import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const built = new URL("../dist/index.html", import.meta.url);
const dashboard = new URL("../dist/dashboard/index.html", import.meta.url);
const dashboardSource = new URL("../src/pages/dashboard.astro", import.meta.url);
const lockfile = new URL("../package-lock.json", import.meta.url);
const workflows = [
  new URL("../.github/workflows/opto-sync-real-web.yml", import.meta.url),
  new URL("../.github/workflows/pages.yml", import.meta.url),
  new URL("../.github/workflows/repository-policy.yml", import.meta.url),
];

test("Astro emits the Shared Auth landing page and dashboard handoff", () => {
  assert.ok(existsSync(built));
  assert.ok(existsSync(dashboard));
});

test("landing page exposes assurance, polyglot clients, and a dashboard CTA", () => {
  const html = readFileSync(built, "utf8");
  for (const expected of ["Shared Auth", "Select client language", "Protected introspection", "Rust", "TypeScript", "Dart / Flutter", "Swift", "Dashboard", "/dashboard/"]) {
    assert.ok(html.includes(expected), `missing ${expected}`);
  }
  const dashboardLinks = html.match(/<a\b[^>]*href="\/dashboard\/"[^>]*>/g) ?? [];
  assert.ok(dashboardLinks.length >= 2, "homepage must expose dashboard links in both the navigation and hero");
  assert.match(html, /<nav>[\s\S]*<a class="nav-dashboard" href="\/dashboard\/">Dashboard<\/a><\/nav>/);
  assert.match(html, /<div class="actions"><a class="dashboard-cta" href="\/dashboard\/"/);
  assert.ok(
    html.includes('aria-label="Open the Shared Auth dashboard handoff"'),
    "hero dashboard CTA must retain its accessible label",
  );
  assert.ok(!html.includes("undefined"));
});

test("the header offers both user and organization login entry points", () => {
  const html = readFileSync(built, "utf8");
  assert.ok(html.includes('href="https://user.ores-shared-auth.com/sign-in/"'), "missing user login link");
  assert.ok(html.includes('href="https://org.ores-shared-auth.com/sign-in/"'), "missing org login link");
  assert.ok(html.includes(">User login<"), "missing user login label");
  assert.ok(html.includes(">Org login<"), "missing org login label");
  // The login entry points must precede the dashboard handoff in the header,
  // and the dashboard link must remain the final navigation item.
  const nav = html.match(/<nav>[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.ok(nav.includes("User login") && nav.includes("Org login"), "login links must live in the header nav");
  assert.ok(nav.indexOf("nav-login") < nav.indexOf("nav-dashboard"));
  // Sign-in surfaces are cross-origin; they must never be same-origin paths.
  assert.ok(!html.includes('href="/sign-in/"'));
});

test("the custom apex domain is bound and the site canonicalises to it", () => {
  const cname = readFileSync(new URL("../public/CNAME", import.meta.url), "utf8").trim();
  assert.equal(cname, "ores-shared-auth.com");
  assert.ok(existsSync(new URL("../dist/CNAME", import.meta.url)), "CNAME must reach the artifact");
  const config = readFileSync(new URL("../astro.config.mjs", import.meta.url), "utf8");
  assert.ok(config.includes('site: "https://ores-shared-auth.com"'));
  const robots = readFileSync(new URL("../dist/robots.txt", import.meta.url), "utf8");
  assert.ok(robots.includes("Disallow: /dashboard/"), "the dashboard handoff must stay out of the index");
});

test("the header is sticky on every page", () => {
  // ORESoftware/my-ai AGENTS.md asks for a sticky header and strong shared
  // header and footer across every organization marketing site.
  for (const page of ["index", "features/index", "roadmap/index", "security/index", "docs/index", "login/index"]) {
    const html = readFileSync(new URL(`../dist/${page}.html`, import.meta.url), "utf8");
    assert.match(html, /header\s*\{[^}]*position:\s*sticky/, `${page} lost the sticky header`);
    assert.ok(html.includes("<footer"), `${page} lost the shared footer`);
  }
});

test("the admin API hostname follows the canonical subdomain contract", async () => {
  // AGENTS.md fixes the label as api-admin, and there is deliberately no
  // second spelling: one administrative surface, one name.
  const hosts = await import("../src/lib/site-hosts.mjs");
  assert.equal(hosts.ADMIN_API_ORIGIN, "https://api-admin.ores-shared-auth.com");
  assert.equal(hosts.ADMIN_API_ALIAS_ORIGIN, undefined);
  for (const [name, expected] of [
    ["USER_ORIGIN", "https://user.ores-shared-auth.com"],
    ["ORG_ORIGIN", "https://org.ores-shared-auth.com"],
    ["AUTH_ORIGIN", "https://auth.ores-shared-auth.com"],
    ["API_ORIGIN", "https://api.ores-shared-auth.com"],
    ["ADMIN_ORIGIN", "https://admin.ores-shared-auth.com"],
    ["MOBILE_ORIGIN", "https://m.ores-shared-auth.com"],
  ]) {
    assert.equal(hosts[name], expected, `${name} drifted from the subdomain contract`);
  }
  const docs = readFileSync(new URL("../dist/docs/index.html", import.meta.url), "utf8");
  assert.ok(docs.includes("api-admin.ores-shared-auth.com"));
  assert.ok(!docs.includes("admin-api.ores-shared-auth.com"), "the retired spelling must not be published");
});

test("the marketing surface ships the capability, roadmap, security and docs pages", () => {
  for (const route of ["features", "roadmap", "security", "docs", "login"]) {
    const page = new URL(`../dist/${route}/index.html`, import.meta.url);
    assert.ok(existsSync(page), `missing /${route}/`);
    const html = readFileSync(page, "utf8");
    assert.ok(!html.includes("undefined"), `/${route}/ rendered undefined`);
    assert.ok(html.includes("Shared Auth"));
    assert.ok(html.includes('class="nav-login"'), `/${route}/ lost the login entry points`);
  }
});

test("the capability register never claims a status it cannot back", async () => {
  const register = await import("../src/lib/capabilities.mjs");
  const ids = register.ALL_CAPABILITIES.map((capability) => capability.id);
  assert.equal(new Set(ids).size, ids.length, "capability ids must be unique");
  const milestones = new Set(register.MILESTONES.map((milestone) => milestone.id));
  for (const capability of register.ALL_CAPABILITIES) {
    assert.ok(register.STATUS[capability.status], `unknown status on ${capability.id}`);
    assert.ok(register.TIERS[capability.tier], `unknown tier on ${capability.id}`);
    assert.ok(capability.note.length > 0, `${capability.id} needs a note`);
    if (capability.status === "partial" || capability.status === "planned") {
      assert.ok(milestones.has(capability.milestone), `${capability.id} must name a milestone`);
    }
    if (capability.status === "shipped" || capability.status === "none") {
      assert.equal(capability.milestone, undefined, `${capability.id} must not name a milestone`);
    }
  }
  const html = readFileSync(new URL("../dist/features/index.html", import.meta.url), "utf8");
  for (const capability of register.ALL_CAPABILITIES) {
    assert.ok(html.includes(capability.title), `features page omits ${capability.id}`);
  }
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

test("repository remains Astro-only and opts out of Jekyll processing", () => {
  assert.ok(existsSync(new URL("../public/.nojekyll", import.meta.url)));
  assert.ok(existsSync(new URL("../dist/.nojekyll", import.meta.url)));
  for (const forbidden of ["_config.yml", "Gemfile", "config.toml", "hugo.toml"]) {
    assert.ok(!existsSync(new URL(`../${forbidden}`, import.meta.url)), `unexpected ${forbidden}`);
  }
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
});
