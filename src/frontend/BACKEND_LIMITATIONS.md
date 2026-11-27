# Backend limitations and integration prerequisites

These findings describe the current Spring Boot implementation. The Phase Six frontend changes preserve the backend baseline.

## Confirmed from the current source

| Area | Finding and backend follow-up |
| --- | --- |
| Player booking history | `BookingService.getPlayerBookings` applies a roughly 24-hour cutoff to completed and cancelled booking history. The frontend can display only the records returned. Add a pagination option and define retention independently of the operational view. |
| Interrupted payments | `PaymentService` exposes intent creation, confirmation with a provided intent ID, and lookup of recorded receipts. The frontend keeps an in-browser recovery reference when available. Add persistent intent-to-booking linkage, idempotency, and a server reconciliation flow for interrupted checkout. |
| Cancellation and refund | `BookingService.cancelBooking` releases a reservation and changes status. The payment service separately handles a late successful payment refund. Add an explicit refund workflow and expose its outcome for already-paid cancellations. |
| Reservation validation | Availability considers generated court hours and maintenance, while `BookingService.createBooking` has an independent validation path that omits equivalent schedule and maintenance enforcement. Enforce the same rule when creating a booking and cover overnight schedules and concurrent writes. |
| Read authorization | Current match and rating player-history and eligibility lookups use caller-supplied identifiers without equivalent ownership checks. The security configuration permits the all-ratings read that the admin report consumes. Move protected reads behind owner/admin authorization and return purpose-specific DTOs. This finding is from source review. |
| Verification response privacy | The pending-document response includes nested account data from the persistence model. The browser picks the displayed fields. Return a DTO with only the review metadata and the account fields reviewers need. Keep file access as a separate authenticated binary endpoint. |
| Reports | Revenue and payment summaries use backend booking-derived totals. They cannot establish Stripe settlement or provide a transaction ledger. Follow the dataset descriptions on individual reports for the date and scope limitations. |
| Restore paths | The file-mode datasource is relative to the backend working directory. The repository restore scripts target `database/courtlydb` relative to the repository root. Align the target with the running datasource and validate restoration in a disposable copy. Phase Six did not run restore. |
| Backup encryption | `BackupService` writes a ZIP archive unless `app.backup.password` is configured, in which case it writes an encrypted archive. Verify password handling and tested recovery before using operational backups. Document encryption uses a separate setting. |
| Persistent startup seed | Default SQL initialization is `always` and the demo seed uses H2 `MERGE`. For an already initialized local database, the seed-disabled launch in the frontend README avoids refreshing demo rows. Separate demos from regular development. |

## External service checklist

Phase Six inspected configuration presence without recording values. The local ignored file contains administrator settings. Stripe, SMTP, Google, GitHub, and document-encryption settings were unavailable in the inspected environment.

| Service | Configure through the existing supported mechanism | End-to-end check |
| --- | --- | --- |
| Stripe test mode | Supply the matching test publishable and secret keys under `stripe.api.public.key` and `stripe.api.secret.key` or the supported environment variables in the backend template. | Reserve, complete test checkout, confirm on the backend, retrieve the receipt, and exercise decline and recovery using test mode. |
| SMTP and password OTP | Configure `spring.mail` credentials and the approved SMTP host, port and transport settings. Use a controlled mailbox. | Request an OTP, verify delivery, change a synthetic account password, sign in, and confirm delivery-log status. |
| Google and GitHub OAuth | Set `client-id` and `client-secret` under `app.oauth2.google` and `app.oauth2.github`. Register `http://localhost:8081/login/oauth2/code/google` and `http://localhost:8081/login/oauth2/code/github` with the corresponding provider. Allow the frontend origin through `app.oauth2.allowed-redirect-origins`. | Confirm the provider button, authorize a test account, return through `/oauth-callback`, and verify canonical identity and role. |
| Document encryption | Use the existing authorized `app.uploads.encryption-key` configuration. Confirm compatibility with previously encrypted records before any key changes. | Upload and review synthetic PNG/PDF data, then confirm review status on the player side. This passed with an isolated test key. |
| Backup encryption | Set a separately authorized `app.backup.password` if encrypted archives are needed. | Generate in isolation and validate recoverability after aligning the script and datasource paths. |

Authorization, exposure, and payment-reconciliation findings remain open. Production readiness requires addressing them on the server and completing the external integration checks.
