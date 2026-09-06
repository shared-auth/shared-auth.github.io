// Canonical public hostnames for the shared-auth estate.
//
// These are public DNS names, not secrets and not configuration: the static
// site is built without credentials, so the login entry points are compiled in
// rather than injected through the environment. `scripts/check-env-policy.sh`
// keeps the environment schema limited to the dashboard handoff variables, and
// this module is why nothing else needs to be added to it.
//
// Every value must stay in sync with `terraform/dns.tf` in shared-auth-infra.

export const APEX_DOMAIN = "ores-shared-auth.com";

/** Marketing site (this repository), served by GitHub Pages. */
export const SITE_ORIGIN = `https://${APEX_DOMAIN}`;

/** End-user login and self-service dashboard (shared-auth-web-server.rs). */
export const USER_ORIGIN = `https://user.${APEX_DOMAIN}`;

/** Organization login and org dashboard (shared-auth-web-server.rs, org mode). */
export const ORG_ORIGIN = `https://org.${APEX_DOMAIN}`;

/** Super-admin console (shared-auth-admin-web-server.rs), VPC-isolated. */
export const ADMIN_ORIGIN = `https://admin.${APEX_DOMAIN}`;

/** Public product API (shared-auth-api-server.rs). */
export const API_ORIGIN = `https://api.${APEX_DOMAIN}`;

/**
 * Admin API (shared-auth-admin-api-server.rs), not publicly routable.
 *
 * The label is `api-admin`, from the subdomain contract in
 * ORESoftware/my-ai AGENTS.md, which every organization in the estate follows.
 * There is no `admin-api` alias: an identity estate with two spellings for one
 * administrative surface is two things to keep in step, two certificates to
 * watch, and one more name an operator can typo into a support ticket.
 */
export const ADMIN_API_ORIGIN = `https://api-admin.${APEX_DOMAIN}`;

/** Mobile entry point; redirects to the responsive apex at the edge. */
export const MOBILE_ORIGIN = `https://m.${APEX_DOMAIN}`;

/** Core identity plane (shared-auth-server.rs) — token exchange, introspection. */
export const AUTH_ORIGIN = `https://auth.${APEX_DOMAIN}`;

export const GITHUB_ORG = "https://github.com/shared-auth";

/**
 * Header/CTA entry points. Order matters: the navigation renders these in
 * sequence and the dashboard handoff must remain the last navigation item.
 */
export const LOGIN_ENTRY_POINTS = [
  {
    id: "user",
    label: "User login",
    href: `${USER_ORIGIN}/sign-in/`,
    description: "Sign in to your personal account, factors, and sessions.",
  },
  {
    id: "org",
    label: "Org login",
    href: `${ORG_ORIGIN}/sign-in/`,
    description: "Sign in to an organization workspace, members, and SSO.",
  },
];
