const API_ORIGIN = "https://api.ores-shared-auth.com";

export const INTAKE_PATHS = Object.freeze({
  quote: "/v1/quote-requests",
  "pre-interest": "/v1/pre-interest-registrations",
});

export function resolveIntakeEndpoint(kind, raw) {
  const expectedPath = INTAKE_PATHS[kind];
  if (!expectedPath) throw new Error("unknown intake kind");
  if (typeof raw !== "string" || !raw.trim()) return "";

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

export function publicIntakeConfig(env = {}) {
  return Object.freeze({
    quote: resolveIntakeEndpoint("quote", env.PUBLIC_QUOTE_INTAKE_URL),
    preInterest: resolveIntakeEndpoint(
      "pre-interest",
      env.PUBLIC_PRE_INTEREST_INTAKE_URL,
    ),
  });
}
