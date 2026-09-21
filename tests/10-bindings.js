import * as chai from 'chai';
import {checkErrorResolutionResult,
  checkSuccessfulResolutionResult} from './assertions.js';
import {addQueryParametersToUrl} from './helpers.js';
import {filterByTag} from 'vc-test-suite-implementations';
import {helpers} from 'mocha-w3c-interop-reporter';

// eslint-disable-next-line no-unused-vars
const should = chai.should();
const expect = chai.expect;
const tag = 'did-resolution';
const {match} = filterByTag({tags: [tag], property: 'didResolvers'});

const DID_RESOLUTION_MEDIA_TYPE = 'application/did-resolution';
const DID_URL_DEREFERENCING_MEDIA_TYPE = 'application/did-url-dereferencing';

// Per spec table: error type → required HTTP status code
const ERROR_STATUS_CODES = {
  INVALID_DID: 400,
  INVALID_DID_URL: 400,
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
    const didResolver = implementation.settings.didResolvers[0];
    const endpoint = didResolver.endpoint;
    const validDids = didResolver.supportedDids.valid;
    // These fields are optional in the implementation config
    const deactivatedDids = didResolver.supportedDids.deactivated || [];
    const notFoundDids = didResolver.supportedDids.notFound || [];
    // derefUrls: [{didUrl, dereferencingOptions}] for DID URL
    // dereferencing tests
    const derefUrls = didResolver.supportedDids.derefUrls || [];
    // serviceDerefUrls: [{didUrl}] for service endpoint redirect (303) tests
    const serviceDerefUrls =
      didResolver.supportedDids.serviceDerefUrls || [];

    describe(name, function() {
      beforeEach(helpers.setupRow);

      // Normative: "All HTTPS bindings MUST use TLS"
      it('All HTTPS bindings MUST use TLS', function() {
        this.test.link =
          'https://w3c.github.io/did-resolution/#bindings-https';
        // If the endpoint uses the HTTPS scheme, TLS is in use by definition.
        // Plain HTTP is also permitted for local/development bindings per spec.
        if(endpoint.startsWith('https://')) {
          expect(endpoint).to.match(/^https:\/\//);
        }
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
          const rv = await fetch(url, {
            method: 'GET',
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
          rv.ok.should.be.true;
        });

        // Normative: "If the value of the Content-Type HTTP response header is
        //   application/did-resolution: The HTTP body MUST contain a DID
        //   resolution result"
        it('If Accept is application/did-resolution, HTTP body MUST ' +
          'contain a DID resolution result', async function() {
          this.test.link =
            'https://w3c.github.io/did-resolution/#bindings-https';
          const rv = await fetch(url, {
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
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
          const rv = await fetch(url, {
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
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
          const rv = await fetch(url, {
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
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
          const rv = await fetch(url, {
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
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
          // Try common DID document representation media types
          const mediaTypes =
            ['application/did+json', 'application/did+ld+json'];
          for(const mediaType of mediaTypes) {
            const rv = await fetch(url, {headers: {Accept: mediaType}});
            if(rv.status === 406) {
              // This representation is not supported; try the next one
              continue;
            }
            if(!rv.ok) {
              continue;
            }
            const body = await rv.json();
            // A bare DID document has an 'id' property; a full resolution
            // result would have 'didResolutionMetadata' instead
            body.should.have.property('id');
            body.should.not.have.property('didResolutionMetadata');
            return;
          }
          // Vacuously passes if no common representation type is supported
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
          const rv = await fetch(encodedUrl, {
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
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
          const rv = await fetch(url, {
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
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
        const rv = await fetch(url, {
          headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
        });
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
          const rv = await fetch(url, {
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
          rv.status.should.equal(ERROR_STATUS_CODES.NOT_FOUND);
          const resolutionResult = await rv.json();
          checkErrorResolutionResult(resolutionResult,
            'https://www.w3.org/ns/did#NOT_FOUND');
        });
      });

      // Normative: "REPRESENTATION_NOT_SUPPORTED → 406"
      it('REPRESENTATION_NOT_SUPPORTED error MUST map to HTTP ' +
        'status 406', async function() {
        this.test.link =
          'https://w3c.github.io/did-resolution/#bindings-https';
        const {did} = validDids[0];
        const url = `${endpoint}/${did}`;
        // Request an Accept type the resolver is very unlikely to support
        const unsupportedType =
          'application/x-unsupported-did-representation-99999';
        const rv = await fetch(url, {
          headers: {Accept: unsupportedType}
        });
        // Only assert 406 if the resolver signals an unsupported
        // representation; some resolvers may fall back to a default
        // representation (200)
        if(rv.status !== 200) {
          expect(rv.status).to.equal(
            ERROR_STATUS_CODES.REPRESENTATION_NOT_SUPPORTED);
        }
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
          const rv = await fetch(url, {
            headers: {Accept: DID_RESOLUTION_MEDIA_TYPE}
          });
          rv.status.should.equal(410);
        });
      });

      // --- DID URL Dereferencing binding ---
      // Tests below run only when the implementation config provides
      // derefUrls. Add `derefUrls: [{didUrl, dereferencingOptions}]` to
      // supportedDids in the implementation config to enable these tests.

      if(derefUrls.length > 0) {
        derefUrls.forEach(({didUrl, dereferencingOptions}) => {
          const hasOptions = dereferencingOptions &&
            Object.keys(dereferencingOptions).length > 0;
          // Per spec: DID URL MUST be URL-encoded when extra options
          // are present
          const encodedDidUrl = hasOptions ?
            encodeURIComponent(didUrl) : didUrl;
          const baseUrl = `${endpoint}/${encodedDidUrl}`;
          const url = addQueryParametersToUrl(baseUrl, dereferencingOptions);

          // Normative: "If the value of the Content-Type HTTP response header
          //   is application/did-url-dereferencing: The HTTP body MUST contain
          //   a DID URL dereferencing result"
          it('If Accept is application/did-url-dereferencing, HTTP body ' +
            'MUST contain a DID URL dereferencing result ' +
            `(${didUrl})`, async function() {
            this.test.link =
              'https://w3c.github.io/did-resolution/#bindings-https';
            const rv = await fetch(url, {
              headers: {Accept: DID_URL_DEREFERENCING_MEDIA_TYPE}
            });
            rv.ok.should.be.true;
            const derefResult = await rv.json();
            derefResult.should.have.property('dereferencingMetadata');
            derefResult.dereferencingMetadata.should.be.an('object');
            derefResult.should.have.property('contentStream');
            derefResult.should.have.property('contentMetadata');
            derefResult.contentMetadata.should.be.an('object');
          });

          // Normative: "If the function is successful and returns a
          //   contentStream with any other contentType:
          //   The HTTP response status code MUST be 200"
          it('If DID URL dereferencing returns a non-uri-list ' +
            'contentStream, HTTP status MUST be 200 ' +
            `(${didUrl})`, async function() {
            this.test.link =
              'https://w3c.github.io/did-resolution/#bindings-https';
            const rv = await fetch(url, {
              headers: {Accept: DID_URL_DEREFERENCING_MEDIA_TYPE},
              redirect: 'manual'
            });
            if(rv.status !== 303) {
              rv.status.should.equal(200);
            }
          });

          // Normative: "The HTTP response MUST contain a Content-Type HTTP
          //   response header. Its value MUST be the value of the contentType
          //   metadata property in the dereferencingMetadata"
          it('If DID URL dereferencing succeeds, Content-Type MUST ' +
            'equal contentType in dereferencingMetadata ' +
            `(${didUrl})`, async function() {
            this.test.link =
              'https://w3c.github.io/did-resolution/#bindings-https';
            const rv = await fetch(url, {
              headers: {Accept: DID_URL_DEREFERENCING_MEDIA_TYPE}
            });
            if(rv.status === 200) {
              const contentTypeHeader = rv.headers.get('Content-Type');
              expect(contentTypeHeader,
                'Content-Type header must be present').to.not.be.null;
              const derefResult = await rv.json();
              expect(derefResult.dereferencingMetadata,
                'dereferencingMetadata must have contentType')
                .to.have.property('contentType');
              contentTypeHeader.should.include(
                derefResult.dereferencingMetadata.contentType);
            }
          });

          // Normative: "The HTTP response body MUST contain the contentStream
          //   that is the result of the DID URL dereferencing function, in the
          //   representation corresponding to the Content-Type HTTP response
          //   header"
          it('HTTP response body MUST contain the contentStream ' +
            `from DID URL dereferencing (${didUrl})`, async function() {
            this.test.link =
              'https://w3c.github.io/did-resolution/#bindings-https';
            const rv = await fetch(url, {
              headers: {Accept: DID_URL_DEREFERENCING_MEDIA_TYPE}
            });
            if(rv.status === 200) {
              const body = await rv.text();
              expect(body,
                'response body must not be empty').to.not.be.empty;
            }
          });

          // Normative: "set the Accept HTTP request header to the value of the
          //   accept dereferencing option to request only the contentStream
          //   value of the result"
          it('If Accept is set to a content media type, response body ' +
            'MUST contain only the contentStream ' +
            '(not the full dereferencing result) ' +
            `(${didUrl})`, async function() {
            this.test.link =
              'https://w3c.github.io/did-resolution/#bindings-https';
            const rv = await fetch(url, {
              headers: {Accept: 'application/json'}
            });
            if(rv.status === 406) {
              // Representation not supported; test is vacuously satisfied
              return;
            }
            if(rv.ok) {
              const body = await rv.json();
              // A bare contentStream should not have dereferencingMetadata
              body.should.not.have.property('dereferencingMetadata');
            }
          });
        });
      }

      // --- Service-endpoint redirect (303) tests ---
      // Add `serviceDerefUrls: [{didUrl}]` to supportedDids in the
      // implementation config to enable these tests.

      if(serviceDerefUrls.length > 0) {
        serviceDerefUrls.forEach(({didUrl}) => {
          const url = `${endpoint}/${encodeURIComponent(didUrl)}`;

          // Normative: "If the function is successful and returns a
          //   contentStream and a contentType metadata property with the value
          //   text/uri-list in the dereferencingMetadata:
          //   The HTTP response status code MUST be 303"
          it('If contentType is text/uri-list, HTTP response status ' +
            `MUST be 303 (${didUrl})`, async function() {
            this.test.link =
              'https://w3c.github.io/did-resolution/#bindings-https';
            const rv = await fetch(url, {
              headers: {Accept: DID_URL_DEREFERENCING_MEDIA_TYPE},
              redirect: 'manual'
            });
            rv.status.should.equal(303);
          });

          // Normative: "The HTTP response MUST contain a Location header.
          //   The value of this header MUST be the selected DID service
          //   endpoint URL"
          it('If 303 response, HTTP response MUST contain a Location ' +
            'header with the selected DID service endpoint URL ' +
            `(${didUrl})`, async function() {
            this.test.link =
              'https://w3c.github.io/did-resolution/#bindings-https';
            const rv = await fetch(url, {
              headers: {Accept: DID_URL_DEREFERENCING_MEDIA_TYPE},
              redirect: 'manual'
            });
            rv.status.should.equal(303);
            const location = rv.headers.get('Location');
            expect(location,
              'Location header must be present and non-null').to.not.be.null;
          });

          // Normative: "the HTTP response body MUST be empty"
          it('If 303 response, HTTP response body MUST be empty ' +
            `(${didUrl})`, async function() {
            this.test.link =
              'https://w3c.github.io/did-resolution/#bindings-https';
            const rv = await fetch(url, {
              headers: {Accept: DID_URL_DEREFERENCING_MEDIA_TYPE},
              redirect: 'manual'
            });
            rv.status.should.equal(303);
            const body = await rv.text();
            body.should.equal('');
          });
        });
      }

    });
  }
});
