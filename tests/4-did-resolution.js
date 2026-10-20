import * as chai from 'chai';
import {addQueryParametersToUrl, cachedFetch} from './helpers.js';
import {checkConformantDidDocument, checkErrorResolutionResult,
  checkSuccessfulResolutionResult} from './assertions.js';
import {filterByTag} from 'vc-test-suite-implementations';
import {helpers} from 'mocha-w3c-interop-reporter';

// eslint-disable-next-line no-unused-vars
const should = chai.should();
const expect = chai.expect;
const tag = 'did-resolution';
const {match} = filterByTag({tags: [tag], property: 'didResolvers'});
const DID_RESOLUTION_MEDIA_TYPE = 'application/did-resolution';

describe('DID Resolution', function() {
  helpers.setupMatrix.call(this, match);
  for(const [name, implementation] of match) {
    // Only the first didResolver tagged `did-resolution` is tested; any
    // others tagged for this suite are ignored
    const didResolver = implementation.settings.didResolvers
      .find(({tags}) => tags.includes(tag));
    const endpoint = didResolver.endpoint;
    describe(name, function() {
      beforeEach(helpers.setupRow);
      const validDids = didResolver.supportedDids.valid;

      it('Implementation has at least one valid DID to test', function() {
        expect(validDids.length).to.be.greaterThan(0);
      });

      validDids.forEach(({did, resolutionOptions}) => {

        const baseUrl = `${endpoint}/${did}`;
        const url = addQueryParametersToUrl(baseUrl, resolutionOptions);
        it('All conformant DID resolvers MUST implement the DID resolution ' +
          'function for at least one DID method', async function() {

          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=All%20conforming%20DID%20resolvers%20MUST%20implement%20the%20DID%20resolution%20function%20for%20at%20least%20one%20DID%20method`;

          rv.ok.should.be.true;
          const resolutionResult = await rv.json();

          checkSuccessfulResolutionResult(resolutionResult);
        });

        // Not testable over the HTTPS binding, which always supplies
        // resolutionOptions (empty if no query parameters are given)
        it.skip('The resolutionOptions input is REQUIRED, but the structure ' +
          'MAY be empty.');
        it('The didResolutionMetadata structure is REQUIRED.',
          async function() {
            const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
            this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=${encodeURIComponent('A metadata structure consisting of values relating to the results of the DID resolution process. This structure is REQUIRED')}`;
            rv.ok.should.be.true;
            const resolutionResult = await rv.json();
            resolutionResult.should.have.property('didResolutionMetadata');
          }
        );
        it('If resolution is successful, the didDocument MUST be a conformant' +
          ' DID document', async function() {
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=If%20the%20resolution%20is%20successful%2C%20this%20MUST%20be%20a%20DID%20document%20that%20is%20capable%20of%20being%20represented%20in%20one%20of%20the%20conformant%20representations%20of%20the%20Decentralized%20Identifiers%20(DIDs)%20v1.0%20specification`;
          rv.ok.should.be.true;
          const resolutionResult = await rv.json();
          resolutionResult.should.have.property('didDocument');
          checkConformantDidDocument(resolutionResult.didDocument);
        });

        it('The value of id in the resolved DID document MUST ' +
          'match the DID that was resolved', async function() {
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=The%20value%20of%20id%20in%20the%20resolved%20DID%20document%20MUST%20be%20string%20equal%20to%20the%20DID%20that%20was%20resolved.`;
          rv.ok.should.be.true;
          const resolutionResult = await rv.json();
          resolutionResult.should.have.property('didDocument');
          resolutionResult.didDocument.id.should.equal(did);
        });

        it('If the resolution is successful, the `didDocumentMetadata` ' +
          'MUST be a metadata structure', async function() {
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#did-resolution-options:~:text=If%20the%20resolution%20is%20successful%2C%20this%20MUST%20be%20a%20metadata%20structure`;
          rv.ok.should.be.true;
          const resolutionResult = await rv.json();
          resolutionResult.should.have.property('didDocumentMetadata');
          resolutionResult.didDocumentMetadata.should.be.an('object');
        });
      });

      const unconformantDids = ['not-a-did', 'did:example'];
      for(const badDid of unconformantDids) {

        it('The did input MUST be a conformant DID; otherwise produces an ' +
          'INVALID_DID error and conformant resolution result',
        async function() {

          const url = `${endpoint}/${badDid}`;
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=${encodeURIComponent('Validate that the input DID conforms to the did rule of the DID Syntax. If not, the DID resolver MUST return the following result:')}`;
          rv.ok.should.be.false;
          const resolutionResult = await rv.json();
          checkErrorResolutionResult(resolutionResult, 'https://www.w3.org/ns/did#INVALID_DID');
        });
        it('The error property in DID Resolution Metadata is REQUIRED when ' +
          'there is an error in the resolution process.', async function() {

          const url = `${endpoint}/${badDid}`;
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=If%20the%20resolution%20is%20unsuccessful%2C%20this%20structure%20MUST%20contain%20an%20error%20property%20describing%20the%20error.`;
          rv.ok.should.be.false;
          const resolutionResult = await rv.json();
          resolutionResult.should.have.property('didResolutionMetadata');
          resolutionResult.didResolutionMetadata
            .should.have.property('error');
        });

        it('If the resolution is unsuccessful, the `didDocumentMetadata` ' +
          'output MUST be an empty metadata structure', async function() {

          const url = `${endpoint}/${badDid}`;
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#did-resolution-options:~:text=If%20the%20resolution%20is%20unsuccessful%2C%20this%20output%20MUST%20be%20an%20empty%20metadata%20structure.`;
          rv.ok.should.be.false;
          const resolutionResult = await rv.json();
          resolutionResult.should.have.property('didDocumentMetadata');
          resolutionResult.didDocumentMetadata.should.deep.equal({});
        });

      }

      const unsupportedDidMethod = 'did:unsupported:123456789abcdefghi';
      it('If the DID method is not supported, produces a ' +
        'METHOD_NOT_SUPPORTED error and conformant resolution result',
      async function() {
        const url = `${endpoint}/${unsupportedDidMethod}`;
        const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
        this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=${encodeURIComponent('Determine whether the DID method of the input DID is supported by the DID resolver that implements this algorithm. If not, the DID resolver MUST return the following result:')}`;
        rv.ok.should.be.false;
        const resolutionResult = await rv.json();
        checkErrorResolutionResult(resolutionResult, 'https://www.w3.org/ns/did#METHOD_NOT_SUPPORTED');
      }
      );

      // versionTime MUST be a datetime (see #did-parameters), so a
      // non-datetime value is an invalid option. A resolver that doesn't
      // support versionTime at all correctly stops earlier, at the
      // FEATURE_NOT_SUPPORTED step, so either error is accepted
      if(validDids.length > 0) {
        it('If the resolution options are invalid, produces an ' +
          'INVALID_OPTIONS (or FEATURE_NOT_SUPPORTED) error and conformant ' +
          'resolution result',
        async function() {
          const url = addQueryParametersToUrl(`${endpoint}/${validDids[0].did}`,
            {versionTime: 'not-a-datetime'});
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=${encodeURIComponent('are valid. If not, the DID resolver MUST return the following result:')}`;
          rv.ok.should.be.false;
          const resolutionResult = await rv.json();
          checkErrorResolutionResult(resolutionResult);
          resolutionResult.didResolutionMetadata.error.type.should.be.oneOf([
            'https://www.w3.org/ns/did#INVALID_OPTIONS',
            'https://www.w3.org/ns/did#FEATURE_NOT_SUPPORTED'
          ]);
        });
      }

      // These fields are optional in the implementation config
      const notFoundDids = didResolver.supportedDids.notFound || [];
      notFoundDids.forEach(({did, resolutionOptions}) => {
        const url = addQueryParametersToUrl(`${endpoint}/${did}`,
          resolutionOptions);
        it('If the DID does not exist, produces a NOT_FOUND error and ' +
          'conformant resolution result', async function() {
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=${encodeURIComponent('does not exist, return the following result:')}`;
          rv.ok.should.be.false;
          const resolutionResult = await rv.json();
          checkErrorResolutionResult(resolutionResult, 'https://www.w3.org/ns/did#NOT_FOUND');
        });
      });

      const deactivatedDids = didResolver.supportedDids.deactivated || [];
      deactivatedDids.forEach(({did, resolutionOptions}) => {
        const url = addQueryParametersToUrl(`${endpoint}/${did}`,
          resolutionOptions);
        it('If a DID has been deactivated, DID document metadata MUST ' +
          'include the deactivated property with the boolean value true',
        async function() {
          const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
          this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=${encodeURIComponent('DID document metadata MUST include this property with the boolean value true')}`;
          const resolutionResult = await rv.json();
          resolutionResult.should.have.property('didDocumentMetadata');
          resolutionResult.didDocumentMetadata.should.have.property(
            'deactivated', true);
        });
        it('If the DID has been deactivated, the didDocument is null',
          async function() {
            const rv = await cachedFetch(url, DID_RESOLUTION_MEDIA_TYPE);
            this.test.link = `https://w3c.github.io/did-resolution/#types:~:text=${encodeURIComponent('has been deactivated, return the following result:')}`;
            const resolutionResult = await rv.json();
            resolutionResult.should.have.property('didDocument', null);
          });
      });

    });

  }
});
