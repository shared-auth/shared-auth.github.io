const API_ORIGIN = "https://api.ores-shared-auth.com";
export const PUBLIC_INTAKE_SCHEMA = "ores.shared-auth.public-intake.v1";
export const CONTACT_CONSENT_REVISION = "2026-09-01";
export const MARKETING_CONSENT_REVISION = "2026-09-01";
export const MAX_REQUEST_BODY_BYTES = 16 * 1024;
export const MAX_RESPONSE_BODY_BYTES = 8 * 1024;
export const REQUEST_TIMEOUT_MS = 8_000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SITE_KEY_PATTERN = /^[0-9A-Za-z_-]{20,128}$/;
const INTAKE_PATHS = Object.freeze({
  quote: "/v1/quote-requests",
  preInterest: "/v1/pre-interest-registrations",
});

export const INTAKE_ENDPOINTS = Object.freeze({
  quote: resolveIntakeEndpoint("quote", `${API_ORIGIN}${INTAKE_PATHS.quote}`),
  preInterest: resolveIntakeEndpoint(
    "preInterest",
    `${API_ORIGIN}${INTAKE_PATHS.preInterest}`,
  ),
});

export const INTAKE_SURFACES = Object.freeze({
  quote: "quote.ores-shared-auth.com",
  preInterest: "pre-interest.ores-shared-auth.com",
});

export const TURNSTILE_ACTIONS = Object.freeze({
  quote: "shared_auth_quote",
  preInterest: "shared_auth_pre_interest",
});

export function resolveIntakeEndpoint(kind, raw) {
  const expectedPath = INTAKE_PATHS[kind];
  if (!expectedPath || typeof raw !== "string" || !raw.trim()) {
    throw new IntakeValidationError("The intake endpoint is unavailable.");
  }

  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new IntakeValidationError("The intake endpoint is unavailable.");
  }
  if (
    url.origin !== API_ORIGIN
    || url.pathname !== expectedPath
    || url.username
    || url.password
    || url.search
    || url.hash
    || url.port
  ) {
    throw new IntakeValidationError("The intake endpoint is unavailable.");
  }
  return url.toString();
}

export function normalizeTurnstileSiteKey(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  if (!SITE_KEY_PATTERN.test(value)) {
    throw new IntakeValidationError("The abuse-prevention site key is invalid.");
  }
  return value;
}

export function publicIntakeConfig() {
  return Object.freeze({
    quote: INTAKE_ENDPOINTS.quote,
    preInterest: INTAKE_ENDPOINTS.preInterest,
  });
}

export function buildQuoteSubmission(values, context = {}) {
  const partyType = oneOf(
    values.partyType,
    ["individual", "organization"],
    "party type",
  );
  const organizationName = optionalText(values.organizationName, 160);
  if (partyType === "organization" && !organizationName) {
    throw new IntakeValidationError(
      "Organization name is required for an organization quote.",
    );
  }

  return Object.freeze({
    schema: PUBLIC_INTAKE_SCHEMA,
    intent: "quote",
    request_id: requiredUuid(context.requestId),
    source_host: requiredSourceHost(context.sourceHost, "quote"),
    contact: Object.freeze({
      name: optionalText(values.name, 120),
      email: requiredEmail(values.email),
    }),
    party_type: partyType,
    organization_name: organizationName,
    deployment_target: oneOf(
      values.deploymentTarget,
      ["hosted", "self_hosted", "hybrid", "unsure"],
      "deployment target",
    ),
    usage: Object.freeze({
      monthly_active_users: boundedInteger(
        values.monthlyActiveUsers,
        1,
        1_000_000_000,
        "monthly active users",
      ),
      monthly_auth_events: boundedInteger(
        values.monthlyAuthEvents,
        1,
        1_000_000_000,
        "monthly authentication events",
      ),
      application_count: boundedInteger(
        values.applicationCount,
        1,
        100_000,
        "application count",
      ),
    }),
    requirements: Object.freeze({
      sso_providers: enumList(
        values.ssoProviders,
        ["google", "github", "microsoft", "saml", "oidc"],
        8,
        "identity providers",
      ),
      mfa: oneOf(
        values.mfa,
        ["optional", "required", "step_up", "three_factor"],
        "MFA requirement",
      ),
      support_tier: oneOf(
        values.supportTier,
        ["standard", "priority", "enterprise", "custom"],
        "support tier",
      ),
      availability_target: oneOf(
        values.availabilityTarget,
        ["best_effort", "99.9", "99.95", "99.99", "custom"],
        "availability target",
      ),
      details: requiredText(
        values.requirements,
        20,
        4_000,
        "Describe the identity and assurance requirements.",
      ),
    }),
    target_timeline: oneOf(
      values.targetTimeline,
      ["unspecified", "0_30_days", "31_90_days", "3_6_months", "6_plus_months"],
      "target timeline",
    ),
    contact_consent: requiredBoolean(
      values.contactConsent,
      "Consent to respond to this quote request is required.",
    ),
    contact_consent_revision: CONTACT_CONSENT_REVISION,
    consented_at: requiredTimestamp(context.consentedAt),
    marketing_consent: false,
    marketing_consent_revision: null,
    turnstile_action: TURNSTILE_ACTIONS.quote,
    turnstile_token: requiredTurnstileToken(context.turnstileToken),
  });
}

export function buildPreInterestSubmission(values, context = {}) {
  const partyType = oneOf(
    values.partyType,
    ["individual", "organization", "platform", "partner"],
    "interest type",
  );
  const organizationName = optionalText(values.organizationName, 160);
  if (partyType !== "individual" && !organizationName) {
    throw new IntakeValidationError(
      "Organization name is required for an organization, platform, or partner.",
    );
  }
  const marketingConsent = values.marketingConsent === true;

  return Object.freeze({
    schema: PUBLIC_INTAKE_SCHEMA,
    intent: "pre_interest",
    request_id: requiredUuid(context.requestId),
    source_host: requiredSourceHost(context.sourceHost, "preInterest"),
    contact: Object.freeze({
      name: optionalText(values.name, 120),
      email: requiredEmail(values.email),
    }),
    party_type: partyType,
    organization_name: organizationName,
    primary_interest: oneOf(
      values.primaryInterest,
      [
        "hosted_auth",
        "organization_sso",
        "mfa_passkeys_3fa",
        "sdk_integration",
        "admin_revocation",
        "self_hosted",
      ],
      "primary interest",
    ),
    use_case: requiredText(
      values.useCase,
      20,
      2_400,
      "Describe the intended use case.",
    ),
    expected_launch: oneOf(
      values.expectedLaunch,
      ["now", "quarter", "six_months", "later", "exploring"],
      "expected launch",
    ),
    contact_consent: requiredBoolean(
      values.contactConsent,
      "Consent to store and review this registration is required.",
    ),
    contact_consent_revision: CONTACT_CONSENT_REVISION,
    consented_at: requiredTimestamp(context.consentedAt),
    marketing_consent: marketingConsent,
    marketing_consent_revision: marketingConsent
      ? MARKETING_CONSENT_REVISION
      : null,
    turnstile_action: TURNSTILE_ACTIONS.preInterest,
    turnstile_token: requiredTurnstileToken(context.turnstileToken),
  });
}

export async function submitIntake({
  kind,
  values,
  context = {},
  fetchImpl = fetch,
  idempotencyKey,
  clock = () => new Date(),
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  if (!["quote", "preInterest"].includes(kind)) {
    throw new IntakeValidationError("Unsupported intake form.");
  }
  if (optionalText(values?.website, 256)) {
    return Object.freeze({ accepted: true, ignored: true });
  }
  if (typeof fetchImpl !== "function") {
    throw new IntakeUnavailableError();
  }

  const key = requiredUuid(idempotencyKey);
  const consentedAt = context.consentedAt
    ? requiredTimestamp(context.consentedAt)
    : timestampFromClock(clock);
  const payloadContext = {
    requestId: key,
    sourceHost: context.sourceHost,
    turnstileToken: context.turnstileToken,
    consentedAt,
  };
  const payload = kind === "quote"
    ? buildQuoteSubmission(values, payloadContext)
    : buildPreInterestSubmission(values, payloadContext);
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BODY_BYTES) {
    throw new IntakeValidationError(
      "The request is too large. Shorten the free-text fields and try again.",
    );
  }

  const timeout = positiveInteger(timeoutMs, REQUEST_TIMEOUT_MS, 30_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let response;
  try {
    response = await fetchImpl(INTAKE_ENDPOINTS[kind], {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "idempotency-key": key,
      },
      body,
      signal: controller.signal,
    });
  } catch {
    throw new IntakeUnavailableError();
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 400 || response.status === 422) {
    throw new IntakeValidationError(
      "The request was rejected. Review the fields and try again.",
    );
  }
  if (response.status !== 202) {
    throw new IntakeUnavailableError();
  }

  const result = await readBoundedJson(response, MAX_RESPONSE_BODY_BYTES);
  if (!isAcceptedEnvelope(result)) {
    throw new IntakeUnavailableError();
  }
  return Object.freeze({ accepted: true, ignored: false });
}

export function bindIntakeForms(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  for (const form of root.querySelectorAll("[data-intake-form]")) {
    bindIntakeForm(form);
  }
}

export function bindIntakeForm(form) {
  if (!(form instanceof HTMLFormElement) || form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  const kind = form.dataset.kind;
  const expectedEndpoint = kind === "quote"
    ? INTAKE_ENDPOINTS.quote
    : kind === "preInterest"
      ? INTAKE_ENDPOINTS.preInterest
      : "";
  const status = form.querySelector("[data-form-status]");
  const submit = form.querySelector('button[type="submit"]');
  const enabled = form.dataset.enabled === "true"
    && form.dataset.endpoint === expectedEndpoint
    && typeof globalThis.crypto?.randomUUID === "function";

  if (!enabled) {
    form.setAttribute("aria-disabled", "true");
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    return;
  }

  let inFlight = false;
  let idempotencyKey = globalThis.crypto.randomUUID();
  let consentedAt = null;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (inFlight || !form.reportValidity()) return;

    const data = new FormData(form);
    consentedAt ??= new Date().toISOString();
    inFlight = true;
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    setStatus(status, "Submitting securely…", "pending");

    try {
      const result = await submitIntake({
        kind,
        values: formValues(data, kind),
        context: {
          sourceHost: globalThis.location.hostname.toLowerCase(),
          turnstileToken: data.get("cf-turnstile-response"),
          consentedAt,
        },
        idempotencyKey,
      });
      form.reset();
      idempotencyKey = globalThis.crypto.randomUUID();
      consentedAt = null;
      setStatus(
        status,
        result.ignored
          ? "Request received."
          : kind === "quote"
            ? "Quote request received for review. No account, invoice, charge, or binding price was created."
            : "Pre-interest registration received. No account, organization, role, entitlement, quote, or charge was created.",
        "success",
      );
    } catch (error) {
      setStatus(
        status,
        error instanceof IntakeValidationError
          ? error.message
          : "The intake service is unavailable. No submission was recorded; try again later.",
        "error",
      );
    } finally {
      globalThis.turnstile?.reset?.();
      inFlight = false;
      if (submit instanceof HTMLButtonElement) submit.disabled = false;
    }
  });
}

export class IntakeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "IntakeValidationError";
  }
}

export class IntakeUnavailableError extends Error {
  constructor() {
    super("The intake service is unavailable.");
    this.name = "IntakeUnavailableError";
  }
}

function formValues(data, kind) {
  const common = {
    name: data.get("name"),
    email: data.get("email"),
    partyType: data.get("party_type"),
    organizationName: data.get("organization_name"),
    website: data.get("website"),
    contactConsent: data.get("contact_consent") === "yes",
  };
  if (kind === "quote") {
    return {
      ...common,
      deploymentTarget: data.get("deployment_target"),
      monthlyActiveUsers: data.get("monthly_active_users"),
      monthlyAuthEvents: data.get("monthly_auth_events"),
      applicationCount: data.get("application_count"),
      ssoProviders: data.getAll("sso_providers"),
      mfa: data.get("mfa"),
      supportTier: data.get("support_tier"),
      availabilityTarget: data.get("availability_target"),
      requirements: data.get("requirements"),
      targetTimeline: data.get("target_timeline"),
    };
  }
  return {
    ...common,
    primaryInterest: data.get("primary_interest"),
    useCase: data.get("use_case"),
    expectedLaunch: data.get("expected_launch"),
    marketingConsent: data.get("marketing_consent") === "yes",
  };
}

function requiredSourceHost(value, kind) {
  const host = String(value ?? "").trim().toLowerCase();
  if (host !== INTAKE_SURFACES[kind]) {
    throw new IntakeValidationError(
      `Use the canonical ${kind === "quote" ? "quote" : "pre-interest"} host.`,
    );
  }
  return host;
}

function requiredEmail(value) {
  const email = requiredText(
    value,
    3,
    254,
    "A valid email address is required.",
  ).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new IntakeValidationError("A valid email address is required.");
  }
  return email;
}

function requiredText(value, minimumLength, maximumLength, message) {
  const text = optionalText(value, maximumLength);
  if (!text || text.length < minimumLength) {
    throw new IntakeValidationError(message);
  }
  return text;
}

function optionalText(value, maximumLength) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maximumLength) {
    throw new IntakeValidationError(
      `A field exceeds the ${maximumLength}-character limit.`,
    );
  }
  return text;
}

function boundedInteger(value, minimum, maximum, label) {
  const text = String(value ?? "").trim();
  if (!/^[0-9]+$/.test(text)) {
    throw new IntakeValidationError(
      `${label} must be between ${minimum} and ${maximum}.`,
    );
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new IntakeValidationError(
      `${label} must be between ${minimum} and ${maximum}.`,
    );
  }
  return parsed;
}

function enumList(values, allowed, maximumItems, label) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  const normalized = list.map((value) => String(value).trim()).filter(Boolean);
  if (
    normalized.length > maximumItems
    || new Set(normalized).size !== normalized.length
    || normalized.some((value) => !allowed.includes(value))
  ) {
    throw new IntakeValidationError(`The selected ${label} are invalid.`);
  }
  return Object.freeze(normalized);
}

function oneOf(value, allowed, label) {
  const normalized = String(value ?? "").trim();
  if (!allowed.includes(normalized)) {
    throw new IntakeValidationError(`Select a valid ${label}.`);
  }
  return normalized;
}

function requiredBoolean(value, message) {
  if (value !== true) throw new IntakeValidationError(message);
  return true;
}

function requiredUuid(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (!UUID_V4_PATTERN.test(key)) {
    throw new IntakeValidationError("The submission identifier is invalid.");
  }
  return key;
}

function timestampFromClock(clock) {
  if (typeof clock !== "function") {
    throw new IntakeValidationError("The consent timestamp is invalid.");
  }
  const now = clock();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new IntakeValidationError("The consent timestamp is invalid.");
  }
  return now.toISOString();
}

function requiredTimestamp(value) {
  const text = String(value ?? "").trim();
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== text) {
    throw new IntakeValidationError("The consent timestamp is invalid.");
  }
  return text;
}

function requiredTurnstileToken(value) {
  return requiredText(
    value,
    1,
    4_096,
    "Complete the abuse-prevention challenge.",
  );
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum
    ? parsed
    : fallback;
}

function isAcceptedEnvelope(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === "schema,status"
    && value.schema === PUBLIC_INTAKE_SCHEMA
    && value.status === "accepted";
}

async function readBoundedJson(response, maximumBytes) {
  const mediaType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") return null;

  const rawLength = response.headers.get("content-length");
  if (rawLength !== null) {
    if (!/^[0-9]+$/.test(rawLength)) return null;
    if (Number(rawLength) > maximumBytes) return null;
  }

  let bytes;
  try {
    bytes = await readBoundedBytes(response.body, maximumBytes);
  } catch {
    return null;
  }
  if (bytes === null) return null;

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readBoundedBytes(body, maximumBytes) {
  if (!body || typeof body.getReader !== "function") return new Uint8Array();
  const reader = body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function setStatus(node, message, state) {
  if (!(node instanceof HTMLElement)) return;
  node.textContent = message;
  node.dataset.state = state;
}
