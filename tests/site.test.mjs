import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const built = new URL("../dist/index.html", import.meta.url);
test("Astro emits the Shared Auth landing page", () => assert.ok(existsSync(built)));
test("landing page exposes assurance and polyglot clients", () => {
  const html = readFileSync(built, "utf8");
  for (const expected of ["Shared Auth", "Select client language", "Protected introspection", "Rust", "TypeScript", "Dart / Flutter", "Swift"]) {
    assert.ok(html.includes(expected), `missing ${expected}`);
  }
  assert.ok(!html.includes("undefined"));
});
