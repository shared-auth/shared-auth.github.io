const API_ORIGIN = "https://api.ores-shared-auth.com";
const PUBLIC_INTAKE_SCHEMA = "ores.shared-auth.public-intake.v1";
const CONTACT_CONSENT_REVISION = "2026-09-01";
const MARKETING_CONSENT_REVISION = "2026-09-01";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_NOTES_LENGTH = 2000;
const MAX_USE_CASE_LENGTH = 2000;
const MAX_ORGANIZATION_LENGTH = 160;
const MAX_NAME_LENGTH = 120;
const MAX_USAGE = 1_000_000_000;
const MAX_TURNSTILE_TOKEN_LENGTH = 4096;

export const INTAKE_ENDPOINTS = Object.freeze({
  quote: `${API_ORIGIN}/v1/quote-requests`,
  preInterest: `${API_ORIGIN}/v1/pre-interest`,
});

export const INTAKE_SURFACES = Object.freeze({
  quote: "org.ores-shared-auth.com",
  preInterest: "user.ores-shared-auth.com",
});

export function buildQuoteSubmission(values, context = {}) {
  const email = requiredEmail(values.email);
  const partyType = oneOf(values.partyType, ["individual", "organization"], "party type");
  const organizationName = optionalText(values.organizationName, MAX_ORGANIZATION_LENGTH);
  if (partyType === "organization" && !organizationName) {
    throw new IntakeValidationError("Organization name is required for organization quotes.");
  }

  return {
    schema: PUBLIC_INTAKE_SCHEMA,
    intent: "quote",
    request_id: requiredUuid(context.requestId),
    source_host: requiredSourceHost(context.sourceHost, "quote"),
    contact: {
      name: optionalText(values.name, MAX_NAME_LENGTH),
      email,
    },
    party_type: partyType,
    organization_name: organizationName,
    usage: {
      monthly_active_users: boundedInteger(values.monthlyActiveUsers, 1, MAX_USAGE, "monthly active users"),
      monthly_auth_events: boundedInteger(values.monthlyAuthEvents, 1, MAX_USAGE, "monthly auth events"),
    },
    requirements: {
      sso_providers: stringList(values.ssoProviders, 8, 40),
      mfa: oneOf(values.mfa, ["optional", "required", "step-up"], "MFA requirement"),
      support_tier: oneOf(values.supportTier, ["standard", "priority", "enterprise"], "support tier"),
    },
    notes: optionalText(values.notes, MAX_NOTES_LENGTH),
    contact_consent: requiredBoolean(values.contactConsent, "Consent to contact is required."),
    contact_consent_revision: CONTACT_CONSENT_REVISION,
    consented_at: requiredTimestamp(context.consentedAt),
    marketing_consent: false,
    marketing_consent_revision: null,
    turnstile_token: requiredText(
      context.turnstileToken,
      MAX_TURNSTILE_TOKEN_LENGTH,
      "Complete the abuse-prevention challenge.",
    ),
  };
}

export function buildPreInterestSubmission(values, context = {}) {
  const email = requiredEmail(values.email);
  const partyType = oneOf(
    values.partyType,
    ["individual", "organization", "partner"],
    "interest type",
  );
  const organizationName = optionalText(values.organizationName, MAX_ORGANIZATION_LENGTH);
  if ((partyType === "organization" || partyType === "partner") && !organizationName) {
    throw new IntakeValidationError("Organization name is required for organization or partner registration.");
  }
  const marketingConsent = values.marketingConsent === true;

  return {
    schema: PUBLIC_INTAKE_SCHEMA,
    intent: "pre_interest",
    request_id: requiredUuid(context.requestId),
    source_host: requiredSourceHost(context.sourceHost, "preInterest"),
    contact: {
      name: optionalText(values.name, MAX_NAME_LENGTH),
      email,
    },
    party_type: partyType,
    organization_name: organizationName,
    use_case: requiredText(values.useCase, MAX_USE_CASE_LENGTH, "Use case is required."),
    expected_launch: oneOf(
      values.expectedLaunch,
      ["now", "quarter", "six_months", "exploring"],
      "expected launch",
    ),
    contact_consent: requiredBoolean(
      values.contactConsent,
      "Consent to store and review this registration is required.",
    ),
    contact_consent_revision: CONTACT_CONSENT_REVISION,
    consented_at: requiredTimestamp(context.consentedAt),
    marketing_consent: marketingConsent,
    marketing_consent_revision: marketingConsent ? MARKETING_CONSENT_REVISION : null,
    turnstile_token: requiredText(
      context.turnstileToken,
      MAX_TURNSTILE_TOKEN_LENGTH,
      "Complete the abuse-prevention challenge.",
    ),
  };
}

export async function submitIntake({
  kind,
  values,
  context = {},
  fetchImpl = fetch,
  idempotencyKey,
  clock = () => new Date(),
}) {
  const endpoint = kind === "quote"
    ? INTAKE_ENDPOINTS.quote
    : kind === "preInterest"
      ? INTAKE_ENDPOINTS.preInterest
      : null;
  if (!endpoint) {
    throw new IntakeValidationError("Unsupported intake form.");
  }

  if (optionalText(values.website, 256)) {
    return { accepted: true, ignored: true };
  }

  const key = requiredUuid(idempotencyKey);
  const payloadContext = {
    requestId: key,
    sourceHost: context.sourceHost,
    turnstileToken: context.turnstileToken,
    consentedAt: clock().toISOString(),
  };
  const payload = kind === "quote"
    ? buildQuoteSubmission(values, payloadContext)
    : buildPreInterestSubmission(values, payloadContext);

  let response;
  try {
    response = await fetchImpl(endpoint, {
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
      body: JSON.stringify(payload),
    });
  } catch {
    throw new IntakeUnavailableError();
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 422) {
      throw new IntakeValidationError("The request was rejected. Review the fields and try again.");
    }
    throw new IntakeUnavailableError();
  }

  const result = await safeJson(response);
  if (!isAcceptedEnvelope(result)) {
    throw new IntakeUnavailableError();
  }
  return { accepted: true };
}

export function bindIntakeForm({ formId, kind }) {
  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) return;

  const status = form.querySelector("[data-form-status]");
  const submit = form.querySelector('button[type="submit"]');
  let inFlight = false;
  let idempotencyKey = crypto.randomUUID();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (inFlight) return;
    setStatus(status, "", "idle");
    if (!form.reportValidity()) return;

    inFlight = true;
    if (submit instanceof HTMLButtonElement) submit.disabled = true;
    setStatus(status, "Submitting securely…", "pending");

    try {
      const data = new FormData(form);
      const values = formValues(data, kind);
      const result = await submitIntake({
        kind,
        values,
        context: {
          sourceHost: globalThis.location.hostname.toLowerCase(),
          turnstileToken: data.get("cf-turnstile-response"),
        },
        idempotencyKey,
      });
      if (!result.ignored) {
        form.reset();
        globalThis.turnstile?.reset?.();
        idempotencyKey = crypto.randomUUID();
      }
      setStatus(
        status,
        kind === "quote"
          ? "Quote request received for review. No account, invoice, charge, or binding price was created."
          : "Pre-interest registration received. No account, organization, role, entitlement, or quote was created.",
        "success",
      );
    } catch (error) {
      const message = error instanceof IntakeValidationError
        ? error.message
        : "The intake service is unavailable. No submission was recorded; try again later.";
      setStatus(status, message, "error");
    } finally {
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
      monthlyActiveUsers: data.get("monthly_active_users"),
      monthlyAuthEvents: data.get("monthly_auth_events"),
      ssoProviders: data.getAll("sso_providers"),
      mfa: data.get("mfa"),
      supportTier: data.get("support_tier"),
      notes: data.get("notes"),
    };
  }
  return {
    ...common,
    useCase: data.get("use_case"),
    expectedLaunch: data.get("expected_launch"),
    marketingConsent: data.get("marketing_consent") === "yes",
  };
}

function requiredSourceHost(value, kind) {
  const host = String(value ?? "").trim().toLowerCase();
  if (host !== INTAKE_SURFACES[kind]) {
    throw new IntakeValidationError(`Use the canonical ${kind === "quote" ? "organization quote" : "user pre-interest"} host.`);
  }
  return host;
}

function requiredEmail(value) {
  const email = requiredText(value, 254, "A valid email address is required.").toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new IntakeValidationError("A valid email address is required.");
  }
  return email;
}

function requiredText(value, maxLength, message) {
  const text = optionalText(value, maxLength);
  if (!text) throw new IntakeValidationError(message);
  return text;
}

function optionalText(value, maxLength) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) {
    throw new IntakeValidationError(`A field exceeds the ${maxLength}-character limit.`);
  }
  return text;
}

function boundedInteger(value, minimum, maximum, label) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new IntakeValidationError(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function stringList(value, maximumItems, maximumLength) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const normalized = values.map((item) => optionalText(item, maximumLength)).filter(Boolean);
  if (normalized.length > maximumItems || new Set(normalized).size !== normalized.length) {
    throw new IntakeValidationError("The selected provider list is invalid.");
  }
  return normalized;
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

function requiredTimestamp(value) {
  const text = String(value ?? "").trim();
  const timestamp = Date.parse(text);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== text) {
    throw new IntakeValidationError("The consent timestamp is invalid.");
  }
  return text;
}

function isAcceptedEnvelope(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).length === 2
    && value.schema === PUBLIC_INTAKE_SCHEMA
    && value.status === "accepted";
}

async function safeJson(response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function setStatus(node, message, state) {
  if (!(node instanceof HTMLElement)) return;
  node.textContent = message;
  node.dataset.state = state;
}
