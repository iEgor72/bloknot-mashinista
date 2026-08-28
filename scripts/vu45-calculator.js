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

  var LOCOMOTIVE_PRESETS = [
    { id: '3te25k2m', label: '3ТЭ25К2М', axles: 18, weightTf: 441, loadedPerAxleTf: 10, emptyPerAxleTf: 5, forceBasis: 'default-diesel' },
    { id: '2te25km', label: '2ТЭ25КМ', axles: 12, weightTf: 288, loadedPerAxleTf: 10, emptyPerAxleTf: 5, forceBasis: 'default-diesel' },
    { id: '3te28', label: '3ТЭ28', axles: 18, weightTf: 441, loadedPerAxleTf: 10, emptyPerAxleTf: 5, forceBasis: 'default-diesel' },
    { id: '3es5k', label: '3ЭС5К', axles: 12, weightTf: 288, loadedPerAxleTf: 14, emptyPerAxleTf: 6 },
    { id: '2es5k', label: '2ЭС5К', axles: 8, weightTf: 192, loadedPerAxleTf: 14, emptyPerAxleTf: 6 },
    { id: '2te116', label: '2ТЭ116', axles: 12, weightTf: 276, loadedPerAxleTf: 12, emptyPerAxleTf: 5 },
    { id: '3te10', label: '3ТЭ10М / 3ТЭ10У', axles: 18, weightTf: 414, loadedPerAxleTf: 12, emptyPerAxleTf: 5 },
    { id: '2te10', label: '2ТЭ10 (кроме 2ТЭ10Л)', axles: 12, weightTf: 276, loadedPerAxleTf: 12, emptyPerAxleTf: 5 },
    { id: '4te10s', label: '4ТЭ10С', axles: 24, weightTf: 552, loadedPerAxleTf: 12, emptyPerAxleTf: 5 },
    { id: '3m62u', label: '3М62У', axles: 18, weightTf: 378, loadedPerAxleTf: 12, emptyPerAxleTf: 5 },
    { id: '2m62u', label: '2М62У', axles: 12, weightTf: 252, loadedPerAxleTf: 12, emptyPerAxleTf: 5 },
    { id: '2m62', label: '2М62', axles: 12, weightTf: 240, loadedPerAxleTf: 12, emptyPerAxleTf: 5 },
    { id: 'm62', label: 'М62', axles: 6, weightTf: 120, loadedPerAxleTf: 12, emptyPerAxleTf: 5 },
    { id: 'vl85', label: 'ВЛ85', axles: 12, weightTf: 288, loadedPerAxleTf: 14, emptyPerAxleTf: 6 },
    { id: 'vl80r', label: 'ВЛ80Р', axles: 8, weightTf: 192, loadedPerAxleTf: 14, emptyPerAxleTf: 6 },
    { id: 'vl80s', label: 'ВЛ80С', axles: 8, weightTf: 192, loadedPerAxleTf: 14, emptyPerAxleTf: 6 },
    { id: 'vl80t', label: 'ВЛ80Т', axles: 8, weightTf: 192, loadedPerAxleTf: 14, emptyPerAxleTf: 6 },
    { id: 'vl80k', label: 'ВЛ80К', axles: 8, weightTf: 184, loadedPerAxleTf: 14, emptyPerAxleTf: 6 },
    { id: 'manual', label: 'Другой локомотив', axles: 0, weightTf: 0, loadedPerAxleTf: 0, emptyPerAxleTf: 0 }
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

  function locomotiveValues(presetId, mode) {
    var preset = LOCOMOTIVE_PRESETS[0];
    for (var i = 0; i < LOCOMOTIVE_PRESETS.length; i++) {
      if (LOCOMOTIVE_PRESETS[i].id === presetId) preset = LOCOMOTIVE_PRESETS[i];
    }
    if (preset.id === 'manual') return { preset: preset, weightTf: 0, brakeForceTf: 0, forcePerAxleTf: 0 };
    var normalizedMode = ['loaded', 'medium', 'empty'].indexOf(mode) >= 0 ? mode : 'loaded';
    var forcePerAxle = normalizedMode === 'empty'
      ? preset.emptyPerAxleTf
      : normalizedMode === 'medium'
        ? round(preset.loadedPerAxleTf * 0.7, 2)
        : preset.loadedPerAxleTf;
    return {
      preset: preset,
      weightTf: preset.weightTf,
      brakeForceTf: round(preset.axles * forcePerAxle, 2),
      forcePerAxleTf: forcePerAxle
    };
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
    var compositionWeight = Math.max(0, toNumber(input.weightTf));
    var norm = Math.max(0, toNumber(input.normPer100Tf));
    var locomotive = input.locomotive || {};
    var locomotiveEnabled = locomotive.enabled === true;
    var locomotiveWeight = locomotiveEnabled ? Math.max(0, toNumber(locomotive.weightTf)) : 0;
    var locomotiveBrakeForce = locomotiveEnabled ? Math.max(0, toNumber(locomotive.brakeForceTf)) : 0;
    var weight = round(compositionWeight + locomotiveWeight, 2);
    var wagonBrakeForce = actualBrakeForce(input.groups);
    var actual = round(wagonBrakeForce + locomotiveBrakeForce, 2);
    var required = requiredBrakeForce(weight, norm);
    var margin = round(actual - required, 2);
    var actualPer100 = weight ? round(actual * 100 / weight, 2) : 0;
    var gradient = Math.max(0, toNumber(input.gradientPermille));
    var manualFactor = manualBrakeFactor(gradient);
    return {
      compositionWeightTf: compositionWeight,
      weightTf: weight,
      locomotiveEnabled: locomotiveEnabled,
      locomotiveWeightTf: locomotiveWeight,
      locomotiveBrakeForceTf: locomotiveBrakeForce,
      wagonBrakeForceTf: wagonBrakeForce,
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
    LOCOMOTIVE_PRESETS: LOCOMOTIVE_PRESETS,
    MANUAL_BRAKE_TABLE: MANUAL_BRAKE_TABLE,
    toNumber: toNumber,
    requiredBrakeForce: requiredBrakeForce,
    actualBrakeForce: actualBrakeForce,
    locomotiveValues: locomotiveValues,
    manualBrakeFactor: manualBrakeFactor,
    requiredManualBrakeAxles: requiredManualBrakeAxles,
    calculate: calculate
  };
});
