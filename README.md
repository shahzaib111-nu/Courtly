# Courtly — Sports Court Booking System

A web-based platform for discovering, booking, and managing sports courts across Lahore. Built with Spring Boot (H2) on the backend and plain HTML/JS/Tailwind on the frontend.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Java JDK** | **21** | Only hard requirement — download from [Adoptium](https://adoptium.net/) |
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

**4. Open the frontend**

Open `src/frontend/index.html` in your browser (VS Code Live Server recommended, or any static HTTP server on port 5500).

Backend API runs on: `http://localhost:8081` (`server.port` in `application.properties`). The frontend reads the backend address from the single `API_BASE` constant at the top of `src/frontend/app.js`, so change both together if you change the port.

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
curl -X POST "http://localhost:8081/api/auth/login?email=admin.playfair@gmail.com&pass=Admin123&role=ADMIN"
```

### Authenticated request example
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" http://localhost:8081/api/courts
```

## OAuth2 Social Login (Google & GitHub)

Players and Arena Managers can also sign in with **Google** or **GitHub**. Social login ends with the same JWT as password login, so every page and API works the same way after sign-in.

### How it works
1. `index.html` calls `GET /api/auth/oauth2/providers` and shows a button for each configured provider.
2. The button opens `GET /api/auth/oauth2/authorize/{google|github}?redirect_uri=<frontend>/oauth-callback.html&role=PLAYER|MANAGER`.
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
4. Serve the frontend from an allowed origin. The defaults are ports `5500` and `5501` on `localhost` and `127.0.0.1` (Live Server; this project's `.vscode/settings.json` uses 5501). To use other origins, set `OAUTH2_ALLOWED_REDIRECT_ORIGINS` to a comma-separated list.

### MVC layout
| Layer | Backend | Frontend |
|---|---|---|
| Model | `User.authProvider` / `providerId`, `OAuth2UserProfile` | `mvc/models/oauth-model.js` |
| View | — | `index.html` (buttons), `oauth-callback.html` |
| Controller | `OAuth2Controller`, `OAuth2LoginSuccessHandler` / `FailureHandler` | `mvc/controllers/oauth-controller.js` |
| Service | `OAuth2AccountService`, `CustomOAuth2UserService` | — |

## Payments (Stripe test mode)

The server is the single source of truth for what a player pays:

1. `POST /api/payments/create-payment-intent { bookingID }`: the server checks the booking belongs to the caller and is still `PENDING`, takes the price from the booking (including peak/weekend rates and discounts) and creates a Stripe PaymentIntent.
2. The checkout page charges the card with Stripe.js. Card numbers never reach the Courtly server.
3. `POST /api/payments/confirm { bookingID, paymentIntentID }`: the server asks Stripe whether the payment really succeeded and for the right amount. It then saves a `Payment` (receipt number `CRT-YYYYMMDD-XXXXXX`, card brand and **last four digits only**) and marks the booking `CONFIRMED`. Calling it twice is safe.
4. `GET /api/payments/booking/{bookingID}`: the receipt, visible only to the player who paid or an admin.

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
| admin.playfair@gmail.com | Admin123 |

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
│   └── frontend/                # MVC frontend (HTML Views + JS Controllers)
│       ├── index.html           # Login / Registration view
│       ├── dashboard.html       # Player dashboard view
│       ├── admin.html           # Admin dashboard view
│       ├── facility-manager.html
│       ├── checkout.html
│       ├── app.js               # Shared controllers and API integration
│       └── mvc/controllers/     # Extracted page controllers
```
