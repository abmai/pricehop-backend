# Bright Data Unlocker Configuration Flow

Date: 2026-03-23

## Scope

This flow documents how the runtime decides whether to use Bright Data's
Unlocker API for page fetching, which environment variables it honors, and how
request options are translated into the Bright Data request body.

## Flow 1: Unlocker API direct access is fully configured

1. The runtime starts with `BRIGHTDATA_API_KEY` configured.
2. The runtime also has an explicit Unlocker API zone name configured through
   `BRIGHTDATA_WEB_UNLOCKER_ZONE`.
3. `makePageFetcher()` builds a Bright Data-backed fetcher.
4. The worker requests a product page.
5. The fetcher sends `POST https://api.brightdata.com/request` with:
   - `zone`: the configured Unlocker API zone name
   - `url`: the target page URL
   - `format: "raw"`
6. Bright Data returns either raw HTML or a JSON envelope that includes the
   HTML body.
7. The fetcher normalizes the response into `RawPageResult`.

Expected result:

- The fetcher uses Bright Data only when the request can be authenticated and
  routed to a real Unlocker API zone.
- Downstream extraction receives the same `RawPageResult` contract regardless of
  provider.

## Flow 2: Legacy zone env var is still present

1. The runtime starts with `BRIGHTDATA_API_KEY` configured.
2. `BRIGHTDATA_WEB_UNLOCKER_ZONE` is absent.
3. `BRIGHTDATA_ZONE` is present from an older deployment configuration.
4. `makePageFetcher()` still builds a Bright Data-backed fetcher using the
   legacy zone value.

Expected result:

- Existing deployments continue to work while configuration is migrated to the
  clearer `BRIGHTDATA_WEB_UNLOCKER_ZONE` name.

## Flow 3: Bright Data is only partially configured

1. The runtime starts with `BRIGHTDATA_API_KEY` configured.
2. No Unlocker API zone name is configured.
3. `makePageFetcher()` does not guess a zone name.
4. The runtime falls back to the direct HTTP fetcher.

Expected result:

- The app does not send invalid Bright Data requests with a fake default zone.
- Local development remains runnable even when Bright Data credentials are
  incomplete.

## Edge Cases

### Manual wait selector

- If the caller passes `waitSelector`, the Bright Data request includes an
  `x-unblock-expect` header payload that asks Unlocker API to wait for the CSS
  selector before returning the page.

### Bright Data JSON envelope

- If Bright Data returns a JSON envelope with `body` and `status_code`, the
  fetcher maps those fields into `RawPageResult`.

### Bright Data raw HTML response

- If Bright Data returns raw HTML directly, the fetcher uses the HTTP response
  body and status code.

### Missing HTML content

- If the provider response does not contain usable HTML, the fetcher returns a
  `ScrapingError`.
