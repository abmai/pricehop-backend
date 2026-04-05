# ScrapingBee Price Lookup Flow

Replaces the Bright Data + PriceExtractor + RegionResolver pipeline with ScrapingBee AI extraction and fast search.

## Happy Path

1. User submits URL via `POST /prices/lookup`
2. URL is normalized, brand detected, cache checked (existing pipeline unchanged)
3. If stale/missing: create indexing job, dispatch to worker
4. Worker extracts source product via ScrapingBee AI extraction (name, price, currency, SKUs, countryCode, available)
5. Product record updated with name and SKUs
6. Source country mapped to Region via ISO alpha-2 code; if supported and in `job.regions`, source price stored
7. For each remaining region in `job.regions` (concurrency: 3):
   - Look up brand's regional hostname from `brand_urls`
   - Build search query from product name + SKUs + country name
   - Search via ScrapingBee fast_search for that country
   - Validate search result URL against brand's regional hostname
   - Extract product data from found URL
   - Validate extracted country matches target region
   - Validate product identity via SKU overlap
   - Parse price, convert to USD, store in Convex
8. Job marked "complete" if at least one region succeeds

## Edge Cases

### Source extraction fails
- Job marked "failed" with error message
- No regions attempted

### Source country not in supported regions
- Product record still updated (name, SKUs)
- Source price NOT stored (no supported region to write to)
- All `job.regions` still searched via fast_search

### fast_search returns empty results (null)
- Treated as a **failure** — search miss is not proof of unavailability
- Existing cached price for that region preserved (no DB write)

### fast_search API/network error
- `ScrapingError` propagated through Effect error channel
- Treated as a **failure** — no DB write, existing cached price preserved

### Search URL hostname doesn't match brand's regional baseUrl
- Treated as a **failure** — non-deterministic miss (could be competitor/marketplace page)
- No DB write, existing cached price preserved

### Extracted country doesn't match target region
- Treated as a **failure** — wrong-country page
- No DB write, existing cached price preserved

### SKU mismatch between source and search-discovered product
- If both have SKUs and no overlap: treated as a **failure** (wrong product)
- If one/both lack SKUs: proceed with reduced confidence ("low")
- No DB write on mismatch

### Extraction succeeds but `available: false`
- Store "unavailable" in prices table — positive determination from extraction
- Confidence: "high" for source URL, "medium" for search-discovered URL

### Extraction succeeds but price missing/unparseable
- Treated as a **failure** — incomplete extraction is not proof of unavailability
- No DB write, existing cached price preserved

### Extracted currency is unsupported
- Present but not in the `CurrencyCode` set → treated as a **failure** (cannot convert)
- No DB write

### Missing `brand_urls` row for a region
- That region treated as a **failure** (missing brand metadata)
- Other requested regions still run

### Source conversion/write fails
- Isolated via `Effect.either` — does not block target-region processing
- Counted as a failure in final tally

## Key Distinction: Unavailable vs Failure

| Outcome | DB Write? | When |
|---------|-----------|------|
| **Unavailable** | Yes — `status: "unavailable"` | Validated extraction says `available: false` |
| **Failure** | No — preserve existing cache | Everything else: API errors, empty search, wrong host/country, SKU mismatch, parse errors |

Only `available: false` from a country-validated, identity-validated extraction writes "unavailable" to the prices table. All other non-success outcomes are failures that preserve existing cached prices.

## Confidence Policy

| Scenario | Confidence |
|----------|------------|
| Source URL, currency matches expected or absent | `"high"` |
| Source URL, currency valid but differs | `"medium"` |
| Source URL, unavailable | `"high"` |
| Search-discovered, currency matches + SKUs verified | `"medium"` |
| Search-discovered, currency matches but no SKU comparison | `"low"` |
| Search-discovered, currency valid but differs | `"low"` |
| Search-discovered, unavailable | `"medium"` |
