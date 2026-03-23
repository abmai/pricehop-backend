# On-Demand Scraper Architecture

Date: 2026-03-22

## Overview

The backend now separates lookup request handling from asynchronous indexing.
The synchronous API layer normalizes URLs, detects brands, checks cached data,
and creates or reuses indexing jobs. A background worker resolves regional URLs,
fetches product pages, extracts price data, converts available prices to USD,
and persists the updated product snapshot.

## Main Components

- `UrlNormalizer`
  - Canonicalizes incoming product URLs.
- `BrandDetector`
  - Detects the supported brand from the normalized hostname.
- `IndexingJobService`
  - Creates or reuses active jobs and exposes job status.
- `IndexingDispatcher`
  - Starts background work without blocking the request lifecycle.
- `IndexingWorker`
  - Orchestrates region resolution, page fetches, extraction, conversion, and
    job status updates.
- `RegionResolver`
  - Uses the manually maintained regional site schema to map a canonical product
    URL to a region-specific product URL.
- `PageFetcher`
  - Fetches HTML through Steel when `STEEL_API_KEY` is configured.
  - Falls back to a direct HTTP fetcher locally so the app remains runnable
    without cloud browser credentials.
- `PriceExtractor`
  - Uses OpenRouter through the OpenAI-compatible SDK when
    `OPENROUTER_API_KEY` is configured.
  - Falls back to rule-based extraction from JSON-LD, meta tags, headings, and
    visible price text when credentials are absent or the provider fails.
- `CurrencyConverter`
  - Converts available local prices into USD using cached exchange rates.

## Regional URL Resolution

Regional URL resolution is schema-driven and requires no network discovery.

- `src/domain/brandRegistry.ts`
  - Defines each supported brand and its canonical base host.
- `src/domain/regionalSites.ts`
  - Defines brand-region entries with:
    - `baseUrl`
    - `urlTransform`
    - optional `localePrefix`

Supported transforms:

- `path-preserve`
  - Keeps the original product path and swaps only the regional base URL.
- `locale-prefix`
  - Removes any leading locale segment from the original path and prefixes the
    path with the configured target locale.

This keeps the lookup deterministic and cheap while remaining easy to maintain
as new brands are added.

## Indexing Lifecycle

1. `POST /prices/lookup` checks the cache.
2. When prices are missing or stale, the API creates or reuses an indexing job.
3. The dispatcher forks the worker and returns `202 Accepted`.
4. The worker marks the job `running`.
5. Each region is processed independently with bounded concurrency.
6. Successful regional results are upserted immediately.
7. If at least one region succeeds, the job is marked `complete`.
8. If all regions fail, the job is marked `failed` with a summarized error.

Unavailable products are persisted explicitly so consumers can distinguish
between “not found in this region” and “not processed yet”.

## Extraction Model

The extraction contract returns:

- `productName`
- `sku`
- `available`
- `localPrice`
- `currency`
- `confidence`

The worker treats extraction success and fetch success separately:

- Fetch failures produce regional job failures.
- Extraction failures produce regional job failures.
- Successful extractions with `available: false` are stored as unavailable
  records and still count as successful processing.

## Storage Model

The in-memory Convex-shaped storage now stores two price record forms:

- Available prices with:
  - `currency`
  - `localPrice`
  - `usdPrice`
  - `exchangeRate`
  - `confidence`
- Unavailable prices with:
  - `status: "unavailable"`
  - `fetchedAt`

This keeps the request response model aligned with future Convex deployment
while supporting the actual scraper lifecycle in tests and local development.

## Runtime and Testability

The runtime is still assembled with Effect layers. Page fetchers, extractors,
and dispatchers can be overridden in tests, which keeps the end-to-end flow
deterministic without requiring live Steel or OpenRouter credentials.
