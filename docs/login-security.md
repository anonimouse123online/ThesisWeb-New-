# Login security integration

The inspected frontend uses `VITE_BACKEND_URL` (default `http://localhost:5001`),
`POST /auth/login`, and localStorage keys `token` and `user`. The nearby backend
copies currently issue a JWT immediately and have no security-context or
login-log routes. Audit Trail is an admin Settings tab at
`/settings?tab=audit`, with a full-width Security Logs table. It has no sidebar
entry. Old `/audit-trail` and `/audit-trail/security-logs` links redirect to this
Settings tab, which uses the existing protected admin layout.

## Enable the feature

Both login modes now ask for location after valid admin credentials. A dialog
asks the admin to turn on device location and allow browser access. Enable
Location triggers the one-time browser request; Continue without location or
Escape records DENIED with null coordinates. The browser may reuse a previous
permission decision; the app cannot force the browser's permission prompt or
turn on operating-system location services. The dialog explains how to enable
previously blocked site permissions.

The existing `/auth/login` endpoint remains the default. Once your backend implements the following
contract, set `VITE_LOGIN_SECURITY_FLOW=two-step` in `.env` and restart Vite
(or rebuild for production). Do not enable it against the old backend. Vite
variables are public configuration, so never put secrets in them.

The security API contracts await backend implementation. Two-step mode never
retries using legacy login when security finalization fails.

### Default login compatibility

The frontend calls the existing `POST /auth/login` and validates the returned
admin user and JWT before displaying the location dialog. After the admin's
choice it sends `POST /auth/login/security-context` with the existing JWT in
the Authorization header and body `{ "security_context": {...} }`. This call
contains no password or client IP. The JWT is held in memory until the location
step completes, then saved using the existing keys.

To support this compatibility path, the backend must accept the authenticated
context request, derive the user from the JWT, and attach the metadata to that
login's audit record (a 204 success response is sufficient). It must enforce
admin RBAC. The inspected old backend does not support this endpoint yet.
Recording is best effort in default mode: a missing endpoint, server rejection,
or network failure does not invalidate the successful existing login. This
request has a five-second timeout. The frontend cannot guarantee an audit
record on the old backend; use the two-step contract below when logging must
complete before the backend issues the session.

### 1. Verify credentials

`POST /auth/login/verify` with JSON:

```json
{ "email": "admin@example.com", "password": "password" }
```

Successful response:

```json
{
  "login_attempt_token": "short-lived-single-use-login-attempt",
  "user": { "id": 1, "name": "Admin", "email": "admin@example.com", "role": "admin" }
}
```

The backend must validate credentials and enforce admin eligibility, apply its
existing login rate limits, and return a short-lived, single-use attempt token
bound to that verified user. This token must not authorize ordinary protected
API calls. The frontend checks the returned role before requesting location.
It keeps the attempt token in memory and never stores or logs it.

### 2. Submit security context and receive the final session

After verification and the admin selecting Enable Location, the frontend calls `navigator.geolocation.getCurrentPosition`
once with `enableHighAccuracy: false`, `timeout: 10000`, and `maximumAge: 0`.
An additional 15-second deadline prevents an unanswered permission prompt from
holding sign-in indefinitely. Late callbacks are ignored. Geolocation requires
HTTPS or a browser-trusted localhost context. Browser permission settings decide
whether a prompt appears; previously granted or denied permission may be reused.

`POST /auth/login/security-context` with JSON:

```json
{
  "login_attempt_token": "short-lived-single-use-login-attempt",
  "security_context": {
    "latitude": 10.123456,
    "longitude": 123.123456,
    "location_accuracy": 25,
    "location_permission_status": "GRANTED",
    "user_agent": "browser user agent",
    "platform": "browser platform",
    "language": "en-US"
  }
}
```

Permission denial sends `DENIED`; position errors or unsupported/insecure
contexts send `UNAVAILABLE`; timeouts send `TIMEOUT`. In all three cases
`latitude`, `longitude`, and `location_accuracy` are null. These outcomes still
submit context and allow the backend to apply the existing authentication rules.
Basic browser metadata comes from navigator; there is no fingerprinting,
client IP lookup, continuous tracking, or local location history.

The backend must consume the attempt token, validate untrusted client metadata,
determine the IP from its trusted request/proxy configuration, create the audit
record, and return the existing `{ "token": "final-jwt", "user": {...} }`
session shape. Server authorization and security classifications remain the
source of truth. The frontend saves that final response using the existing
session keys and navigates to `/dashboard`. Failed finalization does not save
an intermediate session or silently bypass logging. Auth requests time out
after 20 seconds, and errors shown to users are sanitized.

## Security Logs API

`GET /security/login-logs?page=1&limit=25` uses the existing `fetchWithAuth`
helper and its Bearer JWT. **The backend must enforce admin RBAC**; client route
protection is only a UI guard. A 401 uses the existing session-clearing and
login-redirect behavior. A 403 displays an access-denied message. A 404 displays
that the feature is not yet available. Network/server failures show a retry
action. Requests use `cache: no-store`; records are held only in page memory.

Expected response (ISO timestamps should include a timezone):

```json
{
  "data": [
    {
      "id": 1,
      "user_name": "Admin",
      "email": "admin@example.com",
      "role": "admin",
      "event_type": "LOGIN",
      "login_status": "SUCCESS",
      "timestamp": "2026-10-03T08:00:00Z",
      "ip_address": "192.0.2.10",
      "latitude": 10.123456,
      "longitude": 123.123456,
      "location_accuracy": 25,
      "location_permission_status": "GRANTED",
      "location": "Optional backend-provided location label",
      "user_agent": "browser user agent",
      "platform": "browser platform",
      "language": "en-US",
      "security_status": "NEEDS_REVIEW",
      "security_reason": "Backend-provided explanation"
    }
  ],
  "pagination": { "page": 1, "total_pages": 1, "total": 1 }
}
```

The reader also accepts a bare array or `{ "logs": [...], "pagination": {...} }`,
`created_at` instead of `timestamp`, nested `user` fields, and nested
`security_context` fields. List records must include the detail fields above;
the dialog uses the same record without a separate detail API call. Numeric
database strings are supported, including coordinates equal to zero. Missing
classifications are displayed as "Not provided" and are never assumed NORMAL.
Invalid/missing coordinate pairs do not produce a map link.

The UI uses the Settings profile dropdown, filter dropdown, status badges, project table
styles, and modal styling with a native dialog for keyboard focus and Escape.
Dates display in the browser's local timezone, with the timezone shown.
Search and security-status filters apply to the current server page. Pagination
uses server totals; arrays without pagination are displayed in full.

The Security Status badge displays server classifications: NORMAL is green,
SUSPICIOUS is red, and NEEDS_REVIEW is amber. Unknown classifications retain
their backend text with neutral styling. No frontend security detection occurs.
The detail dialog shows the backend reason and offers View Location only for
valid coordinates. Opening it sends the coordinates to Google Maps after the
admin clicks the link; no maps are embedded or loaded automatically.

## Testing

Run `npm run test:security` for mocked-browser/auth/API regression tests,
`npm run build` for TypeScript and production bundling, and lint changed files.
The test command uses Node's test runner without subprocess isolation; it was
validated on Node 24.
These tests do not contact the backend or prove server logging/RBAC.

For end-to-end verification against your backend:

1. Leave security mode unset and confirm the existing login succeeds, then
   shows the location dialog. Verify Enable Location makes one geolocation
   request, while Continue without location or Escape submits DENIED with null
   coordinates. Check a missing security endpoint still allows login, remembered
   email, protected routing, logout, and JWT requests to work.
2. Implement the contract above, enable two-step mode, restart Vite, and use
   localhost or HTTPS. Submit invalid credentials: verify no location prompt
   and no finalization request. Submit a non-admin account: verify no prompt
   and no stored session; the backend must also deny admin access.
3. Submit valid admin credentials and allow location. In DevTools Network,
   confirm verify precedes location, then finalization contains security_context
   and no IP field. Only after the final response should token/user be stored
   and the dashboard open. Do not share Network captures containing credentials
   or authorization tokens.
4. Reset browser location permissions and deny access. Check DENIED plus three
   null coordinate fields, successful finalization according to backend rules,
   and a stored audit record with the backend-determined IP.
5. Simulate position unavailable, timeout, unsupported geolocation, or leave the
   prompt unanswered. Verify UNAVAILABLE/TIMEOUT with null coordinates and no
   stuck loading state. A late location callback must not change the submitted
   result. Repeated clicks must not submit concurrent login attempts.
6. Make finalization fail: verify a friendly error, no newly stored session,
   and no fallback login request. Also check backend-down, rate-limited,
   malformed-response, and expired-attempt responses.
7. Open Settings > Audit Trail (also test direct `/settings?tab=audit` and old
   links). Confirm there is no sidebar Audit Trail item. Verify authenticated pagination, empty states, current-page
   search/filtering, all table columns, detail fields, and map links. Include
   null coordinates and latitude/longitude zero. Verify timestamps show a zone.
8. Return each backend classification and reason; ensure the UI reflects the
   server values. Verify absent/unknown classifications remain neutral.
9. Return 403 for the log endpoint: verify the access-denied message. Expire
   the JWT and return 401: verify the existing helper clears the session and
   redirects to login. Independently test the endpoint with a non-admin token
   to confirm backend RBAC. Simulate 404, 500, non-JSON, and offline responses.
10. Confirm passwords, attempt tokens, JWT responses, and coordinates are absent
    from console output and that location is not persisted in browser storage.

## File inventory

Modified: `src/pages/LoginPage.tsx`, `src/App.tsx`, `src/components/Sidebar.tsx`,
`src/pages/Settings.tsx`, `src/components/login.css`, and `package.json`
(security regression test command).

Created: `src/utils/loginSecurity.ts`, `src/utils/authService.ts`,
`src/utils/securityLogs.ts`, `src/pages/AuditTrail.tsx`,
`src/components/AuditTrail.css`, `.env.example`,
`src/components/LoginLocationPrompt.tsx`, `tests/login-security.test.mjs`,
and this guide.
