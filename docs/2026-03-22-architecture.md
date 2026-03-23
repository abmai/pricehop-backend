# Price Lookup Backend Architecture

Date: 2026-03-22

## Overview

The MVP backend separates synchronous request handling from asynchronous product
indexing. The request layer is responsible for validation, normalization, cache
lookup, and job orchestration. The indexing layer is intentionally a placeholder
that can later be replaced with brand-specific scraping and extraction logic.

## Request Layer

The request layer is a Hono application executed on Bun. Business logic is
modeled with Effect services and composed through a runtime layer.

Main entry points:

- `POST /prices/lookup`
- `GET /prices/status/:jobId`

Primary responsibilities:

- Normalize product URLs
- Detect supported brands
- Read cached products and prices
- Decide whether cached data is fresh
- Create or reuse indexing jobs
- Return a stable response contract

## Indexing Layer

The indexing layer is represented by Convex-oriented modules and a placeholder
indexer action. The placeholder exists to preserve the contract between the API
and future background workers without implementing scraping in this iteration.

Primary responsibilities:

- Accept normalized product URLs and detected brands
- Track requested regions
- Persist lifecycle state for indexing jobs
- Provide an integration point for future extraction logic

## Domain Model

Tables and logical entities:

- `products`
  - `normalizedUrl`
  - `brand`
  - `productName`
  - `rawUrl`
  - `createdAt`
- `prices`
  - `productId`
  - `region`
  - `currency`
  - `localPrice`
  - `usdPrice`
  - `exchangeRate`
  - `confidence`
  - `fetchedAt`
- `indexingJobs`
  - `productId`
  - `status`
  - `regions`
  - `error`
  - `createdAt`
  - `completedAt`
- `exchangeRates`
  - `currency`
  - `rateToUsd`
  - `fetchedAt`

## Service Boundaries

- `UrlNormalizer`: canonicalizes user-submitted URLs
- `BrandDetector`: resolves a supported brand from hostname
- `PriceLookup`: loads products and prices, computes freshness
- `IndexingJobService`: creates or reuses active jobs and fetches status
- `CurrencyConverter`: converts local amounts into USD
- `ExchangeRateService`: reads cached FX rates

## Freshness Model

Cached prices are considered fresh when their latest `fetchedAt` falls within
the configured freshness window. If a product has no prices or only stale
prices, the API returns `status: "indexing"` and triggers a job while returning
stale prices when available.

## Error Model

Errors are modeled as tagged domain errors and translated to HTTP responses:

- `InvalidUrlError` → `400`
- `UnsupportedBrandError` → `400`
- `ProductNotFoundError` → internal pipeline signal, not directly returned
- `IndexingInProgressError` → internal pipeline signal, mapped to existing job
- `ExchangeRateError` → `502` when needed in future conversion flows
- `CacheError` → `500`

## Storage Strategy

This iteration uses storage abstractions that mirror the planned Convex schema.
That keeps the request and pipeline code aligned with the long-term design while
remaining testable in isolation. The `convex/` directory documents the intended
schema and query surfaces for later replacement with real Convex functions.
