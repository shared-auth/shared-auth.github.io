import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const expectedInterfaces = '231510f5d01046af657be42a5d4215be12622042';
const expectedLoader = 'deae23537d27aed94bdc2510649f99393379a617';
const expectedDigest = '93a44bbb96c751218e4c00d479e4c14358122a389acca16205b1e4d0dc5f9476';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function filesBelow(directory) {
  const directoryPath = typeof directory === 'string' ? directory : fileURLToPath(directory);
  const results = [];
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const path = join(directoryPath, entry.name);
    if (entry.isDirectory()) results.push(...await filesBelow(path));
    else results.push(path);
  }
  return results;
}

test('Astro config registers the fleet loader integration', async () => {
  const config = await source('astro.config.mjs');
  assert.match(config, /oresWasmLoader/);
  assert.match(config, /appId:\s*["']shared-auth["']/);
  assert.match(config, /integrations\s*:/);
});

test('browser bootstrap pins the independently versioned contract and loader', async () => {
  const client = await source('public/owls/marketing-loader.mjs');
  assert.match(client, new RegExp(expectedInterfaces));
  assert.match(client, new RegExp(expectedLoader));
  assert.match(client, new RegExp(expectedDigest));
  assert.match(client, /prepareOnIntent/);
  assert.match(client, /activateProbe:\s*\(\)\s*=>/);
  assert.doesNotMatch(client, /unsafe-eval/);
  assert.doesNotMatch(client, /credentials\s*:/);
});

test('the adapter never activates the probe during ordinary page load', async () => {
  const client = await source('public/owls/marketing-loader.mjs');
  const callSites = [...client.matchAll(/coordinator\.activate\(/g)];
  assert.equal(callSites.length, 1);
  assert.match(client, /activateProbe:\s*\(\)\s*=>\s*coordinator\.activate/);
  assert.doesNotMatch(client, /addEventListener\(["']click["']/);
});

test('the dedicated workflow builds and verifies the integration', async () => {
  const workflow = await source('.github/workflows/owls-loader.yml');
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /node --test tests\/owls-loader\.test\.mjs/);
});

test('the static build contains the injected loader URL and app identity', async () => {
  const dist = new URL('../dist/', import.meta.url);
  const files = await filesBelow(dist);
  const searchable = files.filter((path) => ['.html', '.js', '.mjs'].includes(extname(path)));
  const output = (await Promise.all(searchable.map((path) => readFile(path, 'utf8')))).join('\n');
  assert.match(output, /owls\/marketing-loader\.mjs/);
  assert.match(output, /ores\.wasm-loader\.marketing\.bootstrap\.v1/);
});
