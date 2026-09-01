import assert from "node:assert/strict";
import test from "node:test";

import {
  INTAKE_ENDPOINTS,
  INTAKE_SURFACES,
  IntakeUnavailableError,
  IntakeValidationError,
  buildPreInterestSubmission,
  buildQuoteSubmission,
  submitIntake,
} from "../src/lib/intake-client.mjs";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const consentedAt = "2026-09-01T16:00:00.000Z";
const turnstileToken = "turnstile-test-token";

const quoteContext = {
  requestId: uuid,
  sourceHost: "org.ores-shared-auth.com",
  consentedAt,
  turnstileToken,
};
const preInterestContext = {
  requestId: uuid,
  sourceHost: "user.ores-shared-auth.com",
  consentedAt,
  turnstileToken,
};

test("canonical intake endpoints and role hosts remain exact", () => {
  assert.deepEqual(INTAKE_ENDPOINTS, {
    quote: "https://api.ores-shared-auth.com/v1/quote-requests",
    preInterest: "https://api.ores-shared-auth.com/v1/pre-interest",
  });
  assert.deepEqual(INTAKE_SURFACES, {
    quote: "org.ores-shared-auth.com",
    preInterest: "user.ores-shared-auth.com",
  });
});

test("quote requests normalize into a non-binding closed v1 intent", () => {
  assert.deepEqual(buildQuoteSubmission({
    name: "  Alex  ",
    email: " ALEX@EXAMPLE.COM ",
    partyType: "organization",
    organizationName: " ORE Software ",
    monthlyActiveUsers: "1200",
    monthlyAuthEvents: "40000",
    ssoProviders: ["github", "google"],
    mfa: "step-up",
    supportTier: "priority",
    notes: "  staged migration  ",
    contactConsent: true,
  }, quoteContext), {
    schema: "ores.shared-auth.public-intake.v1",
    intent: "quote",
    request_id: uuid,
    source_host: "org.ores-shared-auth.com",
    contact: { name: "Alex", email: "alex@example.com" },
    party_type: "organization",
    organization_name: "ORE Software",
    usage: { monthly_active_users: 1200, monthly_auth_events: 40000 },
    requirements: {
      sso_providers: ["github", "google"],
      mfa: "step-up",
      support_tier: "priority",
    },
    notes: "staged migration",
    contact_consent: true,
    contact_consent_revision: "2026-09-01",
    consented_at: consentedAt,
    marketing_consent: false,
    marketing_consent_revision: null,
    turnstile_token: turnstileToken,
  });
});

test("pre-interest keeps contact and marketing consent separate", () => {
  const submission = buildPreInterestSubmission({
    name: "Pat",
    email: "pat@example.com",
    partyType: "partner",
    organizationName: "Integrator",
    useCase: "OIDC integration",
    expectedLaunch: "quarter",
    contactConsent: true,
    marketingConsent: false,
  }, preInterestContext);
  assert.equal(submission.schema, "ores.shared-auth.public-intake.v1");
  assert.equal(submission.intent, "pre_interest");
  assert.equal(submission.contact_consent, true);
  assert.equal(submission.marketing_consent, false);
  assert.equal(submission.marketing_consent_revision, null);
});

test("the wrong public host and missing abuse challenge fail closed", () => {
  const values = {
    email: "pat@example.com",
    partyType: "individual",
    useCase: "Personal app",
    expectedLaunch: "exploring",
    contactConsent: true,
    marketingConsent: false,
  };
  assert.throws(
    () => buildPreInterestSubmission(values, { ...preInterestContext, sourceHost: "app.ores-shared-auth.com" }),
    /canonical user pre-interest host/,
  );
  assert.throws(
    () => buildPreInterestSubmission(values, { ...preInterestContext, turnstileToken: "" }),
    /abuse-prevention challenge/,
  );
});

test("organization and partner intake require an organization name", () => {
  assert.throws(() => buildQuoteSubmission({
    email: "a@example.com",
    partyType: "organization",
    monthlyActiveUsers: 1,
    monthlyAuthEvents: 1,
    ssoProviders: [],
    mfa: "optional",
    supportTier: "standard",
    contactConsent: true,
  }, quoteContext), /Organization name/);
  assert.throws(() => buildPreInterestSubmission({
    email: "a@example.com",
    partyType: "partner",
    useCase: "integration",
    expectedLaunch: "now",
    contactConsent: true,
  }, preInterestContext), /Organization name/);
});

test("submission omits credentials and accepts only the generic 202 envelope", async () => {
  let seen;
  const result = await submitIntake({
    kind: "preInterest",
    values: {
      email: "pat@example.com",
      partyType: "individual",
      useCase: "Personal app",
      expectedLaunch: "now",
      contactConsent: true,
      marketingConsent: false,
    },
    context: {
      sourceHost: "user.ores-shared-auth.com",
      turnstileToken,
    },
    idempotencyKey: uuid,
    clock: () => new Date(consentedAt),
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return Response.json({
        schema: "ores.shared-auth.public-intake.v1",
        status: "accepted",
      }, { status: 202 });
    },
  });

  assert.equal(seen.url, INTAKE_ENDPOINTS.preInterest);
  assert.equal(seen.init.credentials, "omit");
  assert.equal(seen.init.redirect, "error");
  assert.equal(seen.init.referrerPolicy, "no-referrer");
  assert.equal(seen.init.headers["idempotency-key"], uuid);
  assert.equal(JSON.parse(seen.init.body).request_id, uuid);
  assert.deepEqual(result, { accepted: true });
});

test("responses that reflect a request identifier are rejected", async () => {
  await assert.rejects(
    submitIntake({
      kind: "preInterest",
      values: {
        email: "pat@example.com",
        partyType: "individual",
        useCase: "Personal app",
        expectedLaunch: "now",
        contactConsent: true,
      },
      context: { sourceHost: "user.ores-shared-auth.com", turnstileToken },
      idempotencyKey: uuid,
      clock: () => new Date(consentedAt),
      fetchImpl: async () => Response.json({
        schema: "ores.shared-auth.public-intake.v1",
        status: "accepted",
        request_id: uuid,
      }, { status: 202 }),
    }),
    IntakeUnavailableError,
  );
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
        partyType: "individual",
        useCase: "private use case",
        expectedLaunch: "exploring",
        contactConsent: true,
      },
      context: { sourceHost: "user.ores-shared-auth.com", turnstileToken },
      idempotencyKey: uuid,
      clock: () => new Date(consentedAt),
      fetchImpl: async () => { throw new Error("secret-contact@example.com"); },
    }),
    (error) => error instanceof IntakeUnavailableError
      && !error.message.includes("secret-contact@example.com"),
  );
});
