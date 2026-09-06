// The shared-auth capability register.
//
// One row per capability in the identity-platform feature superset (the union
// of Clerk, Auth0/Okta CIC, WorkOS, Stytch, Frontegg, Supabase Auth, Neon Auth,
// Okta WIC, Entra ID, Keycloak, Ory, Logto and SuperTokens). `status` is a
// claim about *this* implementation and nothing else — we never publish a
// status for someone else's product.
//
//   shipped  — reachable in production today
//   partial  — reachable but narrower than the category expects
//   planned  — accepted onto the roadmap with a milestone
//   none     — deliberately not built, with the reason recorded
//
// `tier` records how the market treats the capability:
//   table-stakes | expected | differentiator
//
// Keep this file in sync with docs/PARITY.md in shared-auth-docs. It is the
// single source for /features/ and /roadmap/, and tests assert on it.

export const STATUS = Object.freeze({
  shipped: { label: "Shipped", className: "status-shipped" },
  partial: { label: "Partial", className: "status-partial" },
  planned: { label: "Planned", className: "status-planned" },
  none: { label: "Not planned", className: "status-none" },
});

export const TIERS = Object.freeze({
  "table-stakes": "Table stakes",
  expected: "Expected",
  differentiator: "Differentiator",
});

export const MILESTONES = [
  {
    id: "m1",
    name: "M1 · Reachable surface",
    goal: "Route the identity code that already exists but is not compiled in, and give the estate a real public hostname.",
  },
  {
    id: "m2",
    name: "M2 · End-user account UI",
    goal: "A complete self-service account experience at user.ores-shared-auth.com: sign-in, sign-up, profile, factors, sessions.",
  },
  {
    id: "m3",
    name: "M3 · Organizations",
    goal: "Organizations as a first-class managed entity: memberships, roles, permissions, invitations, org context in the session.",
  },
  {
    id: "m4",
    name: "M4 · Enterprise",
    goal: "Per-organization SAML and OIDC connections, SCIM directory sync, verified domains, and a self-serve admin portal.",
  },
  {
    id: "m5",
    name: "M5 · Console & extensibility",
    goal: "Admin console depth, outbound webhooks, audit retention and export, branding, and embeddable components.",
  },
];

/**
 * @typedef {object} Capability
 * @property {string} id      Stable identifier, also the anchor.
 * @property {string} title
 * @property {"shipped"|"partial"|"planned"|"none"} status
 * @property {"table-stakes"|"expected"|"differentiator"} tier
 * @property {string} [milestone] Milestone id; required unless shipped/none.
 * @property {string} note    What is true today, in one sentence.
 */

export const CATEGORIES = [
  {
    id: "core-auth",
    name: "Core authentication",
    blurb:
      "Identifiers, credentials, ceremonies and sessions — the part of the platform that decides whether a principal is who they claim to be.",
    capabilities: [
      { id: "password", title: "Password sign-in with lockout", status: "shipped", tier: "table-stakes", note: "Argon2id hashing with database-backed per-principal lockout." },
      { id: "email-otp", title: "Email one-time code", status: "shipped", tier: "table-stakes", note: "Six-digit codes with bounded attempts; the primary passwordless path." },
      { id: "sms-otp", title: "SMS one-time code", status: "shipped", tier: "expected", note: "Delivered through a verification provider; country policy is deployment-configured." },
      { id: "passkeys", title: "Passkeys / WebAuthn", status: "shipped", tier: "table-stakes", note: "Credential JSON is relayed opaquely; no raw biometric template ever reaches the server." },
      { id: "totp", title: "TOTP authenticator", status: "shipped", tier: "table-stakes", note: "Encrypted seeds at rest with per-principal verification lockout." },
      { id: "sessions", title: "Session issuance, rotation and revocation", status: "shipped", tier: "table-stakes", note: "ES256 access tokens, rotating refresh tokens with replay detection and lineage." },
      { id: "step-up", title: "Assurance levels and step-up", status: "shipped", tier: "differentiator", note: "Explicit aal/amr/acr and auth_time; services demand a level instead of inferring one." },
      { id: "delegation", title: "Token delegation to a narrowed audience", status: "shipped", tier: "differentiator", note: "Exchange a session for a token scoped down to one audience and scope set." },
      { id: "qr-handoff", title: "Cross-device QR sign-in", status: "shipped", tier: "differentiator", note: "PKCE handoff with opaque single-use codes and encrypted token bundles." },
      { id: "signup", title: "Self-service sign-up and email verification", status: "partial", tier: "table-stakes", milestone: "m2", note: "Verification ceremonies exist; the hosted sign-up screen does not." },
      { id: "password-reset", title: "Forgot-password and reset", status: "partial", tier: "table-stakes", milestone: "m2", note: "Recovery primitives exist; the end-user reset flow is not surfaced." },
      { id: "social", title: "Social sign-in providers", status: "planned", tier: "table-stakes", milestone: "m2", note: "Zero providers today. Google, GitHub, Apple and Microsoft come first." },
      { id: "identifier-first", title: "Identifier-first routing", status: "planned", tier: "expected", milestone: "m4", note: "Required before an email domain can route to an organization's own IdP." },
      { id: "account-linking", title: "Account linking and dedupe", status: "planned", tier: "expected", milestone: "m3", note: "One principal, many verified identifiers, with an explicit merge ceremony." },
      { id: "backup-codes", title: "Backup / recovery codes", status: "planned", tier: "table-stakes", milestone: "m2", note: "Absent today; single-use, regenerable, shown once." },
      { id: "pending-tasks", title: "Pending-session tasks", status: "planned", tier: "differentiator", milestone: "m3", note: "A session may authenticate and still be pending — finish MFA setup, pick an org, accept terms." },
      { id: "multi-session", title: "Multiple accounts in one browser", status: "planned", tier: "expected", milestone: "m2", note: "Account switching without signing out." },
      { id: "magic-link", title: "Magic links", status: "none", tier: "table-stakes", note: "Deliberately retired in favour of one-time codes: a link is a forwardable bearer credential." },
      { id: "anonymous", title: "Anonymous / guest sessions", status: "none", tier: "differentiator", note: "Out of scope; an unauthenticated principal has no assurance level to assert." },
    ],
  },
  {
    id: "mfa",
    name: "Multi-factor and factor management",
    blurb:
      "Enrolling, presenting, resetting and enforcing additional factors — including the third factor that most platforms do not model at all.",
    capabilities: [
      { id: "mfa-totp", title: "TOTP as a second factor", status: "shipped", tier: "table-stakes", note: "Composed through the same typed ceremony as primary TOTP." },
      { id: "mfa-sms", title: "SMS second factor", status: "shipped", tier: "expected", note: "Shares the OTP transport and rate limits." },
      { id: "mfa-email", title: "Email second factor", status: "shipped", tier: "expected", note: "Shares the OTP transport and rate limits." },
      { id: "mfa-webauthn", title: "Security key as a second factor", status: "shipped", tier: "expected", note: "Distinct from passkey-as-primary; both ceremonies are modelled." },
      { id: "third-factor", title: "Third-factor (3FA) ceremonies", status: "shipped", tier: "differentiator", note: "Identity-document and biometric-recovery planes compose as an explicit third factor." },
      { id: "mfa-self-service", title: "Self-service factor management UI", status: "planned", tier: "table-stakes", milestone: "m2", note: "Enrolment, rename, remove and re-verify from the account screen." },
      { id: "mfa-admin-reset", title: "Admin-initiated factor reset", status: "planned", tier: "expected", milestone: "m5", note: "With a reason string and an audit record, never silently." },
      { id: "mfa-policy", title: "Organization MFA enforcement policy", status: "planned", tier: "expected", milestone: "m3", note: "Required / optional / required-for-role, evaluated per organization." },
      { id: "remember-device", title: "Remembered devices", status: "planned", tier: "expected", milestone: "m5", note: "Device binding that suppresses re-challenge within a bounded window." },
      { id: "adaptive-mfa", title: "Risk-adaptive MFA", status: "planned", tier: "differentiator", milestone: "m5", note: "Risk signals are already collected; the policy engine that consumes them is not built." },
      { id: "push-mfa", title: "Push-notification MFA", status: "none", tier: "differentiator", note: "Requires a first-party mobile authenticator and a push fleet; not a good use of the next year." },
    ],
  },
  {
    id: "organizations",
    name: "Organizations and B2B",
    blurb:
      "The structural gap. Organization identifiers are mirrored from product databases today; they are not yet a managed entity with their own lifecycle.",
    capabilities: [
      { id: "org-membership-read", title: "Organization membership projection", status: "partial", tier: "table-stakes", milestone: "m3", note: "Memberships are readable and enforceable, but read-only — product databases stay authoritative." },
      { id: "org-entity", title: "Organizations as a managed entity", status: "planned", tier: "table-stakes", milestone: "m3", note: "Name, slug, logo, metadata, lifecycle and settings owned by the identity plane." },
      { id: "org-context", title: "Active organization in the session", status: "planned", tier: "expected", milestone: "m3", note: "Org id, slug, role and permissions as first-class claims." },
      { id: "org-switch", title: "Organization switching without re-login", status: "planned", tier: "expected", milestone: "m3", note: "Re-scope the session rather than restart authentication." },
      { id: "org-roles", title: "Org-scoped roles and permissions", status: "planned", tier: "table-stakes", milestone: "m3", note: "Roles are a flat per-principal string list today; a default-deny evaluator is written but not routed." },
      { id: "org-custom-roles", title: "Custom roles and permission keys", status: "planned", tier: "expected", milestone: "m3", note: "System and custom permissions kept in separate namespaces." },
      { id: "org-template", title: "Reusable organization template", status: "planned", tier: "differentiator", milestone: "m3", note: "Define roles and scopes once, apply to every organization, instead of duplicating per tenant." },
      { id: "invitations", title: "Invitations", status: "planned", tier: "table-stakes", milestone: "m3", note: "Entirely absent today — no table, token, endpoint or accept flow." },
      { id: "join-requests", title: "Join requests and approval queue", status: "planned", tier: "differentiator", milestone: "m3", note: "The inverse of an invitation, with the same audit trail." },
      { id: "verified-domains", title: "Verified email domains", status: "planned", tier: "expected", milestone: "m4", note: "Auto-join, auto-invite and suggest modes on a proven domain." },
      { id: "org-discovery", title: "Multi-organization discovery", status: "planned", tier: "differentiator", milestone: "m3", note: "Authenticate, discover every organization the identifier belongs to, then issue an org-scoped session." },
      { id: "org-policy", title: "Per-organization security policy", status: "planned", tier: "differentiator", milestone: "m4", note: "MFA requirement, session lifetime, allowed methods and network policy, per tenant." },
      { id: "org-groups", title: "Groups inside an organization", status: "planned", tier: "differentiator", milestone: "m4", note: "Needed for directory group mapping to be useful." },
      { id: "org-billing", title: "Plans and entitlements on the organization", status: "none", tier: "differentiator", note: "Billing belongs to the product, not the identity plane." },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise SSO and directory",
    blurb:
      "SAML, OIDC federation and SCIM are written and tested in-tree but are not compiled into the running server. Routing them is the first milestone.",
    capabilities: [
      { id: "saml-sp", title: "SAML 2.0 service provider", status: "partial", tier: "table-stakes", milestone: "m1", note: "Assertion handling exists in-tree and is unreachable at runtime until the module is routed." },
      { id: "scim", title: "SCIM 2.0 inbound provisioning", status: "partial", tier: "expected", milestone: "m1", note: "Users and Groups handlers exist in-tree and are unreachable at runtime until the module is routed." },
      { id: "oidc-discovery", title: "OIDC discovery and userinfo", status: "partial", tier: "table-stakes", milestone: "m1", note: "JWKS is live; the discovery document and userinfo endpoint are not yet published." },
      { id: "oauth-server", title: "OAuth 2.1 authorization server", status: "partial", tier: "differentiator", milestone: "m1", note: "Authorization-code with PKCE is implemented in-tree and awaiting a routing decision." },
      { id: "sso-connections", title: "Per-organization SSO connections", status: "planned", tier: "expected", milestone: "m4", note: "No connection registry today; each organization must be able to bring its own IdP." },
      { id: "idp-guides", title: "Guided IdP setup walkthroughs", status: "planned", tier: "expected", milestone: "m4", note: "Okta, Entra, Google Workspace, OneLogin, JumpCloud and Ping, inline in the portal." },
      { id: "scim-tokens", title: "Per-connection SCIM endpoints and tokens", status: "planned", tier: "expected", milestone: "m4", note: "Multiple active tokens, bounded expiry, revocation and per-scope grants." },
      { id: "deprovisioning", title: "Directory deprovisioning revokes sessions", status: "planned", tier: "expected", milestone: "m4", note: "An IdP deactivate must fence the principal immediately; the revocation machinery for this already exists." },
      { id: "group-role-map", title: "Directory group to role mapping", status: "planned", tier: "expected", milestone: "m4", note: "Depends on organization roles and organization groups." },
      { id: "jit", title: "Just-in-time provisioning", status: "planned", tier: "table-stakes", milestone: "m4", note: "The no-SCIM fallback every enterprise buyer expects." },
      { id: "admin-portal", title: "Self-serve enterprise admin portal", status: "planned", tier: "differentiator", milestone: "m4", note: "Hand a customer's IT admin a scoped link to configure SAML and SCIM themselves." },
      { id: "ldap", title: "LDAP / Active Directory federation", status: "none", tier: "differentiator", note: "Legacy directory federation is out of scope; SCIM and SAML cover the same buyers." },
      { id: "outbound-provisioning", title: "Outbound provisioning to downstream SaaS", status: "none", tier: "differentiator", note: "Workforce lifecycle management, not customer identity." },
    ],
  },
  {
    id: "admin",
    name: "Administration",
    blurb:
      "The admin plane runs on an isolated hostname and an isolated API. Today it renders operational metrics; it does not yet manage principals.",
    capabilities: [
      { id: "revocation-workflow", title: "Dual-control global revocation", status: "shipped", tier: "differentiator", note: "Two-person authorisation for estate-wide revocation, with a full record of both parties." },
      { id: "admin-isolation", title: "Network-isolated admin plane", status: "shipped", tier: "expected", note: "Separate service, separate hostname, separate API, not reachable from the public internet." },
      { id: "user-directory", title: "Principal search and detail", status: "planned", tier: "table-stakes", milestone: "m5", note: "Search, inspect, edit and disable a principal from the console." },
      { id: "session-browser", title: "Session and device browser", status: "planned", tier: "table-stakes", milestone: "m5", note: "The data exists; the console view does not." },
      { id: "impersonation", title: "Impersonation with an actor claim", status: "planned", tier: "expected", milestone: "m5", note: "A visibly distinct session, time-boxed, always audited, never silent." },
      { id: "org-admin", title: "Organization administration", status: "planned", tier: "table-stakes", milestone: "m3", note: "Depends on organizations becoming a managed entity." },
      { id: "email-templates", title: "Message template editing", status: "planned", tier: "expected", milestone: "m5", note: "Per-ceremony templates for code, invitation and recovery messages." },
      { id: "branding", title: "Branding and theming", status: "planned", tier: "table-stakes", milestone: "m5", note: "Logo, colour tokens, dark mode and a custom domain for hosted screens." },
      { id: "webhooks-out", title: "Outbound signed webhooks", status: "planned", tier: "table-stakes", milestone: "m5", note: "Only an inbound sync webhook exists today; customers cannot subscribe to events." },
      { id: "metadata", title: "Scoped user and organization metadata", status: "planned", tier: "expected", milestone: "m3", note: "Public, private and untrusted scopes instead of one profile blob." },
      { id: "allowlists", title: "Identifier allow and deny lists", status: "planned", tier: "expected", milestone: "m5", note: "Including disposable-domain blocking and SMS country policy." },
      { id: "analytics", title: "Console analytics", status: "planned", tier: "expected", milestone: "m5", note: "Sign-in success and failure by method, active principals, factor adoption." },
      { id: "migration", title: "Bulk import and password-hash migration", status: "planned", tier: "expected", milestone: "m5", note: "Import from another provider without forcing every user to reset." },
    ],
  },
  {
    id: "developer",
    name: "Developer surface",
    blurb:
      "A polyglot client matrix already exists. What is missing is the drop-in UI layer that makes a competitor usable in an afternoon.",
    capabilities: [
      { id: "clients", title: "Polyglot client packages", status: "shipped", tier: "table-stakes", note: "Rust, TypeScript, Dart, Swift, Go, Gleam, WASM and edge runtimes from one generated contract." },
      { id: "generated-contracts", title: "Generated identity contracts", status: "shipped", tier: "differentiator", note: "Interfaces, guard logic and transports are generated separately so a client cannot redefine identity semantics." },
      { id: "jwks", title: "Asymmetric signing keys and JWKS", status: "shipped", tier: "table-stakes", note: "ES256 with published rotation." },
      { id: "introspection", title: "Protected online introspection", status: "shipped", tier: "differentiator", note: "A service credential is accepted only on introspection, never on exchange or factor endpoints." },
      { id: "mcp", title: "MCP server for agent access", status: "shipped", tier: "differentiator", note: "Agent tooling against the identity plane, published as its own repository." },
      { id: "hosted-pages", title: "Hosted screens for every ceremony", status: "partial", tier: "table-stakes", milestone: "m2", note: "One real flow is hosted today: identifier then one-time code." },
      { id: "components", title: "Embeddable components", status: "planned", tier: "table-stakes", milestone: "m5", note: "Sign-in, user button, profile, organization switcher and organization profile as drop-ins." },
      { id: "control-components", title: "Control and state components", status: "planned", tier: "expected", milestone: "m5", note: "Signed-in, signed-out, protect, and explicit degraded and failed states." },
      { id: "headless", title: "Headless flow APIs", status: "partial", tier: "table-stakes", milestone: "m2", note: "The transport layer is headless already; the flow state machine is not yet exposed as one." },
      { id: "jwt-templates", title: "JWT templates and custom claims", status: "planned", tier: "expected", milestone: "m5", note: "With an explicit size guardrail against the cookie ceiling." },
      { id: "m2m", title: "Machine-to-machine tokens", status: "partial", tier: "expected", milestone: "m4", note: "Service credentials exist; a general client-credentials plane with an allowed-caller graph does not." },
      { id: "i18n", title: "Localization", status: "planned", tier: "expected", milestone: "m5", note: "Message catalogues on every hosted screen, negotiated from the request." },
      { id: "a11y", title: "WCAG 2.2 AA conformance", status: "planned", tier: "differentiator", milestone: "m2", note: "Stated as a target for every hosted screen from the first release." },
      { id: "flow-engine", title: "Configurable flow engine", status: "none", tier: "differentiator", note: "An arbitrary authenticator graph is a large surface with a small audience; typed ceremonies stay fixed." },
    ],
  },
  {
    id: "security",
    name: "Security and abuse",
    blurb:
      "The strongest existing area. Fail-closed behaviour, credential separation and revocation depth are ahead of the category.",
    capabilities: [
      { id: "credential-lanes", title: "Separate service and end-user credential lanes", status: "shipped", tier: "differentiator", note: "The two credential types are never accepted on the same endpoint." },
      { id: "revocation", title: "Layered revocation fences", status: "shipped", tier: "differentiator", note: "Per session, per principal, and estate-wide, with epoch and not-before fences." },
      { id: "replay", title: "Refresh-token replay detection", status: "shipped", tier: "expected", note: "Rotation lineage makes a replayed refresh token detectable and fatal to the family." },
      { id: "lockout", title: "Per-principal velocity lockout", status: "shipped", tier: "table-stakes", note: "Database-backed so it survives process restarts and spans replicas." },
      { id: "transport", title: "Credential-safe transport", status: "shipped", tier: "expected", note: "Redirect refusal, bounded bodies, path validation and redacted errors across the client matrix." },
      { id: "no-biometrics", title: "No biometric custody", status: "shipped", tier: "differentiator", note: "Platform authenticators stay the biometric boundary; no template is ever accepted." },
      { id: "capabilities-endpoint", title: "Machine-checked capability truth", status: "shipped", tier: "differentiator", note: "The server publishes what it will actually do, so a disabled method cannot be silently claimed." },
      { id: "ip-velocity", title: "Per-network velocity throttling", status: "planned", tier: "expected", milestone: "m5", note: "Distinct from per-principal lockout: one network attacking many principals." },
      { id: "bot-defence", title: "Bot and automation defence", status: "planned", tier: "table-stakes", milestone: "m2", note: "A challenge provider on sign-in, sign-up and recovery." },
      { id: "breached-passwords", title: "Breached-password detection", status: "planned", tier: "expected", milestone: "m2", note: "Checked at set time and at sign-in, with a k-anonymity lookup." },
      { id: "password-strength", title: "Password strength estimation", status: "planned", tier: "expected", milestone: "m2", note: "Estimated client-side, enforced server-side." },
      { id: "monitor-mode", title: "Monitoring-only mode for every protection", status: "planned", tier: "expected", milestone: "m5", note: "Every new defence must be deployable in log-only mode first." },
      { id: "device-intel", title: "Device intelligence", status: "planned", tier: "differentiator", milestone: "m5", note: "Fingerprint-driven takeover and trial-abuse signals." },
    ],
  },
  {
    id: "compliance",
    name: "Audit and compliance",
    blurb:
      "Subsystem audit tables exist for the most sensitive planes. A single queryable event stream does not.",
    capabilities: [
      { id: "subsystem-audit", title: "Subsystem audit records", status: "partial", tier: "table-stakes", milestone: "m5", note: "Revocation, recovery and identity-verification write durable records; everything else writes logs." },
      { id: "correlation", title: "Correlation identifiers across a flow", status: "shipped", tier: "differentiator", note: "Request identifiers propagate through every hop of a ceremony." },
      { id: "telemetry", title: "Metrics and tracing", status: "shipped", tier: "expected", note: "OpenTelemetry traces and Prometheus metrics from every service." },
      { id: "unified-audit", title: "Unified authentication event log", status: "planned", tier: "table-stakes", milestone: "m5", note: "One queryable stream: method, result, network, agent, principal, organization." },
      { id: "admin-audit", title: "Administrative action log", status: "planned", tier: "table-stakes", milestone: "m5", note: "Who changed what, when, and under which authorisation." },
      { id: "audit-export", title: "Audit export and query API", status: "planned", tier: "expected", milestone: "m5", note: "Bounded exports with a stable schema." },
      { id: "log-sinks", title: "Log streaming to a SIEM", status: "planned", tier: "expected", milestone: "m5", note: "Push to the customer's own collector rather than holding retention hostage." },
      { id: "customer-audit", title: "Customer-visible organization audit log", status: "planned", tier: "differentiator", milestone: "m5", note: "An organization admin sees their own events in-product." },
      { id: "gdpr", title: "Export and erasure", status: "planned", tier: "table-stakes", milestone: "m5", note: "Self-service account deletion and a complete principal export." },
      { id: "residency", title: "Data residency", status: "shipped", tier: "expected", note: "Self-hosted by construction: the deployment chooses the region and the database." },
      { id: "consent", title: "Consent capture and re-consent", status: "planned", tier: "expected", milestone: "m4", note: "Required by the authorization-server work in M1 and M4." },
      { id: "access-reviews", title: "Access certification campaigns", status: "none", tier: "differentiator", note: "Identity governance is a separate product category." },
    ],
  },
];

export const ALL_CAPABILITIES = CATEGORIES.flatMap((category) =>
  category.capabilities.map((capability) => ({
    ...capability,
    category: category.id,
    categoryName: category.name,
  })),
);

export function countByStatus(capabilities = ALL_CAPABILITIES) {
  const counts = { shipped: 0, partial: 0, planned: 0, none: 0 };
  for (const capability of capabilities) {
    counts[capability.status] += 1;
  }
  return counts;
}

export function capabilitiesForMilestone(milestoneId) {
  return ALL_CAPABILITIES.filter(
    (capability) => capability.milestone === milestoneId,
  );
}
