import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../src/lib/services/geminiValidatorService.js', import.meta.url), 'utf8');

async function loadService(local = '', session = '') {
  const localValues = new Map(local ? [['gemini_api_key', local]] : []);
  const sessionValues = new Map(session ? [['gemini_api_key', session]] : []);
  const context = vm.createContext({
    localStorage: { getItem: (key) => localValues.get(key) ?? null, setItem: (key, value) => localValues.set(key, value) },
    sessionStorage: { getItem: (key) => sessionValues.get(key) ?? null },
    console: { log() {}, warn() {}, error() {} },
  });
  const sdk = new vm.SyntheticModule(['GoogleGenerativeAI'], function () {
    this.setExport('GoogleGenerativeAI', class { constructor(key) { this.key = key; } });
  }, { context });
  await sdk.link(() => {});
  await sdk.evaluate();
  const stores = new vm.SyntheticModule(['aiProcessing'], function () {
    this.setExport('aiProcessing', {});
  }, { context });
  const module = new vm.SourceTextModule(source, {
    context,
    initializeImportMeta(meta) { meta.env = { VITE_GEMINI_API_KEY: 'BUILD_ONLY_CANARY' }; },
    importModuleDynamically() { return sdk; },
  });
  await module.link(() => stores);
  await module.evaluate();
  return module.namespace.geminiValidatorService;
}

test('a build-time credential never initializes the browser client', async () => {
  const service = await loadService();
  assert.equal(await service.initialize(), false);
  assert.equal(service.isAvailable(), false);
  assert.ok(!service.apiKey);
});

test('the user can supply a key through existing browser settings', async () => {
  const service = await loadService();
  assert.equal(await service.setApiKey('USER_SUPPLIED_CANARY'), true);
  assert.equal(service.genAI.key, 'USER_SUPPLIED_CANARY');
});

test('an existing session key still initializes the optional client', async () => {
  const service = await loadService('', 'SESSION_CANARY');
  assert.equal(await service.initialize(), true);
  assert.equal(service.genAI.key, 'SESSION_CANARY');
});
