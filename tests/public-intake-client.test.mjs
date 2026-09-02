import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTACT_CONSENT_REVISION,
  INTAKE_ENDPOINTS,
  INTAKE_SURFACES,
  IntakeUnavailableError,
  IntakeValidationError,
  MARKETING_CONSENT_REVISION,
  MAX_REQUEST_BODY_BYTES,
  PUBLIC_INTAKE_SCHEMA,
  TURNSTILE_ACTIONS,
  buildPreInterestSubmission,
  buildQuoteSubmission,
  normalizeTurnstileSiteKey,
  publicIntakeConfig,
  resolveIntakeEndpoint,
  submitIntake,
} from "../src/lib/public-intake.mjs";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const consentedAt = "2026-09-01T16:00:00.000Z";
const turnstileToken = "turnstile-test-token";

const quoteValues = Object.freeze({
  name: "  Alex  ",
  email: " ALEX@EXAMPLE.COM ",
  partyType: "organization",
  organizationName: " ORE Software ",
  deploymentTarget: "hybrid",
  monthlyActiveUsers: "1200",
  monthlyAuthEvents: "40000",
  applicationCount: "8",
  ssoProviders: ["github", "google"],
  mfa: "three_factor",
  supportTier: "priority",
  availabilityTarget: "99.95",
  requirements: "Need staged migration, passkeys, revocation, and regional isolation.",
  targetTimeline: "31_90_days",
  contactConsent: true,
});

const preInterestValues = Object.freeze({
  name: "Pat",
  email: "pat@example.com",
  partyType: "partner",
  organizationName: "Integrator",
  primaryInterest: "sdk_integration",
  useCase: "Integrate Shared Auth into a multi-tenant developer platform.",
  expectedLaunch: "quarter",
  contactConsent: true,
  marketingConsent: false,
});

const quoteContext = Object.freeze({
  requestId: uuid,
  sourceHost: "quote.ores-shared-auth.com",
  consentedAt,
  turnstileToken,
});
const preInterestContext = Object.freeze({
  requestId: uuid,
  sourceHost: "pre-interest.ores-shared-auth.com",
  consentedAt,
  turnstileToken,
});

test("canonical endpoints, dedicated hosts, and Turnstile actions remain exact", () => {
  assert.deepEqual(INTAKE_ENDPOINTS, {
    quote: "https://api.ores-shared-auth.com/v1/quote-requests",
    preInterest: "https://api.ores-shared-auth.com/v1/pre-interest-registrations",
  });
  assert.deepEqual(INTAKE_SURFACES, {
    quote: "quote.ores-shared-auth.com",
    preInterest: "pre-interest.ores-shared-auth.com",
  });
  assert.deepEqual(TURNSTILE_ACTIONS, {
    quote: "shared_auth_quote",
    preInterest: "shared_auth_pre_interest",
  });
  assert.deepEqual(publicIntakeConfig(), INTAKE_ENDPOINTS);
  assert.equal(Object.isFrozen(publicIntakeConfig()), true);
});

test("endpoint and site-key validation reject authority drift and malformed configuration", () => {
  assert.equal(
    resolveIntakeEndpoint(
      "quote",
      "https://api.ores-shared-auth.com/v1/quote-requests",
    ),
    INTAKE_ENDPOINTS.quote,
  );
  for (const value of [
    "",
    "http://api.ores-shared-auth.com/v1/quote-requests",
    "https://auth.ores-shared-auth.com/v1/quote-requests",
    "https://api.ores-shared-auth.com/v1/quotes",
    "https://api.ores-shared-auth.com/v1/quote-requests?token=secret",
    "https://user:pass@api.ores-shared-auth.com/v1/quote-requests",
    "https://api.ores-shared-auth.com:8443/v1/quote-requests",
  ]) {
    assert.throws(() => resolveIntakeEndpoint("quote", value), IntakeValidationError);
  }
  assert.equal(normalizeTurnstileSiteKey(""), "");
  assert.equal(
    normalizeTurnstileSiteKey("1x00000000000000000000AA"),
    "1x00000000000000000000AA",
  );
  for (const value of ["short", "key with spaces", "<script>".repeat(5)]) {
    assert.throws(() => normalizeTurnstileSiteKey(value), IntakeValidationError);
  }
});

test("quote requests normalize into a closed non-binding v1 contract", () => {
  assert.deepEqual(buildQuoteSubmission(quoteValues, quoteContext), {
    schema: PUBLIC_INTAKE_SCHEMA,
    intent: "quote",
    request_id: uuid,
    source_host: "quote.ores-shared-auth.com",
    contact: { name: "Alex", email: "alex@example.com" },
    party_type: "organization",
    organization_name: "ORE Software",
    deployment_target: "hybrid",
    usage: {
      monthly_active_users: 1200,
      monthly_auth_events: 40000,
      application_count: 8,
    },
    requirements: {
      sso_providers: ["github", "google"],
      mfa: "three_factor",
      support_tier: "priority",
      availability_target: "99.95",
      details: "Need staged migration, passkeys, revocation, and regional isolation.",
    },
    target_timeline: "31_90_days",
    contact_consent: true,
    contact_consent_revision: CONTACT_CONSENT_REVISION,
    consented_at: consentedAt,
    marketing_consent: false,
    marketing_consent_revision: null,
    turnstile_action: "shared_auth_quote",
    turnstile_token: turnstileToken,
  });
});

test("pre-interest keeps purpose contact consent and optional marketing consent separate", () => {
  const withoutMarketing = buildPreInterestSubmission(
    preInterestValues,
    preInterestContext,
  );
  assert.equal(withoutMarketing.schema, PUBLIC_INTAKE_SCHEMA);
  assert.equal(withoutMarketing.intent, "pre_interest");
  assert.equal(withoutMarketing.source_host, "pre-interest.ores-shared-auth.com");
  assert.equal(withoutMarketing.contact_consent, true);
  assert.equal(withoutMarketing.contact_consent_revision, CONTACT_CONSENT_REVISION);
  assert.equal(withoutMarketing.marketing_consent, false);
  assert.equal(withoutMarketing.marketing_consent_revision, null);

  const withMarketing = buildPreInterestSubmission(
    { ...preInterestValues, marketingConsent: true },
    preInterestContext,
  );
  assert.equal(withMarketing.marketing_consent, true);
  assert.equal(
    withMarketing.marketing_consent_revision,
    MARKETING_CONSENT_REVISION,
  );
});

test("wrong hosts, missing challenge, invalid enums, duplicate providers, and missing organization names fail closed", () => {
  assert.throws(
    () => buildQuoteSubmission(quoteValues, {
      ...quoteContext,
      sourceHost: "org.ores-shared-auth.com",
    }),
    /canonical quote host/,
  );
  assert.throws(
    () => buildPreInterestSubmission(preInterestValues, {
      ...preInterestContext,
      sourceHost: "user.ores-shared-auth.com",
    }),
    /canonical pre-interest host/,
  );
  assert.throws(
    () => buildQuoteSubmission(quoteValues, {
      ...quoteContext,
      turnstileToken: "",
    }),
    /abuse-prevention challenge/,
  );
  assert.throws(
    () => buildQuoteSubmission(
      { ...quoteValues, ssoProviders: ["github", "github"] },
      quoteContext,
    ),
    /identity providers/,
  );
  assert.throws(
    () => buildQuoteSubmission(
      { ...quoteValues, supportTier: "unlimited" },
      quoteContext,
    ),
    /support tier/,
  );
  assert.throws(
    () => buildPreInterestSubmission(
      { ...preInterestValues, organizationName: "" },
      preInterestContext,
    ),
    /Organization name/,
  );
});

test("submission sends one credential-free bounded request with matching UUID idempotency", async () => {
  let seen;
  const result = await submitIntake({
    kind: "quote",
    values: quoteValues,
    context: {
      sourceHost: INTAKE_SURFACES.quote,
      turnstileToken,
    },
    idempotencyKey: uuid,
    clock: () => new Date(consentedAt),
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return Response.json(
        { schema: PUBLIC_INTAKE_SCHEMA, status: "accepted" },
        { status: 202 },
      );
    },
  });

  assert.equal(seen.url, INTAKE_ENDPOINTS.quote);
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.mode, "cors");
  assert.equal(seen.init.credentials, "omit");
  assert.equal(seen.init.cache, "no-store");
  assert.equal(seen.init.redirect, "error");
  assert.equal(seen.init.referrerPolicy, "no-referrer");
  assert.equal(seen.init.headers["idempotency-key"], uuid);
  assert.equal(seen.init.headers.authorization, undefined);
  assert.equal(seen.init.headers.cookie, undefined);
  assert.ok(new TextEncoder().encode(seen.init.body).byteLength <= MAX_REQUEST_BODY_BYTES);
  assert.equal(JSON.parse(seen.init.body).request_id, uuid);
  assert.deepEqual(result, { accepted: true, ignored: false });
});

test("honeypot submissions are absorbed before UUID, challenge, validation, clock, or network access", async () => {
  let calls = 0;
  let clocks = 0;
  const result = await submitIntake({
    kind: "quote",
    values: { website: "bot.example" },
    idempotencyKey: "invalid",
    clock: () => {
      clocks += 1;
      return new Date();
    },
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not fetch");
    },
  });
  assert.deepEqual(result, { accepted: true, ignored: true });
  assert.equal(calls, 0);
  assert.equal(clocks, 0);
});

test("safe retries can preserve the consent timestamp with the idempotency key", async () => {
  const bodies = [];
  const call = () => submitIntake({
    kind: "preInterest",
    values: preInterestValues,
    context: {
      sourceHost: INTAKE_SURFACES.preInterest,
      turnstileToken,
      consentedAt,
    },
    idempotencyKey: uuid,
    clock: () => {
      throw new Error("the retry must not move the consent timestamp");
    },
    fetchImpl: async (_url, init) => {
      bodies.push(init.body);
      return Response.json(
        { schema: PUBLIC_INTAKE_SCHEMA, status: "accepted" },
        { status: 202 },
      );
    },
  });
  await call();
  await call();
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(JSON.parse(bodies[0]).consented_at, consentedAt);
});

test("only an exact bounded 202 JSON envelope is accepted", async () => {
  const run = (response) => submitIntake({
    kind: "preInterest",
    values: preInterestValues,
    context: {
      sourceHost: INTAKE_SURFACES.preInterest,
      turnstileToken,
    },
    idempotencyKey: uuid,
    clock: () => new Date(consentedAt),
    fetchImpl: async () => response,
  });

  await assert.rejects(
    run(Response.json(
      { schema: PUBLIC_INTAKE_SCHEMA, status: "accepted" },
      { status: 200 },
    )),
    IntakeUnavailableError,
  );
  await assert.rejects(
    run(Response.json(
      { schema: PUBLIC_INTAKE_SCHEMA, status: "accepted", request_id: uuid },
      { status: 202 },
    )),
    IntakeUnavailableError,
  );
  await assert.rejects(
    run(new Response(
      JSON.stringify({ schema: PUBLIC_INTAKE_SCHEMA, status: "accepted" }),
      { status: 202, headers: { "content-type": "text/plain" } },
    )),
    IntakeUnavailableError,
  );
  await assert.rejects(
    run(new Response("x".repeat(8 * 1024 + 1), {
      status: 202,
      headers: { "content-type": "application/json" },
    })),
    IntakeUnavailableError,
  );
  await assert.rejects(
    run(new Response("{}", {
      status: 202,
      headers: {
        "content-type": "application/json",
        "content-length": String(8 * 1024 + 1),
      },
    })),
    IntakeUnavailableError,
  );
});

test("validation, network, timeout, and server failures never echo submitted contact data", async () => {
  const secret = "secret-contact@example.com";
  const args = {
    kind: "preInterest",
    values: { ...preInterestValues, email: secret },
    context: {
      sourceHost: INTAKE_SURFACES.preInterest,
      turnstileToken,
    },
    idempotencyKey: uuid,
    clock: () => new Date(consentedAt),
  };

  for (const fetchImpl of [
    async () => {
      throw new Error(secret);
    },
    async () => new Response(secret, { status: 500 }),
    async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }),
  ]) {
    await assert.rejects(
      submitIntake({ ...args, fetchImpl, timeoutMs: 5 }),
      (error) => error instanceof IntakeUnavailableError
        && !error.message.includes(secret),
    );
  }

  await assert.rejects(
    submitIntake({
      ...args,
      values: { ...args.values, email: "not-an-email" },
      fetchImpl: async () => {
        throw new Error("must not fetch");
      },
    }),
    (error) => error instanceof IntakeValidationError
      && !error.message.includes("not-an-email"),
  );
});

test("400 and 422 map to a generic validation error; other response statuses remain unavailable", async () => {
  for (const status of [400, 422]) {
    await assert.rejects(
      submitIntake({
        kind: "preInterest",
        values: preInterestValues,
        context: { sourceHost: INTAKE_SURFACES.preInterest, turnstileToken },
        idempotencyKey: uuid,
        clock: () => new Date(consentedAt),
        fetchImpl: async () => new Response(null, { status }),
      }),
      (error) => error instanceof IntakeValidationError
        && error.message === "The request was rejected. Review the fields and try again.",
    );
  }
  for (const status of [401, 403, 409, 429, 500, 503]) {
    await assert.rejects(
      submitIntake({
        kind: "preInterest",
        values: preInterestValues,
        context: { sourceHost: INTAKE_SURFACES.preInterest, turnstileToken },
        idempotencyKey: uuid,
        clock: () => new Date(consentedAt),
        fetchImpl: async () => new Response(null, { status }),
      }),
      IntakeUnavailableError,
    );
  }
});
