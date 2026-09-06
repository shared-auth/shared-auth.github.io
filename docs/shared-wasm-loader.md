# Shared WebAssembly loader pilot

This marketing site participates in the `ores-wasm-loaders` pilot.

## Runtime boundary

The Astro build injects a small page bootstrap. It loads the shared browser coordinator and the
independently versioned `owls-interfaces` contract, but it does **not** start Flutter, Leptos,
Dioxus, or product application code during ordinary page load.

A qualifying application link starts fetch-only preparation after 150 ms of sustained pointer
or keyboard intent. Cancellation, data-saving policy, and page lifecycle remain owned by the
shared coordinator. Clicking the link remains correct when preparation was skipped, failed,
cancelled, or evicted.

The public `globalThis.__ORES_WASM_LOADER__.activateProbe()` diagnostic explicitly activates an
8-byte WebAssembly canary. Production navigation never calls it automatically.

## Immutable inputs

- `owls-interfaces`: `b0e687c88b652d25964c041e2fdd0222f512fddd`
- `owls-web-loader`: `3b92396e34ffd0ba6411261957e47dd62cf3b4a4`
- probe SHA-256: `93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476`

The coordinator and canary are requested credentiallessly from jsDelivr's GitHub content
service. No account state, cookies, form contents, authentication tokens, or private endpoints
are sent. The dependency is pinned to exact Git commits and verified by the release manifest.

## What the pilot proves

It proves that the site can share one coordinator contract, prepare verified public Wasm after
intent, cancel safely, and expose explicit activation diagnostics. It does not claim that a
running runtime survives full-page navigation or that one download is universally reused across
different top-level sites. Browser cache partitioning and product release manifests still apply.

The next rollout stage replaces the canary manifest with each destination application's emitted
Flutter or Rust framework manifest, after click-to-useful-interaction and speculative-byte
budgets are baselined.
