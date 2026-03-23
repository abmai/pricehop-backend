# Price Lookup User Flow

Date: 2026-03-22

## Scope

This flow covers the MVP backend behavior for price lookups across four supported
brands and ten supported regions.

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
2. The API normalizes the URL by removing query parameters, fragments, redundant
   trailing slashes, and lowercasing the hostname.
3. The API detects the brand from the normalized hostname.
4. The API reads the product and region prices from storage.
5. If prices exist and the latest fetch is still fresh, the API returns
   `status: "complete"` with the normalized product URL, brand, product name,
   prices, and `fetchedAt`.

Expected result:

- The response contains all currently cached prices.
- No indexing job is created.

## Flow 2: No prices exist yet

1. The client submits `POST /prices/lookup` with a supported brand URL.
2. The API normalizes the URL and detects the brand.
3. The API does not find cached prices for the product.
4. The API creates or reuses a product record.
5. The API creates an indexing job for all supported regions.
6. The API returns `status: "indexing"` with the job identifier, normalized URL,
   detected brand, an empty `prices` array, and a progress message.

Expected result:

- The product is tracked even when prices are not yet available.
- Only one active indexing job exists per normalized product URL.

## Flow 3: Stale prices exist

1. The client submits `POST /prices/lookup` for a product with cached but stale
   prices.
2. The API normalizes the URL and detects the brand.
3. The API finds cached prices, but the newest `fetchedAt` is older than the
   freshness threshold.
4. The API creates or reuses an active indexing job.
5. The API returns `status: "indexing"` with the active job id and the stale
   prices as partial data.

Expected result:

- Consumers can render partial pricing while a refresh is in progress.
- A duplicate job is not created if one is already pending or running.

## Flow 4: Check indexing status

1. The client submits `GET /prices/status/:jobId`.
2. The API loads the indexing job from storage.
3. The API returns the job id, product id, current status, tracked regions,
   creation timestamp, and optional completion timestamp or error.

Expected result:

- Clients can poll progress without repeating the lookup request.

## Edge Cases

### Invalid URL

- If the submitted string is not a valid absolute URL, the API returns
  `400 Bad Request`.
- The response body includes an `InvalidUrlError` code.

### Unsupported brand

- If the hostname does not match one of the supported brands, the API returns
  `400 Bad Request`.
- The response body includes an `UnsupportedBrandError` code.

### Existing active job

- If a lookup requires indexing and an active job already exists for the product,
  the API returns the existing job id instead of creating another job.

### Missing job status

- If `GET /prices/status/:jobId` references an unknown job id, the API returns
  `404 Not Found`.

### URL normalization consistency

- URLs that differ only by tracking parameters, fragments, hostname casing, or a
  trailing slash map to the same normalized product URL.
