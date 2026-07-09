import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const sectionDir = path.resolve(process.argv[2] || 'assets/tracker/sections');
const indexPath = path.join(sectionDir, 'index.json');
const errors = [];
const warnings = [];
const EPSILON = 0.001;

function fail(scope, message) {
  errors.push(`${scope}: ${message}`);
}

function warn(scope, message) {
  warnings.push(`${scope}: ${message}`);
}

function releaseGateIssue(section, scope, message) {
  if (section.status === 'verified') fail(scope, message);
  else warn(scope, message);
}

function readJson(filePath, scope) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(scope, `не удалось прочитать JSON (${error.message})`);
    return null;
  }
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function mergeRanges(ranges) {
  const result = [];
  const sorted = ranges
    .filter((range) => isFiniteNumber(range.start_m) && isFiniteNumber(range.end_m))
    .map((range) => ({ start_m: range.start_m, end_m: range.end_m }))
    .sort((a, b) => a.start_m - b.start_m || a.end_m - b.end_m);
  for (const range of sorted) {
    const last = result.at(-1);
    if (last && range.start_m <= last.end_m + EPSILON) {
      last.end_m = Math.max(last.end_m, range.end_m);
    } else {
      result.push(range);
    }
  }
  return result;
}

function sameRanges(left, right) {
  if (left.length !== right.length) return false;
  return left.every((range, index) => (
    Math.abs(range.start_m - right[index].start_m) <= EPSILON
    && Math.abs(range.end_m - right[index].end_m) <= EPSILON
  ));
}

function validateSection(section, expectedId, scope) {
  const requiredFields = [
    'schema_version',
    'section_name',
    'direction',
    'km_start',
    'km_end',
    'generator_format',
    'elements',
    'stations',
    'signals',
    'whistle_points',
    'speed',
    'flags_for_review',
  ];
  for (const field of requiredFields) {
    if (!(field in section)) fail(scope, `отсутствует обязательное поле ${field}`);
  }

  if (section.schema_version !== '1.0') fail(scope, 'schema_version должен быть "1.0"');
  if (section.id !== expectedId) fail(scope, `id ${JSON.stringify(section.id)} не совпадает с index id ${JSON.stringify(expectedId)}`);
  if (section.status !== 'draft' && section.status !== 'verified') fail(scope, 'status должен быть draft или verified');
  if (!section.railway || typeof section.railway.id !== 'string' || typeof section.railway.name !== 'string') {
    fail(scope, 'railway должен содержать id и name');
  }
  if (!isFiniteNumber(section.km_start) || !isFiniteNumber(section.km_end) || section.km_end <= section.km_start) {
    fail(scope, 'km_start/km_end должны задавать возрастающий физический диапазон');
  }
  if (!['А', 'Б'].includes(section.generator_format)) fail(scope, 'generator_format должен быть "А" или "Б"');

  const minM = section.km_start * 1000;
  const maxM = section.km_end * 1000;
  const elementRanges = [];
  let previousEnd = -Infinity;
  if (!Array.isArray(section.elements)) {
    fail(scope, 'elements должен быть массивом');
  } else {
    section.elements.forEach((element, index) => {
      const itemScope = `${scope}.elements[${index}]`;
      if (!isFiniteNumber(element.start_m)) fail(itemScope, 'start_m должен быть числом');
      if (!isFiniteNumber(element.len_m) || element.len_m <= 0) fail(itemScope, 'len_m должен быть положительным числом');
      if (!isFiniteNumber(element.grad_permille) || Math.abs(element.grad_permille) > 50) {
        fail(itemScope, 'grad_permille должен быть числом в правдоподобном диапазоне ±50‰');
      }
      if (typeof element.confidence !== 'string' || !element.confidence) fail(itemScope, 'confidence обязателен');
      if (!isFiniteNumber(element.start_m) || !isFiniteNumber(element.len_m)) return;
      const end = element.start_m + element.len_m;
      if (element.start_m < minM - EPSILON || end > maxM + EPSILON) {
        fail(itemScope, `элемент ${element.start_m}..${end} выходит за ${minM}..${maxM}`);
      }
      if (element.start_m < previousEnd - EPSILON) fail(itemScope, 'элементы пересекаются или идут не по возрастанию');
      previousEnd = Math.max(previousEnd, end);
      elementRanges.push({ start_m: element.start_m, end_m: end });
    });
  }

  if (!Array.isArray(section.stations)) {
    fail(scope, 'stations должен быть массивом');
  } else {
    section.stations.forEach((station, index) => {
      const itemScope = `${scope}.stations[${index}]`;
      if (typeof station.name !== 'string' || !station.name.trim()) fail(itemScope, 'name обязателен');
      if (!isFiniteNumber(station.km)) fail(itemScope, 'km должен быть числом');
      if (typeof station.confidence !== 'string' || !station.confidence) fail(itemScope, 'confidence обязателен');
      if (isFiniteNumber(station.km) && (station.km < section.km_start - EPSILON || station.km > section.km_end + EPSILON)) {
        fail(itemScope, `станция ${station.km} км выходит за диапазон участка`);
      }
    });
  }

  for (const field of ['signals', 'whistle_points', 'flags_for_review']) {
    if (!Array.isArray(section[field])) fail(scope, `${field} должен быть массивом`);
  }

  const speed = section.speed;
  if (!speed || speed.established !== null || speed.source !== 'manual_required') {
    fail(scope, 'speed.established должен быть null, speed.source — manual_required');
  }
  if (!Array.isArray(speed?.permanent_restrictions) || speed.permanent_restrictions.length) {
    fail(scope, 'permanent_restrictions должен оставаться пустым массивом');
  }
  if (!Array.isArray(speed?.temporary_warnings) || speed.temporary_warnings.length) {
    fail(scope, 'temporary_warnings должен оставаться пустым массивом');
  }

  const runtime = section.runtime;
  if (!runtime || runtime.coordinate_kind !== 'official_railway_chainage' || runtime.coordinate_offset_m !== -1000) {
    fail(scope, 'runtime должен хранить official_railway_chainage и coordinate_offset_m=-1000');
  }
  const declaredCoverage = Array.isArray(runtime?.profile_coverage) ? runtime.profile_coverage : [];
  const declaredGaps = Array.isArray(runtime?.profile_gaps) ? runtime.profile_gaps : [];
  const calculatedCoverage = mergeRanges(elementRanges);
  if (!sameRanges(calculatedCoverage, declaredCoverage)) {
    fail(scope, 'runtime.profile_coverage не совпадает с фактическим покрытием elements');
  }
  for (const [kind, ranges] of [['profile_coverage', declaredCoverage], ['profile_gaps', declaredGaps]]) {
    ranges.forEach((range, index) => {
      if (!isFiniteNumber(range.start_m) || !isFiniteNumber(range.end_m) || range.end_m <= range.start_m) {
        fail(`${scope}.runtime.${kind}[${index}]`, 'диапазон должен иметь start_m < end_m');
      }
      if (range.start_m < minM - EPSILON || range.end_m > maxM + EPSILON) {
        fail(`${scope}.runtime.${kind}[${index}]`, 'диапазон выходит за границы участка');
      }
      if (kind === 'profile_gaps' && (typeof range.reason !== 'string' || !range.reason)) {
        fail(`${scope}.runtime.${kind}[${index}]`, 'для gap обязателен reason');
      }
    });
  }

  const coverageAndGaps = [...declaredCoverage, ...declaredGaps]
    .map((range) => ({ start_m: range.start_m, end_m: range.end_m }))
    .sort((a, b) => a.start_m - b.start_m || a.end_m - b.end_m);
  let cursor = minM;
  for (const range of coverageAndGaps) {
    if (range.start_m > cursor + EPSILON) fail(scope, `неописанный разрыв профиля ${cursor}..${range.start_m}`);
    if (range.start_m < cursor - EPSILON) fail(scope, `coverage/gap пересекаются у ${range.start_m}`);
    cursor = Math.max(cursor, range.end_m);
  }
  if (cursor < maxM - EPSILON) fail(scope, `неописанный хвост профиля ${cursor}..${maxM}`);

  if (section.status === 'verified') {
    const reviewFlags = Array.isArray(section.flags_for_review) ? section.flags_for_review : [];
    const elements = Array.isArray(section.elements) ? section.elements : [];
    const stations = Array.isArray(section.stations) ? section.stations : [];
    if (reviewFlags.length) fail(scope, 'verified требует пустой flags_for_review');
    if (declaredGaps.length) fail(scope, 'verified не допускает runtime.profile_gaps');
    if (declaredCoverage.length !== 1
        || Math.abs(declaredCoverage[0].start_m - minM) > EPSILON
        || Math.abs(declaredCoverage[0].end_m - maxM) > EPSILON) {
      fail(scope, 'verified требует единого полного profile_coverage от km_start до km_end');
    }
    const unverifiedElement = elements.findIndex((element) => element.confidence !== 'verified');
    if (unverifiedElement !== -1) fail(scope, `verified требует elements[].confidence=verified (первый: ${unverifiedElement})`);
    const unverifiedStation = stations.findIndex((station) => station.confidence !== 'verified');
    if (unverifiedStation !== -1) fail(scope, `verified требует stations[].confidence=verified (первая: ${unverifiedStation})`);
    if (runtime?.profile_status !== 'pdf_verified') fail(scope, 'verified требует runtime.profile_status=pdf_verified');
    if (section.geometry?.status !== 'field_run_verified') fail(scope, 'verified требует geometry.status=field_run_verified');
    const pdfProvenance = Array.isArray(section.provenance)
      ? section.provenance.find((item) => item?.kind === 'regime_map_pdf')
      : null;
    if (!pdfProvenance
        || !/^[a-f0-9]{64}$/i.test(String(pdfProvenance.sha256 || ''))
        || !Number.isInteger(pdfProvenance.pages)
        || pdfProvenance.pages <= 0
        || pdfProvenance.role !== 'authoritative_map_profile_verified') {
      fail(scope, 'verified требует PDF provenance с sha256, pages и role=authoritative_map_profile_verified');
    }
  }

  const geometry = section.geometry;
  if (!geometry || !Array.isArray(geometry.paths) || !geometry.paths.length) {
    fail(scope, 'geometry.paths должен содержать хотя бы один GPS-путь');
    return { elements: elementRanges.length, geometryPoints: 0 };
  }
  const pathIds = new Set();
  const pathDetails = new Map();
  let geometryPoints = 0;
  for (const [pathIndex, geometryPath] of geometry.paths.entries()) {
    const pathScope = `${scope}.geometry.paths[${pathIndex}]`;
    if (typeof geometryPath.path_id !== 'string' || !geometryPath.path_id) fail(pathScope, 'path_id обязателен');
    if (pathIds.has(geometryPath.path_id)) fail(pathScope, `дублируется path_id ${geometryPath.path_id}`);
    pathIds.add(geometryPath.path_id);
    if (!Number.isInteger(geometryPath.sector)) fail(pathScope, 'sector должен быть целым числом');
    if (!Array.isArray(geometryPath.points) || geometryPath.points.length < 2) {
      fail(pathScope, 'нужно минимум две GPS-точки');
      continue;
    }
    let previousChainage = -Infinity;
    let minimumChainage = Infinity;
    let maximumChainage = -Infinity;
    geometryPath.points.forEach((point, pointIndex) => {
      const pointScope = `${pathScope}.points[${pointIndex}]`;
      geometryPoints += 1;
      if (!isFiniteNumber(point.lat) || point.lat < -90 || point.lat > 90) fail(pointScope, 'некорректная lat');
      if (!isFiniteNumber(point.lon) || point.lon < -180 || point.lon > 180) fail(pointScope, 'некорректная lon');
      if (!isFiniteNumber(point.ordinate) || !isFiniteNumber(point.chainage_m)) fail(pointScope, 'ordinate и chainage_m обязательны');
      if (isFiniteNumber(point.ordinate) && isFiniteNumber(point.chainage_m)
          && Math.abs(point.chainage_m - (point.ordinate + 1000)) > EPSILON) {
        fail(pointScope, 'chainage_m должен равняться legacy ordinate + 1000');
      }
      if (point.sector !== geometryPath.sector) fail(pointScope, 'sector точки не совпадает с sector пути');
      if (point.path_id !== geometryPath.path_id) fail(pointScope, 'path_id точки не совпадает с path_id пути');
      if (point.chainage_m < previousChainage - EPSILON) fail(pointScope, 'GPS-точки должны идти по возрастанию chainage_m');
      if (isFiniteNumber(point.chainage_m)) {
        minimumChainage = Math.min(minimumChainage, point.chainage_m);
        maximumChainage = Math.max(maximumChainage, point.chainage_m);
        if (point.chainage_m < minM - EPSILON || point.chainage_m > maxM + EPSILON) {
          releaseGateIssue(section, pointScope, 'GPS-точка выходит за физический диапазон участка');
        }
      }
      previousChainage = point.chainage_m;
    });
    pathDetails.set(geometryPath.path_id, {
      sector: geometryPath.sector,
      minimumChainage,
      maximumChainage,
    });
  }

  if (!Array.isArray(runtime?.route_legs) || !runtime.route_legs.length) {
    fail(scope, 'runtime.route_legs должен содержать хотя бы одно звено');
  } else {
    runtime.route_legs.forEach((leg, index) => {
      const legScope = `${scope}.runtime.route_legs[${index}]`;
      if (!pathIds.has(leg.path_id)) fail(legScope, `неизвестный path_id ${leg.path_id}`);
      if (!isFiniteNumber(leg.from_chainage_m) || !isFiniteNumber(leg.to_chainage_m)) {
        fail(legScope, 'from_chainage_m/to_chainage_m обязательны');
        return;
      }
      const pathDetail = pathDetails.get(leg.path_id);
      if (pathDetail) {
        if (leg.sector !== pathDetail.sector) fail(legScope, 'sector звена не совпадает с geometry path');
        const legIsCovered = [leg.from_chainage_m, leg.to_chainage_m].every((chainage) => (
          chainage >= pathDetail.minimumChainage - EPSILON
          && chainage <= pathDetail.maximumChainage + EPSILON
        ));
        if (!legIsCovered) {
          releaseGateIssue(
            section,
            legScope,
            `границы звена не покрыты GPS-путём ${pathDetail.minimumChainage}..${pathDetail.maximumChainage}`,
          );
        }
      }
    });
  }
  if (!pathIds.has(runtime?.default_path_id)) fail(scope, `runtime.default_path_id ${runtime?.default_path_id} не найден в geometry.paths`);
  if (section.status === 'draft') warn(scope, `draft; profile_status=${runtime?.profile_status || 'unknown'}, flags=${section.flags_for_review.length}`);
  return { elements: elementRanges.length, geometryPoints };
}

if (!fs.existsSync(indexPath)) {
  console.error(`Не найден ${indexPath}`);
  process.exit(1);
}

const index = readJson(indexPath, 'index.json');
if (!index) process.exit(1);
if (index.schema_version !== '1.0') fail('index.json', 'schema_version должен быть "1.0"');
if (!Array.isArray(index.sections) || !index.sections.length) fail('index.json', 'sections должен быть непустым массивом');
if (!Array.isArray(index.routes) || !index.routes.length) fail('index.json', 'routes должен быть непустым массивом');

const sectionIds = new Set();
const referencedFiles = new Set();
let totalElements = 0;
let totalGeometryPoints = 0;
for (const [indexPosition, entry] of (index.sections || []).entries()) {
  const scope = `index.sections[${indexPosition}]`;
  if (typeof entry.id !== 'string' || !entry.id) fail(scope, 'id обязателен');
  if (sectionIds.has(entry.id)) fail(scope, `дублируется id ${entry.id}`);
  sectionIds.add(entry.id);
  if (typeof entry.file !== 'string' || path.basename(entry.file) !== entry.file || !entry.file.endsWith('.json')) {
    fail(scope, 'file должен быть локальным именем .json без каталогов');
    continue;
  }
  referencedFiles.add(entry.file);
  const filePath = path.join(sectionDir, entry.file);
  if (!fs.existsSync(filePath)) {
    fail(scope, `файл ${entry.file} не найден`);
    continue;
  }
  const section = readJson(filePath, entry.file);
  if (!section) continue;
  const counts = validateSection(section, entry.id, entry.file);
  const mirrors = [
    ['status', entry.status, section.status],
    ['section_name', entry.section_name, section.section_name],
    ['direction', entry.direction, section.direction],
    ['profile_status', entry.profile_status, section.runtime?.profile_status],
    ['geometry_status', entry.geometry_status, section.geometry?.status],
  ];
  for (const [field, catalogValue, sectionValue] of mirrors) {
    if (catalogValue !== sectionValue) {
      fail(scope, `${field} каталога ${JSON.stringify(catalogValue)} не совпадает с файлом ${JSON.stringify(sectionValue)}`);
    }
  }
  for (const field of ['km_start', 'km_end']) {
    if (!isFiniteNumber(entry[field]) || !isFiniteNumber(section[field]) || Math.abs(entry[field] - section[field]) > EPSILON) {
      fail(scope, `${field} каталога не совпадает с файлом`);
    }
  }
  totalElements += counts.elements;
  totalGeometryPoints += counts.geometryPoints;
}

for (const fileName of fs.readdirSync(sectionDir).filter((name) => name.endsWith('.json') && name !== 'index.json')) {
  if (!referencedFiles.has(fileName)) fail('index.json', `файл ${fileName} не указан в sections`);
}

const routeIds = new Set();
for (const [routeIndex, route] of (index.routes || []).entries()) {
  const scope = `index.routes[${routeIndex}]`;
  if (typeof route.id !== 'string' || !route.id) fail(scope, 'id обязателен');
  if (routeIds.has(route.id)) fail(scope, `дублируется id ${route.id}`);
  routeIds.add(route.id);
  if ('status' in route) fail(scope, 'status маршрута запрещён: готовность вычисляется только из section_ids');
  if (!Array.isArray(route.variants) || !route.variants.length) {
    fail(scope, 'variants должен быть непустым массивом');
    continue;
  }
  const variantIds = new Set();
  for (const [variantIndex, variant] of route.variants.entries()) {
    const variantScope = `${scope}.variants[${variantIndex}]`;
    if (typeof variant.id !== 'string' || !variant.id) fail(variantScope, 'id обязателен');
    if (variantIds.has(variant.id)) fail(variantScope, `дублируется id ${variant.id}`);
    variantIds.add(variant.id);
    if ('status' in variant) fail(variantScope, 'status варианта запрещён: готовность вычисляется только из section_ids');
    if (!Array.isArray(variant.section_ids) || !variant.section_ids.length) {
      fail(variantScope, 'section_ids должен быть непустым массивом');
      continue;
    }
    variant.section_ids.forEach((sectionId) => {
      if (!sectionIds.has(sectionId)) fail(variantScope, `неизвестный section_id ${sectionId}`);
    });
  }
  if (!variantIds.has(route.default_variant)) fail(scope, `default_variant ${route.default_variant} не найден`);
}

if (warnings.length) {
  console.log(`Draft notices (${warnings.length}):`);
  for (const message of warnings) console.log(`- ${message}`);
}

if (errors.length) {
  console.error(`Validation failed (${errors.length}):`);
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log(
  `Validated ${sectionIds.size} section files, ${(index.routes || []).length} routes, `
  + `${totalElements} profile elements and ${totalGeometryPoints} GPS points.`,
);
