# Public quote and pre-interest intake

The static site exposes two independent, exact-host public intents:

- `https://quote.ores-shared-auth.com/` submits
  `ores.shared-auth.public-intake.v1` with `intent = "quote"` to
  `https://api.ores-shared-auth.com/v1/quote-requests`.
- `https://pre-interest.ores-shared-auth.com/` submits the same closed schema
  marker with `intent = "pre_interest"` to
  `https://api.ores-shared-auth.com/v1/pre-interest-registrations`.
- `https://app.ores-shared-auth.com/` remains the explicit user,
  organization, administration, quote, and pre-interest selector.

A quote request is non-binding and creates no account, invoice, charge,
purchase commitment, role, tenant, session, or authorization grant. A
pre-interest registration creates no account, organization, entitlement,
reserved price, quote, invoice, or charge. The API must not silently promote
either intent into another workflow.

## Browser boundary

The client validates and bounds every field before submission. It sends one
JSON request with:

- `credentials: omit`;
- `cache: no-store`;
- `redirect: error`;
- `referrerPolicy: no-referrer`;
- an eight-second abort timeout; and
- a UUID v4 `Idempotency-Key` that exactly matches the payload `request_id`.

No contact data is placed in browser storage, URL parameters, logs, telemetry,
or error messages. A honeypot is absorbed locally without validation, a clock
read, UUID use, Turnstile use, or origin traffic. A failed request retains the
same idempotency key and consent timestamp for a safe retry; a confirmed
acceptance rotates both.

The quote host requires purpose-limited contact consent. Pre-interest requires
purpose-limited contact/storage consent and presents marketing consent as a
separate optional choice. Consent revisions are explicit and the browser
records an RFC 3339 timestamp.

The browser requires a Cloudflare Turnstile token. The public site key is the
only Turnstile value exposed to Astro. A missing or malformed public site key
fails the build or disables submission. The Turnstile secret belongs only in
the API-side secret manager.

Browser validation is a convenience boundary, never the authority. The Rust
API must independently:

- require `Content-Type: application/json`;
- require a UUID v4 idempotency key and exact equality with `request_id`;
- allow only the exact source host for the selected intent;
- verify the Turnstile token once against the expected hostname and action;
- never persist, echo, or log the Turnstile token;
- enforce the closed v1 schema, enums, integer limits, string limits,
  uniqueness, consent revisions, and timestamp;
- use a unique `(intent, idempotency_key)` database constraint and return the
  same generic result for safe retries;
- return HTTP `202` with exactly
  `{ "schema": "ores.shared-auth.public-intake.v1", "status": "accepted" }`;
- never return an email, organization, request ID, idempotency key, row ID, or
  existence signal;
- apply Cloudflare shielding plus origin-side rate, replay, and abuse controls;
- store approved contact data only in the designated Postgres authority
  through the Rust API's SeaORM/Diesel persistence boundary;
- emit only bounded, low-cardinality telemetry such as intent, result, and
  rejection class; and
- provide authenticated, challenge-gated withdrawal or deletion without
  exposing a public record identifier.

The browser accepts no other success status or response shape. Response bodies
are limited to 8 KiB before JSON parsing, and request bodies are limited to
16 KiB after serialization.

## Exact CORS contract

Production browser origins are exact values, never suffix matches:

- `https://quote.ores-shared-auth.com`
- `https://pre-interest.ores-shared-auth.com`

Required CORS behavior:

- `Access-Control-Allow-Origin` echoes only one of those exact origins;
- `Vary: Origin` is present;
- methods are limited to `OPTIONS, POST`;
- requested headers are limited to `Content-Type, Idempotency-Key`;
- credentials are disabled;
- redirects are not used;
- preflight and POST responses disclose no internal origin or record identity.

The raw GitHub Pages origin may render a review artifact but must not submit
production contact data. Do not add it to production CORS.

## Activation gates

The pages are source-ready but not operational merely because they build.
Production intake requires all of the following before the API origin is
promoted:

1. A scoped Turnstile site/secret pair whose hostname and action checks match
   the exact dedicated surface.
2. Exact-origin `OPTIONS` and `POST` canaries, including negative origin,
   credential, malformed body, replay, and oversized-response cases.
3. Durable idempotent Postgres persistence tests and rollback evidence.
4. Redacted telemetry review proving no contact field, token, request ID, or
   idempotency key appears in logs or metrics.
5. Cloudflare Worker and origin-side rate limits with bounded rejection
   responses.
6. The independent `shared-auth-e2e` domain probe at the exact Worker version
   and Git revision.

Until every gate passes, the UI stays disabled or reports that no submission
was recorded. No third-party form processor or fallback storage is permitted.
