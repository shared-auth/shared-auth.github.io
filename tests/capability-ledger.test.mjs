import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  capabilityLedger,
  capabilityStatuses,
} from "../src/lib/capability-ledger.mjs";

const allowedStatuses = new Set(Object.keys(capabilityStatuses));

test("capability ledger is versioned, unique, and evidence honest", () => {
  assert.equal(capabilityLedger.contract, "ores.shared-auth.capability-ledger.v1");
  assert.equal(capabilityLedger.issue, "DEN-606");
  assert.ok(capabilityLedger.capabilities.length >= 12);

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

test("canonical host contract is exact and keeps administrator origins private", () => {
  const expected = [
    "shared-auth.github.io",
    "ores-shared-auth.com",
    "auth.ores-shared-auth.com",
    "user.ores-shared-auth.com",
    "org.ores-shared-auth.com",
    "api.ores-shared-auth.com",
    "admin.ores-shared-auth.com",
    "api-admin.ores-shared-auth.com",
  ];
  assert.deepEqual(
    capabilityLedger.hostContract.map((route) => route.host),
    expected,
  );
  for (const route of capabilityLedger.hostContract) {
    assert.ok(allowedStatuses.has(route.certification));
    assert.doesNotMatch(route.host, /\s|\*|\//);
  }
  const admin = capabilityLedger.hostContract.filter((route) =>
    route.host.includes("admin"),
  );
  assert.equal(admin.length, 2);
  assert.ok(admin.every((route) => route.exposure.startsWith("private")));
});

test("taxonomy references use official HTTPS documentation origins", () => {
  assert.ok(capabilityLedger.taxonomyReferences.length >= 12);
  for (const reference of capabilityLedger.taxonomyReferences) {
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
  assert.doesNotMatch(platform, /client:(load|idle|visible|media|only)/);
  assert.match(cta, /href="\/platform\/"/);
});
