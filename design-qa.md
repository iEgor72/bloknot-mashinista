# Design QA: compact profile summary

- Source visual truth: `C:/Users/shkur/.codex/generated_images/01a00da4-16ed-7f30-84bf-3b6d526f2428/exec-10224229-bc37-435a-9976-5d76e87669a7.png`
- Implementation screenshot: `C:/Users/shkur/AppData/Local/Temp/bloknot-profile-option2-390x844.png`
- Combined comparison: `C:/Users/shkur/AppData/Local/Temp/bloknot-profile-option2-comparison.png`
- Browser viewport: 390 x 844 CSS px
- Source pixels: 852 x 1846
- Implementation pixels: 390 x 844
- Combined comparison pixels: 2560 x 1215
- State: dark theme, local authenticated development shell, Profile tab active, local data contains 1 shift and 0 worked hours

## Full-view comparison evidence

The selected second design and the implementation are shown side by side in the combined comparison. Both use one compact horizontal surface with a calendar icon, shift count, vertical divider, worked time, and the quiet caption `за всё время`. The implementation keeps the existing product typography, colors, radius, and section rhythm.

## Focused region comparison evidence

The summary card remains fully legible in the normalized 390 x 844 comparison, so a separate crop is unnecessary. The icon, both metrics, divider, and caption are visible without truncation or overflow.

## Findings

No actionable P0, P1, or P2 differences remain.

- Typography: matches the existing profile hierarchy and uses tabular numerals for stable metric width.
- Layout: the two separate statistic tiles are replaced by one compact grouped card.
- Responsive behavior: a narrow-screen rule reduces gaps, icon size, and metric type below 360 px.
- Copy: the shift noun is pluralized for Russian values; worked time is rendered as hours and optional minutes.
- Accessibility: the card exposes a current-value summary through its accessible label.
- Privacy wording: deduction hints contain only neutral instructions and do not refer to supplied calculation sheets.
- Runtime: `node --check scripts/render.js`, `git diff --check`, and `npm run smoke:local` pass.

## Comparison history

### Pass 1

- Earlier implementation: two visually disconnected statistic boxes with low information density.
- Fix: grouped the statistics into one compact card and aligned it to the selected second design direction.
- Post-fix evidence: the combined comparison confirms the selected hierarchy and structure are preserved in the existing application shell.

## Primary interactions tested

- Loaded the local application at the mobile viewport.
- Opened the Profile tab through the bottom navigation.
- Confirmed the summary values render from live local state.
- Confirmed the existing tariff-settings entry remains visible and operable.

final result: passed
