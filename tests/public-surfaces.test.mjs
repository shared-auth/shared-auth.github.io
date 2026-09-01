import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";

import {
  INTAKE_PATHS,
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

test("public intake configuration is empty by default and accepts only exact API endpoints", () => {
  assert.deepEqual(publicIntakeConfig(), { quote: "", preInterest: "" });
  assert.equal(INTAKE_PATHS.quote, "/v1/quote-requests");
  assert.equal(INTAKE_PATHS["pre-interest"], "/v1/pre-interest-registrations");
  assert.equal(
    resolveIntakeEndpoint(
      "quote",
      "https://api.ores-shared-auth.com/v1/quote-requests",
    ),
    "https://api.ores-shared-auth.com/v1/quote-requests",
  );
  assert.equal(
    resolveIntakeEndpoint(
      "pre-interest",
      "https://api.ores-shared-auth.com/v1/pre-interest-registrations",
    ),
    "https://api.ores-shared-auth.com/v1/pre-interest-registrations",
  );
});

test("public intake configuration rejects endpoint drift before the site builds", () => {
  for (const value of [
    "http://api.ores-shared-auth.com/v1/quote-requests",
    "https://auth.ores-shared-auth.com/v1/quote-requests",
    "https://api.ores-shared-auth.com/v1/quotes",
    "https://api.ores-shared-auth.com/v1/quote-requests?token=secret",
    "https://user:pass@api.ores-shared-auth.com/v1/quote-requests",
  ]) {
    assert.throws(() => resolveIntakeEndpoint("quote", value));
  }
  assert.throws(() => resolveIntakeEndpoint("unknown", ""));
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

test("quote and pre-interest remain visibly disabled without approved API endpoints", () => {
  for (const name of ["quote", "pre-interest"]) {
    const html = readFileSync(page(name), "utf8");
    assert.match(html, /<form[^>]*data-intake-form[^>]*aria-disabled="true"/);
    assert.match(html, /<button type="submit" disabled/);
    assert.ok(html.includes("has not sent or stored your information"));
    assert.ok(html.includes('name="referrer" content="no-referrer"'));
    assert.ok(!html.includes("Authorization: Bearer"));
    assert.ok(!html.includes("localStorage"));
  }
});

test("browser intake transport omits ambient authority and does not inspect error bodies", () => {
  const component = readFileSync(
    new URL("../src/components/SafeIntakeForm.astro", import.meta.url),
    "utf8",
  );
  for (const boundary of [
    'credentials: "omit"',
    'redirect: "error"',
    'referrerPolicy: "no-referrer"',
    'cache: "no-store"',
    "AbortController",
    "MAX_BODY_BYTES",
  ]) {
    assert.ok(component.includes(boundary), `missing ${boundary}`);
  }
  assert.ok(!component.includes("response.text("));
  assert.ok(!component.includes("response.json("));
  assert.ok(!component.includes("localStorage"));
  assert.ok(!component.includes("sessionStorage"));
  assert.ok(!component.includes("document.cookie"));
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
