# Courtly demonstration guide

## Prepare the demo

- Start the frontend and backend using the [local instructions](README.md). Use a disposable database and authorized test accounts. Confirm the selected backend is listening on the configured Courtly API port before signing in.
- Prepare a manager awaiting approval, an approved manager assigned to a facility, a player with a future booking opportunity, and an administrator configured through the ignored local secrets file.
- Use synthetic documents and generated play history in the demo environment. Prepare recent records for all five reports. Provider transactions and emails need authorized test settings and recipients.
- Open separate browser profiles for each role, or sign out between roles. Tabs on the same origin share the signed-in session.

## Demonstration sequence

1. Open the homepage and find a court through a sport tile. Select a date and facility, check live availability, and follow the booking path to sign-in.
2. Open the player workspace. Compare the weekly calendar and daily mobile view. Review a live price, reserve one slot, and show the booking status and server hold. With authorized Stripe test configuration, finish a test payment and show the receipt and Copy booking reference action. Otherwise show a recorded synthetic receipt or the missing-payment-service state.
3. Register the demo manager and show the pending restrictions. Sign in as administrator at [local administrator sign-in](http://localhost:5501/login?role=admin). Approve the application and use the manager's Refresh approval status action.
4. Use an approved manager with an assigned facility to update a court description or hourly rate. Verify the result in public discovery and the player workspace. Open the booking register and manually confirm a separate synthetic reservation. Show the player and administrator views for the same booking. A manual confirmation records a booking decision and produces no Stripe receipt.
5. Upload a synthetic verification document as the player. Review it in the protected admin viewer, record a decision, and refresh the player status. If encryption is unavailable, show the prerequisites or use the isolated review environment.
6. Submit a result and rating for an eligible past booking. Show the duplicate guard and the leaderboard. If a synthetic dispute is prepared, resolve it with matching scores and result as administrator.
7. Open administrator reports. Use **Last 30 days** for recent activity, **Previous month** for a closed period, or **Custom range** to include known synthetic records. Generate court utilization, revenue, demographics, rankings, and feedback. Export PDF and CSV and show the resulting history. Run a narrow date range to demonstrate the zero-results state.
8. Open the three role inboxes and show read state. Stay on backup status unless using a disposable environment. Never execute a restore as part of a live demonstration.

## Explain the integration

The frontend sends a role-aware sign-in request to Spring Boot. On success it receives the account identity and a signed, expiring JWT. Protected requests carry the JWT as a bearer header to the Courtly API. The backend verifies the signature and permissions. Browser route guards guide navigation, and a logout clears the shared browser session.

Court schedules and prices come from the backend. A booking review confirms current availability and displays the server quote. Administrator views read existing operational data. Reports keep explicit applied filters, and the backend records their history. PDF and CSV files are built in the browser from the returned report data.

For the final presentation, distinguish recorded booking amounts from validated Stripe transactions. Explain that payments, email OTP, and Google/GitHub sign-in require test provider configuration. The [backend limitations](BACKEND_LIMITATIONS.md) cover reservation validation, authorization, report scope, backups, and seed behavior.
