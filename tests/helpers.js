
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
