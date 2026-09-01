const API_ORIGIN = "https://api.ores-shared-auth.com";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CANONICAL_SURFACES = new Set(["app", "user", "org", "marketing"]);
const MAX_NOTES_LENGTH = 2000;
const MAX_USE_CASE_LENGTH = 2000;
const MAX_ORGANIZATION_LENGTH = 160;
const MAX_NAME_LENGTH = 120;
const MAX_USAGE = 1_000_000_000;

export const INTAKE_ENDPOINTS = Object.freeze({
  quote: `${API_ORIGIN}/v1/quote-requests`,
  preInterest: `${API_ORIGIN}/v1/pre-interest`,
});

export function buildQuoteSubmission(values, context = {}) {
  const email = requiredEmail(values.email);
  const accountKind = oneOf(values.accountKind, ["user", "organization"], "account type");
  const organizationName = optionalText(values.organizationName, MAX_ORGANIZATION_LENGTH);
  if (accountKind === "organization" && !organizationName) {
    throw new IntakeValidationError("Organization name is required for organization quotes.");
  }

  return {
    contract: "ores.shared-auth.quote-request.v1",
    contact: {
      name: optionalText(values.name, MAX_NAME_LENGTH),
      email,
    },
    account_kind: accountKind,
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
    consent_to_contact: requiredBoolean(values.consentToContact, "Consent to contact is required."),
    source: intakeSource(context),
  };
}

export function buildPreInterestSubmission(values, context = {}) {
  const email = requiredEmail(values.email);
  const accountKind = oneOf(values.accountKind, ["user", "organization", "partner"], "interest type");
  const organizationName = optionalText(values.organizationName, MAX_ORGANIZATION_LENGTH);
  if (accountKind === "organization" && !organizationName) {
    throw new IntakeValidationError("Organization name is required for organization registration.");
  }

  return {
    contract: "ores.shared-auth.pre-interest.v1",
    contact: {
      name: optionalText(values.name, MAX_NAME_LENGTH),
      email,
    },
    account_kind: accountKind,
    organization_name: organizationName,
    use_case: requiredText(values.useCase, MAX_USE_CASE_LENGTH, "Use case is required."),
    expected_launch: oneOf(
      values.expectedLaunch,
      ["now", "quarter", "six-months", "exploring"],
      "expected launch",
    ),
    consent_to_updates: requiredBoolean(values.consentToUpdates, "Consent to updates is required."),
    source: intakeSource(context),
  };
}

export async function submitIntake({ kind, values, context = {}, fetchImpl = fetch, idempotencyKey }) {
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

  const payload = kind === "quote"
    ? buildQuoteSubmission(values, context)
    : buildPreInterestSubmission(values, context);
  const key = normalizeIdempotencyKey(idempotencyKey);

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
  return {
    accepted: true,
    requestId: safeRequestId(result?.request_id),
  };
}

export function bindIntakeForm({ formId, kind }) {
  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
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
      const values = formValues(form, kind);
      const result = await submitIntake({
        kind,
        values,
        context: { surface: surfaceFromLocation(globalThis.location) },
        idempotencyKey,
      });
      if (!result.ignored) {
        form.reset();
        idempotencyKey = crypto.randomUUID();
      }
      setStatus(
        status,
        kind === "quote"
          ? "Quote request received. We will contact you after review."
          : "Registration received. We will send product updates to the address provided.",
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

function formValues(form, kind) {
  const data = new FormData(form);
  const common = {
    name: data.get("name"),
    email: data.get("email"),
    accountKind: data.get("account_kind"),
    organizationName: data.get("organization_name"),
    website: data.get("website"),
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
      consentToContact: data.get("consent_to_contact") === "yes",
    };
  }
  return {
    ...common,
    useCase: data.get("use_case"),
    expectedLaunch: data.get("expected_launch"),
    consentToUpdates: data.get("consent_to_updates") === "yes",
  };
}

function intakeSource(context) {
  return {
    surface: canonicalSurface(context.surface),
    page: optionalText(context.page, 120),
  };
}

function canonicalSurface(value) {
  const normalized = String(value ?? "marketing").trim().toLowerCase();
  return CANONICAL_SURFACES.has(normalized) ? normalized : "marketing";
}

function surfaceFromLocation(location) {
  const host = String(location?.hostname ?? "").toLowerCase();
  for (const surface of ["app", "user", "org"]) {
    if (host === `${surface}.ores-shared-auth.com`) return surface;
  }
  return "marketing";
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
  const normalized = values
    .map((item) => optionalText(item, maximumLength))
    .filter(Boolean);
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

function normalizeIdempotencyKey(value) {
  const key = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)) {
    throw new IntakeValidationError("The submission identifier is invalid.");
  }
  return key;
}

function safeRequestId(value) {
  const requestId = String(value ?? "").trim();
  return /^[a-zA-Z0-9_-]{8,80}$/.test(requestId) ? requestId : null;
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
