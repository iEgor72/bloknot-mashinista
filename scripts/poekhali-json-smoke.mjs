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

let browser;
try {
  await waitForServer();
  await mark('server ready');
  browser = await chromium.launch({ headless: true });

  const defaultContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const defaultPage = await defaultContext.newPage();
  await defaultPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await defaultPage.waitForFunction(() => typeof window.startPoekhaliTrackerMode === 'function' && typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
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
  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await secondContext.addInitScript(({ storedMapId, storedPreview }) => {
    localStorage.setItem('poekhali.mapId', storedMapId);
    localStorage.setItem('poekhali.previewProjection', JSON.stringify(storedPreview));
  }, { storedMapId: secondMapId, storedPreview: secondPreview });
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
  const secondState = await secondPage.evaluate(() => ({
    mapId: localStorage.getItem('poekhali.mapId') || '',
    mapTitle: document.getElementById('btnPoekhaliMap')?.title || '',
    headPos: String(window.poekhaliHud?.headPos || ''),
    gradeText: String(window.poekhaliHud?.gradeText || ''),
    compositionType: String(window.poekhaliHud?.shift?.compositionType || '')
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
  await secondPage.screenshot({ path: postyshevoKomsomolskScreenshotPath });
  secondState.screenshot = path.relative(root, postyshevoKomsomolskScreenshotPath);
  report.checks.postyshevoKomsomolsk = secondState;
  await secondPage.evaluate(() => {
    if (typeof window.stopPoekhaliTrackerMode === 'function') window.stopPoekhaliTrackerMode();
  });
  await secondContext.close();
  await mark('Postyshevo-Komsomolsk PDF sign correction ready');

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
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
  });
  page.on('pageerror', (error) => report.pageErrors.push(String(error && error.stack || error)));
  page.on('requestfailed', (request) => {
    const error = request.failure() && request.failure().errorText;
    if (error === 'net::ERR_ABORTED') return;
    report.requestFailures.push({ url: request.url(), error });
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  await mark('page loaded');
  await page.waitForFunction(() => typeof window.startPoekhaliTrackerMode === 'function' && typeof window.setActiveTab === 'function', null, { timeout: 15_000 });
  await mark('tracker API ready');
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
