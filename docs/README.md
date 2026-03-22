# Documentation

This directory contains architectural documentation and design decisions for pricehop-backend.

## Structure

- `docs/` — Architecture docs, design decisions, technical references
- `docs/user-flows/` — User flow documentation covering happy paths and edge cases

## Naming Convention

All files must be prefixed with their creation date:

```
YYYY-MM-DD-descriptive-name.md
```

Examples:
- `2026-03-22-api-design.md`
- `2026-03-22-checkout-flow.md`

**Never use incrementing numbers** (no `001-`, `002-`, etc.). The date prefix provides natural chronological ordering and avoids merge conflicts from competing number sequences.
