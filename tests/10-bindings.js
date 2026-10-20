import * as chai from 'chai';
import {addQueryParametersToUrl, cachedFetch} from './helpers.js';
import {checkErrorResolutionResult,
  checkSuccessfulResolutionResult} from './assertions.js';
import {filterByTag} from 'vc-test-suite-implementations';
import {helpers} from 'mocha-w3c-interop-reporter';

// eslint-disable-next-line no-unused-vars
const should = chai.should();
const expect = chai.expect;
const tag = 'did-resolution';
const {match} = filterByTag({tags: [tag], property: 'didResolvers'});

const DID_RESOLUTION_MEDIA_TYPE = 'application/did-resolution';

// Per spec table: error type → required HTTP status code
const ERROR_STATUS_CODES = {
  INVALID_DID: 400,
  INVALID_OPTIONS: 400,
  NOT_FOUND: 404,
  REPRESENTATION_NOT_SUPPORTED: 406,
  INVALID_DID_DOCUMENT: 500,
  METHOD_NOT_SUPPORTED: 501,
  FEATURE_NOT_SUPPORTED: 501,
  INTERNAL_ERROR: 500
};

describe('10.1 HTTP(S) Binding', function() {
  helpers.setupMatrix.call(this, match);
  for(const [name, implementation] of match) {
    // Only the first didResolver tagged `did-resolution` is tested; any
    // others tagged for this suite are ignored
    const didResolver = implementation.settings.didResolvers
      .find(({tags}) => tags.includes(tag));
    const endpoint = didResolver.endpoint;
    const validDids = didResolver.supportedDids.valid;
    // These fields are optional in the implementation config
    const deactivatedDids = didResolver.supportedDids.deactivated || [];
    const notFoundDids = didResolver.supportedDids.notFound || [];

    describe(name, function() {
      beforeEach(helpers.setupRow);

      // Normative: "All HTTPS bindings MUST use TLS"
      it('All HTTPS bindings MUST use TLS', function() {
        this.test.link =
          'https://w3c.github.io/did-resolution/#bindings-https';
        expect(endpoint).to.match(/^https:\/\//);
      });

      // Normative: "All conforming DID resolvers MUST implement the
      // GET version"
      validDids.forEach(({did, resolutionOptions}) => {
        const baseUrl = `${endpoint}/${did}`;
        const url = addQueryParametersToUrl(baseUrl, resolutionOptions);

        it('All conforming DID resolvers MUST implement the GET ' +
          'version of the HTTPS binding', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          rv.ok.should.be.true;
        });

        // Normative: "If the value of the Content-Type HTTP response header is
        //   application/did-resolution: The HTTP body MUST contain a DID
        //   resolution result"
        it('If Accept is application/did-resolution, HTTP body MUST ' +
          'contain a DID resolution result', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          rv.ok.should.be.true;
          const resolutionResult = await rv.json();
          checkSuccessfulResolutionResult(resolutionResult);
        });

        // Normative: "If the function is successful and returns a didDocument:
        //   The HTTP response status code MUST be 200"
        it('If function is successful and returns a didDocument, ' +
          'HTTP response status code MUST be 200', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          rv.status.should.equal(200);
        });

        // Normative: "The HTTP response MUST contain a Content-Type HTTP
        //   response header. Its value MUST be the value of the contentType
        //   metadata property in the didResolutionMetadata"
        it('HTTP response MUST contain a Content-Type header ' +
          'whose value MUST equal ' +
          'contentType in didResolutionMetadata', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          rv.ok.should.be.true;
          const contentTypeHeader = rv.headers.get('Content-Type');
          expect(contentTypeHeader,
            'Content-Type response header must be present').to.not.be.null;
          const resolutionResult = await rv.json();
          expect(resolutionResult.didResolutionMetadata,
            'didResolutionMetadata must contain a contentType property')
            .to.have.property('contentType');
          contentTypeHeader.should.include(
            resolutionResult.didResolutionMetadata.contentType);
        });

        // Normative: "The HTTP response body MUST contain the didDocument that
        //   is the result of the DID resolution function, in the representation
        //   corresponding to the Content-Type HTTP response header"
        it('HTTP response body MUST contain the didDocument result ' +
          'of the DID resolution function', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          rv.ok.should.be.true;
          const resolutionResult = await rv.json();
          resolutionResult.should.have.property('didDocument');
          resolutionResult.didDocument.should.be.an('object');
        });

        // Normative: "set the Accept HTTP request header to the value of the
        //   accept resolution option to request only the didDocument value of
        //   the result"
        it('If Accept is set to a DID representation media type, ' +
          'response body MUST contain only the didDocument ' +
          '(not the full resolution result)', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await cachedFetch(url, 'application/did+json');
          if(rv.status === 406) {
            // did+json is not supported, so nothing to test
            this.skip();
          }
          rv.ok.should.be.true;
          const body = await rv.json();
          // A bare DID document has an 'id' property; a full resolution
          // result would have 'didResolutionMetadata' instead
          body.should.have.property('id');
          body.should.not.have.property('didResolutionMetadata');
        });

        // Normative (GET): "If any other resolution options or dereferencing
        //   options than accept are provided: The input DID MUST be URL-encoded
        //   (as specified in RFC3986 Section 2.1)"
        // From the server side: the resolver MUST accept URL-encoded DIDs
        // because clients MUST send URL-encoded DIDs when options are present.
        it('GET binding: resolver MUST accept URL-encoded DIDs ' +
          '(required because clients MUST URL-encode when resolution ' +
          'options other than accept are provided)', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const encodedDid = encodeURIComponent(did);
          const encodedUrl = addQueryParametersToUrl(
            `${endpoint}/${encodedDid}`, resolutionOptions
          );
          const rv = await cachedFetch(encodedUrl, DID_RESOLUTION_MEDIA_TYPE);
          rv.ok.should.be.true;
          const resolutionResult = await rv.json();
          checkSuccessfulResolutionResult(resolutionResult);
        });
      });

      // --- Error → HTTP status code mapping ---

      // Normative: "INVALID_DID → 400"
      for(const badDid of ['not-a-did', 'did:example']) {
        it('INVALID_DID error MUST map to HTTP status 400 ' +
          `(input: "${badDid}")`, async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const url = `${endpoint}/${badDid}`;
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          rv.status.should.equal(ERROR_STATUS_CODES.INVALID_DID);
        });
      }

      // Normative: "METHOD_NOT_SUPPORTED → 501"
      it('METHOD_NOT_SUPPORTED error MUST map to HTTP ' +
        'status 501', async function() {
        this.test.link =
          'https://w3c.github.io/did-resolution/#bindings-https';
        const unsupportedDid = 'did:unsupported:123456789abcdefghi';
        const url = `${endpoint}/${unsupportedDid}`;
        const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
        rv.status.should.equal(ERROR_STATUS_CODES.METHOD_NOT_SUPPORTED);
      });

      // Normative: "NOT_FOUND → 404"
      // Requires one or more notFoundDids to be set in the implementation
      // config, each as an object: {did, resolutionOptions}
      notFoundDids.forEach(({did, resolutionOptions}) => {
        const baseUrl = `${endpoint}/${did}`;
        const url = addQueryParametersToUrl(baseUrl, resolutionOptions);

        it('NOT_FOUND error MUST map to HTTP status 404', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          rv.status.should.equal(ERROR_STATUS_CODES.NOT_FOUND);
          const resolutionResult = await rv.json();
          checkErrorResolutionResult(resolutionResult,
            'https://www.w3.org/ns/did#NOT_FOUND');
        });
      });

      // Normative: "If the DID resolution or DID URL dereferencing function
      //   returns a deactivated metadata property with the value true …
      //   The HTTP response status code MUST be 410"
      // Requires deactivatedDids: [{did, resolutionOptions}] in the
      // implementation config
      deactivatedDids.forEach(({did, resolutionOptions}) => {
        const baseUrl = `${endpoint}/${did}`;
        const url = addQueryParametersToUrl(baseUrl, resolutionOptions);

        it('If deactivated metadata property is true, ' +
          'HTTP response status MUST be 410', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          rv.status.should.equal(410);
        });
      });
    });
  }
});
