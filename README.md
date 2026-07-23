# shared-auth.github.io

This repository is intentionally dormant. The shared-auth organization does not
need a GitHub Pages marketing site, and no Pages workflow or site artifact is
configured here.

Repository maintenance still follows the organization baseline:

```sh
nix develop ./.nix
flags2env audit .cli-flags.toml
```

No telemetry exporter runs because there is no application runtime; any future
verification command inherits the standard OpenTelemetry environment contract.
