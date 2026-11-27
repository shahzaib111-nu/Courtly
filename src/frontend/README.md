# Courtly frontend

Courtly connects players with sports courts in Lahore. The React application provides public discovery and separate workspaces for players, arena managers, and administrators. Spring Boot owns authentication, authorization, pricing, reservations, payments, reports, and database writes. The interface uses Lahore dates and PKR amounts.

## Local development on Windows

Use Java 21 and Node.js 20.19+ on the 20.x release line or 22.12+. Use two PowerShell terminals from the repository root.

```powershell
Set-Location src/backend
.\mvnw.cmd spring-boot:run
```

The backend serves the API on port 8081. If existing data is already initialized and the demo seed must be skipped, use the following launch instead. The default startup applies demo seed updates.

```powershell
Set-Location src/backend
.\mvnw.cmd '-Dspring-boot.run.arguments=--spring.sql.init.mode=never' spring-boot:run
```

```powershell
Set-Location src/frontend
npm.cmd ci
npm.cmd run dev
```

Open [Courtly](http://localhost:5501) or [administrator sign-in](http://localhost:5501/login?role=admin). Use accounts authorized for the selected local role. Keep the existing backend-local `src/backend/src/main/resources/secrets.yml` ignored by Git. See the [repository configuration documentation](../../README.md) and the [configuration template](../backend/src/main/resources/secrets.example.yml).

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/main.tsx` | React Router registration, route guards, lazy entry points and bookmark aliases |
| `src/pages/` | Public discovery, authentication and role-specific workflows |
| `src/components/` | Navigation, forms, dialogs, tables, report charts and common states |
| `src/lib/` | API adapters, DTO types, session synchronization, validation, date handling and report exports |
| `src/*.css` | Tailwind integration, shared tokens and public/workspace layouts |
| `public/images/`, `public/licenses/` | Brand artwork, sports photography and font licenses |

Vite bundles React, TypeScript, Tailwind CSS, React Router, Lucide and locally hosted Inter and Space Grotesk. Recharts loads with reports. jsPDF and AutoTable load on PDF export. Stripe.js loads when the player enters card checkout. The built frontend expects the existing local API origin `http://localhost:8081`.

Courtly's logo and approved ImageGen tennis photography carry forward from the original redesign. Responsive WebP derivatives of the same photographs serve the homepage, player welcome, and auth panels. CSS illustrations on facility cards indicate courts generically. Text on the cards comes from the Courtly API.

## Build and review

```powershell
Set-Location src/frontend
npm.cmd run typecheck
npm.cmd run build
npm.cmd run preview
```

The build writes to `dist`. The preview uses port 5501, so stop the development server before running it. A static host must serve existing assets and rewrite application routes, including old `.html` bookmarks, to `index.html`. There is no separate frontend lint command. Run the backend suite from `src/backend` with `.mvnw.cmd test`. Run browser workflow checks against a separate in-memory database with synthetic accounts, test documents, and no live provider configuration.

See the [route map, API inventory and migration checklist](MIGRATION.md), the [demonstration guide](DEMO_GUIDE.md), the [backend limitations](BACKEND_LIMITATIONS.md), and the [Phase Six acceptance report](PHASE_SIX_REPORT.md).
