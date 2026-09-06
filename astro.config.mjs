import { defineConfig } from "astro/config";
import { oresWasmLoader } from "./integrations/ores-wasm-loader.mjs";

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
