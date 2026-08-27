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
