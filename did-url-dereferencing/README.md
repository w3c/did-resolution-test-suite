# DID URL Dereferencing Test Suite

Tests DID URL dereferencing *clients* against
[section 5](https://w3c.github.io/did-resolution/#dereferencing) of the DID
Resolution specification.

Dereferencing happens after resolution, on the resolution result. So instead of
testing against live DIDs, every implementation is given the same fixed DID
resolution result and asked to dereference the same set of DID URLs. Results
are self-reported.

## Layout

| Path | Contents |
|---|---|
| `fixtures/did-resolution-result.json` | The resolution result for `did:test:deref` |
| `fixtures/did-resolution-result-not-found.json` | The result for any other `did:test` DID |
| `fixtures/did-urls.json` | The DID URLs to dereference, with the expected result of each |
| `fixtures/resources/` | The files the service endpoints point at, published to GitHub Pages |
| `implementations/` | One self-reported results file per implementation |
| `reference-client/` | A reference client and the harness that produces its results file |
| `tests/` | Checks every results file and builds the interop report |

## Submitting results

1. **Configure a resolver for the `did:test` method** that returns
   `did-resolution-result.json` for `did:test:deref` and
   `did-resolution-result-not-found.json` for any other DID. Conforming clients
   are required to let users choose the resolver for a DID method (section
   5.1.1).
2. **Register handlers** for the `DIDCommMessaging` and `LinkedResource` types
   that return `{"handler": "<type>", "id": "<id of the object passed in>"}`.
   If your client cannot register handlers, it should return
   `DEREFERENCING_ERROR_HANDLER_NOT_FOUND` for those cases, which is accepted.
3. **Dereference every `didUrl`** in `fixtures/did-urls.json` and record each
   result, keyed by the case `id`, in one of two shapes:
   - Success: `{"content": ..., "resourceUrl": "...", "errors": [...]}`
     - `content` is the DID document, or the response body when a service
       endpoint was fetched: parsed if the response is JSON, otherwise text.
       For a handler registered in step 2, it is what the handler returned.
     - `resourceUrl` is the URL the Default Service Handler fetched. Leave it
       out for other handlers.
     - `errors` lists errors raised while processing continued, such as
       `DEREFERENCING_ERROR_SERVICE_NOT_FOUND`. Use `[]` if there were none.
   - Failure that ended processing: `{"error": "<name>"}`
   - Errors use the names from section 5.6, or `INVALID_DID_URL`. The spec does
     not define URLs for dereferencing errors yet.
4. **Write a results file** to `implementations/<your-implementation>.json`:
   ```json
   {
     "name": "Your Implementation",
     "implementationVersion": "1.2.3",
     "vectorsVersion": "0.1.0",
     "date": "2026-10-26T00:00:00Z",
     "harness": "https://link/to/the/script/that/produced/this/file",
     "results": {"bare-did": {"content": {...}, "errors": []}}
   }
   ```
   `vectorsVersion` is the `version` from `fixtures/did-urls.json` you ran
   against. Publishing your harness lets others reproduce your results.

`reference-client/run.js` follows these steps for the reference client.

## Running the report

```sh
npm run test:dereferencing
```

This checks every file in `implementations/` and writes the interop report to
`reports/did-url-dereferencing/index.html`.

A case passes when the result matches `expected`. Where `expected` has a
`oneOf`, any of the alternatives passes. Cases marked `open` depend on a
question the spec has not settled yet, and cases with `expected: null` are
reported as skipped.
