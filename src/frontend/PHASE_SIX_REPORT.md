# Courtly Phase Six acceptance report

Courtly's public frontend and three workspaces are ready for a local demonstration of the verified workflows. End-to-end Stripe, mail-based recovery, and social sign-in depend on authorized test configuration. The server issues in the [backend review](BACKEND_LIMITATIONS.md) remain relevant before deployment.

## Delivery overview

| Area | Delivered and reviewed |
| --- | --- |
| Public | Courtly branding and the existing approved photography, sport-specific court discovery, server-backed facility cards, live dates and rates, auth, registration and callback routes. |
| Player | Court selection, weekly and mobile availability, current and peak states, reservation review, holds and cancellation, payment history, printable receipts, accessible reference copying, results, ranking, ratings, verification, inbox and settings. |
| Manager | Compact operational grid, application status, approved workspace, facility editing, courts and rates, slot schedules, maintenance, booking controls, inbox and account forms. |
| Administrator | Prioritized queue counts, booking and reported-payment overview, approvals, protected verification, account archive actions, dispute resolution, all five reports, date presets, exports, history, mail logs, backup status and notifications. |
| Error and empty states | Redacted unexpected server errors, explicit missing Stripe and recovery email messages, report range guidance, state distinctions in the booking calendar, and disabled scheduling information when automated backups are off. |
| Accessibility | Labeled compact navigation, mobile Escape and focus return, semantic native dialogs and labels, selectable full booking IDs with clipboard fallback, text equivalents for charts, and reduced-motion styles. |
| Performance | Removed Framer Motion from the lockfile. Public and auth images load responsive WebP derivatives. Kept checkout, admin reports, workspace routes and PDF generation on demand. |
| Migration | Legacy pages and their obsolete scripts, CSS and MVC controllers were removed from the worktree. Modern router aliases cover the old bookmarks and preserve supported query and callback state. |

The [migration reference](MIGRATION.md) contains the route matrix, exact API groups, and legacy workflow inventory. The [demonstration guide](DEMO_GUIDE.md) includes the sequence for showing each role and the optional provider setup. Use the [frontend README](README.md) for local run, build and preview commands.

## Integration and security

JWTs remain in localStorage on the Courtly origin to support cross-tab behavior. Courtly appends bearer headers only to its fixed API origin. Logout, expiry and rejected signatures clear the session. Production hardening should address XSS exposure inherent to JavaScript-readable tokens on this origin. Successful server responses remain authoritative for mutations. Ownership and access to protected documents, canonical account identity, ADMIN notification identity, PDF and CSV exports, and cleanup of protected blob URLs were reviewed. CSV values that could be interpreted as spreadsheet formulas are escaped before export.

The backend suite ran on a verified copy of the backend source using an in-memory H2 database. Browser mutation scenarios used synthetic accounts and records in a separate in-memory runtime. An early legacy handoff check opened a browser context without the isolated API route and attempted a manager sign-in against the regular loopback backend before the old-route assertion timed out. That code path performed no domain mutation. The authentication request could update sign-in metadata. Subsequent browser checks used the isolated route for every context. The regular backend was left running and its database was never reset, restored, or reseeded.

## Git review

PowerShell commands to review the worktree and original stage before choosing what to stage.

```powershell
git status --short
git diff -- src/frontend
git diff --cached --name-status
git diff --cached -- src/frontend
git diff --name-only HEAD -- src/backend src/database
git check-ignore -- src/backend/src/main/resources/secrets.yml
git ls-files -- src/backend/src/main/resources/secrets.yml
```

The branch is `frontend-redesign` at `935c5b1d081df1dd193908e3ab04a4ce07a2c303`. The backend tree is `357297c94bc31d9943b1c2be1685ddb4d967cf0b`. The index hash stayed `0ec070dcdf35b95b0a6d49713b8b5b3505940992`. The unrelated root untracked entry was retained. The already staged legacy files remain in the original index by request. Review the working tree removals and additions together before staging a future commit. The ignored local secrets file remains untracked. The 48 originally staged files were unchanged. Staged path checks found no secrets file, dependency installation, build output, database, backup, or temporary test artifacts. High-confidence credential matching found zero hits in staged additions. No commit, merge or push was made.

## Phase Six file inventory

All paths are relative to `src/frontend`. The inventory compares against the working tree at the start of this phase, including earlier staged and untracked work.

| Change | Files |
| --- | --- |
| Documentation added | `BACKEND_LIMITATIONS.md`, `DEMO_GUIDE.md`, `PHASE_SIX_REPORT.md` |
| Documentation updated | `README.md`, `MIGRATION.md` |
| Obsolete documentation removed | `mvc/README.md` |
| Dependency and stylesheet changes | `package.json`, `package-lock.json`, `src/styles.css`, `src/player.css`, `src/player-workspace.css`, `src/manager.css`, `src/admin.css` |
| Responsive image derivatives added | `public/images/tennis-court-640.webp`, `public/images/tennis-court-1280.webp`, `public/images/tennis-player-640.webp`, `public/images/tennis-player-1024.webp` |
| Routing and API updates | `src/main.tsx`, `src/lib/api.ts`, `src/lib/session.tsx` |
| Shared UI | Added `src/components/copy-reference.tsx`. Updated `src/components/admin-charts.tsx`, `src/components/player-booking-ui.tsx`, `src/components/site-shell.tsx`, `src/components/workspace-shell.tsx`. |
| Page updates | `src/pages/admin-monitoring.tsx`, `src/pages/admin-reports.tsx`, `src/pages/admin-workspace.tsx`, `src/pages/auth.tsx`, `src/pages/discovery.tsx`, `src/pages/player-checkout.tsx`, `src/pages/player-courts.tsx`, `src/pages/player-overview.tsx`, `src/pages/player-payments.tsx` |
| Obsolete files removed from `public/legacy/` | `admin.html`, `app.js`, `checkout.html`, `dashboard.html`, `facility-manager.html`, `index.html`, `oauth-callback.html`, `style.css`, `success.json`, `verification.html` |
| Obsolete controllers and model removed from `public/legacy/mvc/` | `controllers/admin-controller.js`, `controllers/checkout-controller.js`, `controllers/dashboard-controller.js`, `controllers/facility-manager-controller.js`, `controllers/oauth-controller.js`, `controllers/verification-controller.js`, `models/oauth-model.js` |

## Acceptance checks

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript and production build | PASS | Type-check and Vite build completed. The primary JavaScript chunk was about 376 kB before gzip, down from about 498 kB in the previous build. Admin report and PDF bundles remain separate. |
| Dependency advisory review | PASS | npm audit reported zero known advisories for the final lockfile at the time of the check. |
| Backend regression | PASS | 430 passed, 0 failed, 0 skipped on the isolated H2 run. |
| Production browser route and interaction smoke suite | PASS | 12 of 12 check groups. The suite rendered 40 route visits at each of 360, 390, 768, 1024, 1366, and 1920 px. It checked page overflow, the compatibility routes, callback hash removal, keyboard focus and Escape, reduced motion, copying, report presets, cross-tab logout, frontend assets, uncaught errors, and bearer scoping. |
| Public flows and manager controls | PASS | Live search, guarded booking handoff, player registration with category validation, manager facility editing, court add/edit/delete, maintenance scheduling and cancellation, wrong-password feedback, and modern workspace entry. |
| Admin queues and monitoring | PASS | Approval/rejection, protected PNG/PDF review, deletion/archive/restore for synthetic accounts, disputes, operations, email log display, and manual backup in the isolated runtime. |
| Lint and legacy script syntax | NOT TESTED | The repository has no frontend lint command. No legacy JavaScript is shipped by the build. |
| Full accessibility certification and exhaustive input combinations | NOT TESTED | The smoke suite covers representative keyboard, viewport, and state checks. |
| Live hold expiry and archive restore rehearsal | NOT TESTED | Scheduler expiry passed in automated backend tests. The browser run exercised hold display and cancellation. Database restore scripts were excluded. |

## Cross-role scenarios

| Scenario | Result | Verified behavior |
| --- | --- | --- |
| A. Manager onboarding | PASS | Synthetic manager registration and pending access, administrator approval, and manager refresh granting access to the modern court workspace. Rejected-state navigation and the recorded reason were also observed. |
| B. Court management and discovery | PASS | Created and edited synthetic courts using an approved manager. Confirmed that the same court appeared in facility discovery and the player workspace. |
| C. Reservation lifecycle | PASS | A player reservation appeared in the administrator register and manager details. Manager manual confirmation appeared in the player account without creating a card receipt. Cancellation succeeded. The automated suite covered hold expiry. |
| D. Stripe lifecycle | BLOCKED | The matching authorized test publishable/secret pair was unavailable. Missing-service feedback and paid/refunded synthetic receipts passed. No Stripe payment was made. |
| E. Verification lifecycle | PASS | Synthetic PNG and PDF uploads, authenticated admin review, approval/rejection, and resulting player status passed under an isolated test encryption key. |
| F. Matches and ratings | PASS | Submitted an eligible match and rating, verified duplicate rejection, showed leaderboard data, and resolved an admin dispute with server-awarded points. |
| G. Reporting | PASS | Generated all five reports from genuine isolated records. Verified ten downloads (PDF and CSV per report), the applied dates in history, and the filtered empty states for revenue and feedback. |
| H. Notifications | PASS | Real effects from approvals and bookings reached the player, manager and admin inboxes. Read/clear and real notification display were exercised. |
| I. Security | PASS | Anonymous and incorrect-role denials, invalid and expired session cleanup, cross-tab logout, admin identity, protected document read decisions, and no bearer header on observed non-Courtly requests. |
| J. Failure recovery | PASS | Network interruption and admin retry, validation, missing Stripe/SMTP/OAuth configuration states, stale slot rejection, one booking POST for duplicate clicks, and duplicate match and rating submissions. |

Cross-role scenario totals are **9 PASS, 0 FAIL, 1 BLOCKED, and 0 NOT TESTED**. Provider-specific checks are tracked separately below. Initial harness failures included an obsolete expected route, conflicting fixture assumptions, and interrupted development-server file watching. The checks above report the corrected runs. Dedicated testing did not cover every possible form input or every combination of role, browser and provider.

| Provider or operational check | Result |
| --- | --- |
| Stripe test payment, decline and interrupted provider reconciliation | BLOCKED |
| SMTP email delivery and full OTP reset | BLOCKED |
| Google OAuth provider handshake | BLOCKED |
| GitHub OAuth provider handshake | BLOCKED |
| Document upload/review using the regular local configuration | BLOCKED |
| Restore into a disposable copy and verify encrypted-backup recovery | NOT TESTED |

Prepare the provider settings listed in the [backend integration checklist](BACKEND_LIMITATIONS.md), review the stage with the commands above, and follow the [demo sequence](DEMO_GUIDE.md) before a future push.
