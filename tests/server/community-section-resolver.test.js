'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCommunitySection } = require('../../server/community-section-resolver');

function release(version, kind, change) {
  return {
    id: `release:${version}`,
    proposalId: `proposal:${version}`,
    version,
    status: 'published',
    createdAt: `2026-08-28T0${version}:00:00.000Z`,
    payload: { kind, title: `Правка ${version}`, change },
  };
}

test('resolves profile, speed and object releases without mutating the source section', () => {
  const source = {
    id: 'test-section',
    schema_version: '1.0',
    elements: [{ start_m: 1000, len_m: 1000, grad_permille: 18, confidence: 'source' }],
    stations: [{ name: 'Старая', km: 1 }],
    signals: [],
    whistle_points: [],
    runtime: { profile_status: 'pdf_verified' },
  };
  const resolved = resolveCommunitySection(source, [
    release(1, 'profile', { editor: 'visual-v1', startM: 1200, endM: 1600, toGrade: 12 }),
    release(2, 'speed', { editor: 'visual-v1', startM: 1300, endM: 1800, fromSpeed: 40, toSpeed: 60, action: 'set' }),
    release(3, 'object', {
      editor: 'visual-v1', action: 'add', coordinateM: 1500,
      object: { kind: 'brake_start', collection: 'control_marks', name: 'НТ', direction: 'both' },
    }),
  ]);

  assert.equal(source.elements.length, 1);
  assert.equal(source.elements[0].grad_permille, 18);
  assert.deepEqual(resolved.elements.map((item) => [item.start_m, item.len_m, item.grad_permille]), [
    [1000, 200, 18], [1200, 400, 12], [1600, 400, 18],
  ]);
  assert.equal(resolved.control_marks[0].name, 'НТ');
  assert.equal(resolved.control_marks[0].community_key, 'release:release:3');
  assert.equal(resolved.community.version, 3);
  assert.equal(resolved.community.releaseCount, 3);
  assert.equal(resolved.community.speedChanges[0].toSpeed, 60);
  assert.equal(resolved.community.objects.some((item) => item.kind === 'brake_start' && item.coordinateM === 1500), true);
});

test('keeps stable object identity across update, collection move and removal', () => {
  const source = {
    id: 'test-section', schema_version: '1', elements: [],
    stations: [{ name: 'Разъезд', km: 10 }], signals: [], whistle_points: [], runtime: {},
  };
  const resolved = resolveCommunitySection(source, [
    release(1, 'object', {
      editor: 'visual-v1', action: 'update', coordinateM: 10100,
      sourceObject: { collection: 'stations', index: 0, objectKey: 'base:stations:0' },
      object: { kind: 'signal_input', collection: 'signals', name: 'Входной Н', direction: 'odd' },
    }),
    release(2, 'object', {
      editor: 'visual-v1', action: 'remove', coordinateM: 10100,
      sourceObject: { collection: 'signals', index: 0, objectKey: 'base:stations:0' },
    }),
  ]);

  assert.equal(resolved.stations.length, 0);
  assert.equal(resolved.signals.length, 0);
  assert.equal(resolved.community.releaseCount, 2);
});

test('records a skipped release when its object target no longer exists', () => {
  const source = { id: 'test-section', schema_version: '1', elements: [], stations: [], runtime: {} };
  const resolved = resolveCommunitySection(source, [release(1, 'object', {
    editor: 'visual-v1', action: 'remove', coordinateM: 1000,
    sourceObject: { collection: 'stations', index: 4, objectKey: 'base:stations:4' },
  })]);
  assert.equal(resolved.community.releaseCount, 0);
  assert.equal(resolved.community.skipped[0].reason, 'target_missing_or_invalid');
});

test('replaces one geometry fragment and keeps source geometry immutable', () => {
  const source = {
    id: 'test-section', schema_version: '1', elements: [], runtime: {},
    geometry: {
      status: 'draft',
      paths: [{
        path_id: 'main', sector: 1, points: [
          { chainage_m: 1000, ordinate: 0, lat: 50, lon: 135 },
          { chainage_m: 1500, ordinate: 500, lat: 50.005, lon: 135.005 },
          { chainage_m: 2000, ordinate: 1000, lat: 50.01, lon: 135.01 },
        ],
      }],
    },
  };
  const resolved = resolveCommunitySection(source, [release(1, 'geometry', {
    editor: 'visual-v1', action: 'replace_fragment', pathId: 'main', startM: 1000, endM: 2000,
    points: [
      { chainageM: 1000, ordinate: 0, lat: 50, lon: 135 },
      { chainageM: 1500, ordinate: 500, lat: 50.006, lon: 135.007 },
      { chainageM: 2000, ordinate: 1000, lat: 50.01, lon: 135.01 },
    ],
  })]);

  assert.equal(source.geometry.paths[0].points[1].lat, 50.005);
  assert.equal(resolved.geometry.paths[0].points[1].lat, 50.006);
  assert.equal(resolved.geometry.paths[0].points[1].community_version, 1);
  assert.equal(resolved.geometry.status, 'community_published');
  assert.equal(resolved.community.releaseCount, 1);
});

test('rollback release rebuilds the section without deleting the original release history', () => {
  const source = {
    id: 'test-section', schema_version: '1',
    elements: [{ start_m: 1000, len_m: 1000, grad_permille: 18 }],
    stations: [], runtime: { profile_status: 'verified' },
  };
  const profileRelease = release(1, 'profile', {
    editor: 'visual-v1', startM: 1200, endM: 1600, toGrade: 12,
  });
  const rollbackRelease = release(2, 'section', {
    editor: 'rollback-v1', action: 'rollback', targetReleaseId: profileRelease.id,
  });

  const resolved = resolveCommunitySection(source, [profileRelease, rollbackRelease]);

  assert.deepEqual(resolved.elements.map((item) => [item.start_m, item.len_m, item.grad_permille]), [[1000, 1000, 18]]);
  assert.equal(resolved.community.version, 2);
  assert.equal(resolved.community.releaseCount, 2);
  assert.equal(resolved.community.activeReleaseCount, 0);
  assert.equal(resolved.community.rollbackCount, 1);
  assert.equal(resolved.community.history.find((item) => item.id === profileRelease.id).state, 'rolled_back');
  assert.equal(resolved.community.history.find((item) => item.id === rollbackRelease.id).targetReleaseId, profileRelease.id);
});
