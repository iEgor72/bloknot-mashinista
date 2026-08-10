# Design QA: удаление блока «Помощь и связь»

- Source visual truth: `C:/Users/shkur/AppData/Local/Temp/codex-clipboard-32d46acd-009e-49a8-af6c-ebaa29369b1f.png`
- Implementation screenshot: `C:/Users/shkur/AppData/Local/Temp/bloknot-profile-bot-only-20260729.jpg`
- Combined comparison: `C:/Users/shkur/AppData/Local/Temp/bloknot-profile-removal-comparison-20260729.png`
- Browser viewport: 1280 × 720 CSS px, device scale factor 1
- Source pixels: 409 × 126, 96 dpi
- Implementation pixels: 1280 × 720, 72 dpi
- Density normalization: source kept at native size; implementation was additionally resized to 640 px wide only for the combined inspection image. The original browser capture and semantic DOM snapshot were used for the final judgment.
- State: dark theme, local authenticated development shell, Profile tab active

## Full-view comparison evidence

The reference identifies the complete «Связь / Помощь и связь» section that must disappear. In the implementation capture, the Profile screen flows directly from «Приложение» to «О приложении». There is no empty section heading, card, chevron, overlay trigger, or residual spacing.

## Focused region comparison evidence

The combined comparison places the supplied reference above the rendered Profile screen. The referenced card is absent, while adjacent profile cards retain the existing Golos Text typography, spacing, radii, borders, colors, icon treatment, and alignment.

## Findings

No actionable P0, P1, or P2 differences remain for the requested removal.

- Fonts and typography: unchanged in the surrounding Profile screen.
- Spacing and layout rhythm: sections close cleanly with no blank gap.
- Colors and tokens: existing dark profile tokens remain intact.
- Image and icon fidelity: no replacement asset was introduced; the removed chat icon is absent.
- Copy and content: «Связь», «Помощь и связь», news, discussion, and feedback-command copy are absent from the active screen.
- Accessibility and behavior: Profile navigation remains operable; the removed button and overlay are no longer present in the semantic DOM.
- Console/runtime check: the selected Codex browser surface did not expose a console-log API. Equivalent runtime checks passed through `node --check`, server tests, local smoke, and offline smoke with no surfaced browser error state.

## Comparison history

### Pass 1

- Earlier target: the supplied screenshot showed the section to remove.
- Fixes made: removed the Profile section, its bottom sheet, binding code, unused component CSS, community API, obsolete Telegram destinations, and public bot commands.
- Post-fix evidence: the Profile capture shows «О приложении» directly after «Приложение» and the semantic snapshot contains no community control or overlay.

## Primary interactions tested

- Loaded the local application.
- Dismissed the analytics-consent overlay.
- Opened the Profile tab.
- Confirmed tariff settings and install controls remain available.
- Confirmed the removed connection card cannot be found or opened.

## Implementation checklist

- [x] Remove the referenced Profile card and section heading.
- [x] Remove its overlay, event bindings, and unused CSS.
- [x] Remove channel/discussion links from public pages.
- [x] Remove the obsolete community API.
- [x] Clear the Telegram bot command menu and remove command handlers.
- [x] Preserve the hidden `/start` entry flow required by Telegram.
- [x] Pass server, local, and offline tests.

final result: passed
