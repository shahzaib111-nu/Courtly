# Courtly — Sports Court Booking System

A web-based platform for discovering, booking, and managing sports courts across Lahore. Built with Spring Boot (H2) on the backend and React + TypeScript (Vite, Tailwind CSS) on the frontend.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Java JDK** | **21** | Runs the backend — download from [Adoptium](https://adoptium.net/) |
| **Node.js** | **20.19+ or 22.12+** | Runs the frontend (`npm`) — download the LTS from [nodejs.org](https://nodejs.org/) |
| Maven | — | **Not needed** — Maven wrapper (`mvnw`) is bundled |
| Browser | Any modern | Chrome / Edge / Firefox |

---

## Quick Start

**1. Clone the repository**
```bash
git clone <repo-url>
cd Courtly
git checkout feature/mock-database
```

**2. Add your secrets**

Copy `src/backend/src/main/resources/secrets.example.yml` to `secrets.yml` in the same folder, then fill in your Stripe test keys, Gmail app password, a JWT secret and (optionally) OAuth2 credentials. `secrets.yml` is git-ignored, so never commit real keys. Without it the app still starts, but payments, e-mail and social login are disabled.

**3. Run the backend**

Windows:
```
.\run-backend.bat
```

Mac / Linux:
```bash
cd src/backend
./mvnw clean spring-boot:run
```

> First run downloads Maven dependencies — allow 2–3 minutes. You will see `Started ProjectApplication` when it's ready.

**4. Start the frontend** (needs Node.js 20.19+ or 22.12+)

```bash
cd src/frontend
npm ci          # first time, or after package.json changes
npm run dev
```

Open <http://localhost:5501>. Administrators sign in at <http://localhost:5501/login?role=admin>.

The backend API runs on `http://localhost:8081` (`server.port` in `application.properties`). The frontend reads that address from `API_BASE` in `src/frontend/src/lib/api.ts`, so change both if you change the port. See `src/frontend/README.md` for the build, routes and architecture.

> Do not use VS Code Live Server any more: the React app must be served by Vite (`npm run dev`), which also uses port 5501.

---

## JWT Authentication

- Registration and login are handled through `/api/auth/**`.
- Passwords are stored with BCrypt; legacy seed passwords are migrated automatically at startup.
- Successful login returns a signed bearer JWT and expiration duration.
- Send the token as `Authorization: Bearer <token>` for `/api/**` endpoints.
- Spring Security uses a stateless JWT filter and rejects unauthenticated protected requests.
- Configure `jwt.secret` and `jwt.expiration-ms` in `application.properties`.

### Login example
```bash
curl -X POST "http://localhost:8081/api/auth/login?email=admin.playfair@gmail.com&pass=<app.admin.password>&role=ADMIN"
```

### Authenticated request example
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:8081/api/courts
```

## OAuth2 Social Login (Google & GitHub)

Players and Arena Managers can also sign in with **Google** or **GitHub**. Social login ends with the same JWT as password login, so every page and API works the same way after sign-in.

### How it works
1. `index.html` calls `GET /api/auth/oauth2/providers` and shows a button for each configured provider.
2. The button opens `GET /api/auth/oauth2/authorize/{google|github}?redirect_uri=<frontend>/oauth-callback&role=PLAYER|MANAGER`.
3. Spring Security sends the user to the provider, which calls back to `/login/oauth2/code/{provider}`.
4. `OAuth2AccountService` finds the account by provider id. If none is found, it links an existing account with the same **verified** email or creates a new one. It then issues a JWT.
5. The backend redirects to `oauth-callback.html#token=...`. The callback page saves the session and opens the right dashboard.

New social accounts follow the normal registration rules: players are active immediately, and managers wait for admin approval (`PENDING_APPROVAL`). The admin account can only sign in with a password.

The buttons appear on both the **Sign In** and **Register** forms, and the selected role tab (Player / Arena Manager) is the role used for a new account. Accounts created through Google or GitHub have no password. On the dashboard, **Change Password** turns into **Set a Password** for them, and once they set one they can also sign in with email and password. The profile card shows each account's sign-in method.

### Database
Hibernate (`ddl-auto=update`) adds two columns to `app_users` on the next start: `auth_provider` (`LOCAL`, `GOOGLE` or `GITHUB`) and `provider_id`. It also adds a unique constraint `uk_user_oauth_identity` on the pair. `data.sql` marks existing accounts as `LOCAL`. You don't need to reset the database.

### Setup
1. Create OAuth apps:
   - **Google**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → *Create credentials* → *OAuth client ID* → *Web application*.
   - **GitHub**: *Settings* → *Developer settings* → *OAuth Apps* → *New OAuth App*.
2. Set the callback / authorized redirect URI to `http://localhost:<server.port>/login/oauth2/code/google` (or `/github`). `<server.port>` is the port in `application.properties`.
3. Put the credentials in `src/backend/src/main/resources/secrets.yml`. Copy `secrets.example.yml` if the file is missing:
   ```yaml
   app:
     oauth2:
       github:
         client-id: "Ov23li..."
         client-secret: "..."
       google:
         client-id: "....apps.googleusercontent.com"
         client-secret: "GOCSPX-..."
   ```
   The file is git-ignored, so never commit it. A provider left blank is turned off, and its button stays hidden. You can also use the `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` environment variables; they are used when the YAML value is blank.
4. Serve the frontend from an allowed origin. The defaults are ports `5500` and `5501` on `localhost` and `127.0.0.1`; `npm run dev` uses `http://localhost:5501`. To use other origins, set `OAUTH2_ALLOWED_REDIRECT_ORIGINS` to a comma-separated list.

### MVC layout
| Layer | Backend | Frontend |
|---|---|---|
| Model | `User.authProvider` / `providerId`, `OAuth2UserProfile` | `src/lib/contracts.ts`, `src/lib/session.tsx` |
| View | — | `src/pages/auth.tsx` (provider buttons, `/oauth-callback` route) |
| Controller | `OAuth2Controller`, `OAuth2LoginSuccessHandler` / `FailureHandler` | `src/lib/api.ts` (provider discovery and authorize redirect) |
| Service | `OAuth2AccountService`, `CustomOAuth2UserService` | — |

## Payments (Stripe test mode)

The server is the single source of truth for what a player pays:

1. `POST /api/payments/create-payment-intent { bookingID }`: the server checks the booking belongs to the caller and is still `PENDING`, takes the price from the booking (including peak/weekend rates and discounts) and creates a Stripe PaymentIntent.
2. The checkout page charges the card with Stripe.js. Card numbers never reach the Courtly server.
3. `POST /api/payments/confirm { bookingID, paymentIntentID }`: the server asks Stripe whether the payment really succeeded and for the right amount. It then saves a `Payment` (receipt number `CRT-YYYYMMDD-XXXXXX`, card brand and **last four digits only**) and marks the booking `CONFIRMED`. Calling it twice is safe.
4. `GET /api/payments/booking/{bookingID}`: the receipt, visible only to the player who paid or an admin.
5. `GET /api/payments/player/{playerID}`: the player's payment history with receipts (the "Payment History" card on the dashboard).

An unpaid booking holds its slot for **10 minutes** (NFR 3.2). The checkout page shows a countdown; after that the booking can no longer be paid and the slot is released within a minute.

If a booking expires while the player is paying, the payment is refunded automatically. Test card: `4242 4242 4242 4242`, any future expiry date and any CVC.

## Running the Tests

```bash
cd src/backend
./mvnw test                          # everything (~280 tests)
./mvnw test -Dgroups=unit            # fast service/security unit tests only (no Spring, a few seconds)
./mvnw test -Dgroups=integration     # full API tests through HTTP (MockMvc)
./mvnw test -Dtest=BookingControllerTest   # a single class
```

Tests never touch the real database, mail server, Stripe or OAuth apps. They run against an in-memory H2 database seeded by `data.sql`, configured in `src/test/resources/application-test.properties`.

| Folder (`src/test/java/com/scd/courtly/`) | Type | What it covers |
|---|---|---|
| `service/*ServiceTest` | Unit (Mockito) | Business rules: pricing, booking limits, ratings, match points, reports, scheduled jobs, registration/login, OAuth account linking |
| `controller/*ControllerTest` | Integration | Every REST endpoint: success, validation (400), not found (404), conflicts (409) and permissions (401/403) |
| `security/` | Unit + integration | JWT handling, OAuth redirect allowlist, and the role matrix (anonymous / player / manager / admin) |
| `exception/` | Integration | Consistent JSON error body for every kind of failure |
| `support/` | Helpers | `IntegrationTest` base class (mocks e-mail and background jobs; rolls back each test), `TestData` (seed IDs), `Fixtures` (object builders) |

Each integration test runs in a transaction that is rolled back, so tests are independent and can run in any order. To add a test for a new endpoint, extend `IntegrationTest` and use `playerToken()`, `managerToken()`, `adminToken()` or `newPlayer()`.

## DTO Architecture

- Typed request DTOs in `com.scd.courtly.dto.request` validate authentication, booking, rating, match, payment, and maintenance payloads.
- Typed response DTOs in `com.scd.courtly.dto.response` are used for login, profile, registration, checkout, payment receipts, unread notifications, and maintenance responses.
- Jakarta validation provides field-level `400` responses.
- Controllers no longer accept generic `Map<String,Object>` request payloads for core operations.

## Role-Based Authorization

Roles available in the JWT security context:

| Role | Access |
|---|---|
| `USER` | Generic authenticated account access |
| `PLAYER` | Booking, ratings, matches, notifications, profile, and account operations |
| `MANAGER` | Facility and court-management operations |
| `ADMIN` | Full administrative, verification, reports, payments, and account controls |

Public API groups include authentication, court browsing, availability, and public rating queries. Protected APIs require JWT authentication. `/api/admin/**` requires `ADMIN`; `/api/manager/**` requires `MANAGER` or `ADMIN`.

- Missing or invalid JWT: `401 Unauthorized`
- Valid JWT with insufficient role: `403 Forbidden`

### Ownership rules

The caller's identity always comes from the verified JWT, never from IDs in the request (`AccessGuard`). Acting on someone else's data returns `403`.

- Players can only book, rate, submit results, upload documents and read notifications, bookings, profile and account status **for themselves**.
- A booking can be cancelled by its player, by the manager of that court, or by an admin. Manual confirmation is limited to the court's manager or an admin.
- Managers only see and change **their own** courts, bookings and maintenance. A new court always belongs to the manager who creates it.
- Managers awaiting approval (`PENDING_APPROVAL` / `REJECTED`) have no manager rights until an admin approves them.
- Uploaded ID documents can only be viewed by admins.
- Only the frontend origins in `app.cors.allowed-origins` may call the API from a browser (defaults: ports 5500/5501; `npm run dev` uses 5501).

### Accounts and passwords

- Sign in with your **email or username**. The username is optional at registration and can be set later under *Edit Profile*.
- Passwords need **at least 8 characters, with both letters and numbers** (registration, change password and OTP reset).
- **5 wrong passwords in a row lock the account for 10 minutes** (`423 Locked`). Resetting the password with the e-mailed OTP unlocks it immediately.
- Player categories: Regular, Student, Senior, Family or Group (Group also records the group size). Discounts still require an admin-approved document.

### Uploaded ID documents

Verification documents are encrypted with **AES-256-GCM** and stored in the database (`verification_doc_contents`). Nothing readable is written to disk. The key is `app.uploads.encryption-key` in `secrets.yml`:

```bash
openssl rand -base64 32
```

Keep a copy of this key. Documents cannot be read without it. If it is not set, document uploads are switched off. Files are also checked by content, not just by extension: a renamed `.txt` is rejected.

### Match disputes and notification retries

- A match result whose scores contradict the chosen result (e.g. *WIN* with 2-5) is saved as **DISPUTED**. It earns no points, and the admin is notified. Admins resolve it under *Disputed Match Results*, and the points are then awarded.
- Every notification e-mail is logged (`notification_deliveries`). A failed e-mail is retried up to 5 times with growing delays. Admins can see the log under *Notification E-mail Delivery*.
- A court with upcoming (pending or confirmed) bookings cannot be deleted.

## Backups and Restore (NFR 3.3)

The backend backs up the whole database **at least every 7 days**. An hourly check makes a new backup whenever the newest one is older than 7 days, so a backup still happens if the server was off at the usual time. The newest 8 are kept. Admins can see the backups and start one under **Database Backups** on the admin page.

| Setting (`application.properties` / `secrets.yml`) | Default | Meaning |
|---|---|---|
| `app.backup.dir` | `backups` (project root) | Folder for backups. **Set it to a cloud-synced folder** (Google Drive, OneDrive, Dropbox) so copies are kept off the machine. |
| `app.backup.password` | empty | Put a password in `secrets.yml` to encrypt backups (AES). Encrypted backups end in `.enc`. |
| `app.backup.interval-days` / `app.backup.keep` | 7 / 8 | How often, and how many to keep |

**Restore (RTO under 4 hours, NFR 3.3.1)**: typically takes under a minute.

1. Stop the backend.
2. Restore the backup:
   ```bash
   ./scripts/restore-backup.sh backups/courtly-backup-YYYYMMDD-HHMMSS.zip     # Linux/macOS
   scripts\restore-backup.bat backups\courtly-backup-YYYYMMDD-HHMMSS.zip   :: Windows
   ```
   Add the backup password as a second argument for `.enc` files.
3. Start the backend.

The script keeps the current database as `database/courtlydb.mv.db.before-restore-<time>`.

**Also keep a safe copy of `secrets.yml`.** It holds `app.uploads.encryption-key`; without it, the uploaded ID documents inside a backup cannot be read.

## Performance (NFR 1.1-1.3)

`PerformanceTest` loads **50,000 bookings and 5,000 match results** and checks each request against the spec's limit. Measured on a 4-core laptop:

| Request | NFR | Limit | Measured |
|---|---|---|---|
| Calendar: free slots for a date + sport | 1.1.2 / 1.2.1 | 3 s | ~40 ms |
| Search: a player's bookings (~6,000 rows) | 1.2.2 | 4 s | ~0.5 s |
| Reports covering 1 year (utilization / revenue / demographics) | 1.3.1 | 6 s | 0.1-0.9 s |
| Report data for PDF/CSV export (1 year of payments; 5,000 results) | 1.3.2 | 5 s | ~0.9 s / ~0.2 s |

```bash
./mvnw test -Dgroups=performance          # the 50,000-booking check (also runs in CI)
python3 scripts/load-test.py --users 250   # peak load (NFR 1.1.1) against a running backend
```

`load-test.py` simulates 250 players opening the booking calendar **at the same moment**. It reports median, p95 and maximum response times, and passes when every response is under 4 seconds.

## Design Mapping (SCD class diagram and ERD → code)

How the Phase 1 class diagram and ERD (`docs/phases/Courtly_SCD_Phase1_Team13.pdf`) are implemented:

| Design | Implementation |
|---|---|
| `User` / `USERS` (incl. `failed_attempts`, `locked_until`) | `model/User.java` (`app_users` table) |
| `Player` and its categories Regular / Senior / Student / Family / Group | `model/Player.java`. `category` plus the category fields `studentId`, `universityEmail`, `familySize`, `groupSize`, `leadMemberName`; `discountTier` = `discount_status`, `rankPoints` = `ranking_points` |
| `Arena Manager` / `ARENA_MANAGER` | A `Player` with role `MANAGER`; its facility is `Facility.managerId` |
| `Admin` / `ADMIN` | Built-in account from `secrets.yml` (`security/AdminAccount.java`) |
| `Facility` / `FACILITY` (`getFacilityDetails`, `checkOperatingStatus`) | `model/Facility.java`, `/api/facilities`, "My Facility" card on the manager page |
| `Court` / `COURT` (`facility_id`) | `model/Court.java` (`facilityId`) |
| `TIME_SLOT` | Generated on demand from each court's hours and slot length (`CourtService.generateTimeSlots`); a booking stores its date and slot |
| `Booking` / `BOOKING` | `model/Booking.java` |
| `Payment` / `PAYMENT` (`masked_card`, `receipt_no`, `paid_at`) | `model/Payment.java` (`transactionDate` = `paid_at`) |
| `VerificationDoc` / `VERIFICATION_DOC` (`reviewed_by`) | `model/VerificationDoc.java`; encrypted file contents in `VerificationDocContent` |
| `MatchResult` / `MATCH_RESULT` (`opponent_id`, `winner_id`, `status`) | `model/MatchResult.java` |
| `FacilityFeedback` / `FACILITY_FEEDBACK` (`facility_id`) | `model/FacilityRating.java` (`facilityId`, `facilityName`) |
| `NOTIFICATION` (`channel`, `status`, `sent_at`) | In-app: `model/Notification.java`; e-mail delivery log: `model/NotificationDelivery.java` |
| `SystemReport` / `SYSTEM_REPORT` (`admin_id`, `filters`, `export_format`) | `model/SystemReport.java`; report figures from `ReportService`, PDF/CSV export in the admin page, history under "Report History" |

Deliberate differences: IDs are strings (e.g. `PLR001`, `FAC-001`, UUIDs) rather than `INT`; the ERD's `TIME_SLOT` table is not stored because slots are generated from court hours; player categories are one table with a `category` column instead of one subclass per category.

**Database:** the spec does not require a specific DBMS (the ERD uses standard SQL types). The project uses H2 in file mode, so no database server needs to be installed. Switching to MySQL would only need the MySQL driver and a datasource URL, but the seed file (`data.sql`) uses H2's `MERGE ... KEY(...)` syntax and would need rewriting.

## Exception Handling

- All API errors use a consistent JSON response: `timestamp`, `status`, `error`, `message`, and `path`.
- Authentication failures return `401`; authorization failures return `403`.
- Validation, malformed JSON, missing parameters, and bad types return `400`.
- Duplicate/conflicting resources return `409`.
- Missing resources and endpoints return `404`.
- File-size and Stripe/payment provider failures return dedicated `413`/`502` responses.
- Unexpected server failures return `500` without exposing stack traces or internal secrets.

---

## Demo Accounts

All accounts use password: **`Demo1234`**

### Admin
| Email | Password |
|---|---|
| admin.playfair@gmail.com | set `app.admin.password` in `secrets.yml` (admin login is disabled until you do) |

### Arena Managers
| Name | Email | Courts |
|---|---|---|
| Imran Tariq | imran.tariq@demo.com | Court 1 of every sport (8 courts) |
| Faisal Mehmood | faisal.mehmood@demo.com | Court 2 of every sport (8 courts) |

### Players
| Name | Email | Discount |
|---|---|---|
| Hamza Raza | hamza.raza@demo.com | None |
| Zainab Akhtar | zainab.akhtar@demo.com | None |
| Bilal Chaudhry | bilal.chaudhry@demo.com | 20% Student |
| Ayesha Siddiqui | ayesha.s@demo.com | 20% Student |
| Abdul Qadir | abdul.qadir@demo.com | 20% Senior |
| Rubina Naz | rubina.naz@demo.com | 20% Senior |
| Khalid Iqbal | khalid.iqbal@demo.com | 20% Family |
| Nasreen Malik | nasreen.malik@demo.com | 20% Family |

---

## Mock Data

The seed script (`src/backend/src/main/resources/data.sql`) runs automatically on every backend start and populates:

- **16 courts** — 2 per sport (Tennis, Cricket, Football, Basketball, Futsal, Badminton, Squash, Volleyball), each with peak-hour and weekend pricing
- **37 bookings** — spanning April–May 2026, covering all statuses: COMPLETED, CONFIRMED, PENDING, and one CANCELLED

No manual setup is required. If you need a clean slate, stop the backend, delete `src/backend/database/courtlydb.mv.db`, and restart.

---

## H2 Database Console

Available at `http://localhost:8081/h2-console` while the backend is running.

| Field | Value |
|---|---|
| JDBC URL | `jdbc:h2:file:./database/courtlydb` |
| Username | `sa` |
| Password | *(leave blank)* |

---

## Project Structure

```
Courtly/
├── run-backend.bat              # Windows one-click backend launcher
├── src/
│   ├── backend/                 # Spring Boot application
│   │   └── src/main/
│   │       ├── java/com/scd/courtly/
│   │       └── resources/
│   │           ├── application.properties
│   │           └── data.sql     # Auto-seeded mock data
│   └── frontend/                # React + TypeScript app (Vite, Tailwind CSS)
│       ├── package.json         # npm run dev / build / typecheck
│       ├── index.html           # Vite entry page
│       ├── public/              # Images and font licenses
│       └── src/
│           ├── main.tsx         # Routes and route guards
│           ├── pages/           # Public, auth, player, manager and admin screens
│           ├── components/      # Layouts, forms, tables, charts
│           └── lib/             # API adapters, session, validation, exports
```
