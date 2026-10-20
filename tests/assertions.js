import * as chai from 'chai';
import Ajv from 'ajv';
import didSchema from './did-schema.json' with {type: 'json'};

const expect = chai.expect;
const ajv = new Ajv({allErrors: true, strict: false, validateSchema: false});
const validateDidDocument = ajv.compile(didSchema);

export function checkSuccessfulResolutionResult(resolutionResult) {
  expect(resolutionResult,
    'DID resolution result must be an object').to.be.an('object');
  expect(resolutionResult.didResolutionMetadata,
    'didResolutionMetadata must be an object').to.be.an('object');
  checkConformantDidDocument(resolutionResult.didDocument);
  expect(resolutionResult.didDocumentMetadata,
    'didDocumentMetadata must be an object').to.be.an('object');
}

export function checkErrorResolutionResult(resolutionResult,
  expectedErrorType) {

  expect(resolutionResult,
    'DID resolution result must be an object').to.be.an('object');
  expect(resolutionResult.didResolutionMetadata,
    'didResolutionMetadata must be an object').to.be.an('object');
  const {error} = resolutionResult.didResolutionMetadata;
  expect(error, 'didResolutionMetadata.error must be an object with a ' +
    '`type` property (e.g. {type: "https://www.w3.org/ns/did#NOT_FOUND"})')
    .to.be.an('object').that.has.property('type');
  if(expectedErrorType) {
    expect(error.type, 'didResolutionMetadata.error.type')
      .to.equal(expectedErrorType);
  }
  expect(resolutionResult,
    'didDocument must be present and null on error')
    .to.have.property('didDocument', null);
  expect(resolutionResult.didDocumentMetadata,
    'didDocumentMetadata must be an object').to.be.an('object');
}

export function checkConformantDidDocument(didDocument) {
  expect(didDocument, 'didDocument must be an object').to.be.an('object');
  const isValid = validateDidDocument(didDocument);
  expect(isValid, 'didDocument does not conform to the DID document ' +
    'schema: ' + ajv.errorsText(validateDidDocument.errors)).to.be.true;
}
