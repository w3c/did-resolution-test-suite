// The implementer's side of the test suite: runs every DID URL in
// fixtures/did-urls.json through the reference client and writes a
// self-reported results file to implementations/.
// Usage: node did-url-dereferencing/reference-client/run.js
import {readFileSync, writeFileSync} from 'node:fs';
import {dereference} from './dereference.js';

const fixtures = new URL('../fixtures/', import.meta.url);
const load = name => JSON.parse(readFileSync(new URL(name, fixtures)));
const {version, cases} = load('did-urls.json');
const didResolutionResult = load('did-resolution-result.json');
const notFoundErrorResult = load('did-resolution-result-not-found.json');

// The client configuration every implementation is asked to set up
const resolvers = {
  test: async did => did === 'did:test:deref' ?
    didResolutionResult : notFoundErrorResult
};
const echo = type => async ({id}) => ({handler: type, id});
const handlers = {
  DIDCommMessaging: echo('DIDCommMessaging'),
  LinkedResource: echo('LinkedResource')
};

const results = {};
for(const {id, didUrl} of cases) {
  results[id] = await dereference(didUrl, {resolvers, handlers});
}

const report = {
  name: 'Reference Client',
  implementationVersion: '0.1.0',
  vectorsVersion: version,
  date: new Date().toISOString(),
  harness: 'https://github.com/wip-abramson/did-resolution-test-suite/blob/' +
    'main/did-url-dereferencing/reference-client/run.js',
  results
};
const out = new URL('../implementations/reference-client.json',
  import.meta.url);
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`Wrote results for ${cases.length} cases to ${out.pathname}`);
