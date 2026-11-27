# Courtly migration and integration reference

## Modern routes

| Area | Routes and coverage |
| --- | --- |
| Public | `/`, `/courts`, `/facilities`, `/facilities/:facilityId`. Lahore sports, facilities, court facts, date and sport search, live slot and price discovery. |
| Authentication | `/login`, `/register`, `/forgot-password`, `/oauth-callback`, `/workspace`. Role selection, local sign-in, registration, OTP recovery, optional social sign-in, and workspace routing. |
| Player | `/player`, `/player/courts`, `/player/bookings`, `/player/checkout/:bookingID`, `/player/payments`, `/player/payments/:bookingID`, `/player/matches`, `/player/leaderboard`, `/player/ratings`, `/player/verification`, `/player/notifications`, `/player/settings`. |
| Manager | `/manager`, `/manager/facility`, `/manager/courts`, `/manager/maintenance`, `/manager/bookings`, `/manager/notifications`, `/manager/settings`. Pending and rejected states share this route tree and restrict operational access. |
| Administrator | `/admin`, `/admin/managers`, `/admin/verification`, `/admin/accounts`, `/admin/bookings`, `/admin/payments`, `/admin/disputes`, `/admin/reports`, `/admin/email-delivery`, `/admin/backups`, `/admin/notifications`. |

Root and `/legacy/` HTML bookmark aliases preserve the original entry points. `index.html` opens the homepage. `dashboard.html` passes supported section, court, date, sport, facility and slot values. `checkout.html` uses `bookingID` and `receipt=1` to choose the current checkout or receipt. `verification.html`, `facility-manager.html` and `admin.html` open their protected workspaces. `oauth-callback.html` accepts the backend callback fragment and clears it after consumption. Protected aliases use the same guards and return paths as the canonical routes. Hosts must use the SPA fallback for old paths.

## API inventory

The paths below are relative to `/api`. The typed adapters live in `src/lib/api.ts`, `manager-api.ts` and `admin-api.ts`. Dynamic path and query segments are encoded. The adapters support JSON, form encoding, multipart upload, protected file responses and empty success bodies.

| Workflow | Mappings in use |
| --- | --- |
| Auth and profile | POST `/auth/login` (form `email`, `pass`, `role`), `/auth/register` (JSON), `/auth/forgot-password`, `/auth/verify-otp`, `/auth/request-deletion`. GET and PUT `/auth/profile`, GET `/auth/account-status`, PUT `/auth/change-password` and `/auth/reset-password-otp`. GET `/auth/oauth2/providers` and browser navigation to `/auth/oauth2/authorize/{provider}`. |
| Discovery | GET `/facilities`, `/facilities/{id}`, `/courts`, `/courts/{id}`, `/courts/sport-types`, `/bookings/availability?date=&type=`, `/bookings/court/{courtID}?date=`, `/bookings/price?courtID=&date=&timeSlot=` and `/ratings/average/{courtID}`. |
| Booking and checkout | POST `/bookings`, GET `/bookings/player/{playerID}`, PUT `/bookings/{id}/cancel` and `/bookings/{id}/confirm` for authorized callers. POST `/payments/create-payment-intent` and `/payments/confirm`, GET `/payments/booking/{bookingID}` and `/payments/player/{playerID}`. |
| Matches and feedback | GET `/matches/player/{playerID}`, `/matches/check/{bookingID}`, `/matches/leaderboard`, `/ratings/player/{playerID}`, `/ratings/check/{bookingID}`. POST `/matches/submit` and `/ratings/submit`. |
| Verification | POST multipart `/docs/upload` with `file`, `docType`, `playerEmail`. GET `/docs/status` with `playerEmail`. GET `/docs/view/{docID}` for administrators, consumed as a temporary blob. |
| Notifications | GET `/notifications` and `/notifications/unread-count` with `userId`. PUT `/notifications/{id}/read` and `/notifications/read-all`. DELETE `/notifications/{id}` and `/notifications/all`. |
| Manager operations | GET `/facilities/mine`, PUT `/facilities/{id}`, POST `/courts`, PUT/DELETE `/courts/{id}`, GET `/manager/bookings/upcoming`, `/manager/bookings/completed`, `/manager/courts/maintenances`. POST/DELETE `/manager/courts/{courtID}/schedule-maintenance`. |
| Admin operations | GET `/admin/stats`, `/admin/pending-managers`, `/admin/pending-docs`, `/admin/deletion-requests`, `/admin/archived-accounts`, `/admin/active-bookings`, `/admin/payment-history`, `/matches/disputed`, `/notifications/delivery-log`. POST `/admin/approve-manager`, `/admin/verify-doc`, `/admin/process-deletion`, `/matches/{matchID}/resolve`. GET and POST `/admin/backups`. |
| Reports | GET `/admin/reports`, `/matches/rankings`, `/ratings/all`, `/admin/reports/history`. POST `/admin/reports/log` writes successful export history. PDF and CSV use the generated result and its applied filters. |

Public requests omit bearer headers. Protected requests send the JWT only to Courtly's API origin and reject redirects. The UI reads canonical identity from login and profile responses. The administrator's null player ID maps to the backend notification identity `ADMIN`. Existing sessions retain the key names the current interface reads. Login and logout remove obsolete metadata. OAuth callbacks use the existing backend fragment contract and clear it from the URL. The server validates tokens and enforces roles independently of browser routing.

## Migration parity checklist

| Legacy area | Modern replacement |
| --- | --- |
| Auth and recovery forms, OAuth and role redirect | Modern auth routes preserve registration variants, password visibility, OTP stages and provider discovery. Provider-dependent success requires configuration. |
| Player booking, schedules, history and payment | Live calendar and quote, reservation review, server hold, cancellation, Stripe checkout, history, receipt print and booking reference copy. |
| Player matches, ratings and rankings | Match submission and validation, eligible booking feedback, leaderboard and duplicate protection. |
| Player verification, inbox and settings | Multipart document upload and review status, inbox actions, profile/password changes and deletion request. |
| Manager approval and operations | Approval refresh, facility updates, court CRUD and rate changes, maintenance, booking actions, inbox and account settings. |
| Admin decision queues and support | Manager approval, protected PNG/PDF preview, review decisions, deletion and archive actions, match disputes, bookings, payments, email logs, backup status and inbox. |
| Admin report controls | Five report types, dated generation, actual data, exports and history. Browsing the overview does not generate a report. |
| Legacy implementation | Seven obsolete HTML implementations, a shared script and stylesheet, six controllers, one OAuth model and the unused success JSON removed. Root and `/legacy/` bookmark aliases retained. |

See [backend limitations](BACKEND_LIMITATIONS.md) for behaviors that are constrained by the current API and the [acceptance report](PHASE_SIX_REPORT.md) for executed tests and provider blockers.
