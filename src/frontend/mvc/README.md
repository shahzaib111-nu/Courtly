# Frontend MVC Structure

- `views`: HTML pages (presentation only)
- `controllers`: page-specific JavaScript behavior
- `app.js`: shared MVC controller and API integration
- `mvc/controllers`: extracted page controllers, with no inline JavaScript in HTML
- `mvc/models`: client-side data/API logic with no DOM access (e.g. `oauth-model.js` for Google/GitHub sign-in)

The backend follows the same separation: `model` entities, `repository` persistence, `service` business logic, and `controller` HTTP endpoints.
