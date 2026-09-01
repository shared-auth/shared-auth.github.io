# Public quote and pre-interest intake

The static site exposes two deliberately small public intake journeys:

- `/quote/` submits `ores.shared-auth.quote-request.v1` to
  `https://api.ores-shared-auth.com/v1/quote-requests`.
- `/pre-interest/` submits `ores.shared-auth.pre-interest.v1` to
  `https://api.ores-shared-auth.com/v1/pre-interest`.
- `/start/` is the application handoff for the canonical user and organization
  surfaces.

These pages are safe to serve through the `app`, `user`, and `org`
`ores-shared-auth.com` Worker routes while the native Rust web server is being
activated. The API must explicitly allow only the reviewed HTTPS origins that
serve these exact assets; a wildcard CORS origin is not acceptable.

## Browser boundary

The client validates and bounds every field before submission. It sends JSON
with `credentials: omit`, `cache: no-store`, `redirect: error`, and
`referrerPolicy: no-referrer`, plus a UUID v4 `Idempotency-Key`. It does not
persist contact data in browser storage and does not log payloads or provider
responses. A honeypot is accepted locally without generating origin traffic.

Browser validation is convenience only. The API remains authoritative and must:

- require `Content-Type: application/json` and a valid UUID v4 idempotency key;
- enforce the exact v1 contract, enum, array, integer, and text bounds again;
- use a unique `(kind, idempotency_key)` constraint and return the original
  opaque request ID on a safe retry;
- return `202` with an opaque bounded `request_id`, never an email or payload;
- apply coarse Cloudflare shielding plus exact origin-side abuse limits;
- store contact data only in the approved database, encrypted/backed up under
  the shared-auth retention policy;
- emit only bounded, low-cardinality telemetry such as contract kind, result,
  and rejection class; and
- never infer a user, organization, role, or entitlement from an unauthenticated
  intake submission.

## CORS and deployment

Expected browser origins are exact values, not suffix matches:

- `https://app.ores-shared-auth.com`
- `https://user.ores-shared-auth.com`
- `https://org.ores-shared-auth.com`
- the reviewed GitHub Pages origin during the staged migration

Production activation requires the API endpoints to pass live `OPTIONS` and
`POST` canaries before a Worker custom domain is attached. Until then the UI
fails closed with a generic unavailable message and states that no submission
was recorded.
