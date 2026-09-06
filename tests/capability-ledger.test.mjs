import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  capabilityLedger,
  capabilityStatuses,
} from "../src/lib/capability-ledger.mjs";
import {
  hostContract,
  marketingOrigin,
  platformContract,
} from "../src/lib/platform-contract.mjs";

const allowedStatuses = new Set(Object.keys(capabilityStatuses));
const expectedHosts = [
  "ores-shared-auth.com",
  "auth.ores-shared-auth.com",
  "app.ores-shared-auth.com",
  "user.ores-shared-auth.com",
  "org.ores-shared-auth.com",
  "m.ores-shared-auth.com",
  "api.ores-shared-auth.com",
  "admin.ores-shared-auth.com",
  "api-admin.ores-shared-auth.com",
  "admin-api.ores-shared-auth.com",
  "quote.ores-shared-auth.com",
  "pre-interest.ores-shared-auth.com",
];

test("capability ledger is versioned, unique, and evidence honest", () => {
  assert.equal(capabilityLedger.contract, "ores.shared-auth.capability-ledger.v1");
  assert.equal(capabilityLedger.issue, "DEN-606");
  assert.ok(capabilityLedger.capabilities.length >= 15);
  assert.equal(Object.hasOwn(capabilityLedger, "hostContract"), false);

  const ids = new Set();
  for (const capability of capabilityLedger.capabilities) {
    assert.match(capability.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(ids.has(capability.id), false, `duplicate capability id: ${capability.id}`);
    ids.add(capability.id);
    assert.ok(allowedStatuses.has(capability.status), `unknown status: ${capability.status}`);
    assert.ok(capability.domain.length > 3);
    assert.ok(capability.userSurface.length > 20);
    assert.ok(capability.nextGate.length > 20);
    if (capability.status === "available") {
      assert.ok(capability.backendEvidence.length > 0, `available capability lacks evidence: ${capability.id}`);
    }
    if (capability.status === "in_review") {
      assert.ok(
        capability.backendEvidence.some((entry) => /#\d+$/.test(entry)),
        `in-review capability lacks a pull-request reference: ${capability.id}`,
      );
    }
  }
});

test("platform contract has the exact twelve-host Cloudflare authority matrix", () => {
  assert.equal(platformContract.canonicalMarketingHost, "ores-shared-auth.com");
  assert.deepEqual(hostContract.map((route) => route.host), expectedHosts);
  assert.equal(new Set(expectedHosts).size, 12);
  assert.equal(hostContract.some((route) => route.host === "org.ores-shared.auth.com"), false);

  const apex = hostContract.find((route) => route.host === "ores-shared-auth.com");
  assert.deepEqual(
    { service: apex.service, surface: apex.surface, originPool: apex.originPool, sitePath: apex.sitePath, staticOnly: apex.staticOnly },
    { service: "marketing", surface: "marketing", originPool: null, sitePath: "/", staticOnly: true },
  );

  const mobile = hostContract.find((route) => route.host === "m.ores-shared-auth.com");
  assert.deepEqual(
    { service: mobile.service, surface: mobile.surface, originPool: mobile.originPool, sitePath: mobile.sitePath, staticOnly: mobile.staticOnly },
    { service: "mobile", surface: "mobile", originPool: null, sitePath: "/m", staticOnly: true },
  );

  const auth = hostContract.find((route) => route.host === "auth.ores-shared-auth.com");
  assert.equal(auth.service, "auth");
  assert.equal(auth.originPool, "auth");
  assert.equal(auth.staticOnly, false);

  const adminAliases = hostContract.filter((route) =>
    ["api-admin.ores-shared-auth.com", "admin-api.ores-shared-auth.com"].includes(route.host),
  );
  assert.equal(adminAliases.length, 2);
  assert.ok(adminAliases.every((route) => route.service === "admin-api"));
  assert.ok(adminAliases.every((route) => route.originPool === "admin-api"));
});

test("GitHub Pages remains a credential-free origin rather than a second host authority table", () => {
  assert.deepEqual(marketingOrigin, {
    host: "shared-auth.github.io",
    purpose: "Credential-free GitHub Pages origin and review URL for the Astro artifact",
    service: "Astro GitHub Pages artifact",
    exposure: "public origin; no credential handling",
    certification: "available",
  });
  assert.equal(hostContract.some((route) => route.host === marketingOrigin.host), false);
});

test("taxonomy references use HTTPS documentation origins", () => {
  assert.ok(capabilityLedger.taxonomyReferences.length >= 14);
  for (const reference of capabilityLedger.taxonomyReferences) {
    const url = new URL(reference.url);
    assert.equal(url.protocol, "https:");
    assert.doesNotMatch(url.hostname, /example\.(com|org|net)$/);
  }
});

test("Astro source publishes the ledger without a client island", async () => {
  const platform = await readFile(new URL("../src/pages/platform.astro", import.meta.url), "utf8");
  const cta = await readFile(new URL("../src/components/DashboardCta.astro", import.meta.url), "utf8");
  assert.match(platform, /IAM\/CIAM delivery ledger/);
  assert.match(platform, /Cloudflare exact-host router/);
  assert.match(platform, /Google Cloud Run/);
  assert.match(platform, /ORESoftware\/k8s-cluster/);
  assert.match(platform, /Repository code alone does not satisfy this gate/);
  assert.match(platform, /https:\/\/user\.ores-shared-auth\.com/);
  assert.match(platform, /https:\/\/org\.ores-shared-auth\.com/);
  assert.doesNotMatch(platform, /client:(load|idle|visible|media|only)/);
  assert.match(cta, /href="\/platform\/"/);
});

test("Astro build emits an HTML ledger and machine-readable contract", async () => {
  const platformPath = new URL("../dist/platform/index.html", import.meta.url);
  const jsonPath = new URL("../dist/capabilities.json", import.meta.url);
  assert.ok(existsSync(platformPath));
  assert.ok(existsSync(jsonPath));

  const html = await readFile(platformPath, "utf8");
  assert.ok(html.includes("Build broad IAM"));
  assert.ok(html.includes("ores-shared-auth.com"));
  assert.ok(html.includes("m.ores-shared-auth.com"));
  assert.ok(html.includes("User login"));
  assert.ok(html.includes("Org login"));

  const contract = JSON.parse(await readFile(jsonPath, "utf8"));
  assert.equal(contract.contract, "ores.shared-auth.capability-ledger.v1");
  assert.equal(contract.hostContract.length, 12);
  assert.equal(contract.statusDefinitions.in_review, capabilityStatuses.in_review);
});
