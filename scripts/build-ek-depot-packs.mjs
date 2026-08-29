import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogDir = path.join(root, 'assets', 'catalog');
const packDir = path.join(catalogDir, 'depot-packs');
const trackerIndexPath = path.join(root, 'assets', 'tracker', 'sections', 'index.json');
const sourceId = 'legacy-ek-bloknot-069';

const ROUTE_DEPOTS = {
  'ek069-vikhorevka-gyrshelun-sayanskaya': [
    'rzd:east-siberian:tche-9:vikhorevka',
    'rzd:east-siberian:tche-1:taishet',
    'rzd:east-siberian:tche-2:nizhneudinsk',
    'rzd:east-siberian:tche-3:zima',
    'rzd:east-siberian:tche-5:irkutsk-sortirovochnyi',
    'rzd:east-siberian:tche-6:slyudyanka',
    'rzd:east-siberian:tche-7:ulan-ude',
    'rzd:transbaikal:tche-1:khilok',
    'rzd:transbaikal:tche-3:chita',
  ],
  'ek069-vladivostok-obluchye': [
    'rzd:dvost:tche-6:ussuriisk',
    'rzd:dvost:tche-4:ruzhino',
    'rzd:dvost:tche-2:khabarovsk-ii',
    'rzd:dvost:tche-1:obluche',
  ],
  'ek069-voynovka-yekaterinburg': [
    'rzd:sverdlovsk:tche-7:voinovka',
    'rzd:sverdlovsk:tche-6:sverdlovsk-passazhirskii',
    'rzd:sverdlovsk:tche-5:sverdlovsk-sortirovochnyi',
  ],
  'ek069-irkutsk-slyudyanka': [
    'rzd:east-siberian:tche-5:irkutsk-sortirovochnyi',
    'rzd:east-siberian:tche-6:slyudyanka',
  ],
  'ek069-komsomolsk-tche-9': [
    'rzd:dvost:tche-9:komsomolsk-na-amure',
  ],
  'ek069-konosha-sosnogorsk': [
    'rzd:north:tche-13:nyandoma',
    'rzd:north:tche-19:kotlas',
    'rzd:north:tche-21:sosnogorsk',
  ],
  'ek069-mariinsk-irkutsk': [
    'rzd:west-siberian:tche-12:taiga',
    'rzd:krasnoyarsk:tche-1:bogotol',
    'rzd:krasnoyarsk:tche-5:achinsk-i',
    'rzd:krasnoyarsk:tche-2:krasnoyarsk-glavnyi',
    'rzd:krasnoyarsk:tche-3:ilanskaya',
    'rzd:east-siberian:tche-1:taishet',
    'rzd:east-siberian:tche-2:nizhneudinsk',
    'rzd:east-siberian:tche-3:zima',
    'rzd:east-siberian:tche-5:irkutsk-sortirovochnyi',
  ],
  'ek069-ruzhino-freight': [
    'rzd:dvost:tche-4:ruzhino',
  ],
  'ek069-ruzhino-pass-8170': [
    'rzd:dvost:tche-4:ruzhino',
  ],
  'ek069-taishet-gyrshelun': [
    'rzd:east-siberian:tche-1:taishet',
    'rzd:east-siberian:tche-2:nizhneudinsk',
    'rzd:east-siberian:tche-3:zima',
    'rzd:east-siberian:tche-5:irkutsk-sortirovochnyi',
    'rzd:east-siberian:tche-6:slyudyanka',
    'rzd:east-siberian:tche-7:ulan-ude',
    'rzd:transbaikal:tche-1:khilok',
    'rzd:transbaikal:tche-3:chita',
  ],
  'ek069-taksimo-yuktali-freight': [
    'rzd:east-siberian:tche-12:severobaikalsk',
    'rzd:east-siberian:tche-14:novaya-chara',
    'rzd:dvost:tche-11:tynda',
  ],
  'ek069-tynda-verkhnezeysk': [
    'rzd:dvost:tche-11:tynda',
  ],
  'ek069-tynda-komsomolsk-izvestkovaya': [
    'rzd:dvost:tche-11:tynda',
    'rzd:dvost:tche-13:novyi-urgal',
    'rzd:dvost:tche-9:komsomolsk-na-amure',
  ],
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function unique(values) {
  return [...new Set(values)];
}

function depotPackFile(depotId) {
  return `depot-packs/${depotId.replace(/^rzd:/, 'rzd:').replaceAll(':', '-')}.json`;
}

function routeSectionIds(route) {
  return unique((route.variants || []).flatMap((variant) => variant.section_ids || []));
}

const trackerIndex = readJson(trackerIndexPath);
const trackerRoutes = new Map((trackerIndex.routes || []).map((route) => [route.id, route]));
const trackerSections = new Map((trackerIndex.sections || []).map((section) => [section.id, section]));
const depotPath = path.join(catalogDir, 'depots.json');
const depotDocument = readJson(depotPath);
const depots = new Map((depotDocument.depots || []).map((depot) => [depot.id, depot]));
const catalogIndexPath = path.join(catalogDir, 'index.json');
const catalogIndex = readJson(catalogIndexPath);
const sourcesPath = path.join(catalogDir, 'sources.json');
const sources = readJson(sourcesPath);

for (const routeId of Object.keys(ROUTE_DEPOTS)) {
  if (!trackerRoutes.has(routeId)) throw new Error(`Unknown tracker route: ${routeId}`);
  for (const depotId of ROUTE_DEPOTS[routeId]) {
    if (!depots.has(depotId)) throw new Error(`Unknown depot ${depotId} for ${routeId}`);
  }
}

if (!(sources.sources || []).some((source) => source.id === sourceId)) {
  sources.sources.push({
    id: sourceId,
    kind: 'imported_legacy_database',
    title: 'Каталог ЭК приложения «Блокнот машиниста» 0.6.9',
    local_path: 'assets/tracker/sections/index.json',
    imported_at: '2026-08-30',
    supports: ['legacy_ek_routes', 'depot_route_discovery'],
    limitations: 'Привязка к депо показывает наличие ЭК на коридоре, но не подтверждает действующее плечо обслуживания. Все импортированные участки остаются draft до ручной и полевой проверки.',
  });
}

const routesByDepot = new Map();
for (const [routeId, depotIds] of Object.entries(ROUTE_DEPOTS)) {
  for (const depotId of depotIds) {
    if (!routesByDepot.has(depotId)) routesByDepot.set(depotId, []);
    routesByDepot.get(depotId).push(routeId);
  }
}

const packFiles = new Set(catalogIndex.files?.depot_packs || []);
fs.mkdirSync(packDir, { recursive: true });

for (const [depotId, ekRouteIds] of routesByDepot) {
  const depot = depots.get(depotId);
  const relativePackFile = depot.pack_file || depotPackFile(depotId);
  const packPath = path.join(catalogDir, relativePackFile);
  const existing = fs.existsSync(packPath) ? readJson(packPath) : null;
  const existingRouteIds = existing?.route_ids || [];
  const routeIds = unique([...existingRouteIds, ...ekRouteIds]);
  const sectionIds = unique([
    ...(existing?.section_ids || []),
    ...routeIds.flatMap((routeId) => routeSectionIds(trackerRoutes.get(routeId))),
  ]);
  const existingArms = existing?.service_arms || [];
  const existingArmIds = new Set(existingArms.map((arm) => arm.id));
  const ekArms = ekRouteIds
    .filter((routeId) => !existingArmIds.has(routeId))
    .map((routeId) => {
      const route = trackerRoutes.get(routeId);
      return {
        id: routeId,
        name: String(route.name || routeId).replace(/\s*\(ЭК 0\.6\.9\)\s*$/, ''),
        description: 'Импортированная ЭК 0.6.9 · требуется проверка плеча и данных',
        route_options: [{
          id: 'legacy-ek',
          name: 'Открыть ЭК',
          tracker_map_id: routeId,
          entry_station: depot.name,
        }],
      };
    });
  const allSectionsVerified = sectionIds.every((sectionId) => trackerSections.get(sectionId)?.status === 'verified');
  const pack = {
    schema_version: '1.0',
    id: existing?.id || `pack:${depotId}`,
    depot_id: depotId,
    name: existing?.name || [depot.name, depot.code].filter(Boolean).join(' '),
    status: existing?.status || 'pilot_draft',
    updated_at: '2026-08-30',
    source_ids: unique([...(existing?.source_ids || []), sourceId]),
    route_ids: routeIds,
    section_ids: sectionIds,
    service_arms: [...existingArms, ...ekArms],
    readiness: {
      manual_preview_data: true,
      live_gps_data: true,
      all_sections_verified: allSectionsVerified,
    },
    note: 'ЭК показаны в депо по прохождению соответствующего маршрутного коридора. Это помогает найти доступную карту, но не подтверждает организационные границы действующего плеча обслуживания.',
  };
  writeJson(packPath, pack);
  packFiles.add(relativePackFile.replaceAll('\\', '/'));
  depot.status = 'pack_available';
  depot.pack_file = relativePackFile.replaceAll('\\', '/');
  depot.source_ids = unique([...(depot.source_ids || []), sourceId]);
}

catalogIndex.updated_at = '2026-08-30';
catalogIndex.files.depot_packs = [...packFiles].sort((left, right) => left.localeCompare(right));
writeJson(sourcesPath, sources);
writeJson(depotPath, depotDocument);
writeJson(catalogIndexPath, catalogIndex);

console.log(`Built ${routesByDepot.size} depot packs for ${Object.keys(ROUTE_DEPOTS).length} EK routes.`);
