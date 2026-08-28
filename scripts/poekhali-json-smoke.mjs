import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.POEKHALI_SMOKE_PORT || 4319);
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = path.join(root, 'artifacts', 'poekhali-json-smoke');
const screenshotPath = path.join(artifactDir, 'postyshevo-novyi-urgal.png');
const postyshevoKomsomolskScreenshotPath = path.join(artifactDir, 'postyshevo-komsomolsk.png');
const liveTouchPanScreenshotPath = path.join(artifactDir, 'live-touch-pan.png');
const preparationScreenshotPath = path.join(artifactDir, 'preparation-without-gps.png');
const serviceArmPickerScreenshotPath = path.join(artifactDir, 'service-arm-picker.png');
const reportPath = path.join(artifactDir, 'report.json');
const progressPath = path.join(artifactDir, 'progress.log');
const mapId = 'dvost-postyshevo-novyi-urgal-odd';
const preview = {
  mapId,
  lineCoordinate: 3307500,
  sector: 18,
  even: false,
  wayNumber: 1,
  savedAt: Date.now()
};
const shift = {
  id: 'poekhali-json-smoke-shift',
  route_kind: 'work',
  route_from: '',
  route_to: '',
  train_number: '2101',
  train_length: '71',
  train_axles: '284',
  train_weight: '6300',
  start_msk: new Date(Date.now() - 60_000).toISOString(),
  end_msk: new Date(Date.now() + 3_600_000).toISOString(),
  created_at: new Date().toISOString()
};
const sectionAssets = [
  '/assets/tracker/sections/index.json',
  '/assets/tracker/sections/dvost-volochaevka-ii-dzemgi.json',
  '/assets/tracker/sections/dvost-postyshevo-komsomolsk.json',
  '/assets/tracker/sections/dvost-postyshevo-novyi-urgal-odd.json',
  '/assets/tracker/sections/dvost-vysokogornaya-oune-via-sollu.json',
  '/assets/tracker/sections/dvost-vysokogornaya-oune-via-muli.json',
  '/assets/tracker/sections/dvost-oune-pivan.json',
  '/assets/tracker/sections/dvost-pivan-novyi-mir.json'
];

const report = {
  startedAt: new Date().toISOString(),
  baseUrl,
  mapId,
  checks: {},
  consoleErrors: [],
  consoleWarnings: [],
  workerMessages: [],
  pageErrors: [],
  requestFailures: []
};

function pythonJsonString(value) {
  return JSON.stringify(String(value)).replace(/[\u007f-\uffff]/g, (character) => (
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  ));
}

function canonicalJson(value, key = '') {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((itemKey) => (
      `${pythonJsonString(itemKey)}:${canonicalJson(value[itemKey], itemKey)}`
    )).join(',')}}`;
  }
  if (typeof value === 'string') {
    return pythonJsonString(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot canonicalize non-finite profile number: ${value}`);
    }
    if (key === 'grad_permille') {
      if (Object.is(value, -0)) return '-0.0';
      return Number.isInteger(value) ? `${value}.0` : String(value);
    }
    return String(Math.trunc(value));
  }
  throw new Error(`Unsupported canonical profile value: ${String(value)}`);
}

function canonicalProfileDigest(elements, includeConfidence = false) {
  const normalized = elements.map((element) => ({
    start_m: Math.trunc(Number(element.start_m)),
    len_m: Math.trunc(Number(element.len_m)),
    grad_permille: Number(Number(element.grad_permille).toFixed(4)),
    ...(includeConfidence ? { confidence: String(element.confidence || '') } : {})
  }));
  return createHash('sha256').update(canonicalJson(normalized), 'utf8').digest('hex');
}

async function assertReviewedSectionProfile(expected) {
  const section = JSON.parse(await readFile(
    path.join(root, 'assets', 'tracker', 'sections', expected.file),
    'utf8'
  ));
  const confidence = section.elements.reduce((counts, element) => {
    const key = String(element.confidence || '');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const expectedRuntimeGaps = expected.runtimeGaps || [];
  const continuous = section.elements.every((element, index, elements) => (
    index === 0 || (() => {
      const previousEndM = Number(elements[index - 1].start_m) + Number(elements[index - 1].len_m);
      const currentStartM = Number(element.start_m);
      return previousEndM === currentStartM || expectedRuntimeGaps.some(
        (gap) => gap.startM === previousEndM && gap.endM === currentStartM
      );
    })()
  ));
  const review = section.provenance.find((item) => item.kind === 'regime_profile_builder_review');
  const actualProfileSha256 = canonicalProfileDigest(section.elements);
  const actualConfidenceSha256 = canonicalProfileDigest(section.elements, true);
  const anchors = expected.anchors.map((anchor) => {
    const element = section.elements.find((item) => Number(item.start_m) === anchor.startM);
    const actual = element ? {
      startM: Number(element.start_m),
      lenM: Number(element.len_m),
      grade: Number(element.grad_permille),
      confidence: String(element.confidence || '')
    } : null;
    if (
      !actual ||
      actual.lenM !== anchor.lenM ||
      Math.abs(actual.grade - anchor.grade) > 0.0001 ||
      actual.confidence !== anchor.confidence
    ) {
      throw new Error(`${expected.label} anchor mismatch: expected=${JSON.stringify(anchor)}, actual=${JSON.stringify(actual)}`);
    }
    return actual;
  });
  const confidenceMatches = Object.entries(expected.confidence).every(
    ([key, value]) => confidence[key] === value
  ) && Object.keys(confidence).length === Object.keys(expected.confidence).length;
  const actualEndM = Number(section.elements.at(-1)?.start_m) + Number(section.elements.at(-1)?.len_m);
  const runtimeGaps = (section.runtime?.profile_gaps || []).map((gap) => ({
    startM: Number(gap.start_m),
    endM: Number(gap.end_m)
  }));
  if (
    section.elements.length !== expected.elements ||
    !confidenceMatches ||
    !continuous ||
    Number(section.elements[0]?.start_m) !== expected.startM ||
    actualEndM !== expected.endM ||
    section.runtime?.profile_status !== (expected.profileStatus || 'pdf_verified') ||
    JSON.stringify(runtimeGaps) !== JSON.stringify(expectedRuntimeGaps) ||
    section.flags_for_review?.length !== expected.flags ||
    actualProfileSha256 !== expected.profileSha256 ||
    actualConfidenceSha256 !== expected.confidenceSha256 ||
    review?.profile_sha256 !== actualProfileSha256 ||
    review?.profile_with_confidence_sha256 !== actualConfidenceSha256 ||
    review?.resolved_issues !== expected.resolvedIssues ||
    review?.legacy_fallback_elements !== (expected.legacyFallbackElements || 0)
  ) {
    throw new Error(
      `Unexpected ${expected.label} reviewed profile: elements=${section.elements.length}, ` +
      `confidence=${JSON.stringify(confidence)}, continuous=${continuous}, range=${section.elements[0]?.start_m}..${actualEndM}, ` +
      `status=${section.runtime?.profile_status}, gaps=${JSON.stringify(runtimeGaps)}, ` +
      `flags=${section.flags_for_review?.length}, calculatedProfileSha=${actualProfileSha256}, ` +
      `calculatedConfidenceSha=${actualConfidenceSha256}, review=${JSON.stringify(review)}`
    );
  }
  return {
    elements: section.elements.length,
    confidence,
    continuous,
    anchors,
    runtimeGaps,
    profileSha256: actualProfileSha256,
    profileWithConfidenceSha256: actualConfidenceSha256
  };
}

report.checks.vysokogornayaSolluReviewedProfile = await assertReviewedSectionProfile({
  label: 'Vysokogornaya-Oune via Sollu',
  file: 'dvost-vysokogornaya-oune-via-sollu.json',
  elements: 33,
  confidence: { pdf_vector_confirmed: 32, manual_reviewed: 1 },
  startM: 183000,
  endM: 220900,
  flags: 4,
  profileSha256: '885c6028212cd9d3916dd4bebb4b826ff946d17342801dacbdf87d1c227b32f2',
  confidenceSha256: '2ad71dbce860cd52afd1ed89bbd0ccd17090c317f439ed2874f68f021a78330a',
  resolvedIssues: 1,
  anchors: [
    { startM: 183000, lenM: 200, grade: 2.4, confidence: 'manual_reviewed' },
    { startM: 211000, lenM: 2300, grade: -15.6, confidence: 'pdf_vector_confirmed' },
    { startM: 219000, lenM: 1900, grade: -0.2, confidence: 'pdf_vector_confirmed' }
  ]
});

report.checks.vysokogornayaMuliReviewedProfile = await assertReviewedSectionProfile({
  label: 'Vysokogornaya-Oune via Muli',
  file: 'dvost-vysokogornaya-oune-via-muli.json',
  elements: 36,
  confidence: { pdf_vector_confirmed: 25, manual_reviewed: 11 },
  startM: 183000,
  endM: 210000,
  flags: 4,
  profileSha256: '314041ec0d0b20bae0dbab4373146328a15dd4d40d0f01f3eb3c8156e86767c3',
  confidenceSha256: 'd8b864569d1caf5f3964e5c56de9fc1b1f9402eff54f2dbc351e154041d66646',
  resolvedIssues: 12,
  anchors: [
    { startM: 185700, lenM: 300, grade: 10.7, confidence: 'manual_reviewed' },
    { startM: 194600, lenM: 1000, grade: 17.5, confidence: 'manual_reviewed' },
    { startM: 198800, lenM: 3500, grade: -11.4, confidence: 'manual_reviewed' },
    { startM: 205400, lenM: 2200, grade: -18.2, confidence: 'manual_reviewed' },
    { startM: 208900, lenM: 200, grade: -2.5, confidence: 'manual_reviewed' }
  ]
});

report.checks.ounePivanReviewedProfile = await assertReviewedSectionProfile({
  label: 'Oune-Pivan',
  file: 'dvost-oune-pivan.json',
  elements: 341,
  confidence: {
    pdf_vector_confirmed: 122,
    manual_reviewed: 91,
    pdf_manual_evidence_replayed: 128
  },
  startM: 1000,
  endM: 184000,
  runtimeGaps: [{ startM: 91300, endM: 94000 }],
  profileStatus: 'pdf_verified',
  legacyFallbackElements: 0,
  flags: 4,
  profileSha256: 'a56166828963d590ce337262492830fafe6a87e80211fa729e2fde0a3df335db',
  confidenceSha256: 'd14ca096e531f6ece7bfe8566cb7e8949607d54fb774006e2b4b5fc81adcd95e',
  resolvedIssues: 92,
  anchors: [
    { startM: 60300, lenM: 200, grade: 5.6, confidence: 'pdf_manual_evidence_replayed' },
    { startM: 65800, lenM: 200, grade: 0.0, confidence: 'pdf_manual_evidence_replayed' },
    { startM: 97800, lenM: 200, grade: 3.7, confidence: 'manual_reviewed' },
    { startM: 98000, lenM: 100, grade: 3.7, confidence: 'pdf_manual_evidence_replayed' },
    { startM: 98100, lenM: 200, grade: -1.5, confidence: 'pdf_manual_evidence_replayed' },
    { startM: 111600, lenM: 1200, grade: -2.15, confidence: 'pdf_manual_evidence_replayed' },
    { startM: 149600, lenM: 400, grade: -3.8, confidence: 'pdf_manual_evidence_replayed' },
    { startM: 168500, lenM: 100, grade: -1.7, confidence: 'manual_reviewed' },
    { startM: 170500, lenM: 100, grade: 2.5, confidence: 'manual_reviewed' },
    { startM: 181600, lenM: 600, grade: 6.4, confidence: 'pdf_manual_evidence_replayed' },
    { startM: 183400, lenM: 600, grade: 16.55, confidence: 'pdf_manual_evidence_replayed' }
  ]
});

report.checks.pivanNovyiMirReviewedProfile = await assertReviewedSectionProfile({
  label: 'Pivan-Novy Mir',
  file: 'dvost-pivan-novyi-mir.json',
  elements: 32,
  confidence: { pdf_vector_confirmed: 21, manual_reviewed: 11 },
  startM: 1300,
  endM: 17000,
  runtimeGaps: [{ startM: 1000, endM: 1300 }],
  flags: 4,
  profileSha256: '90cb56dd74ec82f30dce99c3d2e36afa00c0395c24be168daeb50db3682ae4cc',
  confidenceSha256: '1671c58f2f03d9e8792e8780d6de8bfa6eea138a7e83947277e655323f4c9057',
  resolvedIssues: 11,
  anchors: [
    { startM: 1300, lenM: 200, grade: -5.5, confidence: 'manual_reviewed' },
    { startM: 1500, lenM: 1200, grade: -2.8, confidence: 'manual_reviewed' },
    { startM: 6200, lenM: 200, grade: -1.2, confidence: 'manual_reviewed' },
    { startM: 14200, lenM: 300, grade: -5.0, confidence: 'manual_reviewed' },
    { startM: 15400, lenM: 300, grade: 1.0, confidence: 'manual_reviewed' },
    { startM: 16900, lenM: 100, grade: -8.9, confidence: 'pdf_vector_confirmed' }
  ]
});

const novyiUrgalSection = JSON.parse(await readFile(
  path.join(root, 'assets', 'tracker', 'sections', 'dvost-postyshevo-novyi-urgal-odd.json'),
  'utf8'
));
const novyiUrgalCorrectedAnchors = [
  { startM: 3363500, lenM: 600, grade: 7.6, confidence: 'manual_reviewed' },
  { startM: 3373900, lenM: 400, grade: 11.3, confidence: 'manual_reviewed' },
  { startM: 3393800, lenM: 500, grade: -2.8, confidence: 'manual_reviewed' },
  { startM: 3409300, lenM: 200, grade: -0.5, confidence: 'pdf_vector_confirmed' },
  { startM: 3412000, lenM: 300, grade: 0.2, confidence: 'manual_reviewed' },
  { startM: 3418900, lenM: 100, grade: 0.0, confidence: 'manual_reviewed' },
  { startM: 3428500, lenM: 400, grade: -0.2, confidence: 'pdf_vector_confirmed' },
  { startM: 3428900, lenM: 700, grade: -0.3, confidence: 'pdf_vector_confirmed' },
  { startM: 3442000, lenM: 300, grade: -0.3, confidence: 'pdf_vector_confirmed' },
  { startM: 3466400, lenM: 300, grade: -0.7, confidence: 'pdf_vector_confirmed' },
  { startM: 3537600, lenM: 200, grade: 0.4, confidence: 'manual_reviewed' },
  { startM: 3549200, lenM: 300, grade: 0.2, confidence: 'manual_reviewed' },
  { startM: 3573600, lenM: 200, grade: 0.6, confidence: 'pdf_vector_confirmed' },
  { startM: 3603300, lenM: 200, grade: -0.5, confidence: 'pdf_vector_confirmed' }
].map((expected) => {
  const element = novyiUrgalSection.elements.find((item) => Number(item.start_m) === expected.startM);
  const actual = element ? {
    startM: Number(element.start_m),
    lenM: Number(element.len_m),
    grade: Number(element.grad_permille),
    confidence: String(element.confidence || '')
  } : null;
  if (
    !actual ||
    actual.lenM !== expected.lenM ||
    Math.abs(actual.grade - expected.grade) > 0.0001 ||
    actual.confidence !== expected.confidence
  ) {
    throw new Error(
      `Reviewed Novyi Urgal segment ${expected.startM} expected ${JSON.stringify(expected)}, ` +
      `got ${JSON.stringify(actual)}`
    );
  }
  return actual;
});
const novyiUrgalConfidence = novyiUrgalSection.elements.reduce((counts, element) => {
  const key = String(element.confidence || '');
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const novyiUrgalContinuous = novyiUrgalSection.elements.every((element, index, elements) => (
  index === 0 || Number(elements[index - 1].start_m) + Number(elements[index - 1].len_m) === Number(element.start_m)
));
const novyiUrgalReviewProvenance = novyiUrgalSection.provenance.find(
  (item) => item.kind === 'regime_profile_builder_review'
);
if (
  novyiUrgalSection.elements.length !== 879 ||
  novyiUrgalConfidence.pdf_vector_confirmed !== 872 ||
  novyiUrgalConfidence.manual_reviewed !== 7 ||
  !novyiUrgalContinuous ||
  novyiUrgalSection.elements[0]?.start_m !== 3299000 ||
  Number(novyiUrgalSection.elements.at(-1)?.start_m) + Number(novyiUrgalSection.elements.at(-1)?.len_m) !== 3616900 ||
  novyiUrgalSection.runtime?.profile_status !== 'pdf_verified' ||
  novyiUrgalSection.flags_for_review?.length !== 3 ||
  novyiUrgalReviewProvenance?.profile_sha256 !== '32e7756ddc1e38c36561286f80b4a0d3d7e499ad97cd787823b9879924f0ec08' ||
  novyiUrgalReviewProvenance?.profile_with_confidence_sha256 !== '47d91d7b0391dcd2dcebdaf39ce1fe129bea80271f658e94e039bd374a9d8b28' ||
  novyiUrgalReviewProvenance?.resolved_issues !== 7 ||
  novyiUrgalReviewProvenance?.legacy_fallback_elements !== 0
) {
  throw new Error(
    `Unexpected Novyi Urgal reviewed profile: elements=${novyiUrgalSection.elements.length}, ` +
    `confidence=${JSON.stringify(novyiUrgalConfidence)}, continuous=${novyiUrgalContinuous}, ` +
    `status=${novyiUrgalSection.runtime?.profile_status}, flags=${novyiUrgalSection.flags_for_review?.length}, ` +
    `provenance=${JSON.stringify(novyiUrgalReviewProvenance)}`
  );
}
report.checks.novyiUrgalReviewedProfile = {
  elements: novyiUrgalSection.elements.length,
  confidence: novyiUrgalConfidence,
  continuous: novyiUrgalContinuous,
  anchors: novyiUrgalCorrectedAnchors,
  profileSha256: novyiUrgalReviewProvenance.profile_sha256,
  profileWithConfidenceSha256: novyiUrgalReviewProvenance.profile_with_confidence_sha256
};

const volochaevkaSection = JSON.parse(await readFile(
  path.join(root, 'assets', 'tracker', 'sections', 'dvost-volochaevka-ii-dzemgi.json'),
  'utf8'
));
const volochaevkaReviewedAnchors = [
  { startM: 9000, lenM: 300, grade: 0.0, confidence: 'manual_reviewed' },
  { startM: 24500, lenM: 400, grade: 3.0, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 70700, lenM: 700, grade: 9.4, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 81400, lenM: 700, grade: -11.4, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 90700, lenM: 100, grade: -1.0, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 90900, lenM: 100, grade: 1.0, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 93500, lenM: 100, grade: 1.0, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 94700, lenM: 500, grade: -8.0, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 124400, lenM: 900, grade: 3.0, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 246800, lenM: 100, grade: 3.0, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 260600, lenM: 300, grade: 2.0, confidence: 'manual_reviewed_legacy_fallback' },
  { startM: 319400, lenM: 500, grade: 1.0, confidence: 'manual_reviewed' },
  { startM: 360600, lenM: 400, grade: 4.9, confidence: 'pdf_vector_confirmed' }
].map((expected) => {
  const element = volochaevkaSection.elements.find((item) => Number(item.start_m) === expected.startM);
  const actualGrade = element ? Number(element.grad_permille) : NaN;
  const actualLength = element ? Number(element.len_m) : NaN;
  const actualConfidence = element ? String(element.confidence || '') : '';
  if (
    !element ||
    actualLength !== expected.lenM ||
    Math.abs(actualGrade - expected.grade) > 0.0001 ||
    actualConfidence !== expected.confidence
  ) {
    throw new Error(
      `Reviewed Volochaevka profile segment ${expected.startM} expected ` +
      `${expected.lenM}m/${expected.grade}‰/${expected.confidence}, ` +
      `got ${actualLength}m/${actualGrade}‰/${actualConfidence}`
    );
  }
  return {
    startM: expected.startM,
    lenM: actualLength,
    grade: actualGrade,
    confidence: actualConfidence
  };
});
const volochaevkaConfidence = volochaevkaSection.elements.reduce((counts, element) => {
  const key = String(element.confidence || '');
  counts[key] = (counts[key] || 0) + 1;
  return counts;
}, {});
const volochaevkaContinuous = volochaevkaSection.elements.every((element, index, elements) => (
  index === 0 || Number(elements[index - 1].start_m) + Number(elements[index - 1].len_m) === Number(element.start_m)
));
const volochaevkaReviewProvenance = volochaevkaSection.provenance.find(
  (item) => item.kind === 'regime_profile_builder_review'
);
if (
  volochaevkaSection.elements.length !== 482 ||
  volochaevkaConfidence.pdf_vector_confirmed !== 458 ||
  volochaevkaConfidence.manual_reviewed !== 14 ||
  volochaevkaConfidence.manual_reviewed_legacy_fallback !== 10 ||
  !volochaevkaContinuous ||
  volochaevkaSection.elements[0]?.start_m !== 9000 ||
  Number(volochaevkaSection.elements.at(-1)?.start_m) + Number(volochaevkaSection.elements.at(-1)?.len_m) !== 361000 ||
  volochaevkaSection.runtime?.profile_status !== 'pdf_profile_audited_10_legacy_magnitudes' ||
  volochaevkaReviewProvenance?.profile_sha256 !== 'd6bd6af46b555988edccbf1017cb5c95a1ccc3e2677fe891a1051c1e4d1996ab' ||
  volochaevkaReviewProvenance?.profile_with_confidence_sha256 !== '3ea2cb99c9a399f33614723b140a0fc6c00677ae67a45a7191ade8bc356fbdf6' ||
  volochaevkaReviewProvenance?.legacy_fallback_elements !== 10
) {
  throw new Error(
    `Unexpected Volochaevka reviewed profile: elements=${volochaevkaSection.elements.length}, ` +
    `confidence=${JSON.stringify(volochaevkaConfidence)}, continuous=${volochaevkaContinuous}, ` +
    `status=${volochaevkaSection.runtime?.profile_status}, ` +
    `sha=${volochaevkaReviewProvenance?.profile_sha256}, ` +
    `confidenceSha=${volochaevkaReviewProvenance?.profile_with_confidence_sha256}, ` +
    `legacyFallback=${volochaevkaReviewProvenance?.legacy_fallback_elements}`
  );
}
report.checks.volochaevkaReviewedProfile = {
  elements: volochaevkaSection.elements.length,
  confidence: volochaevkaConfidence,
  continuous: volochaevkaContinuous,
  anchors: volochaevkaReviewedAnchors,
  profileSha256: volochaevkaReviewProvenance.profile_sha256,
  profileWithConfidenceSha256: volochaevkaReviewProvenance.profile_with_confidence_sha256,
  legacyFallbackElements: volochaevkaReviewProvenance.legacy_fallback_elements
};

const postyshevoKomsomolskSection = JSON.parse(await readFile(
  path.join(root, 'assets', 'tracker', 'sections', 'dvost-postyshevo-komsomolsk.json'),
  'utf8'
));
const correctedProfileAnchors = [
  { startM: 3618600, lenM: 1200, grade: -0.9 },
  { startM: 3619800, lenM: 500, grade: 0.5 },
  { startM: 3620300, lenM: 800, grade: 2.0 },
  { startM: 3621100, lenM: 300, grade: -0.7 },
  { startM: 3641000, lenM: 1100, grade: 9.2 },
  { startM: 3697900, lenM: 2200, grade: -8.8 },
  { startM: 3710500, lenM: 700, grade: 0.1 },
  { startM: 3718200, lenM: 500, grade: 1.0 },
  { startM: 3722600, lenM: 500, grade: 9.4 },
  { startM: 3723100, lenM: 1000, grade: 7.6 },
  { startM: 3753400, lenM: 900, grade: -3.1 },
  { startM: 3810900, lenM: 500, grade: -2.3 }
].map((expected) => {
  const element = postyshevoKomsomolskSection.elements.find((item) => Number(item.start_m) === expected.startM);
  const actualGrade = element ? Number(element.grad_permille) : NaN;
  const actualLength = element ? Number(element.len_m) : NaN;
  if (!element || actualLength !== expected.lenM || Math.abs(actualGrade - expected.grade) > 0.0001) {
    throw new Error(
      `PDF-audited profile segment ${expected.startM} expected ${expected.lenM}m/${expected.grade}‰, ` +
      `got ${actualLength}m/${actualGrade}‰`
    );
  }
  return { startM: expected.startM, lenM: actualLength, grade: actualGrade };
});
const obsoleteProfileBoundaries = [3619700, 3620200, 3621000, 3641900, 3711000, 3723500, 3753900]
  .filter((startM) => postyshevoKomsomolskSection.elements.some((item) => Number(item.start_m) === startM));
if (obsoleteProfileBoundaries.length) {
  throw new Error(`Obsolete Postyshevo-Komsomolsk profile boundaries remain: ${obsoleteProfileBoundaries.join(', ')}`);
}
const postyshevoKomsomolskConfidence = Object.fromEntries(
  Object.entries(postyshevoKomsomolskSection.elements.reduce((counts, element) => {
    const key = String(element.confidence || '');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {})).sort(([left], [right]) => left.localeCompare(right))
);
const postyshevoKomsomolskReviewProvenance = postyshevoKomsomolskSection.provenance.find(
  (item) => item.kind === 'regime_profile_builder_review'
);
if (
  postyshevoKomsomolskSection.elements.length !== 358 ||
  postyshevoKomsomolskConfidence.pdf_manual_evidence_replayed !== 350 ||
  postyshevoKomsomolskConfidence.manual_reviewed !== 2 ||
  postyshevoKomsomolskConfidence.manual_reviewed_legacy_fallback !== 6 ||
  postyshevoKomsomolskReviewProvenance?.profile_sha256 !== '132964a51de4256300bfabd654d3cb0326c597fe73b04c56acbafab1434a878b' ||
  postyshevoKomsomolskReviewProvenance?.profile_with_confidence_sha256 !== '5fc9f700d77346224208d95756c2c2c32b9150098597b80aed610880f8ad93f7' ||
  postyshevoKomsomolskReviewProvenance?.resolved_issues !== 8 ||
  postyshevoKomsomolskReviewProvenance?.legacy_fallback_elements !== 6
) {
  throw new Error(
    `Unexpected Postyshevo-Komsomolsk audit coverage: elements=${postyshevoKomsomolskSection.elements.length}, ` +
    `confidence=${JSON.stringify(postyshevoKomsomolskConfidence)}, ` +
    `provenance=${JSON.stringify(postyshevoKomsomolskReviewProvenance)}`
  );
}
report.checks.pdfCorrectedProfileAnchors = correctedProfileAnchors;
report.checks.postyshevoKomsomolskAuditCoverage = {
  elements: postyshevoKomsomolskSection.elements.length,
  confidence: postyshevoKomsomolskConfidence,
  obsoleteBoundaries: obsoleteProfileBoundaries,
  profileSha256: postyshevoKomsomolskReviewProvenance.profile_sha256,
  profileWithConfidenceSha256: postyshevoKomsomolskReviewProvenance.profile_with_confidence_sha256
};

await mkdir(artifactDir, { recursive: true });
await writeFile(progressPath, '', 'utf8');
async function mark(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  await appendFile(progressPath, line + '\n', 'utf8');
}
const server = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (chunk) => { serverLog += String(chunk); });
server.stderr.on('data', (chunk) => { serverLog += String(chunk); });

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: 'manual' });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not become ready at ${baseUrl}`);
}

async function assertShiftRouteAutoSelection(browser, { id, from, to, expectedMapId, expectedHeadPos }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await context.addInitScript((legacyMapId) => {
    localStorage.setItem('poekhali.mapId', legacyMapId);
    localStorage.removeItem('poekhali.previewProjection');
  }, 'komsomol-sk-tche-9');
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => (
    typeof window.startPoekhaliTrackerMode === 'function' &&
    typeof window.setActiveTab === 'function'
  ), null, { timeout: 15_000 });
  const routeShift = {
    ...shift,
    id,
    route_kind: 'trip',
    route_from: from,
    route_to: to
  };
  await page.evaluate((testShift) => {
    window.allShifts = [testShift];
    if (typeof window.setSelectedPoekhaliShiftId === 'function') {
      window.setSelectedPoekhaliShiftId(testShift.id);
    }
    window.setActiveTab('poekhali');
    window.startPoekhaliTrackerMode();
  }, routeShift);
  try {
    await page.waitForFunction(({ mapId, headPos }) => (
      localStorage.getItem('poekhali.mapId') === mapId &&
      window.poekhaliHud && window.poekhaliHud.hasProjection &&
      String(window.poekhaliHud.headPos || '').includes(headPos) &&
      String(document.getElementById('btnPoekhaliMap')?.title || '').includes('Постышево')
    ), { mapId: expectedMapId, headPos: expectedHeadPos }, { timeout: 20_000 });
  } catch (error) {
    const state = await page.evaluate(() => ({
      mapId: localStorage.getItem('poekhali.mapId') || '',
      mapTitle: document.getElementById('btnPoekhaliMap')?.title || '',
      hud: window.poekhaliHud || null
    }));
    throw new Error(`Shift route did not settle at ${expectedHeadPos}: ${JSON.stringify(state)}`, { cause: error });
  }
  const result = await page.evaluate(() => ({
    mapId: localStorage.getItem('poekhali.mapId') || '',
    mapTitle: document.getElementById('btnPoekhaliMap')?.title || '',
    headPos: String(window.poekhaliHud?.headPos || '')
  }));
  if (!result.mapTitle.includes('Постышево') || !result.mapTitle.includes('Комсомольск')) {
    throw new Error(`Unexpected auto-selected route map: ${JSON.stringify(result)}`);
  }
  await page.evaluate(() => {
    if (typeof window.stopPoekhaliTrackerMode === 'function') window.stopPoekhaliTrackerMode();
  });
  await context.close();
  return result;
}

async function assertPartialRouteDoesNotSelectDraft(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('poekhali.mapId', 'komsomol-sk-tche-9');
    localStorage.removeItem('poekhali.previewProjection');
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
  const partialShift = {
    ...shift,
    id: 'poekhali-json-smoke-partial-route',
    route_kind: 'trip',
    route_from: 'П',
    route_to: 'К'
  };
  await page.evaluate((testShift) => {
    window.allShifts = [testShift];
    window.setSelectedPoekhaliShiftId(testShift.id);
    window.setActiveTab('poekhali');
  }, partialShift);
  await page.waitForFunction(() => {
    const mapTitle = document.getElementById('btnPoekhaliMap')?.title || '';
    return localStorage.getItem('poekhali.mapId') === 'komsomol-sk-tche-9' && mapTitle.includes('Комсомольск ТЧЭ-9');
  }, null, { timeout: 15_000 });
  await page.waitForTimeout(1200);
  const result = await page.evaluate(() => ({
    mapId: localStorage.getItem('poekhali.mapId') || '',
    mapTitle: document.getElementById('btnPoekhaliMap')?.title || ''
  }));
  if (result.mapId !== 'komsomol-sk-tche-9') {
    throw new Error(`Partial station names selected a draft map: ${JSON.stringify(result)}`);
  }
  await page.evaluate(() => window.stopPoekhaliTrackerMode());
  await context.close();
  return result;
}

async function assertStaleRouteSelectionCannotWin(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block'
  });
  await context.addInitScript(() => {
    localStorage.setItem('poekhali.mapId', 'komsomol-sk-tche-9');
    localStorage.removeItem('poekhali.previewProjection');
  });
  const page = await context.newPage();
  await page.route('**/assets/tracker/sections/dvost-postyshevo-komsomolsk.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => typeof window.openPoekhaliForShift === 'function', null, { timeout: 15_000 });
  const staleShift = {
    ...shift,
    id: 'poekhali-json-smoke-stale-route',
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    route_kind: 'trip',
    route_from: 'Постышево',
    route_to: 'Комсомольск-Сортировочный'
  };
  const currentShift = {
    ...shift,
    id: 'poekhali-json-smoke-current-no-route',
    created_at: new Date().toISOString(),
    route_kind: 'work',
    route_from: '',
    route_to: ''
  };
  await page.evaluate(({ first, second }) => {
    window.allShifts = [first, second];
    window.setSelectedPoekhaliShiftId(first.id);
    window.setActiveTab('poekhali');
  }, { first: staleShift, second: currentShift });
  await page.waitForTimeout(80);
  const switched = await page.evaluate((shiftId) => window.openPoekhaliForShift(shiftId), currentShift.id);
  if (!switched) throw new Error('Rapid shift switch could not select the second shift');
  await page.waitForTimeout(1400);
  const result = await page.evaluate(() => ({
    shiftId: window.getPoekhaliTrainDetails()?.shift?.id || '',
    mapId: localStorage.getItem('poekhali.mapId') || '',
    mapTitle: document.getElementById('btnPoekhaliMap')?.title || ''
  }));
  if (result.shiftId !== currentShift.id || result.mapId !== 'komsomol-sk-tche-9') {
    throw new Error(`Stale route selection won the race: ${JSON.stringify(result)}`);
  }
  await page.evaluate(() => window.stopPoekhaliTrackerMode());
  await context.close();
  return result;
}

async function assertPreparationModeWithoutGps(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block'
  });
  await context.addInitScript(() => {
    localStorage.setItem('poekhali.mapId', 'komsomol-sk-tche-9');
    localStorage.removeItem('poekhali.previewProjection');
    window.__poekhaliGpsRequests = { watch: 0, current: 0 };
    const gpsWatchers = new Map();
    let nextGpsWatchId = 1;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition(success, error, options) {
          window.__poekhaliGpsRequests.watch += 1;
          const id = nextGpsWatchId++;
          gpsWatchers.set(id, { success, error, options });
          return id;
        },
        clearWatch(id) {
          gpsWatchers.delete(id);
        },
        getCurrentPosition() {
          window.__poekhaliGpsRequests.current += 1;
        }
      }
    });
    window.__emitPoekhaliPreparationGpsFix = (fix) => {
      const position = {
        timestamp: fix.ts,
        coords: {
          latitude: fix.lat,
          longitude: fix.lon,
          altitude: 40,
          accuracy: fix.accuracy,
          speed: 0,
          heading: null
        }
      };
      for (const watcher of gpsWatchers.values()) watcher.success(position);
    };
  });

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => (
    typeof window.openPoekhaliPreparationForShift === 'function' &&
    typeof window.setPoekhaliPositioningMode === 'function'
  ), null, { timeout: 15_000 });
  const preparationShift = {
    ...shift,
    id: 'poekhali-json-smoke-preparation',
    route_kind: 'trip',
    route_from: 'Постышево',
    route_to: 'Комсомольск-Сортировочный'
  };
  const opened = await page.evaluate((testShift) => {
    window.allShifts = [testShift];
    localStorage.setItem('shift_tracker_profile_v1', JSON.stringify({
      depot: 'ТЧЭ-9 Комсомольск-на-Амуре',
      railwayId: 'dvost',
      depotId: 'rzd:dvost:tche-9:komsomolsk-na-amure'
    }));
    return window.openPoekhaliPreparationForShift(testShift.id);
  }, preparationShift);
  if (!opened) throw new Error('Preparation mode did not open the selected shift');

  await page.waitForFunction(() => (
    !document.getElementById('poekhaliServiceArmSheet')?.classList.contains('hidden') &&
    document.querySelectorAll('#poekhaliServiceArmSheet .poekhali-arm-option').length === 3
  ), null, { timeout: 15_000 });
  const armPicker = await page.evaluate(() => ({
    title: document.getElementById('poekhaliArmSheetTitle')?.textContent.trim() || '',
    arms: Array.from(document.querySelectorAll('#poekhaliServiceArmSheet .poekhali-arm-option-copy strong'))
      .map((element) => element.textContent.trim()),
    actionLabels: Array.from(document.querySelectorAll('#poekhaliServiceArmSheet .poekhali-arm-option'))
      .map((element) => element.getAttribute('aria-label') || ''),
    routeCounts: Array.from(document.querySelectorAll('#poekhaliServiceArmSheet .poekhali-arm-option-route-count'))
      .map((element) => element.textContent.trim()),
    textChevrons: Array.from(document.querySelectorAll(
      '#poekhaliServiceArmSheet .poekhali-arm-option-arrow, #poekhaliServiceArmSheet .poekhali-arm-option-chevron'
    )).filter((element) => element.textContent.trim()).length,
    gpsRequests: { ...window.__poekhaliGpsRequests }
  }));
  if (armPicker.title !== 'Плечо обслуживания' || armPicker.arms.length !== 3 ||
      !armPicker.arms.some((name) => name.includes('Волочаевка')) ||
      !armPicker.arms.some((name) => name.includes('Высокогорная')) ||
      !armPicker.arms.some((name) => name.includes('Постышево')) ||
      armPicker.routeCounts.length !== 1 || armPicker.routeCounts[0] !== '2 пути' ||
      armPicker.textChevrons !== 0 ||
      !armPicker.actionLabels.some((label) => label.includes('Высокогорная') && label.includes('2 вариантов пути')) ||
      armPicker.gpsRequests.watch !== 0 || armPicker.gpsRequests.current !== 0) {
    throw new Error(`Service-arm picker contract failed: ${JSON.stringify(armPicker)}`);
  }
  await page.screenshot({ path: serviceArmPickerScreenshotPath });
  await page.locator('#poekhaliServiceArmSheet .poekhali-arm-option', { hasText: 'Высокогорная' }).click();
  await page.waitForFunction(() => (
    document.getElementById('poekhaliArmSheetTitle')?.textContent.includes('Высокогорная') &&
    document.querySelectorAll('#poekhaliServiceArmSheet .poekhali-arm-option').length === 2
  ));
  const vysokogornayaOptions = await page.evaluate(() => (
    Array.from(document.querySelectorAll('#poekhaliServiceArmSheet .poekhali-arm-option-copy strong'))
      .map((element) => element.textContent.trim())
  ));
  if (!vysokogornayaOptions.some((name) => name.includes('Соллу')) ||
      !vysokogornayaOptions.some((name) => name.includes('Мули'))) {
    throw new Error(`Vysokogornaya route variants are incomplete: ${JSON.stringify(vysokogornayaOptions)}`);
  }
  await page.locator('#poekhaliServiceArmSheet .poekhali-arm-option', { hasText: 'Соллу' }).click();
  await page.waitForFunction(() => (
    document.getElementById('poekhaliServiceArmSheet')?.classList.contains('hidden') &&
    localStorage.getItem('poekhali.mapId') === 'dvost-vysokogornaya-novyi-mir-passenger--via-sollu' &&
    window.poekhaliHud?.hasProjection === true
  ), null, { timeout: 20_000 });
  const solluState = await page.evaluate(() => ({
    mapId: localStorage.getItem('poekhali.mapId') || '',
    mapLocked: window.poekhaliHud?.serviceArmMapLocked,
    assetsError: String(window.poekhaliHud?.status || '')
  }));
  if (!solluState.mapLocked || solluState.assetsError === 'asset-error') {
    throw new Error(`Vysokogornaya via Sollu did not open: ${JSON.stringify(solluState)}`);
  }

  await page.evaluate((shiftId) => window.openPoekhaliPreparationForShift(shiftId), preparationShift.id);
  await page.waitForFunction(() => (
    !document.getElementById('poekhaliServiceArmSheet')?.classList.contains('hidden') &&
    document.querySelectorAll('#poekhaliServiceArmSheet .poekhali-arm-option').length === 3
  ));
  await page.waitForFunction(() => document.querySelectorAll('#poekhaliServiceArmSheet .poekhali-arm-option').length === 3);
  await page.locator('#poekhaliServiceArmSheet .poekhali-arm-option', { hasText: 'Постышево' }).click();

  await page.waitForFunction(() => (
    window.poekhaliHud?.positioningMode === 'preview' &&
    window.poekhaliHud?.hasProjection === true &&
    localStorage.getItem('poekhali.mapId') === 'dvost-postyshevo-komsomolsk' &&
    document.getElementById('appTopBarPreview')?.getAttribute('aria-pressed') === 'true'
  ), null, { timeout: 20_000 });

  const before = await page.evaluate(() => ({
    requests: { ...window.__poekhaliGpsRequests },
    coordinate: Number(window.poekhaliHud?.viewCoordinate),
    gpsMeta: window.poekhaliHud?.gpsMeta,
    trainVisible: window.poekhaliHud?.trainVisible,
    gpsTitle: document.getElementById('btnPoekhaliLive')?.title || '',
    gpsAction: document.querySelector('#appTopBarGps .app-top-bar-gps-word')?.textContent.trim() || '',
    controls: ['appTopBarGps', 'appTopBarPreview', 'appTopBarWay'].map((id) => {
      const element = document.getElementById(id);
      const rect = element?.getBoundingClientRect();
      const style = element ? getComputedStyle(element) : null;
      return {
        id,
        width: Math.round(rect?.width || 0),
        height: Math.round(rect?.height || 0),
        radius: style?.borderRadius || '',
        padding: style?.padding || ''
      };
    })
  }));
  if (before.requests.watch !== 0 || before.requests.current !== 0 || before.gpsMeta !== 'выкл' ||
      before.trainVisible !== false || !before.gpsTitle.includes('Начать поездку') || before.gpsAction !== 'НАЧАТЬ' ||
      new Set(before.controls.map((control) => control.width)).size !== 1 ||
      new Set(before.controls.map((control) => control.height)).size !== 1 ||
      new Set(before.controls.map((control) => control.radius)).size !== 1 ||
      new Set(before.controls.map((control) => control.padding)).size !== 1) {
    throw new Error(`Preparation mode requested GPS or exposed the wrong state: ${JSON.stringify(before)}`);
  }

  const canvas = page.locator('#poekhaliCanvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Preparation canvas has no bounding box');
  const y = box.y + box.height * 0.55;
  await page.mouse.move(box.x + box.width * 0.78, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25, y, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction((coordinate) => (
    Math.abs(Number(window.poekhaliHud?.viewCoordinate) - Number(coordinate)) > 500
  ), before.coordinate, { timeout: 10_000 });

  const afterBrowse = await page.evaluate(() => ({
    requests: { ...window.__poekhaliGpsRequests },
    coordinate: Number(window.poekhaliHud?.viewCoordinate),
    mode: window.poekhaliHud?.positioningMode,
    trainVisible: window.poekhaliHud?.trainVisible
  }));
  if (afterBrowse.requests.watch !== 0 || afterBrowse.requests.current !== 0 ||
      afterBrowse.mode !== 'preview' || afterBrowse.trainVisible !== false) {
    throw new Error(`Manual profile browse activated GPS: ${JSON.stringify(afterBrowse)}`);
  }
  await page.screenshot({ path: preparationScreenshotPath });

  await page.locator('#appTopBarGps').click();
  await page.waitForFunction(() => (
    window.poekhaliHud?.positioningMode === 'gps' &&
    window.__poekhaliGpsRequests.watch > 0
  ), null, { timeout: 10_000 });
  await page.evaluate((fix) => window.__emitPoekhaliPreparationGpsFix(fix), {
    lat: 51.65823519944607,
    lon: 135.661229380896,
    accuracy: 8,
    ts: Date.now()
  });
  await page.waitForFunction(() => (
    window.poekhaliHud?.live === true &&
    window.poekhaliHud?.trainVisible === true
  ), null, { timeout: 10_000 });
  await page.locator('#appTopBarPreview').click();
  await page.waitForFunction(() => (
    window.poekhaliHud?.positioningMode === 'preview' &&
    window.poekhaliHud?.trainVisible === false &&
    document.getElementById('trkCoordinateLabel')?.textContent === 'Точка обзора'
  ), null, { timeout: 10_000 });
  await page.locator('#appTopBarGps').click();
  await page.waitForFunction(() => (
    window.poekhaliHud?.positioningMode === 'gps' &&
    window.__poekhaliGpsRequests.watch > 1
  ), null, { timeout: 10_000 });
  await page.evaluate((fix) => window.__emitPoekhaliPreparationGpsFix(fix), {
    lat: 50.32500652792692,
    lon: 136.80009014182616,
    accuracy: 8,
    ts: Date.now()
  });
  await page.waitForFunction(() => window.poekhaliHud?.status === 'offtrack', null, { timeout: 10_000 });
  await page.waitForTimeout(1500);
  const routeIsolation = await page.evaluate(() => ({
    mapId: localStorage.getItem('poekhali.mapId') || '',
    mapLocked: window.poekhaliHud?.serviceArmMapLocked,
    live: window.poekhaliHud?.live,
    headPos: window.poekhaliHud?.headPos
  }));
  if (routeIsolation.mapId !== 'dvost-postyshevo-komsomolsk' || !routeIsolation.mapLocked ||
      routeIsolation.live || routeIsolation.headPos !== '—') {
    throw new Error(`Explicit shoulder leaked into a nearby map: ${JSON.stringify(routeIsolation)}`);
  }
  const result = await page.evaluate((initial) => ({
    gpsRequestsBeforeStart: initial,
    browsedMeters: Math.round(Math.abs(Number(window.poekhaliHud?.viewCoordinate) - Number(initial.coordinate))),
    gpsRequestsAfterStart: { ...window.__poekhaliGpsRequests },
    previewButtonPressed: document.getElementById('appTopBarPreview')?.getAttribute('aria-pressed'),
    serviceArms: initial.armPicker.arms,
    vysokogornayaOptions: initial.vysokogornayaOptions,
    sollu: initial.solluState,
    routeIsolation: initial.routeIsolation,
    serviceArmPickerScreenshot: 'artifacts\\poekhali-json-smoke\\service-arm-picker.png',
    screenshot: 'artifacts\\poekhali-json-smoke\\preparation-without-gps.png'
  }), { ...before, armPicker, vysokogornayaOptions, solluState, routeIsolation });
  await page.evaluate(() => window.stopPoekhaliTrackerMode());
  await context.close();
  return result;
}

async function assertLiveTouchPanSafety(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block'
  });
  const liveMapId = 'dvost-postyshevo-komsomolsk';
  const pointWarning = {
    id: 'poekhali-json-smoke-live-pan-warning',
    mapId: liveMapId,
    sector: 18,
    start: 3717900,
    end: 3717900,
    speed: 40,
    note: 'Проверка live-pan',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await context.addInitScript(({ mapId: storedMapId, warning }) => {
    localStorage.setItem('poekhali.mapId', storedMapId);
    localStorage.setItem('poekhali.warnings', JSON.stringify([warning]));
    localStorage.removeItem('poekhali.previewProjection');
    localStorage.removeItem('poekhali.lastProjection');
    const watchers = new Map();
    let nextWatchId = 1;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition(success, error, options) {
          const id = nextWatchId++;
          watchers.set(id, { success, error, options });
          return id;
        },
        clearWatch(id) {
          watchers.delete(id);
        },
        getCurrentPosition() {}
      }
    });
    window.__emitPoekhaliGpsFix = (fix) => {
      const position = {
        timestamp: fix.ts,
        coords: {
          latitude: fix.lat,
          longitude: fix.lon,
          altitude: 40,
          accuracy: fix.accuracy,
          speed: 20,
          heading: 90
        }
      };
      for (const watcher of watchers.values()) watcher.success(position);
    };
  }, { mapId: liveMapId, warning: pointWarning });

  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => (
    typeof window.startPoekhaliTrackerMode === 'function' &&
    typeof window.poekhaliReturnToTrain === 'function'
  ), null, { timeout: 15_000 });
  const liveShift = {
    ...shift,
    id: 'poekhali-json-smoke-live-touch-pan',
    route_kind: 'work',
    route_from: '',
    route_to: ''
  };
  await page.evaluate((testShift) => {
    window.allShifts = [testShift];
    window.setSelectedPoekhaliShiftId(testShift.id);
    window.setActiveTab('poekhali');
    window.startPoekhaliTrackerMode();
  }, liveShift);
  await page.waitForFunction((expectedMapId) => (
    localStorage.getItem('poekhali.mapId') === expectedMapId &&
    window.poekhaliHud?.hasProjection
  ), liveMapId, { timeout: 20_000 });

  const gpsFix = {
    lat: 51.19096233441612,
    lon: 136.7194234424976,
    accuracy: 8,
    ts: Date.now()
  };
  await page.evaluate((fix) => window.__emitPoekhaliGpsFix(fix), gpsFix);
  await page.waitForFunction(() => (
    window.poekhaliHud?.live === true &&
    window.poekhaliHud?.viewDetached === false &&
    window.poekhaliHud?.limitKmh === 40
  ), null, { timeout: 10_000 });

  const safetyKeys = ['headPos', 'limitKmh', 'gradeText', 'headline', 'reachText'];
  const before = await page.evaluate((keys) => {
    const canvas = document.getElementById('poekhaliCanvas');
    const stored = JSON.parse(localStorage.getItem('poekhali.lastProjection') || 'null');
    return {
      safety: Object.fromEntries(keys.map((key) => [key, window.poekhaliHud?.[key]])),
      stored,
      bitmap: canvas?.toDataURL() || '',
      touchAction: canvas ? getComputedStyle(canvas).touchAction : '',
      scrollY: window.scrollY,
      viewCoordinate: window.poekhaliHud?.viewCoordinate
    };
  }, safetyKeys);
  if (!before.stored || !before.touchAction.includes('pan-y') || !before.touchAction.includes('pinch-zoom')) {
    throw new Error(`Live pan prerequisites failed: ${JSON.stringify(before)}`);
  }

  const box = await page.locator('#poekhaliCanvas').boundingBox();
  if (!box) throw new Error('Live pan canvas has no bounding box');
  const cdp = await context.newCDPSession(page);
  const y = Math.round(box.y + box.height * 0.55);
  async function dragProfile(startRatio, endRatio, pointerId, paceMs = 0) {
    const startX = Math.round(box.x + box.width * startRatio);
    const endX = Math.round(box.x + box.width * endRatio);
    const renderSamples = [];
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: startX, y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }]
    });
    for (let step = 1; step <= 5; step += 1) {
      const x = Math.round(startX + ((endX - startX) * step / 5));
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, id: pointerId, radiusX: 1, radiusY: 1, force: 1 }]
      });
      if (paceMs > 0) {
        await page.waitForTimeout(paceMs);
        renderSamples.push(await page.evaluate(() => ({
          dpr: window.poekhaliHud?.canvasDpr,
          sequence: window.poekhaliHud?.canvasDrawSequence
        })));
      }
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return renderSamples;
  }
  const dragRenderSamples = await dragProfile(0.82, 0.18, 1, 40);
  await page.waitForFunction(() => (
    window.poekhaliHud?.viewDetached === true &&
    window.poekhaliHud?.browseDragging === false &&
    Number(window.poekhaliHud?.canvasDpr) >= 1.9 &&
    Math.abs(Number(window.poekhaliHud?.browseOffsetMeters || 0)) >= 1000 &&
    document.getElementById('trkBrowseHud')?.hidden === false
  ), null, { timeout: 10_000 });
  const dragSequences = [...new Set(dragRenderSamples.map((sample) => Number(sample.sequence)).filter(Number.isFinite))];
  if (dragSequences.length < 3 || dragRenderSamples.some((sample) => Number(sample.dpr) > 1.25)) {
    throw new Error(`Live pan render cadence/resolution regression: ${JSON.stringify(dragRenderSamples)}`);
  }

  const afterPan = await page.evaluate((keys) => {
    const canvas = document.getElementById('poekhaliCanvas');
    const browseHud = document.getElementById('trkBrowseHud');
    const browseReturn = document.getElementById('trkBrowseReturn');
    const canvasRect = canvas?.getBoundingClientRect();
    const buttonRect = browseReturn?.getBoundingClientRect();
    return {
      safety: Object.fromEntries(keys.map((key) => [key, window.poekhaliHud?.[key]])),
      stored: JSON.parse(localStorage.getItem('poekhali.lastProjection') || 'null'),
      bitmap: canvas?.toDataURL() || '',
      scrollY: window.scrollY,
      viewCoordinate: window.poekhaliHud?.viewCoordinate,
      viewSector: window.poekhaliHud?.viewSector,
      offsetMeters: window.poekhaliHud?.browseOffsetMeters,
      autoReturnAt: window.poekhaliHud?.browseAutoReturnAt,
      autoReturnDelayMs: window.poekhaliHud?.browseAutoReturnDelayMs,
      buttonVisible: browseHud?.hidden === false,
      buttonText: browseHud?.innerText.trim() || '',
      buttonCount: browseHud?.querySelectorAll(':scope > button').length || 0,
      childCount: browseHud?.children.length || 0,
      statusPresent: Boolean(document.getElementById('trkBrowseStatus')),
      buttonCenterDelta: canvasRect && buttonRect
        ? Math.abs((buttonRect.left + buttonRect.width / 2) - (canvasRect.left + canvasRect.width / 2))
        : null
    };
  }, safetyKeys);
  if (JSON.stringify(afterPan.safety) !== JSON.stringify(before.safety) ||
      JSON.stringify(afterPan.stored) !== JSON.stringify(before.stored) ||
      afterPan.bitmap === before.bitmap || afterPan.scrollY !== before.scrollY ||
      Math.abs(Number(afterPan.viewCoordinate) - Number(before.viewCoordinate)) < 1000 ||
      !afterPan.buttonVisible || afterPan.buttonText !== 'К поезду' ||
      afterPan.buttonCount !== 1 || afterPan.childCount !== 1 || afterPan.statusPresent ||
      typeof afterPan.buttonCenterDelta !== 'number' || !Number.isFinite(afterPan.buttonCenterDelta) ||
      afterPan.buttonCenterDelta > 1 ||
      afterPan.autoReturnDelayMs !== 8000 ||
      !Number.isFinite(Number(afterPan.autoReturnAt))) {
    throw new Error(`Live touch pan changed operational state: ${JSON.stringify({
      before: { ...before, bitmap: before.bitmap ? '[bitmap]' : '' },
      afterPan: { ...afterPan, bitmap: afterPan.bitmap ? '[bitmap]' : '' }
    })}`);
  }
  await page.screenshot({ path: liveTouchPanScreenshotPath });

  await page.waitForTimeout(20);
  const movedGpsFix = {
    ...gpsFix,
    lat: gpsFix.lat - 0.0000951109899,
    lon: gpsFix.lon + 0.0002429226434,
    ts: gpsFix.ts + 20_000
  };
  await page.evaluate((fix) => window.__emitPoekhaliGpsFix(fix), movedGpsFix);
  await page.waitForFunction((savedAt) => {
    const stored = JSON.parse(localStorage.getItem('poekhali.lastProjection') || 'null');
    return stored?.savedAt > savedAt;
  }, before.stored.savedAt, { timeout: 10_000 });
  const afterGps = await page.evaluate((keys) => ({
    safety: Object.fromEntries(keys.map((key) => [key, window.poekhaliHud?.[key]])),
    stored: JSON.parse(localStorage.getItem('poekhali.lastProjection') || 'null'),
    viewDetached: window.poekhaliHud?.viewDetached,
    viewCoordinate: window.poekhaliHud?.viewCoordinate
  }), safetyKeys);
  if (!afterGps.viewDetached ||
      Math.abs(Number(afterGps.viewCoordinate) - Number(afterPan.viewCoordinate)) > 1 ||
      Math.abs(Number(afterGps.stored?.lineCoordinate) - Number(before.stored.lineCoordinate)) < 10 ||
      JSON.stringify(afterGps.safety) !== JSON.stringify(before.safety)) {
    throw new Error(`Fresh GPS fix snapped the detached view: ${JSON.stringify({
      before: { ...before, bitmap: before.bitmap ? '[bitmap]' : '' },
      afterPan: { ...afterPan, bitmap: afterPan.bitmap ? '[bitmap]' : '' },
      afterGps
    })}`);
  }

  await page.locator('#trkBrowseReturn').click();
  await page.waitForFunction(() => {
    const stored = JSON.parse(localStorage.getItem('poekhali.lastProjection') || 'null');
    return window.poekhaliHud?.viewDetached === false &&
      Math.abs(Number(window.poekhaliHud?.viewCoordinate) - Number(stored?.lineCoordinate)) < 1 &&
      document.getElementById('trkBrowseHud')?.hidden === true &&
      document.getElementById('poekhaliOpsSheet')?.classList.contains('hidden') !== false;
  }, null, { timeout: 10_000 });
  const result = await page.evaluate(() => ({
    offsetMeters: window.poekhaliHud?.browseOffsetMeters,
    returnedCoordinate: window.poekhaliHud?.viewCoordinate,
    storedCoordinate: JSON.parse(localStorage.getItem('poekhali.lastProjection') || 'null')?.lineCoordinate,
    touchAction: getComputedStyle(document.getElementById('poekhaliCanvas')).touchAction
  }));

  await dragProfile(0.78, 0.24, 2);
  await page.waitForFunction(() => (
    window.poekhaliHud?.viewDetached === true &&
    Number(window.poekhaliHud?.browseAutoReturnAt || 0) > Date.now()
  ), null, { timeout: 2000 });
  const firstAutoState = await page.evaluate(() => ({
    now: Date.now(),
    detached: window.poekhaliHud?.viewDetached,
    autoReturnAt: Number(window.poekhaliHud?.browseAutoReturnAt || 0)
  }));
  if (!firstAutoState.detached || firstAutoState.autoReturnAt <= firstAutoState.now) {
    throw new Error(`Browse auto-return was not scheduled: ${JSON.stringify(firstAutoState)}`);
  }

  await page.waitForTimeout(1000);
  await dragProfile(0.56, 0.48, 3);
  await page.waitForFunction((previousDeadline) => (
    window.poekhaliHud?.viewDetached === true &&
    Number(window.poekhaliHud?.browseAutoReturnAt || 0) > previousDeadline
  ), firstAutoState.autoReturnAt, { timeout: 2000 });
  const resetAutoState = await page.evaluate(() => ({
    now: Date.now(),
    detached: window.poekhaliHud?.viewDetached,
    autoReturnAt: Number(window.poekhaliHud?.browseAutoReturnAt || 0)
  }));
  const resetDelayMs = resetAutoState.autoReturnAt - resetAutoState.now;
  if (!resetAutoState.detached || resetAutoState.autoReturnAt <= firstAutoState.autoReturnAt ||
      resetDelayMs < 7000 || resetDelayMs > 8000) {
    throw new Error(`New touch did not restart browse auto-return: ${JSON.stringify({ firstAutoState, resetAutoState })}`);
  }

  await page.waitForTimeout(Math.max(0, firstAutoState.autoReturnAt + 250 - Date.now()));
  const afterOriginalDeadline = await page.evaluate(() => ({
    now: Date.now(),
    detached: window.poekhaliHud?.viewDetached,
    autoReturnAt: Number(window.poekhaliHud?.browseAutoReturnAt || 0),
    buttonVisible: document.getElementById('trkBrowseHud')?.hidden === false
  }));
  if (!afterOriginalDeadline.detached || !afterOriginalDeadline.buttonVisible ||
      afterOriginalDeadline.autoReturnAt !== resetAutoState.autoReturnAt) {
    throw new Error(`Browse returned on the stale idle deadline: ${JSON.stringify({
      firstAutoState,
      resetAutoState,
      afterOriginalDeadline
    })}`);
  }

  await page.waitForTimeout(Math.max(0, resetAutoState.autoReturnAt - Date.now() - 300));
  const beforeAutoReturn = await page.evaluate(() => ({
    now: Date.now(),
    detached: window.poekhaliHud?.viewDetached,
    autoReturnAt: Number(window.poekhaliHud?.browseAutoReturnAt || 0),
    buttonVisible: document.getElementById('trkBrowseHud')?.hidden === false
  }));
  if (!beforeAutoReturn.detached || !beforeAutoReturn.buttonVisible ||
      beforeAutoReturn.autoReturnAt !== resetAutoState.autoReturnAt ||
      beforeAutoReturn.now >= resetAutoState.autoReturnAt) {
    throw new Error(`Browse returned before 8 seconds of inactivity: ${JSON.stringify({
      resetAutoState,
      beforeAutoReturn
    })}`);
  }

  await page.waitForFunction(() => (
    window.poekhaliHud?.viewDetached === false &&
    document.getElementById('trkBrowseHud')?.hidden === true
  ), null, { timeout: 12_000 });
  const afterAutoReturn = await page.evaluate((keys) => {
    const stored = JSON.parse(localStorage.getItem('poekhali.lastProjection') || 'null');
    return {
      detached: window.poekhaliHud?.viewDetached,
      dragging: window.poekhaliHud?.browseDragging,
      autoReturnAt: window.poekhaliHud?.browseAutoReturnAt,
      now: Date.now(),
      buttonHidden: document.getElementById('trkBrowseHud')?.hidden === true,
      returnedCoordinate: window.poekhaliHud?.viewCoordinate,
      storedCoordinate: stored?.lineCoordinate,
      safety: Object.fromEntries(keys.map((key) => [key, window.poekhaliHud?.[key]]))
    };
  }, safetyKeys);
  if (afterAutoReturn.detached || !afterAutoReturn.buttonHidden ||
      Math.abs(Number(afterAutoReturn.returnedCoordinate) - Number(afterAutoReturn.storedCoordinate)) >= 1 ||
      JSON.stringify(afterAutoReturn.safety) !== JSON.stringify(afterGps.safety)) {
    throw new Error(`Browse did not auto-return safely: ${JSON.stringify({
      firstAutoState,
      resetAutoState,
      afterOriginalDeadline,
      beforeAutoReturn,
      afterAutoReturn
    })}`);
  }

  await page.evaluate(() => window.stopPoekhaliTrackerMode());
  await context.close();
  return {
    detachedOffsetMeters: Math.round(Number(afterPan.offsetMeters)),
    gpsDidNotSnapView: true,
    safetyHudStable: true,
    returnedToTrain: Math.abs(Number(result.returnedCoordinate) - Number(result.storedCoordinate)) < 1,
    centeredReturnButton: Number(afterPan.buttonCenterDelta) <= 1,
    autoReturnDelayMs: afterPan.autoReturnDelayMs,
    autoReturnRestartedByTouch: resetAutoState.autoReturnAt > firstAutoState.autoReturnAt,
    autoReturnedToTrain: Math.abs(Number(afterAutoReturn.returnedCoordinate) - Number(afterAutoReturn.storedCoordinate)) < 1,
    responsiveDragFrames: dragSequences.length,
    dragDprCap: Math.max(...dragRenderSamples.map((sample) => Number(sample.dpr) || 0)),
    touchAction: result.touchAction,
    screenshot: path.relative(root, liveTouchPanScreenshotPath)
  };
}

async function assertLocalGpsCapture(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem('poekhali.mapId', 'komsomol-sk-tche-9');
    localStorage.removeItem('poekhali.previewProjection');
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key && key.startsWith('poekhali.mapLearning.v1')) localStorage.removeItem(key);
    }
    const originalStorageSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (window.__failPoekhaliLearningStorage && key.startsWith('poekhali.mapLearning.v1:')) {
        throw new DOMException('quota test', 'QuotaExceededError');
      }
      return originalStorageSetItem.call(this, key, value);
    };
    const watchers = new Map();
    let nextWatchId = 1;
    const geolocation = {
      watchPosition(success, error, options) {
        const id = nextWatchId++;
        watchers.set(id, { success, error, options });
        return id;
      },
      clearWatch(id) {
        watchers.delete(id);
      },
      getCurrentPosition() {}
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: geolocation
    });
    window.__emitPoekhaliGpsFix = (fix) => {
      const position = {
        timestamp: fix.ts,
        coords: {
          latitude: fix.lat,
          longitude: fix.lon,
          altitude: fix.altitude ?? 40,
          accuracy: fix.accuracy,
          speed: Object.prototype.hasOwnProperty.call(fix, 'speed') ? fix.speed : 20,
          heading: Object.prototype.hasOwnProperty.call(fix, 'heading') ? fix.heading : 90
        }
      };
      for (const watcher of watchers.values()) watcher.success(position);
    };
  });
  const learningRequests = [];
  const page = await context.newPage();
  page.on('request', (request) => {
    if (request.url().includes('/api/poekhali-learning')) learningRequests.push(request.url());
  });
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await page.waitForFunction(() => (
    typeof window.startPoekhaliTrackerMode === 'function' &&
    typeof window.getPoekhaliGpsCaptureState === 'function'
  ), null, { timeout: 15_000 });
  const captureShift = {
    ...shift,
    id: 'poekhali-json-smoke-gps-capture',
    route_kind: 'trip',
    route_from: 'Постышево',
    route_to: 'Комсомольск-Сортировочный'
  };
  await page.evaluate((testShift) => {
    window.allShifts = [testShift];
    window.setSelectedPoekhaliShiftId(testShift.id);
    window.setActiveTab('poekhali');
  }, captureShift);
  await page.waitForFunction(() => (
    localStorage.getItem('poekhali.mapId') === 'dvost-postyshevo-komsomolsk' &&
    window.poekhaliHud && window.poekhaliHud.hasProjection
  ), null, { timeout: 20_000 });

  const a = { lat: 51.65823519944607, lon: 135.661229380896 };
  const b = { lat: 51.66268364376746, lon: 135.67388888337942 };
  const interpolate = (factor) => ({
    lat: a.lat + (b.lat - a.lat) * factor,
    lon: a.lon + (b.lon - a.lon) * factor
  });
  const t0 = Date.now();
  await page.evaluate((value) => window.__emitPoekhaliGpsFix(value), { ...a, accuracy: 10, ts: t0 - 1000 });
  const beforeExplicitStart = await page.evaluate(() => ({
    capture: window.getPoekhaliGpsCaptureState(),
    stored: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .some((key) => key && key.startsWith('poekhali.mapLearning.v1:'))
  }));
  if (beforeExplicitStart.capture.active || beforeExplicitStart.capture.samples || beforeExplicitStart.stored) {
    throw new Error(`GPS capture started without explicit consent: ${JSON.stringify(beforeExplicitStart)}`);
  }
  await page.evaluate(() => document.getElementById('btnPoekhaliLive')?.click());
  await page.waitForTimeout(100);
  const afterUserGpsClick = await page.evaluate(() => {
    const button = document.getElementById('btnPoekhaliLive');
    return {
      capture: window.getPoekhaliGpsCaptureState(),
      label: button?.getAttribute('aria-label') || '',
      title: button?.title || ''
    };
  });
  if (afterUserGpsClick.capture.active || /запис|контрольн/i.test(afterUserGpsClick.label + ' ' + afterUserGpsClick.title)) {
    throw new Error(`User GPS status control exposed diagnostic capture: ${JSON.stringify(afterUserGpsClick)}`);
  }
  const started = await page.evaluate(() => window.startPoekhaliGpsCapture());
  if (!started) throw new Error('Explicit GPS capture did not start');
  const fixes = [
    { ...a, accuracy: 12, ts: t0 },
    { ...interpolate(0.04), accuracy: 120, ts: t0 + 1000 },
    { ...a, accuracy: 10, ts: t0 + 20_000 },
    { ...interpolate(0.08), accuracy: 10, ts: t0 + 22_000 },
    { ...interpolate(0.09), accuracy: 9, ts: t0 + 42_000 },
    { ...interpolate(0.1), accuracy: 9, ts: t0 + 21_000 },
    { ...b, accuracy: 8, ts: t0 + 43_000 }
  ];
  for (const fix of fixes) {
    await page.evaluate((value) => window.__emitPoekhaliGpsFix(value), fix);
  }
  await page.waitForFunction(() => (
    window.getPoekhaliGpsCaptureState().samples === 3 &&
    window.poekhaliHud?.gpsRecording === true &&
    window.poekhaliHud?.gpsRecordedSamples === 3
  ), null, { timeout: 10_000 });
  const liveState = await page.evaluate(() => ({
    capture: window.getPoekhaliGpsCaptureState(),
    hud: {
      gpsRecording: window.poekhaliHud?.gpsRecording,
      gpsRecordedSamples: window.poekhaliHud?.gpsRecordedSamples
    }
  }));
  await page.evaluate(() => window.stopPoekhaliTrackerMode());
  await page.evaluate(() => window.startPoekhaliTrackerMode());
  await page.waitForFunction(() => window.getPoekhaliGpsCaptureState().available === true, null, { timeout: 15_000 });
  const resumed = await page.evaluate(() => ({
    started: window.startPoekhaliGpsCapture(),
    state: window.getPoekhaliGpsCaptureState()
  }));
  if (!resumed.started || resumed.state.trackKey !== liveState.capture.trackKey) {
    throw new Error(`Interrupted GPS capture did not resume: ${JSON.stringify({ liveState, resumed })}`);
  }
  await page.evaluate((value) => window.__emitPoekhaliGpsFix(value), {
    ...interpolate(0.17),
    accuracy: 8,
    ts: t0 + 100_000
  });
  await page.waitForFunction(() => window.getPoekhaliGpsCaptureState().samples === 4, null, { timeout: 10_000 });
  await page.evaluate(() => {
    window.stopPoekhaliGpsCapture();
    window.stopPoekhaliTrackerMode();
  });
  const persisted = await page.evaluate(() => {
    const storageKey = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .find((key) => key && key.startsWith('poekhali.mapLearning.v1:'));
    const store = JSON.parse(storageKey ? localStorage.getItem(storageKey) : '{}');
    const map = store.maps?.['dvost-postyshevo-komsomolsk'];
    const entries = Object.entries(map?.rawTracks || {});
    const gpsPackage = window.buildPoekhaliGpsCapturePackage();
    return {
      storageKey,
      entries,
      gpsPackage
    };
  });
  if (persisted.entries.length !== 1) {
    throw new Error(`Expected one local GPS capture, got ${persisted.entries.length}`);
  }
  const [captureId, bucket] = persisted.entries[0];
  if (bucket.samples?.length !== 4 || bucket.purpose !== 'field_geometry_capture' ||
      bucket.status !== 'completed' || bucket.routeFrom !== 'Постышево' ||
      bucket.routeTo !== 'Комсомольск-Сортировочный' ||
      bucket.samples.some((sample) => sample.heading !== 90) ||
      new Set(bucket.samples.map((sample) => sample.segmentId)).size !== 2) {
    throw new Error(`Unexpected persisted GPS capture: ${JSON.stringify({ captureId, bucket })}`);
  }
  if (persisted.gpsPackage?.schema !== 'bloknot.poekhali.gps-captures' || persisted.gpsPackage.captures?.length !== 1) {
    throw new Error(`Unexpected GPS-only export package: ${JSON.stringify(persisted.gpsPackage)}`);
  }
  if (persisted.gpsPackage.captures[0].samples.some((sample) => sample.heading !== 90 || sample.shiftId !== undefined)) {
    throw new Error(`GPS-only export leaked or lost sample fields: ${JSON.stringify(persisted.gpsPackage.captures[0].samples)}`);
  }
  if (learningRequests.length) {
    throw new Error(`GPS capture attempted backend sync: ${learningRequests.join(', ')}`);
  }

  const ownerIsolation = await page.evaluate(() => {
    const originalOwnerGetter = window.getOfflineStorageUserId;
    const ownOwner = originalOwnerGetter();
    window.getOfflineStorageUserId = () => 'smoke-other-owner';
    const otherPackage = window.buildPoekhaliGpsCapturePackage();
    window.getOfflineStorageUserId = originalOwnerGetter;
    const ownPackage = window.buildPoekhaliGpsCapturePackage();
    return {
      ownOwner,
      otherCaptures: otherPackage.captures.length,
      ownCaptures: ownPackage.captures.length,
      scopedKeys: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
        .filter((key) => key && key.startsWith('poekhali.mapLearning.v1:'))
    };
  });
  if (ownerIsolation.otherCaptures !== 0 || ownerIsolation.ownCaptures !== 1 || ownerIsolation.scopedKeys.length < 1) {
    throw new Error(`Per-owner GPS isolation failed: ${JSON.stringify(ownerIsolation)}`);
  }

  const migration = await page.evaluate(() => {
    const originalOwnerGetter = window.getOfflineStorageUserId;
    const ownOwner = originalOwnerGetter();
    const ownKey = 'poekhali.mapLearning.v1:' + String(ownOwner).replace(/[^a-zA-Z0-9_.:-]+/g, '_').slice(0, 120);
    localStorage.setItem('poekhali.mapLearning.v1', localStorage.getItem(ownKey));
    window.getOfflineStorageUserId = () => 'smoke-migration-owner';
    const migratedPackage = window.buildPoekhaliGpsCapturePackage();
    const migratedKey = 'poekhali.mapLearning.v1:smoke-migration-owner';
    const result = {
      captures: migratedPackage.captures.length,
      scopedExists: Boolean(localStorage.getItem(migratedKey)),
      legacyRemoved: !localStorage.getItem('poekhali.mapLearning.v1')
    };
    window.clearPoekhaliGpsCaptures();
    window.getOfflineStorageUserId = originalOwnerGetter;
    window.buildPoekhaliGpsCapturePackage();
    return result;
  });
  if (migration.captures !== 1 || !migration.scopedExists || !migration.legacyRemoved) {
    throw new Error(`Legacy GPS store migration failed: ${JSON.stringify(migration)}`);
  }

  const cleared = await page.evaluate(() => ({
    removed: window.clearPoekhaliGpsCaptures(),
    remaining: window.buildPoekhaliGpsCapturePackage().captures.length
  }));
  if (cleared.removed !== 1 || cleared.remaining !== 0) {
    throw new Error(`GPS export/clear lifecycle failed: ${JSON.stringify(cleared)}`);
  }

  await page.evaluate(() => window.startPoekhaliTrackerMode());
  await page.waitForFunction(() => window.getPoekhaliGpsCaptureState().available === true, null, { timeout: 15_000 });
  const quotaCaptureStarted = await page.evaluate(() => {
    window.__failPoekhaliLearningStorage = true;
    return window.startPoekhaliGpsCapture();
  });
  if (!quotaCaptureStarted) throw new Error('Quota failure capture did not start');
  await page.evaluate((value) => window.__emitPoekhaliGpsFix(value), {
    ...a,
    accuracy: 8,
    heading: null,
    speed: null,
    ts: Date.now()
  });
  await page.waitForFunction(() => {
    const state = window.getPoekhaliGpsCaptureState();
    return !state.active && Boolean(state.error) && window.poekhaliHud?.gpsCaptureError;
  }, null, { timeout: 10_000 });
  const quotaFailure = await page.evaluate(() => {
    const state = window.getPoekhaliGpsCaptureState();
    const gpsPackage = window.buildPoekhaliGpsCapturePackage();
    window.__failPoekhaliLearningStorage = false;
    return { state, gpsPackage };
  });
  if (!quotaFailure.state.error || quotaFailure.gpsPackage.captures.length !== 1 ||
      quotaFailure.gpsPackage.captures[0].status !== 'storage-error' ||
      quotaFailure.gpsPackage.captures[0].samples[0].heading !== null) {
    throw new Error(`Quota error was not surfaced truthfully: ${JSON.stringify(quotaFailure)}`);
  }
  await page.evaluate(() => {
    window.clearPoekhaliGpsCaptures();
    window.stopPoekhaliTrackerMode();
  });
  const compaction = await page.evaluate(() => {
    const originalOwnerGetter = window.getOfflineStorageUserId;
    const ownerId = 'smoke-compaction-owner';
    const samples = [];
    for (let index = 0; index < 7000; index += 1) {
      samples.push({
        mapId: 'compact-map',
        lat: 50 + index * 0.0000001,
        lon: 130,
        altitude: null,
        accuracy: 10,
        speed: null,
        heading: null,
        distance: null,
        shiftId: 'compact-shift',
        runId: '',
        nearestSector: null,
        nearestCoordinate: null,
        ts: index + 1
      });
    }
    localStorage.setItem('poekhali.mapLearning.v1:' + ownerId, JSON.stringify({
      version: 1,
      maps: {
        'compact-map': {
          updatedAt: 7000,
          sectors: {},
          userSections: {},
          rawTracks: {
            'compact-capture': {
              samples,
              purpose: 'field_geometry_capture',
              status: 'completed',
              routeFrom: 'А',
              routeTo: 'Б',
              startedAt: 1,
              endedAt: 7000,
              updatedAt: 7000
            }
          }
        }
      }
    }));
    window.getOfflineStorageUserId = () => ownerId;
    const gpsPackage = window.buildPoekhaliGpsCapturePackage();
    const compacted = gpsPackage.captures[0].samples;
    let maxGap = 0;
    for (let index = 1; index < compacted.length; index += 1) {
      maxGap = Math.max(maxGap, compacted[index].ts - compacted[index - 1].ts);
    }
    const result = {
      samples: compacted.length,
      firstTs: compacted[0].ts,
      lastTs: compacted[compacted.length - 1].ts,
      maxGap,
      nullsPreserved: compacted.every((sample) => (
        sample.heading === null && sample.speed === null && sample.distance === null &&
        sample.nearestSector === null && sample.nearestCoordinate === null
      ))
    };
    window.clearPoekhaliGpsCaptures();
    window.getOfflineStorageUserId = originalOwnerGetter;
    window.buildPoekhaliGpsCapturePackage();
    return result;
  });
  if (compaction.samples !== 3000 || compaction.firstTs !== 1 || compaction.lastTs !== 7000 ||
      compaction.maxGap > 3 || !compaction.nullsPreserved) {
    throw new Error(`Long GPS trace compaction failed: ${JSON.stringify(compaction)}`);
  }
  await context.close();
  return {
    samples: bucket.samples.length,
    rejectedFixes: fixes.length + 1 - bucket.samples.length,
    purpose: bucket.purpose,
    status: bucket.status,
    route: `${bucket.routeFrom} → ${bucket.routeTo}`,
    hudRecording: Boolean(liveState.hud.gpsRecording),
    exportSchema: persisted.gpsPackage.schema,
    ownerIsolation: true,
    legacyMigration: true,
    resumedSegments: 2,
    clearAndRestart: true,
    quotaFailureVisible: true,
    compaction,
    backendRequests: learningRequests.length
  };
}

let browser;
try {
  await waitForServer();
  await mark('server ready');
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined
  });

  const defaultContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const defaultPage = await defaultContext.newPage();
  await defaultPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await defaultPage.waitForFunction(() => typeof window.startPoekhaliTrackerMode === 'function' && typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
  const routeFormInference = await defaultPage.evaluate(() => {
    const from = document.getElementById('inputRouteFrom');
    const to = document.getElementById('inputRouteTo');
    const chooser = document.getElementById('routeTypeSegmented');
    from.value = 'Постышево';
    to.value = 'Комсомольск-Сортировочный';
    const filled = window.collectOptionalShiftData();
    from.value = '';
    to.value = '';
    const empty = window.collectOptionalShiftData();
    return {
      chooserHidden: Boolean(chooser && chooser.classList.contains('hidden')),
      filled: {
        routeKind: filled.route_kind,
        routeFrom: filled.route_from,
        routeTo: filled.route_to
      },
      emptyRouteKind: empty.route_kind
    };
  });
  if (!routeFormInference.chooserHidden ||
      routeFormInference.filled.routeKind !== 'trip' ||
      routeFormInference.filled.routeFrom !== 'Постышево' ||
      routeFormInference.filled.routeTo !== 'Комсомольск-Сортировочный' ||
      routeFormInference.emptyRouteKind !== 'depot') {
    throw new Error(`Hidden route chooser inference failed: ${JSON.stringify(routeFormInference)}`);
  }
  report.checks.routeFormInference = routeFormInference;
  await defaultPage.evaluate((testShift) => {
    window.allShifts = [testShift];
    if (typeof window.setSelectedPoekhaliShiftId === 'function') {
      window.setSelectedPoekhaliShiftId(testShift.id);
    }
    window.setActiveTab('poekhali');
    window.startPoekhaliTrackerMode();
  }, shift);
  await defaultPage.waitForFunction(() => {
    const mapButton = document.getElementById('btnPoekhaliMap');
    return mapButton && String(mapButton.title || '').includes('Комсомольск ТЧЭ-9');
  }, null, { timeout: 15_000 });
  const defaultSelection = await defaultPage.evaluate(() => ({
    storedMapId: localStorage.getItem('poekhali.mapId') || '',
    mapTitle: document.getElementById('btnPoekhaliMap')?.title || ''
  }));
  if (defaultSelection.storedMapId && defaultSelection.storedMapId !== 'komsomol-sk-tche-9') {
    throw new Error(`Draft JSON map was selected automatically: ${defaultSelection.storedMapId}`);
  }
  report.checks.draftSafety = {
    automaticMap: 'komsomol-sk-tche-9',
    draftMapsRequireManualSelection: true
  };
  await defaultPage.evaluate(() => {
    if (typeof window.stopPoekhaliTrackerMode === 'function') window.stopPoekhaliTrackerMode();
  });
  await defaultContext.close();
  await mark('draft maps excluded from automatic selection');

  const directAutoSelection = await assertShiftRouteAutoSelection(browser, {
    id: 'poekhali-json-smoke-route-direct',
    from: 'ст. Постышево',
    to: 'станция Комсомольск-Сортировочный',
    expectedMapId: 'dvost-postyshevo-komsomolsk',
    expectedHeadPos: '3614 км 8 пк'
  });
  const reverseAutoSelection = await assertShiftRouteAutoSelection(browser, {
    id: 'poekhali-json-smoke-route-reverse',
    from: 'Комсомольск-Сортировочный',
    to: 'Постышево',
    expectedMapId: 'dvost-postyshevo-komsomolsk',
    expectedHeadPos: '3814 км 5 пк'
  });
  report.checks.shiftRouteAutoSelection = {
    direct: directAutoSelection,
    reverse: reverseAutoSelection,
    partialRejected: await assertPartialRouteDoesNotSelectDraft(browser),
    staleSelectionRejected: await assertStaleRouteSelectionCannotWin(browser)
  };
  await mark('pilot JSON map selected from shift route in both directions');

  report.checks.preparationWithoutGps = await assertPreparationModeWithoutGps(browser);
  await mark('preparation mode browses the route without requesting GPS');

  report.checks.localGpsCapture = await assertLocalGpsCapture(browser);
  await mark('local-only GPS field capture filtered and persisted');

  report.checks.liveTouchPan = await assertLiveTouchPanSafety(browser);
  await mark('live touch pan keeps GPS safety state and recenters');

  const secondMapId = 'dvost-postyshevo-komsomolsk';
  const secondPreview = {
    mapId: secondMapId,
    // Section JSON stores official chainage and applies the legacy geometry
    // coordinate_offset_m (-1000) at runtime. Use a point inside (not exactly
    // on the shared boundary of) the official 3718200–3718700 +1.0‰ element.
    lineCoordinate: 3717250,
    sector: 18,
    even: true,
    wayNumber: 1,
    savedAt: Date.now()
  };
  const secondShift = {
    ...shift,
    id: 'poekhali-json-smoke-postyshevo-komsomolsk',
    train_number: '2102'
  };
  const secondPointWarning = {
    id: 'poekhali-json-smoke-point-warning',
    mapId: secondMapId,
    sector: 18,
    start: 3717900,
    end: 3717900,
    speed: 40,
    note: 'Проверка точечного ПР',
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await secondContext.addInitScript(({ storedMapId, storedPreview, pointWarning }) => {
    localStorage.setItem('poekhali.mapId', storedMapId);
    localStorage.setItem('poekhali.previewProjection', JSON.stringify(storedPreview));
    localStorage.setItem('poekhali.warnings', JSON.stringify([pointWarning]));
    window.__poekhaliCanvasTexts = [];
    window.__poekhaliCanvasStrokeStyles = [];
    const originalFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function trackedFillText(value, ...args) {
      if (this.canvas && this.canvas.id === 'poekhaliCanvas') {
        window.__poekhaliCanvasTexts.push(String(value));
        if (window.__poekhaliCanvasTexts.length > 2000) window.__poekhaliCanvasTexts.shift();
      }
      return originalFillText.call(this, value, ...args);
    };
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function trackedStroke(...args) {
      if (this.canvas && this.canvas.id === 'poekhaliCanvas') {
        window.__poekhaliCanvasStrokeStyles.push(String(this.strokeStyle));
        if (window.__poekhaliCanvasStrokeStyles.length > 4000) window.__poekhaliCanvasStrokeStyles.shift();
      }
      return originalStroke.call(this, ...args);
    };
  }, { storedMapId: secondMapId, storedPreview: secondPreview, pointWarning: secondPointWarning });
  const secondPage = await secondContext.newPage();
  await secondPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await mark('Postyshevo-Komsomolsk page loaded');
  await secondPage.waitForFunction(() => typeof window.startPoekhaliTrackerMode === 'function' && typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
  await mark('Postyshevo-Komsomolsk tracker API ready');
  await Promise.race([
    secondPage.evaluate((testShift) => {
      window.allShifts = [testShift];
      if (typeof window.setSelectedPoekhaliShiftId === 'function') {
        window.setSelectedPoekhaliShiftId(testShift.id);
      }
      window.setActiveTab('poekhali');
      window.startPoekhaliTrackerMode();
    }, secondShift),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Postyshevo-Komsomolsk tracker start timeout')), 15_000))
  ]);
  await mark('Postyshevo-Komsomolsk tracker started');
  await secondPage.waitForFunction((expected) => {
    return window.poekhaliHud && window.poekhaliHud.hasProjection &&
      window.poekhaliHud.shift && window.poekhaliHud.shift.compositionType === 'train' &&
      localStorage.getItem('poekhali.mapId') === expected.mapId;
  }, { mapId: secondMapId }, { timeout: 20_000 });
  await secondPage.waitForFunction(() => (
    window.poekhaliHud?.limitKmh === 100 &&
    (window.__poekhaliCanvasTexts || []).some((value) => value.startsWith('ПР через')) &&
    (window.__poekhaliCanvasTexts || []).includes('до 40 км/ч') &&
    (window.__poekhaliCanvasStrokeStyles || []).includes('rgba(251, 146, 60, 0.98)')
  ), null, { timeout: 5_000 });
  const secondState = await secondPage.evaluate(() => ({
    mapId: localStorage.getItem('poekhali.mapId') || '',
    mapTitle: document.getElementById('btnPoekhaliMap')?.title || '',
    headPos: String(window.poekhaliHud?.headPos || ''),
    gradeText: String(window.poekhaliHud?.gradeText || ''),
    compositionType: String(window.poekhaliHud?.shift?.compositionType || ''),
    limitKmh: Number(window.poekhaliHud?.limitKmh || 0),
    headline: String(window.poekhaliHud?.headline || ''),
    warningCue: (window.__poekhaliCanvasTexts || []).filter((value) => value.startsWith('ПР через') || value === 'до 40 км/ч').slice(-2),
    warningLineColor: (window.__poekhaliCanvasStrokeStyles || []).includes('rgba(251, 146, 60, 0.98)')
  }));
  if (!secondState.mapTitle.includes('Постышево')) {
    throw new Error(`Unexpected Postyshevo-Komsomolsk map title: ${JSON.stringify(secondState)}`);
  }
  if (!secondState.headPos.includes('3718 км 2 пк')) {
    throw new Error(`Unexpected Postyshevo-Komsomolsk preview coordinate: ${JSON.stringify(secondState)}`);
  }
  if (!secondState.gradeText.includes('+1.0')) {
    throw new Error(`PDF-corrected +1.0‰ grade is not active: ${JSON.stringify(secondState)}`);
  }
  if (secondState.limitKmh !== 100 || !secondState.warningCue.some((value) => value.startsWith('ПР через')) || !secondState.warningCue.includes('до 40 км/ч') || !secondState.warningLineColor) {
    throw new Error(`Default speed, point warning cue or numerical speed colour is incorrect: ${JSON.stringify(secondState)}`);
  }
  await secondPage.screenshot({ path: postyshevoKomsomolskScreenshotPath });
  secondState.screenshot = path.relative(root, postyshevoKomsomolskScreenshotPath);
  report.checks.postyshevoKomsomolsk = secondState;
  await secondPage.evaluate(() => {
    if (typeof window.stopPoekhaliTrackerMode === 'function') window.stopPoekhaliTrackerMode();
  });
  await secondContext.close();
  await mark('Postyshevo-Komsomolsk PDF sign correction ready');

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  context.on('serviceworker', (worker) => {
    report.workerMessages.push(`created: ${worker.url()}`);
    worker.on('console', (message) => report.workerMessages.push(`${message.type()}: ${message.text()}`));
    worker.on('close', () => report.workerMessages.push(`closed: ${worker.url()}`));
  });
  await context.addInitScript(({ storedMapId, storedPreview }) => {
    localStorage.setItem('poekhali.mapId', storedMapId);
    localStorage.setItem('poekhali.previewProjection', JSON.stringify(storedPreview));
    window.__poekhaliCanvasRotations = [];
    const originalRotate = CanvasRenderingContext2D.prototype.rotate;
    CanvasRenderingContext2D.prototype.rotate = function trackedRotate(angle) {
      if (this.canvas && this.canvas.id === 'poekhaliCanvas' && Number.isFinite(Number(angle))) {
        window.__poekhaliCanvasRotations.push(Number(angle));
        if (window.__poekhaliCanvasRotations.length > 4000) window.__poekhaliCanvasRotations.shift();
      }
      return originalRotate.call(this, angle);
    };
  }, { storedMapId: mapId, storedPreview: preview });

  const page = await context.newPage();
  let resolveCanvasCapture;
  let rejectCanvasCapture;
  const canvasCapture = new Promise((resolve, reject) => {
    resolveCanvasCapture = resolve;
    rejectCanvasCapture = reject;
  });
  let resolveCacheReport;
  let rejectCacheReport;
  const cacheReport = new Promise((resolve, reject) => {
    resolveCacheReport = resolve;
    rejectCacheReport = reject;
  });
  await page.route('**/__poekhali_canvas_capture__', async (route) => {
    try {
      const dataUrl = route.request().postData() || '';
      if (!dataUrl.startsWith('data:image/png;base64,')) throw new Error('Invalid canvas capture payload');
      await writeFile(screenshotPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
      resolveCanvasCapture();
      await route.fulfill({ status: 204, body: '' });
    } catch (error) {
      rejectCanvasCapture(error);
      await route.fulfill({ status: 500, body: 'capture failed' });
    }
  });
  await page.route('**/__poekhali_cache_report__', async (route) => {
    try {
      const payload = JSON.parse(route.request().postData() || '{}');
      resolveCacheReport(payload);
      await route.fulfill({ status: 204, body: '' });
    } catch (error) {
      rejectCacheReport(error);
      await route.fulfill({ status: 500, body: 'cache report failed' });
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push(message.text());
    if (message.type() === 'warning') report.consoleWarnings.push(message.text());
  });
  page.on('pageerror', (error) => report.pageErrors.push(String(error && error.stack || error)));
  page.on('requestfailed', (request) => {
    const error = request.failure() && request.failure().errorText;
    if (error === 'net::ERR_ABORTED') return;
    report.requestFailures.push({ url: request.url(), error });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await mark('page loaded');
  const initialWorkerState = await page.evaluate(() => Promise.race([
    navigator.serviceWorker.ready.then((registration) => ({
      active: Boolean(registration && registration.active),
      controlled: Boolean(navigator.serviceWorker.controller),
    })),
    new Promise((resolve) => setTimeout(() => resolve({ timeout: true, controlled: false }), 8_000)),
  ]));
  if (initialWorkerState.timeout || !initialWorkerState.active) {
    const runtimeState = await page.evaluate(async () => ({
      integrity: window.__SHIFT_TRACKER_RUNTIME_INTEGRITY || null,
      modules: window.__SHIFT_TRACKER_RUNTIME_MODULES || null,
      loadFailures: window.__SHIFT_TRACKER_RUNTIME_LOAD_FAILURES || null,
      registrations: 'serviceWorker' in navigator
        ? (await navigator.serviceWorker.getRegistrations()).map((registration) => ({
            active: registration.active && registration.active.scriptURL,
            installing: registration.installing && registration.installing.scriptURL,
            waiting: registration.waiting && registration.waiting.scriptURL,
          }))
        : [],
    }));
    throw new Error(`service worker did not become active: ${JSON.stringify({ initialWorkerState, runtimeState })}`);
  }
  if (!initialWorkerState.controlled) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 8_000 });
    await mark('page controlled by service worker');
  }
  await page.waitForFunction(() => typeof window.startPoekhaliTrackerMode === 'function' && typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
  await mark('tracker API ready');
  report.checks.stationNames = await page.evaluate(() => {
    const format = window.formatPoekhaliHumanObjectName;
    if (typeof format !== 'function') throw new Error('station-name formatter is unavailable');
    const samples = {
      eldigan: format('ЭЛЬДИГ', 'station', 64_330),
      galitsky: format('ГАЛИЦК', 'station', 156_098),
      novyiKuznetsovsky: format('НОВЫЙ', 'station', 192_520),
      novyiUrgal: format('НОВЫЙ', 'station', 3_303_732),
      urgalOne: format('УРГАЛ', 'station', 3_313_510),
      talidzhak: format('ТАЛИДЖ', 'station', 3_467_706),
      komsomolskSortirovochny: format('КСМ-Сорт', 'station', 0)
    };
    const expected = {
      eldigan: 'Эльдиган',
      galitsky: 'Галицкий',
      novyiKuznetsovsky: 'Новый Кузнецовский',
      novyiUrgal: 'Новый Ургал',
      urgalOne: 'Ургал I',
      talidzhak: 'Талиджак',
      komsomolskSortirovochny: 'Комсомольск-Сортировочный'
    };
    for (const key of Object.keys(expected)) {
      if (samples[key] !== expected[key]) {
        throw new Error(`station label ${key}: expected ${expected[key]}, got ${samples[key]}`);
      }
    }
    return samples;
  });
  await Promise.race([page.evaluate((testShift) => {
    window.allShifts = [testShift];
    window.__poekhaliCanvasRotations = [];
    if (typeof window.setSelectedPoekhaliShiftId === 'function') {
      window.setSelectedPoekhaliShiftId(testShift.id);
    }
    window.setActiveTab('poekhali');
    window.startPoekhaliTrackerMode();
  }, shift), new Promise((_, reject) => setTimeout(() => reject(new Error('tracker start timeout')), 15_000))]);
  await mark('tracker started');

  await page.waitForFunction(
    (expected) => {
      const mapButton = document.getElementById('btnPoekhaliMap');
      const distinctAngles = new Set((window.__poekhaliCanvasRotations || [])
        .filter((value) => Number.isFinite(value) && Math.abs(value) > 0.0005)
        .map((value) => Number(value.toFixed(4)))).size;
      const ready = window.poekhaliHud && window.poekhaliHud.hasProjection &&
        window.poekhaliHud.shift && window.poekhaliHud.shift.compositionType === 'train' &&
        String(window.poekhaliHud.headPos || '').includes('3308 км 5 пк') &&
        distinctAngles >= 2 &&
        mapButton && String(mapButton.title || '').includes('Постышево') &&
        localStorage.getItem('poekhali.mapId') === expected.mapId;
      if (ready && !window.__poekhaliCanvasCaptureSent) {
        window.__poekhaliCanvasCaptureSent = true;
        const canvas = document.getElementById('poekhaliCanvas');
        if (canvas) {
          fetch('/__poekhali_canvas_capture__', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: canvas.toDataURL('image/png')
          }).catch(() => {});
        }
      }
      if (ready && !window.__poekhaliCacheCheckStarted) {
        window.__poekhaliCacheCheckStarted = true;
        (async () => {
          const registration = await navigator.serviceWorker.ready;
          if (registration.active) registration.active.postMessage({ type: 'WARMUP_CACHE' });
          const controlDeadline = Date.now() + 5_000;
          while (!navigator.serviceWorker.controller && Date.now() < controlDeadline) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          const controlled = Boolean(navigator.serviceWorker.controller);
          let networkFresh = false;
          const probeAsset = expected.assets.find((asset) => asset.includes('postyshevo-novyi-urgal'));
          const shellCacheName = (await caches.keys()).find((name) => name.startsWith('shift-tracker-shell-'));
          if (controlled && shellCacheName && probeAsset) {
            const shellCache = await caches.open(shellCacheName);
            await shellCache.put(probeAsset, new Response(JSON.stringify({ stale: true }), {
              headers: { 'Content-Type': 'application/json' }
            }));
            const probeResponse = await fetch(probeAsset, { cache: 'no-store' });
            const probeData = await probeResponse.json();
            networkFresh = probeData && probeData.id === expected.mapId;
          }
          const deadline = Date.now() + 15_000;
          let cached = 0;
          while (Date.now() < deadline) {
            const cacheNames = await caches.keys();
            cached = 0;
            for (const asset of expected.assets) {
              let found = false;
              for (const cacheName of cacheNames) {
                if (await (await caches.open(cacheName)).match(asset)) {
                  found = true;
                  break;
                }
              }
              if (found) cached += 1;
            }
            if (cached === expected.assets.length) break;
            await new Promise((resolve) => setTimeout(resolve, 250));
          }
          fetch('/__poekhali_cache_report__', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cached, total: expected.assets.length, controlled, networkFresh })
          }).catch(() => {});
        })().catch(() => {});
      }
      if (ready && typeof window.stopPoekhaliTrackerMode === 'function') window.stopPoekhaliTrackerMode();
      return ready;
    },
    { mapId, assets: sectionAssets },
    { timeout: 20_000 }
  );
  await mark('JSON route and preview ready');

  report.checks.runtime = {
    mapTitle: 'Постышево — Новый Ургал (нечётное)',
    headPos: '3308 км 5 пк',
    hasProjection: true,
    compositionType: 'train',
    distinctTrainAngles: 'at least 2'
  };

  await mark('waiting for canvas capture');
  await Promise.race([
    canvasCapture,
    new Promise((_, reject) => setTimeout(() => reject(new Error('canvas capture timeout')), 5_000))
  ]);
  report.checks.screenshot = path.relative(root, screenshotPath);
  await mark('canvas captured');

  report.checks.offlineCache = await Promise.race([
    cacheReport,
    new Promise((_, reject) => setTimeout(() => reject(new Error('offline cache report timeout')), 20_000))
  ]);
  if (report.checks.offlineCache.cached !== sectionAssets.length) {
    throw new Error(`Only ${report.checks.offlineCache.cached}/${sectionAssets.length} section assets were cached`);
  }
  if (!report.checks.offlineCache.controlled || !report.checks.offlineCache.networkFresh) {
    throw new Error('Section JSON did not use a controlled network-first refresh');
  }
  await mark('offline section cache ready');

  report.ok = report.consoleErrors.length === 0 && report.pageErrors.length === 0;
  if (!report.ok) throw new Error('Browser errors were captured');
  await context.close();
} catch (error) {
  report.ok = false;
  report.error = String(error && error.stack || error);
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  server.kill();
  report.finishedAt = new Date().toISOString();
  report.serverLog = serverLog;
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

console.log(JSON.stringify(report, null, 2));
