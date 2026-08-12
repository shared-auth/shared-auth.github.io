# Static-site environment policy

This Astro/GitHub Pages repository is not a secret owner. `PUBLIC_DASHBOARD_URL` is validated public build metadata and remains a GitHub repository variable in the Pages workflow; the workflow must not decrypt SOPS files.

For fleet consistency, the only optional tracked ciphertext paths are `env/enc/dev.env.enc` and `env/enc/prod.env.enc`. Plaintext stays under ignored, owner-only `env/dec/`, created by `just bootstrap`. If all values remain public, no ciphertext should be created.

Provider, database, signing, service-role, bearer/access/refresh-token, cloud, private-key, and callback-secret values are forbidden. Authentication state and provider delivery remain server-side in Shared Auth; general communications remain in Fanwaave.
