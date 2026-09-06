import { defineConfig } from "astro/config";

// The canonical public origin is the apex of the domain we own on Cloudflare.
// GitHub Pages still serves the artifact; public/CNAME binds the custom domain.
export default defineConfig({
  site: "https://ores-shared-auth.com",
  output: "static",
  trailingSlash: "always",
});
