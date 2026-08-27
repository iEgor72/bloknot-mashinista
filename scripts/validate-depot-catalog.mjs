import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultCatalogDir = path.join(root, 'assets', 'catalog');
const defaultTrackerIndex = path.join(root, 'assets', 'tracker', 'sections', 'index.json');

const DEPOT_STATUSES = new Set(['legacy_unverified', 'verified', 'pack_available', 'retired']);
const PACK_STATUSES = new Set(['draft', 'pilot_draft', 'published', 'retired']);
const DIRECTORATE_STATUSES = new Set(['structural_stub', 'verified']);
const STABLE_ID = /^[a-z0-9][a-z0-9:.-]*$/;

function readJson(filePath, errors, scope) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`${scope}: не удалось прочитать JSON (${error.message})`);
    return null;
  }
}

function resolveCatalogFile(catalogDir, relativePath, errors, scope) {
  if (typeof relativePath !== 'string' || !relativePath) {
    errors.push(`${scope}: путь к файлу обязателен`);
    return null;
  }
  const resolved = path.resolve(catalogDir, relativePath);
  const relative = path.relative(catalogDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    errors.push(`${scope}: путь должен оставаться внутри каталога`);
    return null;
  }
  return resolved;
}

function validateId(value, scope, errors) {
  if (typeof value !== 'string' || !STABLE_ID.test(value)) {
    errors.push(`${scope}: id должен быть стабильной строкой из латиницы, цифр и :.-`);
    return false;
  }
  return true;
}

function collectById(items, scope, errors) {
  const result = new Map();
  if (!Array.isArray(items)) {
    errors.push(`${scope}: должен быть массивом`);
    return result;
  }
  items.forEach((item, index) => {
    const itemScope = `${scope}[${index}]`;
    if (!item || typeof item !== 'object') {
      errors.push(`${itemScope}: должна быть записью`);
      return;
    }
    if (!validateId(item.id, itemScope, errors)) return;
    if (result.has(item.id)) errors.push(`${itemScope}: дублируется id ${item.id}`);
    result.set(item.id, item);
  });
  return result;
}

function validateSourceRefs(item, scope, sourceIds, errors) {
  if (!Array.isArray(item.source_ids) || !item.source_ids.length) {
    errors.push(`${scope}: source_ids должен быть непустым массивом`);
    return;
  }
  const seen = new Set();
  item.source_ids.forEach((sourceId) => {
    if (seen.has(sourceId)) errors.push(`${scope}: дублируется source_id ${sourceId}`);
    seen.add(sourceId);
    if (!sourceIds.has(sourceId)) errors.push(`${scope}: неизвестный source_id ${sourceId}`);
  });
}

function requireUniqueStrings(values, scope, errors) {
  const result = new Set();
  if (!Array.isArray(values) || !values.length) {
    errors.push(`${scope}: должен быть непустым массивом`);
    return result;
  }
  values.forEach((value, index) => {
    if (typeof value !== 'string' || !value) errors.push(`${scope}[${index}]: строковый id обязателен`);
    if (result.has(value)) errors.push(`${scope}: дублируется ${value}`);
    result.add(value);
  });
  return result;
}

export function validateDepotCatalog({ catalogDir = defaultCatalogDir, trackerIndexPath = defaultTrackerIndex } = {}) {
  const errors = [];
  const indexPath = path.join(catalogDir, 'index.json');
  const index = readJson(indexPath, errors, 'index.json');
  const trackerIndex = readJson(trackerIndexPath, errors, 'tracker sections index');
  if (!index || !trackerIndex) return { errors, summary: null };

  if (index.schema_version !== '1.0') errors.push('index.json: schema_version должен быть "1.0"');
  if (index.catalog_status !== 'partial' && index.catalog_status !== 'complete') {
    errors.push('index.json: catalog_status должен быть partial или complete');
  }

  const fileEntries = index.files || {};
  const loadCatalog = (key, scope) => {
    const filePath = resolveCatalogFile(catalogDir, fileEntries[key], errors, `index.files.${key}`);
    return filePath ? readJson(filePath, errors, scope) : null;
  };
  const sourceDocument = loadCatalog('sources', 'sources.json');
  const railwayDocument = loadCatalog('railways', 'railways.json');
  const directorateDocument = loadCatalog('traction_directorates', 'traction-directorates.json');
  const depotDocument = loadCatalog('depots', 'depots.json');
  if (!sourceDocument || !railwayDocument || !directorateDocument || !depotDocument) {
    return { errors, summary: null };
  }

  for (const [name, document] of [
    ['sources.json', sourceDocument],
    ['railways.json', railwayDocument],
    ['traction-directorates.json', directorateDocument],
    ['depots.json', depotDocument],
  ]) {
    if (document.schema_version !== '1.0') errors.push(`${name}: schema_version должен быть "1.0"`);
  }

  const sources = collectById(sourceDocument.sources, 'sources', errors);
  const railways = collectById(railwayDocument.railways, 'railways', errors);
  const directorates = collectById(directorateDocument.traction_directorates, 'traction_directorates', errors);
  const depots = collectById(depotDocument.depots, 'depots', errors);

  sources.forEach((source, id) => {
    if (typeof source.title !== 'string' || !source.title.trim()) errors.push(`sources.${id}: title обязателен`);
    if (source.local_path) {
      const localPath = path.resolve(root, source.local_path);
      const relative = path.relative(root, localPath);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(localPath)) {
        errors.push(`sources.${id}: local_path не найден внутри проекта`);
      }
    }
  });

  railways.forEach((railway, id) => {
    if (typeof railway.name !== 'string' || !railway.name.trim()) errors.push(`railways.${id}: name обязателен`);
    validateSourceRefs(railway, `railways.${id}`, sources, errors);
  });

  directorates.forEach((directorate, id) => {
    if (!railways.has(directorate.railway_id)) {
      errors.push(`traction_directorates.${id}: неизвестный railway_id ${directorate.railway_id}`);
    }
    if (!DIRECTORATE_STATUSES.has(directorate.status)) {
      errors.push(`traction_directorates.${id}: неизвестный status ${directorate.status}`);
    }
    validateSourceRefs(directorate, `traction_directorates.${id}`, sources, errors);
  });

  depots.forEach((depot, id) => {
    const railway = railways.get(depot.railway_id);
    const directorate = directorates.get(depot.traction_directorate_id);
    if (!railway) errors.push(`depots.${id}: неизвестный railway_id ${depot.railway_id}`);
    if (!directorate) {
      errors.push(`depots.${id}: неизвестный traction_directorate_id ${depot.traction_directorate_id}`);
    } else if (directorate.railway_id !== depot.railway_id) {
      errors.push(`depots.${id}: депо и дирекция относятся к разным дорогам`);
    }
    if (!DEPOT_STATUSES.has(depot.status)) errors.push(`depots.${id}: неизвестный status ${depot.status}`);
    if (typeof depot.code !== 'string' || !depot.code.trim()) errors.push(`depots.${id}: code обязателен`);
    if (depot.aliases != null && (!Array.isArray(depot.aliases) || depot.aliases.some((alias) => typeof alias !== 'string' || !alias.trim()))) {
      errors.push(`depots.${id}: aliases должен быть массивом непустых строк`);
    }
    validateSourceRefs(depot, `depots.${id}`, sources, errors);
  });

  const expectedRailways = index.network_snapshot?.railway_count;
  const expectedDirectorates = index.network_snapshot?.regional_traction_directorate_count;
  if (railways.size !== expectedRailways) {
    errors.push(`index.network_snapshot: заявлено ${expectedRailways} дорог, в каталоге ${railways.size}`);
  }
  if (directorates.size !== expectedDirectorates) {
    errors.push(`index.network_snapshot: заявлено ${expectedDirectorates} дирекций, в каталоге ${directorates.size}`);
  }
  if (!sources.has(index.network_snapshot?.source_id)) {
    errors.push(`index.network_snapshot: неизвестный source_id ${index.network_snapshot?.source_id}`);
  }
  if (index.catalog_status === 'complete' && depots.size !== index.network_snapshot?.operating_locomotive_depot_count) {
    errors.push('index.json: complete требует полного количества депо из network_snapshot');
  }

  const trackerSections = collectById(trackerIndex.sections, 'tracker.sections', errors);
  const trackerRoutes = collectById(trackerIndex.routes, 'tracker.routes', errors);
  const trackerMapIds = new Set();
  trackerRoutes.forEach((route, routeId) => {
    const variants = Array.isArray(route.variants) && route.variants.length ? route.variants : [route];
    variants.forEach((variant) => {
      const variantId = String(variant?.id || route.default_variant || 'main');
      trackerMapIds.add(variants.length > 1 ? `${routeId}--${variantId}` : routeId);
    });
  });
  const packPaths = Array.isArray(fileEntries.depot_packs) ? fileEntries.depot_packs : [];
  if (!packPaths.length) errors.push('index.files.depot_packs: нужен хотя бы один пакет');
  const packs = new Map();

  packPaths.forEach((relativePath, indexPosition) => {
    const scope = `depot_packs[${indexPosition}]`;
    const packPath = resolveCatalogFile(catalogDir, relativePath, errors, `index.files.depot_packs[${indexPosition}]`);
    const pack = packPath ? readJson(packPath, errors, relativePath) : null;
    if (!pack) return;
    if (pack.schema_version !== '1.0') errors.push(`${scope}: schema_version должен быть "1.0"`);
    if (!validateId(pack.id, scope, errors)) return;
    if (packs.has(pack.id)) errors.push(`${scope}: дублируется id ${pack.id}`);
    packs.set(pack.id, pack);
    const depot = depots.get(pack.depot_id);
    if (!depot) errors.push(`${scope}: неизвестный depot_id ${pack.depot_id}`);
    else if (depot.status !== 'pack_available') errors.push(`${scope}: депо с пакетом должно иметь status=pack_available`);
    if (!PACK_STATUSES.has(pack.status)) errors.push(`${scope}: неизвестный status ${pack.status}`);
    validateSourceRefs(pack, scope, sources, errors);

    const sectionIds = requireUniqueStrings(pack.section_ids, `${scope}.section_ids`, errors);
    const routeIds = requireUniqueStrings(pack.route_ids, `${scope}.route_ids`, errors);
    sectionIds.forEach((sectionId) => {
      if (!trackerSections.has(sectionId)) errors.push(`${scope}: неизвестный section_id ${sectionId}`);
    });
    routeIds.forEach((routeId) => {
      const route = trackerRoutes.get(routeId);
      if (!route) {
        errors.push(`${scope}: неизвестный route_id ${routeId}`);
        return;
      }
      (route.variants || []).forEach((variant) => {
        (variant.section_ids || []).forEach((sectionId) => {
          if (!sectionIds.has(sectionId)) errors.push(`${scope}: маршрут ${routeId} использует не включённый section_id ${sectionId}`);
        });
      });
    });
    const serviceArms = Array.isArray(pack.service_arms) ? pack.service_arms : [];
    if (!serviceArms.length) errors.push(`${scope}.service_arms: нужен хотя бы один элемент`);
    const armIds = new Set();
    serviceArms.forEach((arm, armIndex) => {
      const armScope = `${scope}.service_arms[${armIndex}]`;
      if (!arm || typeof arm !== 'object') {
        errors.push(`${armScope}: должна быть записью`);
        return;
      }
      if (!validateId(arm.id, armScope, errors)) return;
      if (armIds.has(arm.id)) errors.push(`${armScope}: дублируется id ${arm.id}`);
      armIds.add(arm.id);
      if (typeof arm.name !== 'string' || !arm.name.trim()) errors.push(`${armScope}: name обязателен`);
      const options = Array.isArray(arm.route_options) ? arm.route_options : [];
      if (!options.length) errors.push(`${armScope}.route_options: нужен хотя бы один вариант`);
      const optionIds = new Set();
      options.forEach((option, optionIndex) => {
        const optionScope = `${armScope}.route_options[${optionIndex}]`;
        if (!option || typeof option !== 'object') {
          errors.push(`${optionScope}: должна быть записью`);
          return;
        }
        if (!validateId(option.id, optionScope, errors)) return;
        if (optionIds.has(option.id)) errors.push(`${optionScope}: дублируется id ${option.id}`);
        optionIds.add(option.id);
        if (typeof option.name !== 'string' || !option.name.trim()) errors.push(`${optionScope}: name обязателен`);
        if (typeof option.tracker_map_id !== 'string' || !option.tracker_map_id.trim()) {
          errors.push(`${optionScope}: tracker_map_id обязателен`);
        } else if (!trackerMapIds.has(option.tracker_map_id)) {
          errors.push(`${optionScope}: неизвестный tracker_map_id ${option.tracker_map_id}`);
        }
      });
    });
    const allSectionsVerified = [...sectionIds].every((sectionId) => trackerSections.get(sectionId)?.status === 'verified');
    if (pack.readiness?.all_sections_verified !== allSectionsVerified) {
      errors.push(`${scope}: readiness.all_sections_verified не совпадает со статусами участков`);
    }
  });

  depots.forEach((depot, id) => {
    const hasPack = [...packs.values()].some((pack) => pack.depot_id === id && pack.status !== 'retired');
    if (depot.status === 'pack_available' && !hasPack) errors.push(`depots.${id}: status=pack_available требует пакет`);
    if (depot.status === 'pack_available' && (typeof depot.pack_file !== 'string' || !depot.pack_file)) {
      errors.push(`depots.${id}: status=pack_available требует pack_file`);
    }
  });

  return {
    errors,
    summary: {
      sources: sources.size,
      railways: railways.size,
      tractionDirectorates: directorates.size,
      depots: depots.size,
      depotPacks: packs.size,
    },
  };
}

function runCli() {
  const catalogDir = process.argv[2] ? path.resolve(process.argv[2]) : defaultCatalogDir;
  const trackerIndexPath = process.argv[3] ? path.resolve(process.argv[3]) : defaultTrackerIndex;
  const result = validateDepotCatalog({ catalogDir, trackerIndexPath });
  if (result.errors.length) {
    console.error(`Depot catalog validation failed (${result.errors.length}):`);
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
    return;
  }
  const summary = result.summary;
  console.log(
    `Validated depot catalog: ${summary.railways} railways, ${summary.tractionDirectorates} traction directorates, `
    + `${summary.depots} depot records and ${summary.depotPacks} depot pack.`,
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) runCli();
