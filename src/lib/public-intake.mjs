const API_ORIGIN = "https://api.ores-shared-auth.com";

export const INTAKE_PATHS = Object.freeze({
  quote: "/v1/quote-requests",
  "pre-interest": "/v1/pre-interest-registrations",
});

export function resolveIntakeEndpoint(kind, raw) {
  const expectedPath = INTAKE_PATHS[kind];
  if (!expectedPath) throw new Error("unknown intake kind");
  if (typeof raw !== "string" || !raw.trim()) {
    throw new Error(`missing ${kind} intake endpoint`);
  }

  const url = new URL(raw.trim());
  if (
    url.origin !== API_ORIGIN
    || url.pathname !== expectedPath
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error(`invalid ${kind} intake endpoint`);
  }
  return url.toString();
}

const PUBLIC_INTAKE = Object.freeze({
  quote: resolveIntakeEndpoint("quote", `${API_ORIGIN}${INTAKE_PATHS.quote}`),
  preInterest: resolveIntakeEndpoint(
    "pre-interest",
    `${API_ORIGIN}${INTAKE_PATHS["pre-interest"]}`,
  ),
});

export function publicIntakeConfig() {
  return PUBLIC_INTAKE;
}
