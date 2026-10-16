# Audit remediation v421

Authorized by the user: fix all confirmed reliability findings and the UI/technology review.
Baseline: production v420 / 6e14ab51e8010384ad9745ec84c14fb31e5267ac.

## Required delivery

- [x] Server journal revision, atomic compare-and-swap and safe rejection of obsolete clients.
- [x] Serialized, account-scoped client sync; three-way merge including deletions and explicit conflict resolution.
- [x] Transactional IndexedDB journal/outbox; verified legacy migration and accurate storage failures.
- [x] Empty pending deletion and cross-account isolation.
- [x] Strict server date validation, preserving existing explicit Moscow +03:00 timestamps.
- [x] Independent core startup and on-demand Poekhali/documents/calculator modules.
- [x] Explicit ES modules/types for the new data layer; generated release metadata and checked build.
- [x] Automated regression/viewport/upgrade tests and CI workflow.
- [x] Client diagnostics without journal contents; current deployment/rollback documentation.

## User scope correction

The user explicitly rejected design changes. All visual experiments were removed
before release: original styles, typography, home order, form, viewport policy and
navigation are retained. The baseline markup and every existing stylesheet are
protected by `npm run test:ui-preservation` (only release URLs may change).
No persistent status bar, new visual tokens or layout changes ship. Necessary
conflict confirmation uses the existing overlay/bottom-sheet/button components.
The proposed UI changes are cancelled by the user's instruction.

## Verification

The journal tests cover concurrent saves, late acknowledgements, independent
remote changes/deletions, conflict preservation, wrong-account responses, quota
failure and legacy empty queues. Actual Chromium and WebKit IndexedDB tests cover
commit failure, account-scoped migration, offline delete/restart/reconnect and two
concurrent tabs. Mobile layouts are checked at 360/375/390/430px without redesign.
Full offline smoke covers poisoned CSS/JS cache recovery, mixed runtime repair,
seeded offline reload and the boot fallback. Production backup/deploy/public
verification are recorded in the canonical project memory when executed.

Production is RU origin `klyuchik-ru1`, archive releases/current symlink, systemd
`bloknot-mashinista.service`, persistent `/var/lib/bloknot-mashinista`.
Old PM2 instructions inherited from the baseline are obsolete.
