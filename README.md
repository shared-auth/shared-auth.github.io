# shared-auth.github.io

Astro-based GitHub Pages marketing site for the Shared Auth identity plane. This repository is intentionally **not** Jekyll or Hugo.

## Development

```sh
npm ci
npm run dev
npm run build
npm test
```

The site emits static output to `dist/`, including `public/.nojekyll` so GitHub Pages serves the Astro artifact directly.

## Dashboard handoff

The marketing site links to `/dashboard/`. The handoff page never infers authentication state or embeds secrets. Set the GitHub Pages repository variable `PUBLIC_DASHBOARD_URL` to the deployed dashboard URL after `shared-auth/shared-auth-web-server.js` is provisioned.

The value is validated during the Astro build and must:

- use HTTPS;
- contain no embedded username or password; and
- point to the separately deployed Shared Auth directory dashboard.

When the variable is absent, the page stays fail-closed and displays a provisioning notice rather than redirecting to an invented endpoint.
