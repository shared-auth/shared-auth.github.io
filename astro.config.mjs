import { defineConfig } from "astro/config";
import { oresWasmLoader } from "./integrations/ores-wasm-loader.mjs";

// The canonical public origin is the apex of the domain we own on Cloudflare.
// GitHub Pages still serves the artifact; public/CNAME binds the custom domain.
export default defineConfig({
  site: "https://ores-shared-auth.com",
  output: "static",
  trailingSlash: "always",
  integrations: [
    oresWasmLoader({
      appId: "shared-auth",
      triggerSelector:
        'a[href^="https://user.ores-shared-auth.com"],a[href^="https://org.ores-shared-auth.com"],a[href^="https://admin.ores-shared-auth.com"],a[href^="https://m.ores-shared-auth.com"]',
    }),
  ],
});
