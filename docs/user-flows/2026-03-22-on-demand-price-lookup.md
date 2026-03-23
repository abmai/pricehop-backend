# On-Demand Price Lookup User Flow

Date: 2026-03-22

## Scope

This flow documents the on-demand single-product lookup path for the supported
brands and regions. The request returns immediately, while indexing continues in
the background and updates the cached product snapshot.

Supported brands:

- Tiffany
- Bottega Veneta
- Cartier
- On

Supported regions:

- US
- KR
- CN
- TW
- HK
- TH
- AU
- PH
- SG
- CA

## Flow 1: Fresh prices are already cached

1. The client submits `POST /prices/lookup` with a product URL.
2. The API normalizes the URL and detects the brand.
3. The API loads the cached product snapshot and region prices.
4. If the latest `fetchedAt` is still fresh, the API returns
   `status: "complete"` with the current cached prices.

Expected result:

- No indexing job is created.
- The response contains the normalized product URL, detected brand, optional
  product name, cached prices, and `fetchedAt`.

## Flow 2: Cache miss or stale data triggers background indexing

1. The client submits `POST /prices/lookup` for a supported brand URL.
2. The API normalizes the URL, detects the brand, and checks the cache.
3. If no fresh prices exist, the API creates or reuses an indexing job.
4. The API dispatches a background worker for the job.
5. The API returns `status: "indexing"` immediately, including any stale prices
   that already exist.
6. The worker marks the job `running`, resolves the region-specific product
   URLs, fetches the pages, extracts structured pricing, converts available
   prices to USD, and stores the results.
7. When at least one region completes successfully, the worker marks the job
   `complete` and updates the product name from the first successful extraction.

Expected result:

- The request stays fast and does not wait for scraping.
- Cached stale prices remain visible while the refresh runs.
- Only one active job exists per normalized product URL.

## Flow 3: Regional partial failure

1. The worker processes the configured regions independently.
2. One or more regions can fail because the site mapping is missing, the page
   fetch fails, extraction fails, or an exchange rate is unavailable.
3. Successful regions are still written to storage.
4. If at least one region succeeds, the job finishes as `complete`.

Expected result:

- A partial regional result set is still returned on future lookups.
- Failed regions do not erase successful prices from other regions.

## Flow 4: Regional product unavailable

1. The worker fetches a regional page successfully.
2. Extraction determines that the product is unavailable in that region.
3. The worker stores an `unavailable` price record for the region.

Expected result:

- The product snapshot includes `status: "unavailable"` for that region rather
  than silently omitting it.

## Flow 5: All regions fail

1. The worker starts the job.
2. Every region fails before a usable price or unavailable result can be stored.
3. The worker marks the job `failed` and stores a summarized error message.

Expected result:

- `GET /prices/status/:jobId` exposes the final `failed` state.
- A later lookup can create a new job and retry the product.

## Flow 6: Poll indexing status

1. The client submits `GET /prices/status/:jobId`.
2. The API loads the indexing job from storage.
3. The API returns the job id, product id, current status, tracked regions,
   creation timestamp, and optional completion timestamp or error.

Expected result:

- Clients can poll progress without resubmitting the lookup URL.

## Edge Cases

### Invalid URL

- If the submitted value is not a valid absolute URL, the API returns
  `400 Bad Request`.
- The response body includes `InvalidUrlError`.

### Unsupported brand

- If the hostname does not match a supported brand, the API returns
  `400 Bad Request`.
- The response body includes `UnsupportedBrandError`.

### Existing active job

- If a lookup already has a `pending` or `running` job, the API returns that
  job instead of creating a duplicate.

### Missing region mapping

- If the worker cannot resolve a brand-region URL, that region is recorded as a
  failure and the rest of the job continues.

### Missing indexing job

- If `GET /prices/status/:jobId` references an unknown job id, the API returns
  `404 Not Found`.

### URL normalization consistency

- URLs that differ only by tracking parameters, fragments, hostname casing, or a
  trailing slash map to the same normalized product URL.
