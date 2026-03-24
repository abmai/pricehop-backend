# Bright Data Unlocker Configuration Update

Date: 2026-03-23

## Summary

The page-fetch integration now aligns with Bright Data's current Unlocker API
documentation for direct API access.

## Changes

- The runtime no longer assumes a default Bright Data zone name.
- Bright Data is used only when both `BRIGHTDATA_API_KEY` and an explicit
  Unlocker zone name are configured.
- The preferred env var is `BRIGHTDATA_WEB_UNLOCKER_ZONE`.
- `BRIGHTDATA_ZONE` remains supported as a legacy fallback during migration.
- The Bright Data request body can now include `x-unblock-expect` through the
  documented `headers` payload when callers provide a `waitSelector`.

## Why

Bright Data's current Unlocker API docs still require a concrete zone name in
the request body, sourced from the Unlocker API zone overview in the control
panel. Guessing `web_unlocker1` was not a valid default and could produce
misconfigured requests in real deployments.
