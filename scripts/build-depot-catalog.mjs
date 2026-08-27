import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogDir = path.join(root, 'assets', 'catalog');
const roster = JSON.parse(fs.readFileSync(path.join(catalogDir, 'depot-roster-2022.json'), 'utf8'));
const outputPath = path.join(catalogDir, 'depots.json');
const previous = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const previousByKey = new Map((previous.depots || []).map((depot) => [
  `${depot.railway_id}:${String(depot.code || '').replace(/[^0-9]+/g, '')}:${depot.name}`,
  depot,
]));

const transliteration = new Map(Object.entries({
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ь: '', ъ: '',
}));

function slugify(value) {
  return String(value || '').toLocaleLowerCase('ru-RU')
    .split('').map((char) => transliteration.has(char) ? transliteration.get(char) : char).join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const depots = [];
for (const [railwayId, entries] of Object.entries(roster.railways || {})) {
  for (const [codeNumber, name] of entries) {
    const code = codeNumber ? `ТЧЭ-${codeNumber}` : '';
    const key = `${railwayId}:${codeNumber || ''}:${name}`;
    const existing = previousByKey.get(key) || {};
    const id = codeNumber
      ? `rzd:${railwayId}:tche-${codeNumber}:${slugify(name)}`
      : `rzd:${railwayId}:depot:${slugify(name)}`;
    depots.push({
      id,
      name,
      code,
      ...(code ? {} : { code_unknown: true }),
      railway_id: railwayId,
      traction_directorate_id: `td-${railwayId}`,
      status: existing.status === 'pack_available' ? 'pack_available' : 'source_listed',
      ...(existing.pack_file ? { pack_file: existing.pack_file } : {}),
      ...(existing.aliases ? { aliases: existing.aliases } : {}),
      ...(existing.relationship_note ? { relationship_note: existing.relationship_note } : {}),
      source_ids: Array.from(new Set([...(existing.source_ids || []), roster.source_id])),
    });
  }
}

depots.sort((a, b) => a.railway_id.localeCompare(b.railway_id) || a.name.localeCompare(b.name, 'ru'));
fs.writeFileSync(outputPath, `${JSON.stringify({ schema_version: '1.0', depots }, null, 2)}\n`, 'utf8');
console.log(`Built ${depots.length} depot records from ${roster.source_id}.`);
