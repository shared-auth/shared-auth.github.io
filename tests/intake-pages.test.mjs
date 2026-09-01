import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = await Promise.all([
  "src/pages/quote.astro",
  "src/pages/pre-interest.astro",
  "src/pages/start.astro",
  "src/components/PublicIntakeShell.astro",
  "src/components/DashboardCta.astro",
].map(async (path) => [path, await readFile(new URL(`../${path}`, import.meta.url), "utf8")]));
const source = files.map(([, content]) => content).join("\n");

test("public pages expose the exact role-host journeys", () => {
  for (const marker of [
    "https://org.ores-shared-auth.com/quote/",
    "https://user.ores-shared-auth.com/pre-interest/",
    "https://app.ores-shared-auth.com/",
    "https://user.ores-shared-auth.com/",
    "https://org.ores-shared-auth.com/",
    "https://auth.ores-shared-auth.com/edge/healthz",
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("forms declare bounded fields, separate consent, accessible status, and a honeypot", () => {
  assert.match(source, /maxlength="2000"/);
  assert.match(source, /contact_consent/);
  assert.match(source, /marketing_consent/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /name="website"/);
});

test("production submissions require a configured Turnstile site key", () => {
  assert.match(source, /PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(source, /cf-turnstile/);
  assert.match(source, /challenges\.cloudflare\.com\/turnstile/);
  assert.match(source, /disabled=!\{?turnstileSiteKey\}?|disabled=\{!turnstileSiteKey\}/);
});

test("the intake UI never stores or logs contact data", () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|console\.(?:log|info|debug)/);
});

test("every Astro page and component keeps a closed frontmatter block", () => {
  for (const [path, content] of files) {
    assert.ok(content.startsWith("---\n"), `${path} must start with Astro frontmatter`);
    assert.ok(content.indexOf("\n---\n", 4) > 3, `${path} must close Astro frontmatter`);
  }
});
