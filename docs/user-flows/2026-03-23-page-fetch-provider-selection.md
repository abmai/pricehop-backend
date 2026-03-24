# Page Fetch Provider Selection Flow

Date: 2026-03-23

## Scope

This flow documents how the runtime chooses a page fetch provider for product
HTML retrieval and how fetch responses are normalized before extraction starts.

## Flow 1: Bright Data Web Unlocker is configured

1. The runtime starts with `BRIGHTDATA_API_KEY` configured.
2. `makePageFetcher()` builds a Bright Data-backed fetcher.
3. The worker requests a product page.
4. The fetcher sends `POST https://api.brightdata.com/request` with the
   configured `zone`, target `url`, and `format: "raw"`.
5. The fetcher normalizes the Bright Data response into `RawPageResult`.

Expected result:

- The fetcher returns HTML, the upstream status code, and a fetch timestamp.
- Downstream extraction keeps the same contract regardless of provider.

## Flow 2: Bright Data credentials are absent

1. The runtime starts without `BRIGHTDATA_API_KEY`.
2. `makePageFetcher()` falls back to the direct HTTP fetcher.
3. The worker requests a product page.
4. The fetcher performs a normal HTTP request with the existing browser-like
   user agent and returns `RawPageResult`.

Expected result:

- Local development and tests still run without Bright Data credentials.
- Provider selection does not change the rest of the indexing flow.

## Edge Cases

### Bright Data JSON envelope

- If Bright Data returns a JSON envelope with `body` and `status_code`, the
  fetcher maps those fields into `RawPageResult`.

### Bright Data raw HTML response

- If Bright Data returns raw HTML directly, the fetcher uses the HTTP response
  body and status code.

### Missing HTML content

- If the provider response does not contain usable HTML, the fetcher returns a
  `ScrapingError`.

### Provider authentication or transport failure

- If the Bright Data request fails before a page payload is available, the
  fetcher returns a `ScrapingError`.
