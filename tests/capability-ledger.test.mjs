import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  capabilityStatuses,
  platformContract,
} from "../src/lib/platform-contract.mjs";

const allowedStatuses = new Set(Object.keys(capabilityStatuses));

test("capability ledger is versioned, unique, and evidence honest", () => {
  assert.equal(platformContract.contract, "ores.shared-auth.capability-ledger.v1");
  assert.equal(platformContract.issue, "DEN-606");
  assert.ok(platformContract.capabilities.length >= 12);

  const ids = new Set();
  for (const capability of platformContract.capabilities) {
    assert.match(capability.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(ids.has(capability.id), false, `duplicate capability id: ${capability.id}`);
    ids.add(capability.id);
    assert.ok(allowedStatuses.has(capability.status), `unknown status: ${capability.status}`);
    assert.ok(capability.domain.length > 3);
    assert.ok(capability.userSurface.length > 20);
    assert.ok(capability.nextGate.length > 20);
    if (capability.status === "available") {
      assert.ok(
        capability.backendEvidence.length > 0,
        `available capability lacks evidence: ${capability.id}`,
      );
    }
    if (capability.status === "in_review") {
      assert.ok(
        capability.backendEvidence.some((entry) => /#\d+$/.test(entry)),
        `in-review capability lacks a pull-request reference: ${capability.id}`,
      );
    }
  }
});

test("canonical zone host contract is exact and keeps administrator origins private", () => {
  assert.equal(platformContract.marketingHost.host, "shared-auth.github.io");
  const expected = [
    "ores-shared-auth.com",
    "auth.ores-shared-auth.com",
    "app.ores-shared-auth.com",
    "user.ores-shared-auth.com",
    "org.ores-shared-auth.com",
    "api.ores-shared-auth.com",
    "admin.ores-shared-auth.com",
    "api-admin.ores-shared-auth.com",
    "admin-api.ores-shared-auth.com",
    "quote.ores-shared-auth.com",
    "pre-interest.ores-shared-auth.com",
  ];
  assert.deepEqual(
    platformContract.hostContract.map((route) => route.host),
    expected,
  );
  for (const route of platformContract.hostContract) {
    assert.ok(allowedStatuses.has(route.certification));
    assert.doesNotMatch(route.host, /\s|\*|\//);
    assert.ok(route.originPool.length > 1);
  }
  const admin = platformContract.hostContract.filter((route) =>
    route.host.includes("admin"),
  );
  assert.equal(admin.length, 3);
  assert.ok(admin.every((route) => route.exposure.startsWith("private")));
  assert.equal(
    platformContract.hostContract.find((route) => route.host === "api-admin.ores-shared-auth.com")?.service,
    platformContract.hostContract.find((route) => route.host === "admin-api.ores-shared-auth.com")?.service,
  );
});

test("taxonomy references use official HTTPS documentation origins", () => {
  assert.ok(platformContract.taxonomyReferences.length >= 12);
  for (const reference of platformContract.taxonomyReferences) {
    const url = new URL(reference.url);
    assert.equal(url.protocol, "https:");
    assert.doesNotMatch(url.hostname, /example\.(com|org|net)$/);
  }
});

test("Astro page and homepage CTA publish the ledger without client JavaScript", async () => {
  const platform = await readFile(new URL("../src/pages/platform.astro", import.meta.url), "utf8");
  const cta = await readFile(
    new URL("../src/components/DashboardCta.astro", import.meta.url),
    "utf8",
  );
  assert.match(platform, /IAM\/CIAM delivery ledger/);
  assert.match(platform, /Cloudflare exact-host router/);
  assert.match(platform, /Google Cloud Run/);
  assert.match(platform, /oresoftware\/k8s-cluster/);
  assert.match(platform, /Repository code alone does not satisfy this gate/);
  assert.match(platform, /no Jekyll · no Hugo/);
  assert.doesNotMatch(platform, /client:(load|idle|visible|media|only)/);
  assert.match(cta, /href="\/platform\/"/);
});
