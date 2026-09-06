import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const built = new URL("../dist/index.html", import.meta.url);
const dashboard = new URL("../dist/dashboard/index.html", import.meta.url);
const mobile = new URL("../dist/m/index.html", import.meta.url);
const dashboardSource = new URL("../src/pages/dashboard.astro", import.meta.url);
const lockfile = new URL("../package-lock.json", import.meta.url);
const workflows = [
  new URL("../.github/workflows/opto-sync-real-web.yml", import.meta.url),
  new URL("../.github/workflows/pages.yml", import.meta.url),
  new URL("../.github/workflows/repository-policy.yml", import.meta.url),
];

test("Astro emits the Shared Auth landing, dashboard handoff, and mobile surface", () => {
  assert.ok(existsSync(built));
  assert.ok(existsSync(dashboard));
  assert.ok(existsSync(mobile));
});

test("landing page exposes assurance, polyglot clients, and explicit user and organization login", () => {
  const html = readFileSync(built, "utf8");
  for (const expected of [
    "Shared Auth",
    "Select client language",
    "protected introspection",
    "Rust",
    "TypeScript",
    "Dart / Flutter",
    "Swift",
    "Dashboard",
    "User login",
    "Org login",
    "m.ores-shared-auth.com",
  ]) {
    assert.ok(html.includes(expected), `missing ${expected}`);
  }

  assert.ok(html.includes('<link rel="canonical" href="https://ores-shared-auth.com/"'));
  assert.match(
    html,
    /<a class="nav-login nav-user" href="https:\/\/user\.ores-shared-auth\.com">User login<\/a>/,
  );
  assert.match(
    html,
    /<a class="nav-login nav-org" href="https:\/\/org\.ores-shared-auth\.com">Org login<\/a>/,
  );
  assert.ok(
    html.includes('aria-label="Open the Shared Auth dashboard handoff"'),
    "dashboard CTA must retain its accessible label",
  );
  assert.ok(html.includes('class="site-header"'));
  assert.ok(!html.includes("undefined"));
});

test("mobile surface keeps user and organization context explicit", () => {
  const html = readFileSync(mobile, "utf8");
  for (const expected of [
    "m.ores-shared-auth.com",
    "User login",
    "Organization login",
    "user.ores-shared-auth.com",
    "org.ores-shared-auth.com",
    "touch-friendly",
  ]) {
    assert.ok(html.includes(expected), `missing ${expected}`);
  }
  assert.ok(!html.includes("Authorization: Bearer"));
  assert.ok(!html.includes("localStorage"));
  assert.ok(!html.includes("sessionStorage"));
});

test("dashboard handoff documents fail-closed directory guardrails", () => {
  const html = readFileSync(dashboard, "utf8");
  for (const expected of ["Users, sessions, and roles", "Organization isolation", "Session privacy", "Capability truth"]) {
    assert.ok(html.includes(expected), `missing ${expected}`);
  }
  assert.ok(html.includes("Dashboard endpoint pending"));
  assert.ok(html.includes('name="referrer" content="no-referrer"'));
  assert.ok(html.includes('name="robots" content="noindex,nofollow"'));
  assert.ok(!html.includes("Continue to dashboard"));
  assert.ok(!html.includes("Authorization: Bearer"));

  const source = readFileSync(dashboardSource, "utf8");
  assert.ok(source.includes('rel="noreferrer noopener"'));
  assert.ok(source.includes('referrerpolicy="no-referrer"'));
});

test("repository remains Astro-only, removes the legacy root page, and opts out of Jekyll", () => {
  assert.ok(existsSync(new URL("../public/.nojekyll", import.meta.url)));
  assert.ok(existsSync(new URL("../dist/.nojekyll", import.meta.url)));
  assert.ok(!existsSync(new URL("../index.html", import.meta.url)));
  for (const forbidden of ["_config.yml", "Gemfile", "config.toml", "hugo.toml"]) {
    assert.ok(!existsSync(new URL(`../${forbidden}`, import.meta.url)), `unexpected ${forbidden}`);
  }
});

test("Astro canonical output is the Cloudflare-owned marketing domain", () => {
  const config = readFileSync(new URL("../astro.config.mjs", import.meta.url), "utf8");
  assert.ok(config.includes('site: "https://ores-shared-auth.com"'));
  assert.ok(config.includes('output: "static"'));
  assert.ok(config.includes('trailingSlash: "always"'));
  assert.ok(!config.includes('site: "https://shared-auth.github.io"'));
});

test("the committed lock pins the certified Astro dependency", () => {
  assert.ok(existsSync(lockfile));
  const lock = JSON.parse(readFileSync(lockfile, "utf8"));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages[""].dependencies.astro, "7.2.1");
  assert.equal(lock.packages["node_modules/astro"].version, "7.2.1");
});

test("all workflow dependencies are immutable and checkouts drop credentials", () => {
  let checkoutCount = 0;
  let protectedCheckoutCount = 0;
  for (const workflowPath of workflows) {
    const workflow = readFileSync(workflowPath, "utf8");
    const uses = [...workflow.matchAll(/^\s*(?:-\s+)?uses:\s+\S+@([^\s#]+)\s*$/gm)];
    assert.ok(uses.length > 0, `no workflow dependency found in ${workflowPath.pathname}`);
    for (const [, reference] of uses) {
      assert.match(reference, /^[0-9a-f]{40}$/);
    }
    checkoutCount += (workflow.match(/uses:\s+actions\/checkout@/g) ?? []).length;
    protectedCheckoutCount += (
      workflow.match(/uses:\s+actions\/checkout@[0-9a-f]{40}[\s\S]{0,160}?persist-credentials:\s+false/g) ?? []
    ).length;
  }
  assert.ok(checkoutCount > 0);
  assert.equal(protectedCheckoutCount, checkoutCount);

  const pages = readFileSync(workflows[1], "utf8");
  assert.ok(pages.includes("npm ci --ignore-scripts --no-audit --no-fund"));
  assert.ok(!pages.includes("npm install --package-lock-only"));

  const browser = readFileSync(workflows[0], "utf8");
  assert.ok(browser.includes("skip_repository_commands: false"));
  assert.ok(browser.includes("app_page: index.html"));
  assert.ok(browser.includes("- 'src/**'"));
});
