# Design QA — боковая навигация и зарплата

**Comparison target**

- Source visual truth: `C:\Users\shkur\.codex\generated_images\01a04663-4301-7811-9fc6-76f7dc79ea71\exec-cf59c0f1-17cf-4a3d-b731-7d62fae4f108.png`
- Source pixels: 852 × 1850. The generated concept has an arbitrary high-density canvas; it was proportionally normalized into a 390 px comparison column and cropped by 3 px vertically to the implementation viewport.
- Implementation screenshot: `D:\work\bloknot-mashinista-tg\artifacts\navigation-drawer-qa\drawer-mobile.png`
- Implementation pixels/CSS viewport: 390 × 844 at `deviceScaleFactor: 1`.
- Combined comparison evidence: `D:\work\bloknot-mashinista-tg\artifacts\navigation-drawer-qa\drawer-comparison.png` (816 × 900).
- Salary evidence: `D:\work\bloknot-mashinista-tg\artifacts\navigation-drawer-qa\salary-mobile.png` (390 × 844).
- State: dark theme, authenticated shell, drawer open at scroll position 0; `Смены`, `Зарплата`, `Профиль`, and `О приложении` expanded; `Поехали` and `Документы` collapsed. Salary state uses August 2026, four realistic shifts, 48 worked hours, and a populated calculation.

**Findings**

- No actionable P0/P1/P2 findings remain.
- [P3] The implementation uses slightly larger text and row rhythm than the concept.
  Location: navigation drawer group headers and child entries.
  Evidence: the combined comparison shows fewer groups in the first viewport of the implementation.
  Impact: more scrolling, but improved legibility and tap targets on a real 390 px mobile viewport.
  Fix: optional later density preference; no change is recommended for the current accessibility/readability balance.

**Required fidelity surfaces**

- Fonts and typography: the product's existing Golos Text family is retained. Weight, hierarchy, line height, wrapping, and numeric alignment remain readable at 390 px. No clipping or unintended wrapping is visible.
- Spacing and layout rhythm: drawer width was reduced from 88vw to 82vw after comparison, restoring a visible strip of underlying content while leaving Russian labels usable. Header, search, thematic rails, separators, and footer align consistently. The salary transition was allowed to finish before capture; the final screen has no horizontal clipping.
- Colors and visual tokens: existing dark surfaces, cyan accent, muted secondary text, semantic green/red salary values, hairlines, shadows, and radii follow the source and the established application tokens.
- Image quality and asset fidelity: this interface contains no raster imagery. Navigation uses the application's existing SVG sprite/icon language; icons stay sharp and inherit semantic color correctly.
- Copy and content: requested thematic labels and actions are present: shifts/add/all, three Poekhali modes plus map contribution, six document destinations plus add-document, salary/month/by-shift/settings, VU-45, profile/depot, users/install/version.

**Focused region comparison**

No separate crop was needed: the 816 px combined comparison preserves readable header, search, active item, group headers, child rail, icons, subtitles, and footer identity. The salary screen was inspected separately at its native 390 × 844 size because it is a new supporting screen rather than the drawer reference state.

**Comparison history**

1. Initial browser pass found a P1 interaction issue: the standalone add-shift button was always transparent and non-interactive because a selector matched every closed community-editor overlay. It was narrowed to `.community-editor-overlay.is-open`. Post-fix evidence: `addShiftContract.active: true`, and the button opens the add form in one click.
2. Initial salary capture found P2 visual problems: a duplicated page title and a capture taken during the tab slide animation, which visibly clipped the right edge. The duplicate internal title was removed and capture now waits for the transition. Post-fix evidence: `salary-mobile.png` is centered, unclipped, populated, and retains the top-bar title.
3. Drawer comparison found P2 proportion drift at 88vw. Width was adjusted to 82vw. Post-fix evidence: the final combined comparison retains the source's visible background strip without compromising Russian labels or 44 px-plus targets.
4. Final interaction pass verified drawer open/close, accordion groups, `ВУ-45` search filtering, add-document presence, add-map presence, populated salary rendering, and one-click add-shift navigation. `npm run smoke:local` completed with empty console, page-error, and request-failure collections.
5. The second navigation pass added exact active-child highlighting with `aria-current`, a visible empty-search state, separator-insensitive search, and restoration of the user's accordion layout after clearing search. The revised browser contract confirms the salary child/group state and search restoration.
6. Static DOM QA found one unrelated duplicate SVG identifier in the home salary sparkline. The gradient resource was renamed without changing the visible design; the local smoke now blocks all future duplicate IDs and invalid drawer tab targets.

**Implementation Checklist**

- [x] Match dark drawer composition and active cyan treatment.
- [x] Group navigation by product theme.
- [x] Keep add shift reachable in one click from the persistent FAB and two clicks from the drawer.
- [x] Move creation/configuration actions into their relevant menu groups.
- [x] Provide populated salary calculation and by-shift detail.
- [x] Verify mobile search, keyboard focus trap, Escape/backdrop close, and active-route synchronization.
- [x] Restore accordion state after search and show a clear empty result.
- [x] Verify local, offline, server, and service-worker smoke coverage.

**Follow-up Polish**

- Consider a user-selectable compact drawer density only if field feedback shows that scrolling is a recurring problem.

final result: passed
