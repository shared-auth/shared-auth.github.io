# Public quote and pre-interest intake

The static site exposes two separate public intents on standard role hosts:

- `https://org.ores-shared-auth.com/quote/` submits
  `ores.shared-auth.public-intake.v1` with `intent = "quote"` to
  `https://api.ores-shared-auth.com/v1/quote-requests`.
- `https://user.ores-shared-auth.com/pre-interest/` submits the same closed
  schema marker with `intent = "pre_interest"` to
  `https://api.ores-shared-auth.com/v1/pre-interest`.
- `https://app.ores-shared-auth.com/start/` is the explicit handoff to the user
  and organization surfaces.

A quote request is non-binding and creates no account, invoice, charge, or
purchase commitment. A pre-interest registration creates no account,
organization, role, entitlement, quote, invoice, or charge. The API must not
silently promote either intent into another workflow.

## Browser boundary

The client validates and bounds every field before submission. It sends JSON
with `credentials: omit`, `cache: no-store`, `redirect: error`, and
`referrerPolicy: no-referrer`, plus a UUID v4 `Idempotency-Key` that is also the
request's client-generated `request_id`. It does not persist contact data in
browser storage and does not log payloads or provider responses. A honeypot is
accepted locally without generating origin traffic.

The quote host requires contact consent. Pre-interest requires purpose-limited
contact/storage consent and exposes marketing consent as a separate optional
choice. Every consent has an explicit revision and RFC 3339 timestamp. The
browser also requires a Cloudflare Turnstile token; without a configured public
site key, the submit button is disabled and the client fails closed.

Browser validation is convenience only. The API remains authoritative and must:

- require `Content-Type: application/json`, a valid UUID v4 idempotency key, and
  exact equality with `request_id`;
- verify the Turnstile token once, bind it to the expected action and canonical
  hostname, and never persist or log the token;
- enforce the closed v1 contract, exact source host, enums, uniqueness, integer
  bounds, text bounds, consent revisions, and consent timestamp again;
- use a unique `(intent, idempotency_key)` constraint and return the same generic
  accepted envelope on safe retries;
- return only `{ "schema": "ores.shared-auth.public-intake.v1", "status": "accepted" }`
  for every accepted or already-accepted request—never an email, organization,
  request ID, idempotency key, or existence signal;
- apply coarse Cloudflare shielding plus exact origin-side abuse limits;
- store approved contact data only in the designated Postgres authority through
  the Rust API and its SeaORM/Diesel persistence boundary;
- emit only bounded, low-cardinality telemetry such as intent, result, and
  rejection class; and
- provide authenticated, challenge-gated withdrawal/deletion without exposing a
  public record identifier.

## CORS and deployment

Expected browser origins are exact values, not suffix matches:

- `https://user.ores-shared-auth.com`
- `https://org.ores-shared-auth.com`

The GitHub Pages origin may render a review build but must not submit production
PII. Production activation requires exact-origin `OPTIONS` and `POST` canaries,
Turnstile hostname/action verification, persistence/idempotency tests, and a
rollback probe before a Worker custom domain is attached. Until then the UI
fails closed and states that no submission was recorded.
