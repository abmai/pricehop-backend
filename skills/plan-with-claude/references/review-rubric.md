# Plan Review Rubric

Use this rubric before each Claude review pass and again before declaring consensus.

## Core Checks

- Confirm the plan matches the user's actual goal and deliverable.
- State assumptions, constraints, and unknowns that affect the approach.
- List dependencies, required access, and prerequisites.
- Sequence the work in the order it should be executed.
- Define how success will be verified.

## Edge Cases

- Call out failure modes, invalid inputs, and partial-success scenarios.
- Include data migration, backward compatibility, or rollback steps when relevant.
- Include security, performance, cost, and observability concerns when relevant.
- Identify environment-specific issues such as local, CI, staging, or production differences.

## Review Questions

- What could make this plan fail after implementation starts?
- Which assumptions would force a different design if they are false?
- Which parts of the plan are hardest to test or validate?
- What would an operator or maintainer need that the current plan omits?
