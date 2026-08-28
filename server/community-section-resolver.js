'use strict';

const OBJECT_COLLECTIONS = [
  'stations',
  'signals',
  'whistle_points',
  'infrastructure',
  'control_marks',
  'annotations',
];

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sectionBaseVersion(section) {
  const source = section || {};
  return `${String(source.schema_version || '')}:${String(source.runtime && source.runtime.profile_status || '')}`;
}

function sectionObjectCoordinate(item) {
  if (!item || typeof item !== 'object') return NaN;
  if (Number.isFinite(Number(item.coordinate_m))) return Math.round(Number(item.coordinate_m));
  if (Number.isFinite(Number(item.chainage_m))) return Math.round(Number(item.chainage_m));
  if (Number.isFinite(Number(item.coordinate))) return Math.round(Number(item.coordinate));
  if (Number.isFinite(Number(item.km))) return Math.round(Number(item.km) * 1000);
  return NaN;
}

function inferSectionObjectKind(collection, item) {
  const rawType = String(item && (item.object_kind || item.type || item.kind) || '').toLowerCase();
  const name = String(item && (item.name || item.note) || '').trim().toUpperCase();
  if (collection === 'stations') return 'station';
  if (collection === 'signals') {
    if (rawType.includes('input') || rawType.includes('вход')) return 'signal_input';
    if (rawType.includes('output') || rawType.includes('выход')) return 'signal_output';
    return 'signal_passage';
  }
  if (collection === 'whistle_points') return name === 'С' || rawType === 'sign_c' ? 'sign_c' : 'whistle';
  if (collection === 'infrastructure') return rawType === 'ktsm' || name.includes('КТСМ') ? 'ktsm' : 'note';
  if (collection === 'control_marks') {
    if (rawType === 'brake' || rawType === 'brake_start' || name === 'НТ') return 'brake_start';
    if (rawType === 'brake_end' || name === 'КТ') return 'brake_end';
    if (rawType === 'neutral' || name === 'ОМ') return 'neutral';
    if (rawType === 'connection') return 'connection';
    return 'throttle';
  }
  if (rawType === 'brake_note') return 'brake_note';
  if (rawType === 'position_note') return 'position_note';
  return 'note';
}

function objectKey(collection, item, index) {
  const explicit = item && (item.community_key || item.object_key);
  return explicit ? String(explicit) : `base:${collection}:${index}`;
}

function prepareObjects(section) {
  const runtime = section.runtime && typeof section.runtime === 'object' ? section.runtime : {};
  OBJECT_COLLECTIONS.forEach((collection) => {
    let source = collection === 'control_marks' ? (section.control_marks || runtime.control_marks) : section[collection];
    if (!Array.isArray(source)) source = [];
    const prepared = source.map((item, index) => ({
      ...item,
      community_key: objectKey(collection, item, index),
      community_origin: item && item.community_origin || 'base',
    }));
    section[collection] = prepared;
    if (collection === 'control_marks' && runtime.control_marks) runtime.control_marks = prepared;
  });
}

function listSectionObjects(section) {
  const result = [];
  OBJECT_COLLECTIONS.forEach((collection) => {
    const source = section && Array.isArray(section[collection]) ? section[collection] : [];
    source.forEach((item, index) => {
      const coordinateM = sectionObjectCoordinate(item);
      if (!Number.isFinite(coordinateM)) return;
      result.push({
        collection,
        index,
        objectKey: objectKey(collection, item, index),
        coordinateM,
        kind: inferSectionObjectKind(collection, item),
        name: String(item && (item.name || item.note) || '').trim(),
        direction: ['odd', 'even'].includes(String(item && item.direction || '').toLowerCase())
          ? String(item.direction).toLowerCase() : 'both',
        origin: String(item && item.community_origin || 'base'),
        releaseId: String(item && item.community_release_id || ''),
        version: Number(item && item.community_version) || 0,
      });
    });
  });
  return result;
}

function releaseMeta(release) {
  const payload = release && release.payload || {};
  const change = payload.change || {};
  return {
    id: String(release && release.id || ''),
    proposalId: String(release && release.proposalId || ''),
    version: Number(release && release.version) || 0,
    kind: String(payload.kind || ''),
    riskLevel: String(payload.riskLevel || 'normal'),
    action: String(change.action || 'set'),
    title: String(payload.title || ''),
    summary: String(payload.summary || ''),
    createdAt: String(release && release.createdAt || ''),
  };
}

function rollbackTargetId(release) {
  const payload = release && release.payload || {};
  const change = payload.change || {};
  if (payload.kind !== 'section' || change.editor !== 'rollback-v1' || change.action !== 'rollback') return '';
  return String(change.targetReleaseId || '');
}

function geometryPaths(section) {
  return section && section.geometry && Array.isArray(section.geometry.paths) ? section.geometry.paths : [];
}

function pathPointChainage(point) {
  if (!point || typeof point !== 'object') return NaN;
  if (Number.isFinite(Number(point.chainage_m))) return Number(point.chainage_m);
  if (Number.isFinite(Number(point.coordinate_m))) return Number(point.coordinate_m);
  if (Number.isFinite(Number(point.ordinate))) return Number(point.ordinate);
  return NaN;
}

function applyGeometryChange(section, change, release) {
  if (String(change.action || '') !== 'replace_fragment') return false;
  const pathId = String(change.pathId || '');
  const path = geometryPaths(section).find((item) => String(item && item.path_id || '') === pathId);
  const replacement = Array.isArray(change.points) ? change.points : [];
  const startM = Number(change.startM);
  const endM = Number(change.endM);
  if (!path || !Array.isArray(path.points) || replacement.length < 3 || !Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM) {
    return false;
  }
  const before = path.points.filter((point) => pathPointChainage(point) < startM);
  const after = path.points.filter((point) => pathPointChainage(point) > endM);
  const prepared = replacement.map((point) => ({
    ...point,
    lat: Number(point.lat),
    lon: Number(point.lon),
    chainage_m: Math.round(Number(point.chainageM == null ? point.chainage_m : point.chainageM)),
    ordinate: Number.isFinite(Number(point.ordinate)) ? Math.round(Number(point.ordinate)) : undefined,
    path_id: pathId,
    sector: path.sector,
    confidence: 'community_published',
    community_release_id: String(release.id || ''),
    community_proposal_id: String(release.proposalId || ''),
    community_version: Number(release.version) || 0,
  }));
  if (prepared.some((point) => !Number.isFinite(point.lat) || !Number.isFinite(point.lon) || !Number.isFinite(point.chainage_m))) return false;
  path.points = before.concat(prepared, after).sort((a, b) => pathPointChainage(a) - pathPointChainage(b));
  path.community_origin = 'release';
  path.community_release_id = String(release.id || '');
  path.community_proposal_id = String(release.proposalId || '');
  path.community_version = Number(release.version) || 0;
  section.geometry.status = 'community_published';
  return true;
}

function applyProfileChange(section, change, release) {
  const startM = Number(change.startM);
  const endM = Number(change.endM);
  const toGrade = Number(change.toGrade);
  if (!Number.isFinite(startM) || !Number.isFinite(endM) || endM <= startM || !Number.isFinite(toGrade)) return false;
  let changed = false;
  const next = [];
  (Array.isArray(section.elements) ? section.elements : []).forEach((item, index) => {
    const itemStart = Number(item && item.start_m);
    const itemLength = Number(item && item.len_m);
    const itemEnd = itemStart + itemLength;
    if (!Number.isFinite(itemStart) || !Number.isFinite(itemLength) || itemLength <= 0 || itemEnd <= startM || itemStart >= endM) {
      next.push(item);
      return;
    }
    changed = true;
    const overlapStart = Math.max(itemStart, startM);
    const overlapEnd = Math.min(itemEnd, endM);
    if (itemStart < overlapStart) next.push({ ...item, len_m: overlapStart - itemStart });
    next.push({
      ...item,
      start_m: overlapStart,
      len_m: overlapEnd - overlapStart,
      grad_permille: toGrade,
      confidence: 'community_published',
      community_release_id: String(release.id || ''),
      community_proposal_id: String(release.proposalId || ''),
      community_version: Number(release.version) || 0,
      community_source_element: String(item.community_source_element || `base:${index}`),
    });
    if (overlapEnd < itemEnd) next.push({ ...item, start_m: overlapEnd, len_m: itemEnd - overlapEnd });
  });
  if (changed) section.elements = next;
  return changed;
}

function findObject(section, sourceObject) {
  const source = sourceObject && typeof sourceObject === 'object' ? sourceObject : {};
  const requestedKey = String(source.objectKey || source.communityKey || '');
  const requestedCollection = String(source.collection || '');
  const requestedIndex = Number(source.index);
  for (const collection of OBJECT_COLLECTIONS) {
    if (requestedCollection && collection !== requestedCollection) continue;
    const items = Array.isArray(section[collection]) ? section[collection] : [];
    const index = items.findIndex((item, itemIndex) => requestedKey
      ? objectKey(collection, item, itemIndex) === requestedKey
      : collection === requestedCollection && itemIndex === requestedIndex);
    if (index >= 0) return { collection, items, index, item: items[index] };
  }
  return null;
}

function objectFromChange(change, release) {
  const value = change.object || {};
  const kind = String(value.kind || 'note');
  const coordinateM = Math.round(Number(change.coordinateM));
  return {
    name: String(value.name || ''),
    note: String(value.name || ''),
    chainage_m: coordinateM,
    coordinate_m: coordinateM,
    direction: String(value.direction || 'both'),
    type: kind,
    object_kind: kind,
    confidence: 'community_published',
    community_key: `release:${String(release.id || '')}`,
    community_origin: 'release',
    community_release_id: String(release.id || ''),
    community_proposal_id: String(release.proposalId || ''),
    community_version: Number(release.version) || 0,
  };
}

function applyObjectChange(section, change, release) {
  const action = String(change.action || '');
  if (action === 'add') {
    const collection = String(change.object && change.object.collection || 'annotations');
    if (!OBJECT_COLLECTIONS.includes(collection) || !Number.isFinite(Number(change.coordinateM))) return false;
    if (!Array.isArray(section[collection])) section[collection] = [];
    section[collection].push(objectFromChange(change, release));
    return true;
  }
  const target = findObject(section, change.sourceObject);
  if (!target) return false;
  if (action === 'remove') {
    target.items.splice(target.index, 1);
    return true;
  }
  if (action !== 'update' || !change.object || !Number.isFinite(Number(change.coordinateM))) return false;
  const destination = String(change.object.collection || target.collection);
  if (!OBJECT_COLLECTIONS.includes(destination)) return false;
  const updated = {
    ...target.item,
    ...objectFromChange(change, release),
    community_key: objectKey(target.collection, target.item, target.index),
    community_origin: target.item.community_origin || 'base',
  };
  target.items.splice(target.index, 1);
  if (!Array.isArray(section[destination])) section[destination] = [];
  section[destination].push(updated);
  return true;
}

function resolveCommunitySection(baseSection, releases) {
  const section = cloneJson(baseSection || {});
  prepareObjects(section);
  const ordered = (Array.isArray(releases) ? releases : [])
    .filter((release) => release && release.status === 'published')
    .sort((a, b) => (Number(a.version) || 0) - (Number(b.version) || 0) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const history = [];
  const skipped = [];
  const speedChanges = [];
  const releaseById = new Map(ordered.map((release) => [String(release.id || ''), release]));
  const rollbackByTarget = new Map();
  let communityVersion = 0;

  ordered.forEach((release) => {
    const targetId = rollbackTargetId(release);
    if (!targetId || rollbackByTarget.has(targetId)) return;
    const target = releaseById.get(targetId);
    if (!target || Number(target.version) >= Number(release.version) || rollbackTargetId(target)) return;
    rollbackByTarget.set(targetId, release);
  });

  ordered.forEach((release) => {
    communityVersion = Math.max(communityVersion, Number(release.version) || 0);
    const payload = release.payload || {};
    const change = payload.change || {};
    const meta = releaseMeta(release);
    const targetId = rollbackTargetId(release);
    if (targetId) {
      const target = releaseById.get(targetId);
      if (!target || Number(target.version) >= Number(release.version) || rollbackTargetId(target) || rollbackByTarget.get(targetId) !== release) {
        skipped.push({ ...meta, targetReleaseId: targetId, reason: 'rollback_target_missing_or_invalid' });
        return;
      }
      const targetMeta = releaseMeta(target);
      history.push({
        ...meta,
        kind: 'rollback',
        state: 'active',
        targetReleaseId: targetId,
        targetVersion: targetMeta.version,
        targetTitle: targetMeta.title,
      });
      return;
    }
    const rollback = rollbackByTarget.get(String(release.id || ''));
    if (rollback) {
      history.push({
        ...meta,
        state: 'rolled_back',
        rolledBackBy: {
          id: String(rollback.id || ''),
          proposalId: String(rollback.proposalId || ''),
          version: Number(rollback.version) || 0,
        },
      });
      return;
    }
    if (change.editor !== 'visual-v1') {
      skipped.push({ ...meta, reason: 'unsupported_change_format' });
      return;
    }
    let applied = false;
    if (payload.kind === 'profile') applied = applyProfileChange(section, change, release);
    else if (payload.kind === 'object') applied = applyObjectChange(section, change, release);
    else if (payload.kind === 'geometry') applied = applyGeometryChange(section, change, release);
    else if (payload.kind === 'speed') {
      speedChanges.push({
        ...meta,
        startM: Number(change.startM),
        endM: Number(change.endM),
        fromSpeed: Number(change.fromSpeed),
        toSpeed: Number(change.toSpeed),
        action: String(change.action || 'set'),
      });
      applied = Number.isFinite(Number(change.startM)) && Number.isFinite(Number(change.endM));
    }
    if (applied) history.push({ ...meta, state: 'active' });
    else skipped.push({ ...meta, reason: 'target_missing_or_invalid' });
  });

  const activeReleaseCount = history.filter((item) => item.kind !== 'rollback' && item.state === 'active').length;
  const rollbackCount = history.filter((item) => item.kind === 'rollback').length;
  section.community = {
    baseVersion: sectionBaseVersion(baseSection),
    version: communityVersion,
    releaseCount: history.length,
    activeReleaseCount,
    rollbackCount,
    history,
    skipped,
    speedChanges,
    objects: listSectionObjects(section),
  };
  return section;
}

module.exports = {
  OBJECT_COLLECTIONS,
  applyGeometryChange,
  inferSectionObjectKind,
  listSectionObjects,
  rollbackTargetId,
  resolveCommunitySection,
  sectionBaseVersion,
  sectionObjectCoordinate,
};
