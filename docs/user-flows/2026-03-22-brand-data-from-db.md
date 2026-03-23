# Brand Data From DB User Flow

Date: 2026-03-22

## Scope

This flow documents how brand identity and regional URL rules are loaded from
Convex-backed tables instead of hardcoded source files. The same seeded brand
data is used by request-time brand detection and background indexing URL
resolution.

## Flow 1: Seeded brand data is available at startup

1. The application creates an in-memory Convex store for local development,
   tests, or the app runtime.
2. Store initialization seeds `brands` and `brand_urls` with the supported
   brand definitions and all regional URL mappings.
3. Services read from those tables through the Convex client abstraction.

Expected result:

- Every supported brand has a canonical `baseHost`.
- Every supported region has one `brand_urls` row per brand.
- No request path depends on hardcoded brand constants.

## Flow 2: Brand detection reads hostnames from storage

1. A client submits `POST /prices/lookup` with a supported product URL.
2. `BrandDetector` loads all brand records and brand URL records from storage.
3. The detector builds a hostname map from both each brand's `baseHost` and any
   regional site hosts.
4. The detector matches the normalized hostname to one of the seeded brands.

Expected result:

- Global hosts such as `www.cartier.com` resolve correctly.
- Regional hosts such as `www.tiffany.co.kr` also resolve correctly.

## Flow 3: Region resolution reads URL transforms from storage

1. The indexing worker starts a regional lookup for a product and region.
2. `RegionResolver` loads the brand row by name, then the `brand_urls` row for
   the target region.
3. The resolver applies the stored transform:
   `path-preserve` keeps the product path on a regional domain,
   `locale-prefix` swaps locale segments on the shared host.

Expected result:

- Tiffany regional lookups move to the correct country domain.
- Shared-host brands reuse the same domain with the seeded locale prefix.

## Edge Cases

### Missing brand row

- If a brand name is not present in `brands`, regional URL resolution fails for
  that job with a descriptive scraping error.

### Missing region mapping

- If a brand exists but has no `brand_urls` row for the target region, only
  that region fails and the rest of the indexing job can continue.

### Duplicate seeding attempt

- If the in-memory store is already seeded, the seed step is skipped so tests
  and local runtimes do not duplicate brand records.
