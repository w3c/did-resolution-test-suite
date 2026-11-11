import {readdirSync, readFileSync} from 'node:fs';

// [filename without .json, parsed JSON] for each file in a top-level folder
function readJsonDir(dir) {
  const url = new URL(`../${dir}/`, import.meta.url);
  return readdirSync(url).filter(f => f.endsWith('.json')).map(f => [
    f.slice(0, -'.json'.length),
    JSON.parse(readFileSync(new URL(f, url), 'utf8'))
  ]);
}

// did:<method> → shared test DIDs from did-methods/<method>.json
export const didMethods = new Map(readJsonDir('did-methods')
  .map(([method, dids]) => [`did:${method}`,
    {valid: [], notFound: [], deactivated: [], ...dids}]));

// Resolver name → resolver from resolvers/*.json, plus its test cases: the
// test DIDs of every DID method it supports, each tagged with its method
export const resolvers = new Map(readJsonDir('resolvers').map(([, r]) => {
  const methods = r.supportedDidMethods.filter(m => didMethods.has(m));
  const testCases = category => methods.flatMap(method =>
    didMethods.get(method)[category].map(c => ({...c, method})));
  return [r.name, {
    ...r,
    missingDidMethods: r.supportedDidMethods.filter(m => !didMethods.has(m)),
    validDids: testCases('valid'),
    notFoundDids: testCases('notFound'),
    deactivatedDids: testCases('deactivated')
  }];
}));

// DID methods with test DIDs and at least one resolver, offered as the
// report's DID method filter (see matrix.hbs)
export const testedDidMethods = [...didMethods.keys()].filter(m =>
  [...resolvers.values()].some(r => r.supportedDidMethods.includes(m)));

// Run `check` against every test case, recording a result per DID method on
// the mocha test (`byMethod`) for the report's DID method filter. The test
// fails if any test case fails. `check` may return 'pending' to skip a test
// case; if every test case is skipped, the test is skipped.
export async function forEachTestCase(context, testCases, check) {
  const byMethod = context.test.byMethod = {};
  const failures = [];
  for(const testCase of testCases) {
    const result = byMethod[testCase.method] ??= {state: 'pending'};
    try {
      if(await check(testCase) !== 'pending' && result.state === 'pending') {
        result.state = 'passed';
      }
    } catch(e) {
      const message = `${testCase.did}: ${e.message}`;
      if(result.state !== 'failed') {
        Object.assign(result, {state: 'failed', err: {message}});
      }
      failures.push(message);
    }
  }
  if(failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
  if(Object.values(byMethod).every(({state}) => state === 'pending')) {
    context.skip();
  }
}

// Add resolutionOptions as query parameters to a base URL
export function addQueryParametersToUrl(baseUrl, parameters = {}) {
  const url = new URL(baseUrl);
  for(const [key, value] of Object.entries(parameters)) {
    url.searchParams.append(key, value);
  }
  return url.toString();
}

// GET each url + Accept pair once per run, so tests making the same request
// share a response rather than hammering (often rate-limited) resolvers
const responses = new Map();
export async function cachedFetch(url, accept) {
  const key = `${accept} ${url}`;
  if(!responses.has(key)) {
    responses.set(key, fetch(url, {headers: {Accept: accept}}));
  }
  // each caller gets its own clone so the body can be read more than once
  return (await responses.get(key)).clone();
}
