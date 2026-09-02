import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

import {
  INTAKE_ENDPOINTS,
  INTAKE_SURFACES,
  TURNSTILE_ACTIONS,
  normalizeTurnstileSiteKey,
  publicIntakeConfig,
  resolveIntakeEndpoint,
} from "../src/lib/public-intake.mjs";

const surfaces = ["app", "user", "org", "admin", "quote", "pre-interest"];
const page = (name) => new URL(`../dist/${name}/index.html`, import.meta.url);
const source = (name) => new URL(`../src/pages/${name}.astro`, import.meta.url);

test("all ores-shared-auth launch surfaces are source-controlled and built", () => {
  for (const name of surfaces) {
    assert.ok(existsSync(source(name)), `missing source page ${name}`);
    assert.ok(existsSync(page(name)), `missing built page ${name}`);
  }
});

test("public intake pins exact dedicated hosts, endpoints, and Turnstile actions", () => {
  assert.deepEqual(publicIntakeConfig(), {
    quote: "https://api.ores-shared-auth.com/v1/quote-requests",
    preInterest: "https://api.ores-shared-auth.com/v1/pre-interest-registrations",
  });
  assert.deepEqual(INTAKE_ENDPOINTS, publicIntakeConfig());
  assert.deepEqual(INTAKE_SURFACES, {
    quote: "quote.ores-shared-auth.com",
    preInterest: "pre-interest.ores-shared-auth.com",
  });
  assert.deepEqual(TURNSTILE_ACTIONS, {
    quote: "shared_auth_quote",
    preInterest: "shared_auth_pre_interest",
  });
  assert.equal(Object.isFrozen(publicIntakeConfig()), true);
  assert.equal(
    resolveIntakeEndpoint(
      "quote",
      "https://api.ores-shared-auth.com/v1/quote-requests",
    ),
    INTAKE_ENDPOINTS.quote,
  );
  assert.equal(
    resolveIntakeEndpoint(
      "preInterest",
      "https://api.ores-shared-auth.com/v1/pre-interest-registrations",
    ),
    INTAKE_ENDPOINTS.preInterest,
  );
});

test("public intake rejects endpoint and site-key drift before the site builds", () => {
  for (const value of [
    "",
    "http://api.ores-shared-auth.com/v1/quote-requests",
    "https://auth.ores-shared-auth.com/v1/quote-requests",
    "https://api.ores-shared-auth.com/v1/quotes",
    "https://api.ores-shared-auth.com/v1/quote-requests?token=secret",
    "https://user:pass@api.ores-shared-auth.com/v1/quote-requests",
    "https://api.ores-shared-auth.com:8443/v1/quote-requests",
  ]) {
    assert.throws(() => resolveIntakeEndpoint("quote", value));
  }
  assert.equal(normalizeTurnstileSiteKey(""), "");
  assert.equal(
    normalizeTurnstileSiteKey("1x00000000000000000000AA"),
    "1x00000000000000000000AA",
  );
  assert.throws(() => normalizeTurnstileSiteKey("short"));
  assert.throws(() => normalizeTurnstileSiteKey("site key with spaces"));
});

test("the static-site environment exposes only reviewed public values", () => {
  const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const variables = envExample
    .split("\n")
    .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
    .map((line) => line.split("=", 1)[0])
    .sort();
  assert.deepEqual(variables, [
    "PUBLIC_DASHBOARD_URL",
    "PUBLIC_DASHBOARD_URL_ALLOWLIST",
    "PUBLIC_TURNSTILE_SITE_KEY",
  ]);
  assert.ok(!envExample.includes("TURNSTILE_SECRET"));
  assert.ok(!envExample.includes("ORIGIN_AUTH_SECRET"));
});

test("application selector links every exact public launch hostname", () => {
  const html = readFileSync(page("app"), "utf8");
  for (const hostname of [
    "user.ores-shared-auth.com",
    "org.ores-shared-auth.com",
    "admin.ores-shared-auth.com",
    "api.ores-shared-auth.com",
    "quote.ores-shared-auth.com",
    "pre-interest.ores-shared-auth.com",
  ]) {
    assert.ok(html.includes(hostname), `missing ${hostname}`);
  }
  assert.ok(!html.includes("org.ores-shared.auth.com"));
});

test("quote and pre-interest forms retain empty HTML actions and exact API data endpoints", () => {
  const expected = {
    quote: INTAKE_ENDPOINTS.quote,
    "pre-interest": INTAKE_ENDPOINTS.preInterest,
  };
  for (const [name, endpoint] of Object.entries(expected)) {
    const html = readFileSync(page(name), "utf8");
    assert.match(html, /<form[^>]*data-intake-form/);
    assert.ok(html.includes(`data-endpoint="${endpoint}"`));
    assert.match(html, /data-enabled="(?:true|false)"/);
    assert.ok(html.includes('method="post"'));
    assert.ok(html.includes('action=""'));
    assert.ok(html.includes('name="referrer" content="no-referrer"'));
    assert.ok(!html.includes("Authorization: Bearer"));
    assert.ok(!html.includes("localStorage"));
    assert.ok(!html.includes("sessionStorage"));
  }
});

test("intake source requires Turnstile without exposing its secret", () => {
  const quote = readFileSync(source("quote"), "utf8");
  const preInterest = readFileSync(source("pre-interest"), "utf8");
  const component = readFileSync(
    new URL("../src/components/SafeIntakeForm.astro", import.meta.url),
    "utf8",
  );
  const combined = `${quote}\n${preInterest}\n${component}`;

  for (const marker of [
    "PUBLIC_TURNSTILE_SITE_KEY",
    "cf-turnstile",
    "challenges.cloudflare.com/turnstile/v0/api.js",
    "data-action",
    "data-response-field-name",
    "disabled={!enabled}",
  ]) {
    assert.ok(combined.includes(marker), `missing ${marker}`);
  }
  assert.ok(!combined.includes("TURNSTILE_SECRET"));
  assert.ok(!combined.includes("secretKey"));
});

test("browser transport is bounded, idempotent, credential-free, and accepts no reflected record identity", () => {
  const client = readFileSync(
    new URL("../src/lib/public-intake.mjs", import.meta.url),
    "utf8",
  );
  for (const boundary of [
    'credentials: "omit"',
    'redirect: "error"',
    'referrerPolicy: "no-referrer"',
    'cache: "no-store"',
    '"idempotency-key": key',
    "AbortController",
    "MAX_REQUEST_BODY_BYTES",
    "MAX_RESPONSE_BODY_BYTES",
    'Object.keys(value).sort().join(",") === "schema,status"',
    'response.status !== 202',
  ]) {
    assert.ok(client.includes(boundary), `missing ${boundary}`);
  }
  assert.ok(!client.includes("console.log"));
  assert.ok(!client.includes("console.info"));
  assert.ok(!client.includes("localStorage"));
  assert.ok(!client.includes("sessionStorage"));
  assert.ok(!client.includes("document.cookie"));
});

test("quote captures deployment, volume, identity, support, SLO, and migration requirements", () => {
  const html = readFileSync(page("quote"), "utf8");
  for (const field of [
    "party_type",
    "organization_name",
    "deployment_target",
    "application_count",
    "monthly_active_users",
    "monthly_auth_events",
    "sso_providers",
    "mfa",
    "support_tier",
    "availability_target",
    "target_timeline",
    "requirements",
    "contact_consent",
  ]) {
    assert.ok(html.includes(`name="${field}"`), `missing quote field ${field}`);
  }
  assert.ok(html.includes("99.99%"));
  assert.ok(html.includes("Custom SLO / SLA discussion"));
});

test("pre-interest keeps purpose consent and marketing consent separate", () => {
  const html = readFileSync(page("pre-interest"), "utf8");
  for (const field of [
    "party_type",
    "organization_name",
    "primary_interest",
    "expected_launch",
    "use_case",
    "contact_consent",
    "marketing_consent",
  ]) {
    assert.ok(html.includes(`name="${field}"`), `missing pre-interest field ${field}`);
  }
  assert.ok(html.includes("This is optional"));
});

test("dedicated intake hosts replace the superseded nested role-host routes", () => {
  const allSources = [
    "src/pages/quote.astro",
    "src/pages/pre-interest.astro",
    "src/components/SafeIntakeForm.astro",
    "src/lib/public-intake.mjs",
  ].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))
    .join("\n");
  assert.ok(!allSources.includes("org.ores-shared-auth.com/quote/"));
  assert.ok(!allSources.includes("user.ores-shared-auth.com/pre-interest/"));
  assert.ok(!allSources.includes("/v1/pre-interest\""));
});

test("admin surface is non-indexable and documents direct admin API alias parity", () => {
  const html = readFileSync(page("admin"), "utf8");
  assert.ok(html.includes('name="robots" content="noindex,nofollow"'));
  assert.ok(html.includes("api-admin.ores-shared-auth.com"));
  assert.ok(html.includes("admin-api.ores-shared-auth.com"));
  assert.ok(html.includes("mutating requests are not redirected and replayed"));
});

test("every launch surface declares its exact public hostname and no cross-zone typo", () => {
  for (const name of surfaces) {
    const html = readFileSync(page(name), "utf8");
    assert.ok(html.includes(`${name}.ores-shared-auth.com`), `missing host for ${name}`);
    assert.ok(!html.includes("org.ores-shared.auth.com"));
  }
});
