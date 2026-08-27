(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Vu45Calculator = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';

  var BRAKE_PRESETS = [
    { id: 'composite-loaded', label: 'Композиционные · гружёный', forcePerAxle: 8.5 },
    { id: 'cast-loaded', label: 'Чугунные · гружёный', forcePerAxle: 7 },
    { id: 'composite-medium', label: 'Композиционные · средний', forcePerAxle: 7 },
    { id: 'cast-medium', label: 'Чугунные · средний', forcePerAxle: 5 },
    { id: 'composite-empty', label: 'Композиционные · порожний', forcePerAxle: 3.5 },
    { id: 'cast-empty', label: 'Чугунные · порожний', forcePerAxle: 3.5 },
    { id: 'reefer-cast-loaded', label: 'Рефрижератор · чугунные · гружёный', forcePerAxle: 9 },
    { id: 'reefer-cast-medium', label: 'Рефрижератор · чугунные · средний', forcePerAxle: 6 },
    { id: 'reefer-cast-empty', label: 'Рефрижератор · чугунные · порожний', forcePerAxle: 3.5 },
    { id: 'reefer-composite-medium', label: 'Рефрижератор · композиционные · средний', forcePerAxle: 7 },
    { id: 'reefer-composite-empty', label: 'Рефрижератор · композиционные · порожний', forcePerAxle: 4.5 },
    { id: 'custom', label: 'Другой тип · ввести вручную', forcePerAxle: null }
  ];

  var MANUAL_BRAKE_TABLE = [
    { gradient: 0, factor: 0.4 },
    { gradient: 2, factor: 0.4 },
    { gradient: 4, factor: 0.4 },
    { gradient: 6, factor: 0.4 },
    { gradient: 8, factor: 0.6 },
    { gradient: 10, factor: 0.8 },
    { gradient: 12, factor: 1 },
    { gradient: 14, factor: 1.2 },
    { gradient: 16, factor: 1.4 },
    { gradient: 18, factor: 1.6 },
    { gradient: 20, factor: 1.8 }
  ];

  function toNumber(value) {
    if (typeof value === 'string') value = value.trim().replace(',', '.');
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round(value, digits) {
    var factor = Math.pow(10, digits == null ? 2 : digits);
    return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
  }

  function requiredBrakeForce(weightTf, normPer100Tf) {
    var weight = Math.max(0, toNumber(weightTf));
    var norm = Math.max(0, toNumber(normPer100Tf));
    if (!weight || !norm) return 0;
    return Math.ceil(weight * norm / 100);
  }

  function actualBrakeForce(groups) {
    return round((Array.isArray(groups) ? groups : []).reduce(function(total, group) {
      var axles = Math.max(0, toNumber(group && group.axles));
      var force = Math.max(0, toNumber(group && group.forcePerAxle));
      return total + axles * force;
    }, 0), 2);
  }

  function manualBrakeFactor(gradientPermille) {
    var gradient = Math.max(0, toNumber(gradientPermille));
    if (gradient > 20) return null;
    for (var i = 0; i < MANUAL_BRAKE_TABLE.length; i++) {
      if (gradient <= MANUAL_BRAKE_TABLE[i].gradient) {
        return MANUAL_BRAKE_TABLE[i].factor;
      }
    }
    return null;
  }

  function requiredManualBrakeAxles(weightTf, gradientPermille) {
    var weight = Math.max(0, toNumber(weightTf));
    var factor = manualBrakeFactor(gradientPermille);
    if (!weight || factor == null) return null;
    return Math.ceil(weight * factor / 100);
  }

  function calculate(input) {
    input = input || {};
    var weight = Math.max(0, toNumber(input.weightTf));
    var norm = Math.max(0, toNumber(input.normPer100Tf));
    var actual = actualBrakeForce(input.groups);
    var required = requiredBrakeForce(weight, norm);
    var margin = round(actual - required, 2);
    var actualPer100 = weight ? round(actual * 100 / weight, 2) : 0;
    var gradient = Math.max(0, toNumber(input.gradientPermille));
    var manualFactor = manualBrakeFactor(gradient);
    return {
      weightTf: weight,
      normPer100Tf: norm,
      requiredForceTf: required,
      actualForceTf: actual,
      actualPer100Tf: actualPer100,
      marginTf: margin,
      meetsEnteredNorm: weight > 0 && norm > 0 && actual >= required,
      manualBrakeFactor: manualFactor,
      requiredManualBrakeAxles: requiredManualBrakeAxles(weight, gradient),
      localRuleWarning: gradient > 12,
      manualCalculationRequired: gradient > 20
    };
  }

  return {
    BRAKE_PRESETS: BRAKE_PRESETS,
    MANUAL_BRAKE_TABLE: MANUAL_BRAKE_TABLE,
    toNumber: toNumber,
    requiredBrakeForce: requiredBrakeForce,
    actualBrakeForce: actualBrakeForce,
    manualBrakeFactor: manualBrakeFactor,
    requiredManualBrakeAxles: requiredManualBrakeAxles,
    calculate: calculate
  };
});
