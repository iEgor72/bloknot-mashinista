import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const stationNames = require(path.join(root, 'scripts', 'poekhali-station-names.js'));

const sectionDir = path.join(root, 'assets', 'tracker', 'sections');
const sectionFiles = fs.readdirSync(sectionDir)
  .filter((name) => name.endsWith('.json') && name !== 'index.json');

const audited = [];
for (const file of sectionFiles) {
  const section = JSON.parse(fs.readFileSync(path.join(sectionDir, file), 'utf8'));
  for (const station of Array.isArray(section.stations) ? section.stations : []) {
    if (station.confidence !== 'legacy_label_truncated') continue;
    const raw = String(station.name || '').trim();
    const coordinate = Number(station.km) * 1000;
    const human = stationNames.formatHumanObjectName(raw, 'station', coordinate);
    if (!human || (raw === raw.toUpperCase() && human === raw)) {
      throw new Error(`${file}: legacy station label was not expanded: ${raw}`);
    }
    audited.push({ file, raw, human });
  }
}

const expected = new Map([
  ['ЭЛЬДИГ@64330', 'Эльдиган'],
  ['ГАЛИЦК@156098', 'Галицкий'],
  ['ГУРСКО@115818', 'Гурская'],
  ['САГДЖЕ@132615', 'Сагджему'],
  ['НОВЫЙ@192520', 'Новый Кузнецовский'],
  ['НОВЫЙ@3303732', 'Новый Ургал'],
  ['УРГАЛ@3313510', 'Ургал I'],
  ['ЧЕМЧУК@3325150', 'Чемчуко'],
  ['МУКУНГ@3356576', 'Мукунга'],
  ['ТАЛИДЖ@3467706', 'Талиджак'],
  ['УРКАЛЬ@3483069', 'Уркальту'],
  ['СЕКТАЛ@3525751', 'Сектали'],
  ['БЛОКПО@9928', 'Блок-пост 9 км'],
  ['197 КМ@198210', 'Блок-пост 197 км'],
  ['303 КМ@304680', 'Разъезд 303 км'],
  ['N 18@193650', 'Разъезд 18 км'],
  ['№21@224000', 'Разъезд 21 км']
]);

for (const [sample, wanted] of expected) {
  const separator = sample.lastIndexOf('@');
  const raw = sample.slice(0, separator);
  const coordinate = Number(sample.slice(separator + 1));
  const actual = stationNames.formatHumanObjectName(raw, 'station', coordinate);
  if (actual !== wanted) throw new Error(`${raw}: expected "${wanted}", got "${actual}"`);
}

const referenceSamples = new Map([
  ['КСМ-Сорт', 'Комсомольск-Сортировочный'],
  ['КСМ-Груз', 'Комсомольск-Грузовой'],
  ['ДВост разъезд', 'Дальневосточный'],
  ['Партизанск. сопки', 'Партизанские Сопки'],
  ['Нов Кузнецовский', 'Новый Кузнецовский'],
  ['БП 197 км', 'Блок-пост 197 км'],
  ['Кун, БП 197км', 'Кун, блок-пост 197 км']
]);

for (const [raw, wanted] of referenceSamples) {
  const actual = stationNames.formatHumanObjectName(raw, 'station', 0);
  if (actual !== wanted) throw new Error(`${raw}: expected "${wanted}", got "${actual}"`);
}

const reference = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'tracker', 'tch9-reference.json'), 'utf8'));
const referenceNames = new Set((reference.hauls || [])
  .flatMap((haul) => Array.isArray(haul.stations) ? haul.stations : [])
  .map((station) => String(station.name || '').trim())
  .filter(Boolean));
const abbreviationPattern = /(^|[\s,])(КСМ-|БП\s*\d|ДВост\b|Нов\s+Кузнецовский|Партизанск\.)/i;
for (const raw of referenceNames) {
  if (!abbreviationPattern.test(raw)) continue;
  const human = stationNames.formatHumanObjectName(raw, 'station', 0);
  if (abbreviationPattern.test(human)) {
    throw new Error(`Reference station abbreviation was not expanded: ${raw} -> ${human}`);
  }
}

const uniqueRaw = new Set(audited.map((item) => item.raw));
if (audited.length !== 76 || uniqueRaw.size !== 75) {
  throw new Error(`Expected 76 audited labels / 75 unique names, got ${audited.length} / ${uniqueRaw.size}`);
}

console.log(`Station-name audit passed: ${audited.length} labels, ${uniqueRaw.size} unique legacy names.`);
