// Checks each self-reported results file in implementations/ against the
// expected results in fixtures/did-urls.json and builds the interop report.
import {readdirSync, readFileSync} from 'node:fs';
import {expect} from 'chai';
import {helpers} from 'mocha-w3c-interop-reporter';
import {isDeepStrictEqual} from 'node:util';

const root = new URL('../', import.meta.url);
const load = path => JSON.parse(readFileSync(new URL(path, root)));
const {version, cases} = load('fixtures/did-urls.json');
const implementations = new Map(
  readdirSync(new URL('implementations/', root))
    .filter(file => file.endsWith('.json'))
    .map(file => load(`implementations/${file}`))
    .map(report => [report.name, report]));

const SPEC = 'https://w3c.github.io/did-resolution/';
const ANCHORS = {
  '5.1.1': 'prepare-for-resolution',
  '5.1.2': 'resolve-the-did',
  '5.1.3': 'determine-handling-strategy',
  '5.1.5': 'use-the-handler-result',
  5.2: 'service-selection-algorithm',
  5.3: 'default-service-handler',
  5.4: 'pathHandler-path-matching-algorithm',
  5.5: 'return-did-document-dereferencing-algorithm',
  '12.7.1': 'path-traversal-via-relativeref'
};

describe('DID URL Dereferencing', function() {
  helpers.setupMatrix.call(this, implementations);
  for(const [name, {vectorsVersion, results}] of implementations) {
    describe(name, function() {
      beforeEach(helpers.setupRow);

      it(`Results are for the current test vectors (version ${version})`,
        function() {
          expect(vectorsVersion, 'vectorsVersion').to.equal(version);
        });

      for(const {id, section, description, expected} of cases) {
        it(description, function() {
          this.test.link = `${SPEC}#${ANCHORS[section]}`;
          if(expected === null) {
            this.test.cell.skipMessage = 'The spec does not define the ' +
              'result yet.';
            this.skip();
          }
          expect(results, 'results').to.have.property(id);
          const result = results[id];
          expect(matches(result, expected),
            `${id}: got ${JSON.stringify(summarize(result))}`).to.be.true;
        });
      }
    });
  }
});

function matches(result, expected) {
  if(expected.oneOf) {
    return expected.oneOf.some(alternative => matches(result, alternative));
  }
  if(expected.error || result.error) {
    return result.error === expected.error;
  }
  if(expected.resourceUrl &&
    ![expected.resourceUrl.oneOf ?? expected.resourceUrl].flat()
      .includes(result.resourceUrl)) {
    return false;
  }
  return isDeepStrictEqual(result.content, deref(expected.content)) &&
    isDeepStrictEqual(result.errors, expected.errors);
}

// {"$ref": "file.json#/json/pointer"} points into a fixture file
function deref(value) {
  if(!value?.$ref) {
    return value;
  }
  const [file, pointer] = value.$ref.split('#');
  return pointer.split('/').slice(1)
    .reduce((v, key) => v[key], load(`fixtures/${file}`));
}

// Keeps failure messages short: the DID document is shown by its id
function summarize(result) {
  return result.content?.id === 'did:test:deref' ?
    {...result, content: '<DID document>'} : result;
}
