const test = require('node:test');
const assert = require('node:assert/strict');
const vu45 = require('../scripts/vu45-calculator.js');

test('required force uses freight norms and rounds every fraction upward', () => {
  assert.equal(vu45.requiredBrakeForce(5000, 33), 1650);
  assert.equal(vu45.requiredBrakeForce(5001, 33), 1651);
  assert.equal(vu45.requiredBrakeForce(1200, 55), 660);
});

test('actual force sums independent axle groups', () => {
  assert.equal(vu45.actualBrakeForce([
    { axles: 120, forcePerAxle: 8.5 },
    { axles: 40, forcePerAxle: 7 }
  ]), 1300);
});

test('comma decimals are accepted', () => {
  assert.equal(vu45.requiredBrakeForce('1000,5', '33'), 331);
  assert.equal(vu45.actualBrakeForce([{ axles: '10', forcePerAxle: '8,5' }]), 85);
});

test('manual brake table chooses the next conservative gradient row', () => {
  assert.equal(vu45.manualBrakeFactor(0), 0.4);
  assert.equal(vu45.manualBrakeFactor(7), 0.6);
  assert.equal(vu45.manualBrakeFactor(9.1), 0.8);
  assert.equal(vu45.manualBrakeFactor(20), 1.8);
  assert.equal(vu45.manualBrakeFactor(20.1), null);
});

test('manual brake axles round upward', () => {
  assert.equal(vu45.requiredManualBrakeAxles(5000, 10), 40);
  assert.equal(vu45.requiredManualBrakeAxles(5001, 10), 41);
  assert.equal(vu45.requiredManualBrakeAxles(5000, 21), null);
});

test('summary reports margin and local-rule warnings without claiming safety', () => {
  const result = vu45.calculate({
    weightTf: 5000,
    normPer100Tf: 33,
    gradientPermille: 14,
    groups: [{ axles: 200, forcePerAxle: 8.5 }]
  });
  assert.equal(result.requiredForceTf, 1650);
  assert.equal(result.actualForceTf, 1700);
  assert.equal(result.marginTf, 50);
  assert.equal(result.meetsEnteredNorm, true);
  assert.equal(result.requiredManualBrakeAxles, 60);
  assert.equal(result.localRuleWarning, true);
  assert.equal(result.manualCalculationRequired, false);
});

test('enabled locomotive adds its accounting weight and brake force', () => {
  const result = vu45.calculate({
    weightTf: 5000,
    normPer100Tf: 33,
    gradientPermille: 10,
    groups: [{ axles: 200, forcePerAxle: 8.5 }],
    locomotive: { enabled: true, weightTf: 288, brakeForceTf: 168 }
  });
  assert.equal(result.compositionWeightTf, 5000);
  assert.equal(result.weightTf, 5288);
  assert.equal(result.requiredForceTf, 1746);
  assert.equal(result.wagonBrakeForceTf, 1700);
  assert.equal(result.actualForceTf, 1868);
  assert.equal(result.actualPer100Tf, 35.33);
  assert.equal(result.requiredManualBrakeAxles, 43);
});

test('disabled locomotive values do not affect the calculation', () => {
  const result = vu45.calculate({
    weightTf: 5000,
    normPer100Tf: 33,
    groups: [{ axles: 200, forcePerAxle: 8.5 }],
    locomotive: { enabled: false, weightTf: 288, brakeForceTf: 140 }
  });
  assert.equal(result.weightTf, 5000);
  assert.equal(result.requiredForceTf, 1650);
  assert.equal(result.actualForceTf, 1700);
  assert.equal(result.locomotiveWeightTf, 0);
  assert.equal(result.locomotiveBrakeForceTf, 0);
});

test('locomotive catalog calculates total force for each brake mode', () => {
  assert.deepEqual(
    vu45.LOCOMOTIVE_PRESETS.slice(0, 2).map((preset) => preset.id),
    ['3te25k2m', '2te25km']
  );
  assert.deepEqual(
    { weight: vu45.locomotiveValues('3te25k2m', 'loaded').weightTf, force: vu45.locomotiveValues('3te25k2m', 'loaded').brakeForceTf },
    { weight: 441, force: 180 }
  );
  assert.deepEqual(
    { weight: vu45.locomotiveValues('2te25km', 'loaded').weightTf, force: vu45.locomotiveValues('2te25km', 'loaded').brakeForceTf },
    { weight: 288, force: 120 }
  );
  assert.equal(vu45.locomotiveValues('3te28', 'medium').brakeForceTf, 126);
  assert.deepEqual(vu45.locomotiveValues('2te10', 'loaded'), vu45.locomotiveValues('2te116', 'loaded'));
  assert.deepEqual(vu45.locomotiveValues('vl85', 'loaded'), vu45.locomotiveValues('3es5k', 'loaded'));
  assert.deepEqual(vu45.locomotiveValues('vl80s', 'empty'), vu45.locomotiveValues('2es5k', 'empty'));
  assert.equal(vu45.LOCOMOTIVE_PRESETS.length, 15);
  assert.deepEqual(
    { weight: vu45.locomotiveValues('tem2-tem18', 'loaded').weightTf, force: vu45.locomotiveValues('tem2-tem18', 'loaded').brakeForceTf },
    { weight: 126, force: 66 }
  );
  assert.deepEqual(
    { weight: vu45.locomotiveValues('tem7', 'empty').weightTf, force: vu45.locomotiveValues('tem7', 'empty').brakeForceTf },
    { weight: 182, force: 44 }
  );
  assert.equal(vu45.locomotiveValues('manual', 'loaded').brakeForceTf, 0);
  assert.deepEqual(
    { weight: vu45.locomotiveValues('3es5k', 'loaded').weightTf, force: vu45.locomotiveValues('3es5k', 'loaded').brakeForceTf },
    { weight: 288, force: 168 }
  );
  assert.equal(vu45.locomotiveValues('3es5k', 'medium').brakeForceTf, 117.6);
  assert.equal(vu45.locomotiveValues('3es5k', 'empty').brakeForceTf, 72);
  assert.equal(vu45.locomotiveValues('2te116', 'loaded').brakeForceTf, 144);
  assert.ok(vu45.LOCOMOTIVE_PRESETS.findIndex((preset) => preset.id === '3es5k') > vu45.LOCOMOTIVE_PRESETS.findIndex((preset) => preset.id === 'm62'));
});
