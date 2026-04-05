# ScrapingBee Integration Architecture

Replaces Bright Data Web Unlocker with ScrapingBee for product data extraction and cross-country search.

## Overview

ScrapingBee provides two APIs used by the indexing worker:

1. **AI Extraction** (`/api/v1` with `ai_extract_rules`) — Fetches a URL and returns structured data extracted by AI: product name, price, currency, SKUs, country code, and availability. Replaces the previous PageFetcher + PriceExtractor pipeline.

2. **Fast Search** (`/api/v1/fast_search`) — Searches for products by query string within a specific country. Returns URLs of matching pages. Replaces the previous RegionResolver's deterministic URL transforms.

## Environment Variables

| Variable | Source | Required | Description |
|----------|--------|----------|-------------|
| `SCRAPINGBEE_API_KEY` | Doppler | Yes | ScrapingBee API key |

## Flow Diagram

```
POST /prices/lookup { url }
  │
  ├─ Normalize URL → Detect brand → Check cache
  │
  ├─ [Fresh cache] → Return 200 with prices
  │
  └─ [Stale/missing] → Create indexing job → Return 202
       │
       └─ IndexingWorker.processJob(jobId)
            │
            ├─ 1. ScrapingBee extractProduct(sourceUrl)
            │     → { name, price, currency, skus, countryCode, available }
            │
            ├─ 2. Update product record (name, SKUs)
            │
            ├─ 3. Source region price write (if country is supported)
            │     → Effect.either (isolated from target loop)
            │
            ├─ 4. For each target region in job.regions (concurrency: 3):
            │     │
            │     ├─ Look up brand_urls.baseUrl for region
            │     ├─ ScrapingBee searchProduct(query, countryCode)
            │     ├─ Validate: hostname matches brand's regional host
            │     ├─ ScrapingBee extractProduct(foundUrl)
            │     ├─ Validate: country matches target region
            │     ├─ Validate: SKU overlap with source product
            │     ├─ Resolve currency, determine confidence
            │     └─ upsertPrices() for region
            │
            └─ 5. Tally results → Update job status
```

## Service Architecture

```
ScrapingBeeService (new)
  ├─ extractProduct(url) → ScrapingBeeExtractedData
  └─ searchProduct(query, countryCode) → string | null

IndexingWorker (rewritten)
  ├─ depends on: ScrapingBeeService, ConvexClient, CurrencyConverter
  └─ no longer depends on: PageFetcher, PriceExtractor, RegionResolver
```

## Data Integrity Guarantees

- Only `available: false` from a validated extraction writes "unavailable" to the DB
- Transient failures (API errors, search misses, wrong host/country) never overwrite existing cached prices
- Product identity validated via SKU overlap before storing search-discovered prices
- Unsupported currencies cause per-region failure, not incorrect conversion
- Jobs never stuck in "running" state — top-level error handler ensures terminal state
