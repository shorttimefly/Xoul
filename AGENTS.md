# AI Coding Governance

This repository uses a cautious local AI coding workflow. Optimize for correct, bounded, verified code with minimum sufficient context.

## Default Loop

1. Classify the task and state assumptions for non-trivial work.
2. Search before reading and inspect only relevant entrypoints and conventions.
3. Plan edits and verification before changing files.
4. Make surgical changes only; preserve unrelated work.
5. Verify with deterministic checks and browser-visible checks when practical.
6. Report changes, verification, residual risk, and review focus.

## Quality Rules

- Do not weaken tests, hide errors, or claim completion without evidence.
- Treat uncommitted changes as user-owned unless clearly part of the current task.
- Keep production deployment changes isolated and reversible.
