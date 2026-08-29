import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets', 'catalog');
const trackerIndex = path.join(root, 'assets', 'tracker', 'sections', 'index.json');
const validator = path.join(root, 'scripts', 'validate-depot-catalog.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'depot-catalog-validator-'));
const fixtureDir = path.join(tempRoot, 'catalog');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, fileName), 'utf8'));
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(fixtureDir, fileName), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function runValidator() {
  return spawnSync(process.execPath, [validator, fixtureDir, trackerIndex], {
    cwd: root,
    encoding: 'utf8',
  });
}

function expectSuccess(label) {
  const result = runValidator();
  if (result.status !== 0) throw new Error(`${label} failed unexpectedly:\n${result.stdout}\n${result.stderr}`);
}

function expectFailure(label, expectedText) {
  const result = runValidator();
  const output = `${result.stdout}\n${result.stderr}`;
  if (result.status === 0 || !output.includes(expectedText)) {
    throw new Error(`${label} did not fail with ${JSON.stringify(expectedText)}:\n${output}`);
  }
}

try {
  fs.cpSync(sourceDir, fixtureDir, { recursive: true });
  const originalRailways = readJson('railways.json');
  const originalDepots = readJson('depots.json');
  const catalogIndex = readJson('index.json');
  const packFile = path.join('depot-packs', 'rzd-dvost-tche-9-komsomolsk-na-amure.json');
  const originalPack = readJson(packFile);

  expectSuccess('baseline catalog');

  const duplicateRailways = structuredClone(originalRailways);
  duplicateRailways.railways.push(structuredClone(duplicateRailways.railways[0]));
  writeJson('railways.json', duplicateRailways);
  expectFailure('duplicate railway', 'дублируется id okt');
  writeJson('railways.json', originalRailways);

  const invalidDepot = structuredClone(originalDepots);
  invalidDepot.depots[0].railway_id = 'missing-railway';
  writeJson('depots.json', invalidDepot);
  expectFailure('invalid depot railway', 'неизвестный railway_id missing-railway');
  writeJson('depots.json', originalDepots);

  const invalidPack = structuredClone(originalPack);
  invalidPack.section_ids[0] = 'missing-section';
  writeJson(packFile, invalidPack);
  expectFailure('invalid pack section', 'неизвестный section_id missing-section');
  writeJson(packFile, originalPack);

  const invalidArmMap = structuredClone(originalPack);
  invalidArmMap.service_arms[0].route_options[0].tracker_map_id = 'missing-map';
  writeJson(packFile, invalidArmMap);
  expectFailure('invalid service arm map', 'неизвестный tracker_map_id missing-map');
  writeJson(packFile, originalPack);

  const unboundRouteId = 'ek069-vladivostok-obluchye';
  for (const relativePackFile of catalogIndex.files.depot_packs) {
    const pack = readJson(relativePackFile);
    if (!pack.route_ids.includes(unboundRouteId)) continue;
    pack.route_ids = pack.route_ids.filter((routeId) => routeId !== unboundRouteId);
    pack.service_arms = pack.service_arms.filter((arm) => arm.id !== unboundRouteId);
    writeJson(relativePackFile, pack);
  }
  expectFailure('unbound imported EK', `tracker.routes.${unboundRouteId}: импортированная ЭК не привязана ни к одному депо`);

  console.log('Depot catalog validator smoke passed.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
