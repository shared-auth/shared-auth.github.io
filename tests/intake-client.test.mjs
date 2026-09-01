import assert from "node:assert/strict";
import test from "node:test";

import {
  INTAKE_ENDPOINTS,
  IntakeUnavailableError,
  IntakeValidationError,
  buildPreInterestSubmission,
  buildQuoteSubmission,
  submitIntake,
} from "../src/lib/intake-client.mjs";

const uuid = "123e4567-e89b-42d3-a456-426614174000";

test("canonical intake endpoints stay on the exact API host", () => {
  assert.deepEqual(INTAKE_ENDPOINTS, {
    quote: "https://api.ores-shared-auth.com/v1/quote-requests",
    preInterest: "https://api.ores-shared-auth.com/v1/pre-interest",
  });
});

test("quote requests are normalized into the v1 contract", () => {
  assert.deepEqual(buildQuoteSubmission({
    name: "  Alex  ",
    email: " ALEX@EXAMPLE.COM ",
    accountKind: "organization",
    organizationName: " ORE Software ",
    monthlyActiveUsers: "1200",
    monthlyAuthEvents: "40000",
    ssoProviders: ["github", "google"],
    mfa: "step-up",
    supportTier: "priority",
    notes: "  staged migration  ",
    consentToContact: true,
  }, { surface: "org", page: "/quote/" }), {
    contract: "ores.shared-auth.quote-request.v1",
    contact: { name: "Alex", email: "alex@example.com" },
    account_kind: "organization",
    organization_name: "ORE Software",
    usage: { monthly_active_users: 1200, monthly_auth_events: 40000 },
    requirements: {
      sso_providers: ["github", "google"],
      mfa: "step-up",
      support_tier: "priority",
    },
    notes: "staged migration",
    consent_to_contact: true,
    source: { surface: "org", page: "/quote/" },
  });
});

test("pre-interest registration requires a bounded use case and consent", () => {
  const submission = buildPreInterestSubmission({
    name: "Pat",
    email: "pat@example.com",
    accountKind: "partner",
    organizationName: "Integrator",
    useCase: "OIDC integration",
    expectedLaunch: "quarter",
    consentToUpdates: true,
  }, { surface: "not-trusted" });
  assert.equal(submission.contract, "ores.shared-auth.pre-interest.v1");
  assert.equal(submission.source.surface, "marketing");

  assert.throws(() => buildPreInterestSubmission({
    email: "pat@example.com",
    accountKind: "user",
    useCase: "",
    expectedLaunch: "exploring",
    consentToUpdates: true,
  }), IntakeValidationError);
});

test("organization intake requires an organization name", () => {
  assert.throws(() => buildQuoteSubmission({
    email: "a@example.com",
    accountKind: "organization",
    monthlyActiveUsers: 1,
    monthlyAuthEvents: 1,
    ssoProviders: [],
    mfa: "optional",
    supportTier: "standard",
    consentToContact: true,
  }), /Organization name/);
});

test("submission omits browser credentials and uses an idempotency key", async () => {
  let seen;
  const result = await submitIntake({
    kind: "preInterest",
    values: {
      email: "pat@example.com",
      accountKind: "user",
      useCase: "Personal app",
      expectedLaunch: "now",
      consentToUpdates: true,
    },
    idempotencyKey: uuid,
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return Response.json({ request_id: "req_12345678" }, { status: 202 });
    },
  });

  assert.equal(seen.url, INTAKE_ENDPOINTS.preInterest);
  assert.equal(seen.init.credentials, "omit");
  assert.equal(seen.init.redirect, "error");
  assert.equal(seen.init.referrerPolicy, "no-referrer");
  assert.equal(seen.init.headers["idempotency-key"], uuid);
  assert.equal(result.requestId, "req_12345678");
});

test("honeypot submissions are accepted locally without network traffic", async () => {
  let calls = 0;
  const result = await submitIntake({
    kind: "quote",
    values: { website: "bot.example" },
    idempotencyKey: uuid,
    fetchImpl: async () => { calls += 1; },
  });
  assert.deepEqual(result, { accepted: true, ignored: true });
  assert.equal(calls, 0);
});

test("network and server failures expose no submitted contact data", async () => {
  await assert.rejects(
    submitIntake({
      kind: "preInterest",
      values: {
        email: "secret-contact@example.com",
        accountKind: "user",
        useCase: "private use case",
        expectedLaunch: "exploring",
        consentToUpdates: true,
      },
      idempotencyKey: uuid,
      fetchImpl: async () => { throw new Error("secret-contact@example.com"); },
    }),
    (error) => error instanceof IntakeUnavailableError
      && !error.message.includes("secret-contact@example.com"),
  );
});
