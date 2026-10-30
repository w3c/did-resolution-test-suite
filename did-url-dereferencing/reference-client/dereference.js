// Reference DID URL dereferencing client, following section 5 of the DID
// Resolution spec. Its job is to check the test vectors, not to be a
// production client.

// did-url ABNF from DID Core, as a regex
const PCT = '%[0-9A-Fa-f]{2}';
const IDCHAR = `(?:[A-Za-z0-9._-]|${PCT})`;
const PCHAR = `(?:[A-Za-z0-9\\-._~!$&'()*+,;=:@]|${PCT})`;
const DID_URL = new RegExp(
  `^(did:([a-z0-9]+):(?:${IDCHAR}*:)*${IDCHAR}+)` + // did, method
  `((?:/${PCHAR}*)*)` + // path-abempty
  `(?:\\?((?:${PCHAR}|[/?])*))?` + // query
  `(?:#((?:${PCHAR}|[/?])*))?$`); // fragment

// Service and secondary types this client knows to define their own handling
// strategy. A type listed here with no registered handler raises
// HANDLER_NOT_FOUND
const TYPES_WITH_STRATEGY = ['DIDCommMessaging', 'LinkedResource'];

class DereferencingError extends Error {}

/**
 * Dereferences a DID URL.
 *
 * @param {string} didUrl - The DID URL to dereference.
 * @param {object} options - Options.
 * @param {object} options.resolvers - Map of DID method name to an async
 *   function that takes a DID and returns a DID resolution result.
 * @param {object} [options.handlers] - Map of type name to an async function
 *   that takes the selected object and the DID URL and returns content.
 * @returns {Promise<object>} Either {content, resourceUrl?, errors} or
 *   {error}.
 */
export async function dereference(didUrl, {resolvers, handlers = {}}) {
  try {
    return await run(didUrl, {resolvers, handlers});
  } catch(e) {
    if(e instanceof DereferencingError) {
      return {error: e.message};
    }
    throw e;
  }
}

async function run(didUrl, {resolvers, handlers}) {
  // 5.1.1 Prepare for Resolution
  const parsed = DID_URL.exec(didUrl);
  if(!parsed) {
    throw new DereferencingError('INVALID_DID_URL');
  }
  const [, did, method, path, query = ''] = parsed;
  const resolve = resolvers[method];
  if(!resolve) {
    throw new DereferencingError('DEREFERENCING_ERROR_FAILED');
  }

  // 5.1.2 Resolve the DID. No query parameters are promoted to resolution
  // options: the test resolver returns a fixed result
  const resolutionResult = await resolve(did);
  if(resolutionResult.didResolutionMetadata.error) {
    throw new DereferencingError('DEREFERENCING_ERROR_RESOLUTION_ERROR');
  }
  const {didDocument} = resolutionResult;

  // 5.1.3 Determine Handling Strategy
  const errors = [];
  const strategy = determineStrategy(
    {did, path, query, didDocument, errors});

  // 5.1.4 Invoke the Handler
  if(strategy.name === 'returnDidDocument') {
    return {content: didDocument, errors};
  }
  if(strategy.name === 'defaultServiceHandler') {
    return {...await defaultServiceHandler(strategy.object, path), errors};
  }
  const handler = handlers[strategy.name];
  if(!handler) {
    throw new DereferencingError('DEREFERENCING_ERROR_HANDLER_NOT_FOUND');
  }
  return {content: await handler(strategy.object, didUrl), errors};
}

function determineStrategy({did, path, query, didDocument, errors}) {
  const returnDidDocument = {name: 'returnDidDocument'};

  // Services Step
  const serviceParams = new URLSearchParams(query).getAll('service');
  if(serviceParams.length > 1) {
    errors.push('DEREFERENCING_ERROR_MULTIPLE_SERVICE_PARAMETERS');
    return returnDidDocument;
  }
  if(serviceParams.length === 1) {
    const service = selectService(did, serviceParams[0], didDocument);
    if(!service) {
      errors.push('DEREFERENCING_ERROR_SERVICE_NOT_FOUND');
      return returnDidDocument;
    }
    const strategy = strategyForType(types(service)) ??
      {name: 'defaultServiceHandler'};
    return {...strategy, object: service};
  }

  // PathHandlers Step
  if(path) {
    const matches = matchPathHandlers(path, didDocument);
    if(matches.length > 1) {
      errors.push('DEREFERENCING_ERROR_MULTIPLE_MATCHING_PATH_HANDLERS');
      return returnDidDocument;
    }
    if(matches.length === 1) {
      const [object] = matches;
      const secondary = types(object).filter(t => t !== 'PathHandler');
      const strategy = strategyForType(secondary);
      if(strategy) {
        return {...strategy, object};
      }
      // Section 5.3: a service whose type has no handler of its own, or
      // whose only type is PathHandler, uses the Default Service Handler
      if(didDocument.service?.includes(object)) {
        return {name: 'defaultServiceHandler', object};
      }
      errors.push('DEREFERENCING_ERROR_PATH_HANDLER_HANDLER_NOT_DEFINED');
      return returnDidDocument;
    }
  }

  // Document Properties, Method-Specific, Query Parameters and Metadata
  // Steps: nothing in the spec defines a strategy for these yet

  // Default DID Document Step
  return returnDidDocument;
}

function types(object) {
  return [object.type].flat();
}

function strategyForType(typeList) {
  const name = typeList.find(t => TYPES_WITH_STRATEGY.includes(t));
  return name && {name};
}

// 5.2 Service Selection Algorithm
function selectService(did, serviceParam, didDocument) {
  const target = absolute(serviceParam, did);
  const matches = (didDocument.service ?? [])
    .filter(({id}) => target && absolute(id, did) === target);
  if(matches.length > 1) {
    throw new DereferencingError(
      'DEREFERENCING_ERROR_MULTIPLE_MATCHING_SERVICES');
  }
  return matches[0];
}

// RFC3986 reference resolution against the DID. A bare name such as `files`
// cannot be resolved against an opaque base like `did:test:deref`, so it
// matches nothing
function absolute(ref, did) {
  try {
    return new URL(ref, did).href;
  } catch {
    return undefined;
  }
}

// 5.4 PathHandler Path Matching Algorithm, over every array of objects in the
// DID document
function matchPathHandlers(path, didDocument) {
  const handlers = Object.values(didDocument)
    .filter(Array.isArray).flat()
    .filter(o => o?.type && types(o).includes('PathHandler') &&
      typeof o.path === 'string' && path.startsWith(o.path));
  const longest = Math.max(...handlers.map(o => o.path.length));
  return handlers.filter(o => o.path.length === longest);
}

// 5.3 Default Service Handler
async function defaultServiceHandler(service, path) {
  const servicePath = service.path ?? '';
  if(path && !path.startsWith(servicePath)) {
    // not defined by the spec
    throw new DereferencingError('DEREFERENCING_ERROR_FAILED');
  }
  const pathExtension = path.slice(servicePath.length);

  // Start at a random endpoint and try each one until one succeeds. Only URL
  // strings can be dereferenced; the spec does not cover map endpoints
  const endpoints = [service.serviceEndpoint].flat()
    .filter(e => typeof e === 'string' && URL.canParse(e));
  const start = Math.floor(Math.random() * endpoints.length);
  for(let i = 0; i < endpoints.length; i++) {
    const endpoint = new URL(endpoints[(start + i) % endpoints.length]);
    // Setting pathname removes dot segments, including %2E forms
    const resourceUrl = new URL(endpoint);
    resourceUrl.pathname = endpoint.pathname + pathExtension;
    if(!resourceUrl.pathname.startsWith(endpoint.pathname)) {
      throw new DereferencingError(
        'DEREFERENCE_ERROR_PATH_NORMALIZATION_ERROR');
    }
    const response = await fetch(resourceUrl);
    if(response.ok) {
      const isJson = response.headers.get('content-type')?.includes('json');
      const content = isJson ? await response.json() : await response.text();
      return {content, resourceUrl: resourceUrl.href};
    }
  }
  throw new DereferencingError(
    'DEREFERENCING_ERROR_NO_SERVICE_ENDPOINTS_SUCCEED');
}
