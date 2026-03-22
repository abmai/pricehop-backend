# AGENTS.md

Instructions for all AI agents and contributors working in this repository.

## Development Approach

1. **User flows first** — Before writing implementation code, create user flow docs in `docs/user-flows/` covering both happy paths and edge cases.
2. **Tests second** — Write unit tests and end-to-end tests that cover the documented user flows. Tests go in `tests/` (unit/integration) and `tests/e2e/` (end-to-end).
3. **Build until green** — Implement code in `src/` until all tests pass.

## Acceptance Criteria

All changes must meet these requirements before being considered complete:

- [ ] All new and modified code is covered by tests
- [ ] All new and existing end-to-end tests pass
- [ ] Self-review your own code up to 5 times and fix any issues found
- [ ] Docs in `/docs` are updated with any new architectural changes

## Project Structure

```
src/               # Application source code
tests/             # Unit and integration tests
tests/e2e/         # End-to-end tests
docs/              # Architectural docs and decisions
docs/user-flows/   # User flow documentation with edge cases
```

## Documentation Conventions

- **Naming:** All doc files must be prefixed with their creation date: `YYYY-MM-DD-descriptive-name.md`
  - Example: `2026-03-22-auth-flow.md`
  - **Never use incrementing numbers** (no `001-`, `002-`, etc.)
- **Location:** Architectural docs go in `docs/`, user flow docs go in `docs/user-flows/`
- **Updates:** When architecture changes, update or create a new dated doc — do not silently change existing docs without noting the update

## Testing Requirements

- Write tests before implementation when possible (TDD)
- End-to-end tests should mirror real user flows documented in `docs/user-flows/`
- Tests must cover edge cases identified in user flow docs
- All tests (new and existing) must pass before a change is considered complete
