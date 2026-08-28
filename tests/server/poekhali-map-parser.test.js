'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createParser() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'poekhali-map-parser.js'), 'utf8'), sandbox);
  return sandbox.window.createPoekhaliMapParser({
    config: { maxSegmentOrdinateGapM: 1600 },
    parseNumber: Number,
    normalizeOrdinate: (value) => Math.round(Number(value)),
    getElementsByLocalName: () => [],
    getFirstTextByLocalName: () => '',
    getSectorKey: (value) => String(value),
    normalizeRouteName: (value) => String(value || '').trim().toLowerCase(),
    haversine: (latA, lonA, latB, lonB) => Math.hypot(latB - latA, lonB - lonA) * 111000,
    getProfileDeltaForLength: (grade, length) => Number(grade) * Number(length) / 1000,
  });
}

test('effective JSON section exposes community speeds and control marks to Poekhali', () => {
  const parser = createParser();
  const section = {
    schema_version: '1.0',
    id: 'test-section',
    elements: [{ start_m: 1000, len_m: 2000, grad_permille: 4 }],
    runtime: { coordinate_offset_m: 0, profile_status: 'verified' },
    geometry: { paths: [{ path_id: 'main', sector: 7, points: [
      { chainage_m: 1000, lat: 50, lon: 135 },
      { chainage_m: 2000, lat: 50.005, lon: 135.005 },
      { chainage_m: 3000, lat: 50.01, lon: 135.01 },
    ] }] },
    stations: [], signals: [], whistle_points: [{ name: 'С', km: 1.5, object_kind: 'sign_c' }],
    infrastructure: [{ name: 'КТСМ 2', coordinate_m: 2000, object_kind: 'ktsm', community_origin: 'release', community_version: 4 }],
    control_marks: [{ name: 'НТ', coordinate_m: 2200, object_kind: 'brake_start' }],
    annotations: [],
    community: { version: 4, speedChanges: [
      { version: 2, startM: 1200, endM: 2600, toSpeed: 60, action: 'set' },
      { version: 4, startM: 1800, endM: 2200, toSpeed: 60, action: 'remove' },
    ] },
  };

  const bundle = parser.parseSectionPackage(section, 'test-section');

  assert.deepEqual(JSON.parse(JSON.stringify(bundle.speed.all.map((item) => [item.coordinate, item.end, item.speed]))), [
    [1200, 1800, 60],
    [2200, 2600, 60],
  ]);
  assert.deepEqual(Array.from(bundle.controlMarksBySector['7'], (item) => item.kind), ['sign_c', 'ktsm', 'brake']);
  assert.equal(bundle.controlMarksBySector['7'][1].source, 'community-control');
});
