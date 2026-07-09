import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets', 'tracker', 'sections');
const validator = path.join(root, 'scripts', 'validate-tracker-sections.mjs');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tracker-sections-validator-'));
const fixtureDir = path.join(tempRoot, 'sections');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, fileName), 'utf8'));
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(fixtureDir, fileName), JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function runValidator() {
  return spawnSync(process.execPath, [validator, fixtureDir], {
    cwd: root,
    encoding: 'utf8',
  });
}

function expectSuccess(label) {
  const result = runValidator();
  if (result.status !== 0) {
    throw new Error(`${label} failed unexpectedly:\n${result.stdout}\n${result.stderr}`);
  }
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
  const originalIndex = readJson('index.json');
  const firstEntry = originalIndex.sections[0];
  const originalSection = readJson(firstEntry.file);

  expectSuccess('baseline catalog');

  const mismatchedIndex = structuredClone(originalIndex);
  mismatchedIndex.sections[0].status = 'verified';
  writeJson('index.json', mismatchedIndex);
  expectFailure('catalog/file status mismatch', 'status каталога');

  const unsafeIndex = structuredClone(originalIndex);
  unsafeIndex.sections[0].status = 'verified';
  const unsafeSection = structuredClone(originalSection);
  unsafeSection.status = 'verified';
  writeJson('index.json', unsafeIndex);
  writeJson(firstEntry.file, unsafeSection);
  expectFailure('unsafe verified section', 'verified требует пустой flags_for_review');

  const overrideIndex = structuredClone(originalIndex);
  overrideIndex.routes[0].status = 'verified';
  writeJson('index.json', overrideIndex);
  writeJson(firstEntry.file, originalSection);
  expectFailure('route status override', 'status маршрута запрещён');

  console.log('Tracker section validator release-gate smoke passed.');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
