if (typeof registerShiftTrackerRuntimeModule === 'function') registerShiftTrackerRuntimeModule('poekhali-utils', 'v409');

(function(global) {
  'use strict';

  var EARTH_RADIUS_M = 6371000;

  function parseNumber(value) {
    if (value === null || value === undefined) return NaN;
    return parseFloat(String(value).replace(',', '.'));
  }

  function isRealNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function getElementsByLocalName(root, localName) {
    var all = root ? root.getElementsByTagName('*') : [];
    var result = [];
    for (var i = 0; i < all.length; i++) {
      if (all[i].localName === localName || all[i].tagName === localName) {
        result.push(all[i]);
      }
    }
    return result;
  }

  function getFirstTextByLocalName(root, localName) {
    var items = getElementsByLocalName(root, localName);
    if (!items.length) return '';
    return (items[0].textContent || '').trim();
  }

  function normalizeOrdinate(rawValue) {
    var value = parseNumber(rawValue);
    if (!isFinite(value)) return NaN;
    return Math.round(value);
  }

  function fetchText(path) {
    return fetch(path, { cache: 'no-store' }).then(function(response) {
      if (!response || !response.ok) {
        throw new Error('Не удалось загрузить ' + path);
      }
      return response.text();
    });
  }

  function getFileName(path) {
    return String(path || '').split(/[\\/]/).pop().toLowerCase();
  }

  function uniqueStrings(values) {
    var seen = {};
    var result = [];
    for (var i = 0; i < values.length; i++) {
      var value = values[i] ? String(values[i]) : '';
      if (!value || seen[value]) continue;
      seen[value] = true;
      result.push(value);
    }
    return result;
  }

  function readJsonStorage(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      // localStorage can be blocked in restricted browser contexts.
      return false;
    }
  }

  function readStringStorage(key) {
    try {
      return String(localStorage.getItem(key) || '').trim();
    } catch (error) {
      return '';
    }
  }

  function writeStringStorage(key, value) {
    try {
      var text = String(value || '').trim();
      if (text) localStorage.setItem(key, text);
      else localStorage.removeItem(key);
    } catch (error) {
      // localStorage can be blocked in restricted browser contexts.
    }
  }

  function haversine(lat1, lon1, lat2, lon2) {
    var p1 = lat1 * Math.PI / 180;
    var p2 = lat2 * Math.PI / 180;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function projectToSegment(location, segment) {
    var a = segment.start;
    var b = segment.end;
    var lat0 = ((a.lat + b.lat + location.lat) / 3) * Math.PI / 180;
    var ax = 0;
    var ay = 0;
    var bx = (b.lon - a.lon) * Math.PI / 180 * Math.cos(lat0) * EARTH_RADIUS_M;
    var by = (b.lat - a.lat) * Math.PI / 180 * EARTH_RADIUS_M;
    var px = (location.lon - a.lon) * Math.PI / 180 * Math.cos(lat0) * EARTH_RADIUS_M;
    var py = (location.lat - a.lat) * Math.PI / 180 * EARTH_RADIUS_M;
    var vx = bx - ax;
    var vy = by - ay;
    var lenSq = vx * vx + vy * vy;
    if (lenSq <= 0) return null;
    var t = ((px - ax) * vx + (py - ay) * vy) / lenSq;
    var clamped = Math.max(0, Math.min(1, t));
    var qx = ax + vx * clamped;
    var qy = ay + vy * clamped;
    var distance = Math.sqrt(Math.pow(px - qx, 2) + Math.pow(py - qy, 2));
    var lineCoordinate = a.ordinate + (b.ordinate - a.ordinate) * clamped;

    return {
      distance: distance,
      lineCoordinate: lineCoordinate,
      sector: segment.sector,
      start: a,
      end: b,
      t: clamped
    };
  }

  function findNearestPointInList(location, points) {
    var best = null;
    var source = Array.isArray(points) ? points : [];
    for (var i = 0; i < source.length; i++) {
      var point = source[i];
      var distance = haversine(location.lat, location.lon, point.lat, point.lon);
      if (!best || distance < best.distance) {
        best = {
          distance: distance,
          lineCoordinate: point.ordinate,
          sector: point.sector,
          start: point,
          end: point,
          t: 0
        };
      }
    }
    return best;
  }

  function getRailKmPkParts(value) {
    if (!isFinite(value)) return { km: null, pk: null, meters: null };
    var coordinate = Math.max(0, Math.round(value));
    var meters = coordinate % 1000;
    return {
      // ЭК хранит метры после предыдущего километрового знака: 3749+373
      // в рабочей записи отображается как 3750 км 3 пк.
      km: Math.floor(coordinate / 1000) + 1,
      pk: Math.floor(meters / 100),
      meters: meters
    };
  }

  function formatLineCoordinate(value) {
    if (!isFinite(value)) return '—';
    var parts = getRailKmPkParts(value);
    return parts.km + ' км ' + parts.pk + ' пк';
  }

  function formatTime(date) {
    try {
      return new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Europe/Moscow',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date).replace(/\./g, ':');
    } catch (error) {
      var utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
      var msk = new Date(utcMs + 3 * 60 * 60000);
      return String(msk.getHours()).padStart(2, '0') + ':' +
        String(msk.getMinutes()).padStart(2, '0') + ':' +
        String(msk.getSeconds()).padStart(2, '0');
    }
  }

  function coordinateToKmPk(value) {
    var coordinate = Math.max(0, Math.round(Number(value) || 0));
    var parts = getRailKmPkParts(coordinate);
    return {
      km: parts.km,
      pk: parts.pk
    };
  }

  function coordinateToKmPkMeter(value) {
    var coordinate = Math.max(0, Math.round(Number(value) || 0));
    var base = coordinateToKmPk(coordinate);
    return {
      km: base.km,
      pk: base.pk,
      meter: coordinate % 100
    };
  }

  function coordinateFromKmPk(km, pk) {
    var numericKm = Math.max(1, Math.round(Number(km) || 1));
    var numericPk = Math.max(0, Math.min(9, Math.round(Number(pk) || 0)));
    return (numericKm - 1) * 1000 + numericPk * 100;
  }

  function coordinateFromKmPkMeter(km, pk, meter) {
    var numericMeter = Math.max(0, Math.min(99, Math.round(Number(meter) || 0)));
    return coordinateFromKmPk(km, pk) + numericMeter;
  }

  function formatDistanceLabel(value) {
    if (!isFinite(value)) return '—';
    var distance = Math.max(0, Math.round(value));
    if (distance >= 10000) return (distance / 1000).toFixed(0) + ' км';
    if (distance >= 1000) return (distance / 1000).toFixed(1).replace('.0', '') + ' км';
    return distance + ' м';
  }

  function formatGradeLabel(value) {
    if (!isFinite(value)) return '—';
    var rounded = Math.round(value * 10) / 10;
    return (rounded > 0 ? '+' : '') + rounded.toFixed(1) + '‰';
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function estimateEtaSeconds(distanceMeters, speedKmh) {
    var distance = Math.max(0, Math.round(Number(distanceMeters) || 0));
    var speed = Math.max(0, Number(speedKmh) || 0);
    if (!distance) return 0;
    if (speed < 3) return 0;
    return Math.max(1, Math.round(distance / (speed / 3.6)));
  }

  function getNavigationTargetPriority(kind) {
    if (kind === 'restriction_end') return 70;
    if (kind === 'warning') return 65;
    if (kind === 'restriction') return 60;
    if (kind === 'signal') return 45;
    if (kind === 'station') return 40;
    if (kind === 'route_start') return 30;
    if (kind === 'route_finish') return 25;
    return 10;
  }

  function normalizeNavigationTargetCandidate(candidate) {
    if (!candidate) return null;
    var label = String(candidate.label || '').trim();
    if (!label) return null;
    var distance = Math.max(0, Math.round(Number(candidate.distanceMeters) || 0));
    var coordinate = Math.max(0, Math.round(Number(candidate.coordinate) || 0));
    return {
      kind: String(candidate.kind || 'target'),
      label: label,
      source: String(candidate.source || ''),
      sector: Math.max(0, Math.round(Number(candidate.sector) || 0)),
      coordinate: coordinate,
      distanceMeters: distance,
      etaSeconds: Math.max(0, Math.round(Number(candidate.etaSeconds) || 0)),
      priority: isFinite(Number(candidate.priority)) ? Number(candidate.priority) : getNavigationTargetPriority(candidate.kind),
      speedKmh: Math.max(0, Math.round(Number(candidate.speedKmh) || 0)),
      updatedAt: String(candidate.updatedAt || new Date().toISOString())
    };
  }

  function selectNavigationTarget(candidates) {
    var best = null;
    for (var i = 0; i < (candidates || []).length; i++) {
      var item = normalizeNavigationTargetCandidate(candidates[i]);
      if (!item) continue;
      if (!best) {
        best = item;
        continue;
      }
      if (item.priority >= 90 && best.priority < 90) {
        best = item;
        continue;
      }
      if (best.priority >= 90 && item.priority < 90) continue;
      if (item.distanceMeters < best.distanceMeters - 5) {
        best = item;
        continue;
      }
      if (Math.abs(item.distanceMeters - best.distanceMeters) <= 5 && item.priority > best.priority) {
        best = item;
      }
    }
    return best;
  }

  global.PoekhaliUtils = Object.freeze({
    parseNumber: parseNumber,
    isRealNumber: isRealNumber,
    getElementsByLocalName: getElementsByLocalName,
    getFirstTextByLocalName: getFirstTextByLocalName,
    normalizeOrdinate: normalizeOrdinate,
    fetchText: fetchText,
    getFileName: getFileName,
    uniqueStrings: uniqueStrings,
    readJsonStorage: readJsonStorage,
    writeJsonStorage: writeJsonStorage,
    readStringStorage: readStringStorage,
    writeStringStorage: writeStringStorage,
    haversine: haversine,
    projectToSegment: projectToSegment,
    findNearestPointInList: findNearestPointInList,
    getRailKmPkParts: getRailKmPkParts,
    formatLineCoordinate: formatLineCoordinate,
    formatTime: formatTime,
    coordinateToKmPk: coordinateToKmPk,
    coordinateToKmPkMeter: coordinateToKmPkMeter,
    coordinateFromKmPk: coordinateFromKmPk,
    coordinateFromKmPkMeter: coordinateFromKmPkMeter,
    formatDistanceLabel: formatDistanceLabel,
    formatGradeLabel: formatGradeLabel,
    clamp: clamp,
    estimateEtaSeconds: estimateEtaSeconds,
    getNavigationTargetPriority: getNavigationTargetPriority,
    normalizeNavigationTargetCandidate: normalizeNavigationTargetCandidate,
    selectNavigationTarget: selectNavigationTarget
  });
})(window);
