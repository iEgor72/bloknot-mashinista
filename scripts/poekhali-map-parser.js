if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('poekhali-map-parser', 'v394');

(function(global) {
  'use strict';

  function createPoekhaliMapParser(deps) {
    deps = deps || {};
    var config = deps.config || {};

    function parseMapXml(xmlText) {
      var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      var parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) throw new Error('Ошибка чтения data.xml');

      var sectorNodes = deps.getElementsByLocalName(doc, 'sector');
      var wpts = [];
      var points = [];

      if (!sectorNodes.length) {
        sectorNodes = [doc];
      }

      for (var sectorIndex = 0; sectorIndex < sectorNodes.length; sectorIndex++) {
        var sectorNode = sectorNodes[sectorIndex];
        var rawSector = sectorNode.getAttribute ? sectorNode.getAttribute('id') : '';
        var sector = deps.parseNumber(rawSector);
        if (!isFinite(sector)) sector = sectorIndex + 1;
        wpts = deps.getElementsByLocalName(sectorNode, 'wpt');

        for (var i = 0; i < wpts.length; i++) {
          var node = wpts[i];
          var lat = deps.parseNumber(node.getAttribute('lat') || deps.getFirstTextByLocalName(node, 'lat'));
          var lon = deps.parseNumber(node.getAttribute('lon') || deps.getFirstTextByLocalName(node, 'lon'));
          var ordinate = deps.normalizeOrdinate(
            deps.getFirstTextByLocalName(node, 'ord') ||
            deps.getFirstTextByLocalName(node, 'name') ||
            node.getAttribute('ord')
          );

          if (!isFinite(lat) || !isFinite(lon) || !isFinite(ordinate)) continue;
          points.push({
            lat: lat,
            lon: lon,
            ordinate: ordinate,
            sector: sector,
            position: points.length
          });
        }
      }

      points.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.ordinate - b.ordinate;
      });

      var unique = [];
      var seen = {};
      for (var j = 0; j < points.length; j++) {
        var key = points[j].sector + ':' + points[j].ordinate;
        if (seen[key]) continue;
        seen[key] = true;
        unique.push(points[j]);
      }

      var segments = [];
      var sectorGroups = {};
      for (var u = 0; u < unique.length; u++) {
        var groupKey = String(unique[u].sector);
        if (!sectorGroups[groupKey]) sectorGroups[groupKey] = [];
        sectorGroups[groupKey].push(unique[u]);
      }

      Object.keys(sectorGroups).forEach(function(sectorKey) {
        var group = sectorGroups[sectorKey];
        for (var k = 0; k < group.length - 1; k++) {
          var a = group[k];
          var b = group[k + 1];
          var ordinateGap = Math.abs(b.ordinate - a.ordinate);
          var geoDistance = deps.haversine(a.lat, a.lon, b.lat, b.lon);
          if (ordinateGap <= 0 || ordinateGap > config.maxSegmentOrdinateGapM || geoDistance > 2200) continue;
          segments.push({
            start: a,
            end: b,
            sector: a.sector,
            length: geoDistance,
            ordinateGap: ordinateGap
          });
        }
      });

      if (unique.length < 2 || !segments.length) {
        throw new Error('Карта ЭК не содержит рабочих участков');
      }

      return {
        points: unique,
        segments: segments
      };
    }

    function indexProfileElevations(points) {
      points.sort(function(a, b) {
        return a.start - b.start;
      });

      var elevation = 0;
      var visualOffset = 0;
      for (var i = 0; i < points.length; i++) {
        var point = points[i];
        point.elevationStart = elevation;
        point.elevationEnd = elevation + point.grade * point.length / 1000;
        elevation = point.elevationEnd;
        point.visualStart = visualOffset;
        point.visualEnd = visualOffset + deps.getProfileDeltaForLength(Number(point.grade), Number(point.length), 1);
        visualOffset = point.visualEnd;
      }
      return points;
    }

    function parseProfileXml(xmlText) {
      var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      var parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) throw new Error('Ошибка чтения profile.xml');

      var sectorNodes = deps.getElementsByLocalName(doc, 'sector');
      if (!sectorNodes.length) sectorNodes = [doc];
      var points = [];
      var bySector = {};

      for (var sectorIndex = 0; sectorIndex < sectorNodes.length; sectorIndex++) {
        var sectorNode = sectorNodes[sectorIndex];
        var rawSector = sectorNode.getAttribute ? sectorNode.getAttribute('id') : '';
        var sector = deps.parseNumber(rawSector);
        if (!isFinite(sector)) sector = sectorIndex;
        var sectorKey = String(sector);
        var nodes = deps.getElementsByLocalName(sectorNode, 'pt');

        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var start = deps.normalizeOrdinate(deps.getFirstTextByLocalName(node, 'start'));
          var length = Math.round(deps.parseNumber(deps.getFirstTextByLocalName(node, 'len')));
          var grade = deps.parseNumber(deps.getFirstTextByLocalName(node, 'grad'));
          if (!isFinite(start) || !isFinite(length) || length <= 0 || !isFinite(grade)) continue;
          var point = {
            start: start,
            end: start + length,
            length: length,
            grade: grade,
            sector: sector
          };
          points.push(point);
          if (!bySector[sectorKey]) bySector[sectorKey] = [];
          bySector[sectorKey].push(point);
        }
      }

      Object.keys(bySector).forEach(function(sectorKey) {
        indexProfileElevations(bySector[sectorKey]);
      });
      points.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.start - b.start;
      });
      return {
        all: points,
        bySector: bySector
      };
    }

    function parseTrackObjectsXml(xmlText, fileKey) {
      var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
      var parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) throw new Error('Ошибка чтения ' + fileKey + '.xml');

      var sectorNodes = deps.getElementsByLocalName(doc, 'sector');
      if (!sectorNodes.length) sectorNodes = [doc];
      var all = [];
      var bySector = {};
      var signalNEven = 0;
      var signalEven = 0;

      for (var sectorIndex = 0; sectorIndex < sectorNodes.length; sectorIndex++) {
        var sectorNode = sectorNodes[sectorIndex];
        var rawSector = sectorNode.getAttribute ? sectorNode.getAttribute('id') : '';
        var sector = deps.parseNumber(rawSector);
        if (!isFinite(sector)) sector = sectorIndex + 1;
        var sectorKey = String(sector);
        var nodes = deps.getElementsByLocalName(sectorNode, 'wpt');

        for (var i = 0; i < nodes.length; i++) {
          var node = nodes[i];
          var coordinate = deps.normalizeOrdinate(deps.getFirstTextByLocalName(node, 'coordinate'));
          var length = Math.max(0, Math.round(deps.parseNumber(deps.getFirstTextByLocalName(node, 'length')) || 0));
          var type = String(deps.getFirstTextByLocalName(node, 'type') || '').trim();
          var name = String(deps.getFirstTextByLocalName(node, 'name') || '').trim();
          var speed = deps.parseNumber(deps.getFirstTextByLocalName(node, 'speed'));
          if (!isFinite(coordinate) || !type || !name) continue;
          if (type === '1') {
            if (/^Ч/i.test(name)) signalEven += 1;
            else if (/^[НH]/i.test(name)) signalNEven += 1;
          }
          var item = {
            fileKey: fileKey,
            sector: sector,
            type: type,
            name: name,
            coordinate: coordinate,
            length: length,
            end: coordinate + length,
            speed: isFinite(speed) ? speed : null
          };
          all.push(item);
          if (!bySector[sectorKey]) bySector[sectorKey] = [];
          bySector[sectorKey].push(item);
        }
      }

      Object.keys(bySector).forEach(function(sectorKey) {
        bySector[sectorKey].sort(function(a, b) {
          if (a.coordinate !== b.coordinate) return a.coordinate - b.coordinate;
          return a.type.localeCompare(b.type);
        });
      });
      all.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.coordinate - b.coordinate;
      });
      var directionEven = null;
      if (signalEven > signalNEven) directionEven = true;
      else if (signalNEven > signalEven) directionEven = false;
      if (directionEven !== null) {
        for (var itemIndex = 0; itemIndex < all.length; itemIndex++) {
          all[itemIndex].directionEven = directionEven;
        }
      }
      return {
        all: all,
        bySector: bySector,
        directionEven: directionEven,
        directionStats: {
          evenSignals: signalEven,
          oddSignals: signalNEven
        }
      };
    }

    function parseSpeedXml(xmlText) {
      if (!xmlText) return { all: [], bySector: {} };
      var body = String(xmlText).replace(/<\?xml[^>]*\?>/i, '');
      var doc = new DOMParser().parseFromString('<speed-points>' + body + '</speed-points>', 'application/xml');
      var parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) return { all: [], bySector: {} };

      var nodes = deps.getElementsByLocalName(doc, 'wpt');
      var all = [];
      var bySector = {};
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var coordinate = deps.normalizeOrdinate(deps.getFirstTextByLocalName(node, 'coordinate'));
        var length = Math.max(0, Math.round(deps.parseNumber(deps.getFirstTextByLocalName(node, 'length')) || 0));
        var sector = deps.parseNumber(deps.getFirstTextByLocalName(node, 'sector'));
        var wayNumber = Math.round(deps.parseNumber(deps.getFirstTextByLocalName(node, 'way_number')) || 0);
        var speed = deps.parseNumber(deps.getFirstTextByLocalName(node, 'speed'));
        var name = String(deps.getFirstTextByLocalName(node, 'name') || '').trim();
        if (!isFinite(coordinate) || !isFinite(sector) || !isFinite(speed)) continue;
        var item = {
          sector: sector,
          wayNumber: wayNumber || 0,
          name: name || String(Math.round(speed)),
          coordinate: coordinate,
          length: length,
          end: coordinate + length,
          speed: speed
        };
        all.push(item);
        var sectorKey = String(sector);
        if (!bySector[sectorKey]) bySector[sectorKey] = [];
        bySector[sectorKey].push(item);
      }
      Object.keys(bySector).forEach(function(sectorKey) {
        bySector[sectorKey].sort(function(a, b) {
          return a.coordinate - b.coordinate;
        });
      });
      return {
        all: all,
        bySector: bySector
      };
    }

    function getSectionCoordinateOffset(section) {
      var runtime = section && section.runtime && typeof section.runtime === 'object' ? section.runtime : {};
      var candidates = [
        runtime.coordinate_offset_m,
        runtime.coordinateOffsetM,
        section && section.coordinate_offset_m,
        section && section.coordinateOffsetM
      ];
      for (var i = 0; i < candidates.length; i++) {
        var value = Number(candidates[i]);
        if (isFinite(value)) return value;
      }
      return 0;
    }

    function getSectionGeometryPaths(section) {
      var runtime = section && section.runtime && typeof section.runtime === 'object' ? section.runtime : {};
      var geometry = section && section.geometry && typeof section.geometry === 'object'
        ? section.geometry
        : (runtime.geometry && typeof runtime.geometry === 'object' ? runtime.geometry : {});
      if (Array.isArray(geometry.paths)) return geometry.paths;
      if (Array.isArray(geometry.points)) {
        return [{ id: geometry.id || 'main', points: geometry.points }];
      }
      if (Array.isArray(runtime.geometry_points)) {
        return [{ id: 'main', points: runtime.geometry_points }];
      }
      return [];
    }

    function getSectionPointCoordinate(point, offset) {
      if (!point || typeof point !== 'object') return NaN;
      var chainage = Number(point.chainage_m !== undefined ? point.chainage_m : point.chainageM);
      if (isFinite(chainage)) return Math.round(chainage + offset);
      var km = Number(point.km);
      if (isFinite(km)) return Math.round(km * 1000 + offset);
      var ordinate = Number(point.ordinate);
      return isFinite(ordinate) ? Math.round(ordinate) : NaN;
    }

    function buildSectionRouteData(section) {
      var offset = getSectionCoordinateOffset(section);
      var paths = getSectionGeometryPaths(section);
      var sectionId = String(section && (section.id || section.section_name) || 'section');
      var points = [];
      for (var pathIndex = 0; pathIndex < paths.length; pathIndex++) {
        var path = paths[pathIndex] || {};
        var rawPathId = String(path.id || path.path_id || ('path-' + (pathIndex + 1)));
        var pathId = sectionId + ':' + rawPathId;
        var sourcePoints = Array.isArray(path.points) ? path.points : [];
        for (var pointIndex = 0; pointIndex < sourcePoints.length; pointIndex++) {
          var sourcePoint = sourcePoints[pointIndex] || {};
          var lat = Number(sourcePoint.lat !== undefined ? sourcePoint.lat : sourcePoint.latitude);
          var lon = Number(sourcePoint.lon !== undefined ? sourcePoint.lon : sourcePoint.longitude);
          var ordinate = getSectionPointCoordinate(sourcePoint, offset);
          var sector = Number(sourcePoint.sector !== undefined ? sourcePoint.sector : path.sector);
          if (!isFinite(lat) || !isFinite(lon) || !isFinite(ordinate) || !isFinite(sector)) continue;
          points.push({
            lat: lat,
            lon: lon,
            ordinate: ordinate,
            sector: sector,
            pathId: pathId,
            position: points.length
          });
        }
      }

      var groups = {};
      for (var groupIndex = 0; groupIndex < points.length; groupIndex++) {
        var point = points[groupIndex];
        var groupKey = point.pathId + ':' + point.sector;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(point);
      }

      var unique = [];
      var segments = [];
      Object.keys(groups).forEach(function(groupKey) {
        var group = groups[groupKey].sort(function(a, b) {
          return a.ordinate - b.ordinate;
        });
        var deduped = [];
        var seen = {};
        for (var i = 0; i < group.length; i++) {
          var pointKey = group[i].ordinate + ':' + group[i].lat.toFixed(7) + ':' + group[i].lon.toFixed(7);
          if (seen[pointKey]) continue;
          seen[pointKey] = true;
          deduped.push(group[i]);
          unique.push(group[i]);
        }
        for (var segmentIndex = 0; segmentIndex < deduped.length - 1; segmentIndex++) {
          var a = deduped[segmentIndex];
          var b = deduped[segmentIndex + 1];
          var ordinateGap = Math.abs(b.ordinate - a.ordinate);
          var geoDistance = deps.haversine(a.lat, a.lon, b.lat, b.lon);
          if (ordinateGap <= 0 || ordinateGap > config.maxSegmentOrdinateGapM || geoDistance > 2200) continue;
          segments.push({
            start: a,
            end: b,
            sector: a.sector,
            pathId: a.pathId,
            length: geoDistance,
            ordinateGap: ordinateGap
          });
        }
      });
      unique.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.ordinate - b.ordinate;
      });
      if (unique.length < 2 || !segments.length) throw new Error('JSON участка не содержит рабочей GPS-линии');
      return {
        points: unique,
        segments: segments
      };
    }

    function getSectionRouteRanges(mapData) {
      var ranges = {};
      var points = mapData && Array.isArray(mapData.points) ? mapData.points : [];
      for (var i = 0; i < points.length; i++) {
        var key = deps.getSectorKey(points[i].sector);
        if (!ranges[key]) {
          ranges[key] = { sector: points[i].sector, min: points[i].ordinate, max: points[i].ordinate };
        } else {
          ranges[key].min = Math.min(ranges[key].min, points[i].ordinate);
          ranges[key].max = Math.max(ranges[key].max, points[i].ordinate);
        }
      }
      return ranges;
    }

    function findSectionSectorForCoordinate(mapData, coordinate) {
      var ranges = getSectionRouteRanges(mapData);
      var keys = Object.keys(ranges);
      var best = null;
      for (var i = 0; i < keys.length; i++) {
        var range = ranges[keys[i]];
        var distance = coordinate < range.min
          ? range.min - coordinate
          : (coordinate > range.max ? coordinate - range.max : 0);
        if (!best || distance < best.distance) best = { sector: range.sector, distance: distance };
      }
      return best ? best.sector : NaN;
    }

    function findSectionSectorsForCoordinate(mapData, coordinate) {
      var ranges = getSectionRouteRanges(mapData);
      var result = [];
      Object.keys(ranges).forEach(function(key) {
        var range = ranges[key];
        if (coordinate >= range.min && coordinate <= range.max) result.push(range.sector);
      });
      if (!result.length) {
        var nearest = findSectionSectorForCoordinate(mapData, coordinate);
        if (isFinite(nearest)) result.push(nearest);
      }
      return result;
    }

    function buildSectionProfile(section, mapData) {
      var offset = getSectionCoordinateOffset(section);
      var elements = section && Array.isArray(section.elements) ? section.elements : [];
      var ranges = getSectionRouteRanges(mapData);
      var rangeKeys = Object.keys(ranges);
      var all = [];
      var bySector = {};

      function appendPoint(sector, start, end, grade, element) {
        if (!isFinite(sector) || !isFinite(start) || !isFinite(end) || end <= start || !isFinite(grade)) return;
        var point = {
          start: Math.round(start),
          end: Math.round(end),
          length: Math.round(end - start),
          grade: grade,
          sector: sector,
          confidence: element.confidence ? String(element.confidence) : '',
          sourcePage: element.source_page !== undefined ? element.source_page : element.page,
          source: 'section-json'
        };
        all.push(point);
        var key = deps.getSectorKey(sector);
        if (!bySector[key]) bySector[key] = [];
        bySector[key].push(point);
      }

      for (var elementIndex = 0; elementIndex < elements.length; elementIndex++) {
        var element = elements[elementIndex] || {};
        var officialStart = Number(element.start_m !== undefined ? element.start_m : element.startM);
        var length = Number(element.len_m !== undefined ? element.len_m : element.length_m);
        var grade = Number(element.grad_permille !== undefined ? element.grad_permille : element.grade);
        if (!isFinite(officialStart) || !isFinite(length) || length <= 0 || !isFinite(grade)) continue;
        var start = officialStart + offset;
        var end = start + length;
        var explicitSectors = [];
        if (Array.isArray(element.sectors)) explicitSectors = element.sectors.map(Number).filter(isFinite);
        else if (isFinite(Number(element.sector))) explicitSectors = [Number(element.sector)];
        if (explicitSectors.length) {
          for (var explicitIndex = 0; explicitIndex < explicitSectors.length; explicitIndex++) {
            appendPoint(explicitSectors[explicitIndex], start, end, grade, element);
          }
          continue;
        }

        var intersections = [];
        for (var rangeIndex = 0; rangeIndex < rangeKeys.length; rangeIndex++) {
          var range = ranges[rangeKeys[rangeIndex]];
          var partStart = Math.max(start, range.min);
          var partEnd = Math.min(end, range.max);
          if (partEnd > partStart) intersections.push({ sector: range.sector, start: partStart, end: partEnd });
        }
        if (!intersections.length) {
          appendPoint(findSectionSectorForCoordinate(mapData, (start + end) / 2), start, end, grade, element);
        } else if (intersections.length === 1) {
          appendPoint(intersections[0].sector, start, end, grade, element);
        } else {
          for (var partIndex = 0; partIndex < intersections.length; partIndex++) {
            appendPoint(intersections[partIndex].sector, intersections[partIndex].start, intersections[partIndex].end, grade, element);
          }
        }
      }

      Object.keys(bySector).forEach(function(sectorKey) {
        indexProfileElevations(bySector[sectorKey]);
      });
      all.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.start - b.start;
      });
      return { all: all, bySector: bySector };
    }

    function buildSectionProfileGaps(section, mapData) {
      var runtime = section && section.runtime && typeof section.runtime === 'object' ? section.runtime : {};
      var source = Array.isArray(runtime.profile_gaps) ? runtime.profile_gaps : [];
      var offset = getSectionCoordinateOffset(section);
      var ranges = getSectionRouteRanges(mapData);
      var rangeKeys = Object.keys(ranges);
      var bySector = {};
      function appendGap(sector, start, end, gap) {
        if (!isFinite(sector) || !isFinite(start) || !isFinite(end) || end <= start) return;
        var key = deps.getSectorKey(sector);
        if (!bySector[key]) bySector[key] = [];
        bySector[key].push({
          sector: sector,
          start: Math.round(start),
          end: Math.round(end),
          length: Math.round(end - start),
          reason: String(gap.reason || 'профиль требует проверки'),
          source: 'section-json'
        });
      }
      for (var gapIndex = 0; gapIndex < source.length; gapIndex++) {
        var gap = source[gapIndex] || {};
        var officialStart = Number(gap.start_m !== undefined ? gap.start_m : gap.startM);
        var officialEnd = Number(gap.end_m !== undefined ? gap.end_m : gap.endM);
        if (!isFinite(officialStart) || !isFinite(officialEnd) || officialEnd <= officialStart) continue;
        var start = officialStart + offset;
        var end = officialEnd + offset;
        if (isFinite(Number(gap.sector))) {
          appendGap(Number(gap.sector), start, end, gap);
          continue;
        }
        var matched = false;
        for (var rangeIndex = 0; rangeIndex < rangeKeys.length; rangeIndex++) {
          var range = ranges[rangeKeys[rangeIndex]];
          var partStart = Math.max(start, range.min);
          var partEnd = Math.min(end, range.max);
          if (partEnd <= partStart) continue;
          appendGap(range.sector, partStart, partEnd, gap);
          matched = true;
        }
        if (!matched) appendGap(findSectionSectorForCoordinate(mapData, (start + end) / 2), start, end, gap);
      }
      Object.keys(bySector).forEach(function(sectorKey) {
        bySector[sectorKey].sort(function(a, b) { return a.start - b.start; });
      });
      return bySector;
    }

    function getSectionObjectCoordinate(item, offset) {
      if (!item || typeof item !== 'object') return NaN;
      var chainage = Number(item.chainage_m !== undefined ? item.chainage_m : item.coordinate_m);
      if (isFinite(chainage)) return Math.round(chainage + offset);
      var km = Number(item.km);
      if (isFinite(km)) return Math.round(km * 1000 + offset);
      var coordinate = Number(item.coordinate);
      return isFinite(coordinate) ? Math.round(coordinate) : NaN;
    }

    function buildSectionObjectStore(section, mapData, fileKey) {
      var offset = getSectionCoordinateOffset(section);
      var sources = [
        { type: '2', items: section && Array.isArray(section.stations) ? section.stations : [] },
        { type: '1', items: section && Array.isArray(section.signals) ? section.signals : [] },
        { type: '4', items: section && Array.isArray(section.whistle_points) ? section.whistle_points : [] }
      ];
      var all = [];
      var bySector = {};
      for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
        var source = sources[sourceIndex];
        for (var itemIndex = 0; itemIndex < source.items.length; itemIndex++) {
          var item = source.items[itemIndex] || {};
          var coordinate = getSectionObjectCoordinate(item, offset);
          var name = String(item.name || item.note || '').trim();
          if (!isFinite(coordinate) || !name) continue;
          var sectors = isFinite(Number(item.sector))
            ? [Number(item.sector)]
            : findSectionSectorsForCoordinate(mapData, coordinate);
          var length = Math.max(0, Math.round(Number(item.length_m || item.len_m || 0)));
          for (var sectorIndex = 0; sectorIndex < sectors.length; sectorIndex++) {
            var sector = sectors[sectorIndex];
            if (!isFinite(sector)) continue;
            var object = {
              fileKey: fileKey,
              sector: sector,
              type: source.type,
              name: name,
              coordinate: coordinate,
              length: length,
              end: coordinate + length,
              speed: null,
              confidence: item.confidence ? String(item.confidence) : '',
              signalType: item.type ? String(item.type) : '',
              source: 'section-json'
            };
            all.push(object);
            var key = deps.getSectorKey(sector);
            if (!bySector[key]) bySector[key] = [];
            bySector[key].push(object);
          }
        }
      }
      Object.keys(bySector).forEach(function(sectorKey) {
        bySector[sectorKey].sort(function(a, b) { return a.coordinate - b.coordinate; });
      });
      all.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.coordinate - b.coordinate;
      });
      return {
        all: all,
        bySector: bySector,
        directionEven: null,
        directionStats: { evenSignals: 0, oddSignals: 0 }
      };
    }

    function parseSectionPackage(text, fileKey) {
      var section = typeof text === 'string' ? JSON.parse(text) : text;
      if (!section || typeof section !== 'object') throw new Error('Пустой JSON участка');
      var schemaVersion = String(section.schema_version || section.schemaVersion || '');
      if (!/^1(?:\.|$)/.test(schemaVersion)) throw new Error('Неподдерживаемая версия JSON участка: ' + (schemaVersion || 'не указана'));
      var mapData = buildSectionRouteData(section);
      var profile = buildSectionProfile(section, mapData);
      if (!profile.all.length) throw new Error('JSON участка не содержит профиль пути');
      profile.gapsBySector = buildSectionProfileGaps(section, mapData);
      var store = buildSectionObjectStore(section, mapData, fileKey || String(section.id || 'section'));
      return {
        section: section,
        mapData: mapData,
        profile: profile,
        speed: { all: [], bySector: {} },
        objectStores: [store]
      };
    }

    function mergeSectionMapBundles(parts) {
      var points = [];
      var segments = [];
      var profileAll = [];
      var profileBySector = {};
      var profileGapsBySector = {};
      var objectStores = [];
      var pointSeen = {};
      var segmentSeen = {};
      var profileSeen = {};
      for (var partIndex = 0; partIndex < parts.length; partIndex++) {
        var part = parts[partIndex];
        var partPoints = part.mapData.points || [];
        for (var pointIndex = 0; pointIndex < partPoints.length; pointIndex++) {
          var point = partPoints[pointIndex];
          var pointKey = [point.pathId, point.sector, point.ordinate, point.lat.toFixed(7), point.lon.toFixed(7)].join(':');
          if (pointSeen[pointKey]) continue;
          pointSeen[pointKey] = true;
          points.push(point);
        }
        var partSegments = part.mapData.segments || [];
        for (var segmentIndex = 0; segmentIndex < partSegments.length; segmentIndex++) {
          var segment = partSegments[segmentIndex];
          var segmentKey = [segment.pathId, segment.sector, segment.start.ordinate, segment.end.ordinate].join(':');
          if (segmentSeen[segmentKey]) continue;
          segmentSeen[segmentKey] = true;
          segments.push(segment);
        }
        var partProfile = part.profile.all || [];
        for (var profileIndex = 0; profileIndex < partProfile.length; profileIndex++) {
          var profilePoint = partProfile[profileIndex];
          var profileKey = [profilePoint.sector, profilePoint.start, profilePoint.end, profilePoint.grade].join(':');
          if (profileSeen[profileKey]) continue;
          profileSeen[profileKey] = true;
          profileAll.push(profilePoint);
          var sectorKey = deps.getSectorKey(profilePoint.sector);
          if (!profileBySector[sectorKey]) profileBySector[sectorKey] = [];
          profileBySector[sectorKey].push(profilePoint);
        }
        var partGaps = part.profile.gapsBySector || {};
        Object.keys(partGaps).forEach(function(gapSectorKey) {
          if (!profileGapsBySector[gapSectorKey]) profileGapsBySector[gapSectorKey] = [];
          profileGapsBySector[gapSectorKey] = profileGapsBySector[gapSectorKey].concat(partGaps[gapSectorKey] || []);
        });
        objectStores = objectStores.concat(part.objectStores || []);
      }
      points.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.ordinate - b.ordinate;
      });
      profileAll = [];
      Object.keys(profileBySector).forEach(function(sectorKey) {
        var source = profileBySector[sectorKey].sort(function(a, b) { return a.start - b.start; });
        var normalized = [];
        for (var profileIndex = 0; profileIndex < source.length; profileIndex++) {
          var current = source[profileIndex];
          var previous = normalized.length ? normalized[normalized.length - 1] : null;
          if (previous && current.start < previous.end) {
            if (Math.abs(Number(previous.grade) - Number(current.grade)) > 0.0001) {
              throw new Error(
                'Конфликт профиля в секторе ' + sectorKey + ': ' +
                Math.round(current.start) + '–' + Math.round(Math.min(previous.end, current.end)) + ' м'
              );
            }
            previous.end = Math.max(previous.end, current.end);
            previous.length = previous.end - previous.start;
            continue;
          }
          normalized.push(current);
        }
        profileBySector[sectorKey] = indexProfileElevations(normalized);
        profileAll = profileAll.concat(profileBySector[sectorKey]);
      });
      profileAll.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.start - b.start;
      });
      Object.keys(profileGapsBySector).forEach(function(sectorKey) {
        var source = profileGapsBySector[sectorKey].sort(function(a, b) { return a.start - b.start; });
        var merged = [];
        for (var gapIndex = 0; gapIndex < source.length; gapIndex++) {
          var gap = source[gapIndex];
          var previous = merged.length ? merged[merged.length - 1] : null;
          if (previous && gap.start <= previous.end) {
            previous.end = Math.max(previous.end, gap.end);
            previous.length = previous.end - previous.start;
            if (previous.reason.indexOf(gap.reason) === -1) previous.reason += '; ' + gap.reason;
          } else {
            merged.push(gap);
          }
        }
        profileGapsBySector[sectorKey] = merged;
      });
      var mergedObjects = [];
      var mergedObjectsBySector = {};
      var objectSeen = {};
      for (var storeIndex = 0; storeIndex < objectStores.length; storeIndex++) {
        var storeObjects = objectStores[storeIndex] && Array.isArray(objectStores[storeIndex].all)
          ? objectStores[storeIndex].all
          : [];
        for (var objectIndex = 0; objectIndex < storeObjects.length; objectIndex++) {
          var object = storeObjects[objectIndex];
          var objectKey = [object.type, deps.normalizeRouteName(object.name), object.sector, object.coordinate].join(':');
          if (objectSeen[objectKey]) continue;
          objectSeen[objectKey] = true;
          object.fileKey = 'section-json';
          mergedObjects.push(object);
          var objectSectorKey = deps.getSectorKey(object.sector);
          if (!mergedObjectsBySector[objectSectorKey]) mergedObjectsBySector[objectSectorKey] = [];
          mergedObjectsBySector[objectSectorKey].push(object);
        }
      }
      mergedObjects.sort(function(a, b) {
        if (a.sector !== b.sector) return a.sector - b.sector;
        return a.coordinate - b.coordinate;
      });
      Object.keys(mergedObjectsBySector).forEach(function(sectorKey) {
        mergedObjectsBySector[sectorKey].sort(function(a, b) { return a.coordinate - b.coordinate; });
      });
      var mergedObjectStore = {
        all: mergedObjects,
        bySector: mergedObjectsBySector,
        directionEven: null,
        directionStats: { evenSignals: 0, oddSignals: 0 }
      };
      return {
        mapData: { points: points, segments: segments },
        profile: { all: profileAll, bySector: profileBySector, gapsBySector: profileGapsBySector },
        speed: { all: [], bySector: {} },
        objectStores: [mergedObjectStore],
        objectKeys: ['section-json'],
        sections: parts.map(function(part) { return part.section; })
      };
    }

    return {
      parseMapXml: parseMapXml,
      indexProfileElevations: indexProfileElevations,
      parseProfileXml: parseProfileXml,
      parseTrackObjectsXml: parseTrackObjectsXml,
      parseSpeedXml: parseSpeedXml,
      getSectionCoordinateOffset: getSectionCoordinateOffset,
      getSectionGeometryPaths: getSectionGeometryPaths,
      getSectionPointCoordinate: getSectionPointCoordinate,
      buildSectionRouteData: buildSectionRouteData,
      getSectionRouteRanges: getSectionRouteRanges,
      findSectionSectorForCoordinate: findSectionSectorForCoordinate,
      findSectionSectorsForCoordinate: findSectionSectorsForCoordinate,
      buildSectionProfile: buildSectionProfile,
      buildSectionProfileGaps: buildSectionProfileGaps,
      getSectionObjectCoordinate: getSectionObjectCoordinate,
      buildSectionObjectStore: buildSectionObjectStore,
      parseSectionPackage: parseSectionPackage,
      mergeSectionMapBundles: mergeSectionMapBundles
    };
  }

  global.createPoekhaliMapParser = createPoekhaliMapParser;
})(window);
