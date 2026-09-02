# Static-site environment policy

This Astro/GitHub Pages repository is not a secret owner. Its only build-time
values are reviewed public metadata:

- `PUBLIC_DASHBOARD_URL`;
- `PUBLIC_DASHBOARD_URL_ALLOWLIST`; and
- `PUBLIC_TURNSTILE_SITE_KEY`.

The dashboard values are exact public routing metadata. The Turnstile site key
is also public by design and enables the browser challenge widget. Its matching
secret key, verification response, and provider credentials belong only in the
API-side secret manager. They must never enter this repository, a Pages
variable, Astro output, logs, or browser code.

The three values remain GitHub repository variables in the Pages workflow; the
workflow must not decrypt SOPS files.

For fleet consistency, the only optional tracked ciphertext paths are
`env/enc/dev.env.enc` and `env/enc/prod.env.enc`. Plaintext stays under ignored,
owner-only `env/dec/`, created by `just bootstrap`. If all values remain public,
no ciphertext should be created.

Database, signing, service-role, bearer/access/refresh-token, cloud,
private-key, Turnstile-secret, and callback-secret values are forbidden.
Authentication state and provider delivery remain server-side in Shared Auth;
general communications remain in Fanwaave.
