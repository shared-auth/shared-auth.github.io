import {
  capabilityLedger as capabilityEvidence,
  capabilityStatuses,
} from "./capability-ledger.mjs";

export { capabilityStatuses };

export const marketingHost = Object.freeze({
  host: "shared-auth.github.io",
  purpose: "Astro marketing, architecture, and delivery-evidence site",
  service: "GitHub Pages artifact",
  exposure: "public",
  certification: "available",
});

export const hostContract = Object.freeze([
  {
    host: "ores-shared-auth.com",
    purpose: "Public product entry and canonical authentication gateway",
    service: "auth",
    originPool: "auth",
    exposure: "public behind Cloudflare",
    certification: "partial",
  },
  {
    host: "auth.ores-shared-auth.com",
    purpose: "Hosted authentication journey",
    service: "auth",
    originPool: "auth",
    exposure: "public behind Cloudflare",
    certification: "partial",
  },
  {
    host: "app.ores-shared-auth.com",
    purpose: "Application landing and authenticated handoff",
    service: "app",
    originPool: "web",
    exposure: "public behind Cloudflare",
    certification: "partial",
  },
  {
    host: "user.ores-shared-auth.com",
    purpose: "Customer account and security UI",
    service: "user",
    originPool: "web",
    exposure: "public behind Cloudflare",
    certification: "in_review",
  },
  {
    host: "org.ores-shared-auth.com",
    purpose: "Organization and tenant UI",
    service: "org",
    originPool: "web",
    exposure: "public behind Cloudflare",
    certification: "planned",
  },
  {
    host: "api.ores-shared-auth.com",
    purpose: "Customer identity API",
    service: "api",
    originPool: "api",
    exposure: "public behind Cloudflare",
    certification: "partial",
  },
  {
    host: "admin.ores-shared-auth.com",
    purpose: "Operator IAM console",
    service: "admin",
    originPool: "admin-web",
    exposure: "private identity-aware ingress only",
    certification: "in_review",
  },
  {
    host: "api-admin.ores-shared-auth.com",
    purpose: "Canonical operator IAM command API",
    service: "admin-api",
    originPool: "admin-api",
    exposure: "private service/admin ingress only",
    certification: "partial",
  },
  {
    host: "admin-api.ores-shared-auth.com",
    purpose: "Compatibility alias for the operator IAM command API",
    service: "admin-api",
    originPool: "admin-api",
    exposure: "private service/admin ingress only",
    certification: "partial",
  },
  {
    host: "quote.ores-shared-auth.com",
    purpose: "Public quote intake handoff",
    service: "quote",
    originPool: "web",
    exposure: "public behind Cloudflare",
    certification: "partial",
  },
  {
    host: "pre-interest.ores-shared-auth.com",
    purpose: "Public pre-interest intake handoff",
    service: "pre-interest",
    originPool: "web",
    exposure: "public behind Cloudflare",
    certification: "partial",
  },
]);

const { hostContract: _supersededHostContract, ...capabilityContract } =
  capabilityEvidence;

export const platformContract = Object.freeze({
  ...capabilityContract,
  marketingHost,
  hostContract,
});
