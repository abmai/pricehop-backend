---
name: plan-with-claude
description: Build an execution plan for a user request, send that plan to Claude Code through the Claude CLI in headless mode for structured critique, revise the plan, and repeat until both Codex and Claude agree the plan is ready. Use when the user asks for a plan, implementation strategy, migration plan, rollout plan, or extra edge-case review before coding or operational work.
---

# Plan With Claude

## Overview

Turn a user request into a reviewed execution plan instead of replying with the first draft. Persist the task, evolving plan, and Claude feedback in `.context/plan-with-claude/` so the review loop is inspectable and resumable.

## Workflow

### 1. Capture the task

Write the original user request to `.context/plan-with-claude/task.md`. Add any constraints, repo facts, deadlines, dependencies, or explicit non-goals that materially affect the plan.

### 2. Draft the first plan

Draft a first-pass plan in `.context/plan-with-claude/plan-v1.md` before asking Claude anything. Use [references/review-rubric.md](./references/review-rubric.md) to cover scope, sequencing, verification, and edge cases.

Make the plan concrete:

- Break work into ordered steps.
- State assumptions explicitly.
- Call out tests, verification, and rollback or mitigation when risk is non-trivial.
- Include edge cases that would change implementation or sequencing.

### 3. Send the plan to Claude headlessly

Run the bundled wrapper instead of hand-building the Claude CLI call:

```bash
python3 skills/plan-with-claude/scripts/review_plan_with_claude.py \
  --task-file .context/plan-with-claude/task.md \
  --plan-file .context/plan-with-claude/plan-v1.md \
  --history-file .context/plan-with-claude/review-history.md
```

The wrapper calls `claude -p` with only structured output enabled, an empty MCP configuration, and a strict JSON schema. Claude returns:

- `approved`
- `summary`
- `blocking_gaps`
- `edge_cases`
- `improvements`
- `questions`

Write the response to `.context/plan-with-claude/review-v1.json`.

### 4. Revise and iterate

Revise the plan yourself after reading Claude's feedback. Do not accept Claude output blindly; reconcile it with the repository state and the user request. Save each revision as a new file such as `.context/plan-with-claude/plan-v2.md`.

Run the wrapper again for each revision and keep the review history up to date. Default to at most 3 review rounds. Go past 3 only when the remaining disagreement is narrow and likely resolvable.

### 5. Stop only at real consensus

Treat the plan as approved only when all of the following are true:

- Claude returns `approved: true`.
- Claude reports no blocking gaps.
- You independently agree the plan is executable and covers the meaningful edge cases for this task.
- Any remaining questions are either answered, converted into explicit assumptions, or surfaced to the user as blockers.

If Claude is unavailable, unauthenticated, or errors repeatedly, say that clearly and stop rather than pretending the external review happened.

## Output Format

When you respond to the user, include:

- The final approved plan.
- The highest-value issues Claude caught during review.
- Any assumptions or residual risks that remain.

Keep the answer concise. The goal of this skill is a vetted plan, not a transcript dump.

## Resources

- [scripts/review_plan_with_claude.py](./scripts/review_plan_with_claude.py): Run Claude headlessly with a strict review schema.
- [references/review-rubric.md](./references/review-rubric.md): Use this checklist when drafting and revising plans.
