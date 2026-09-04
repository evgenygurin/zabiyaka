# SDD ledger — plan: docs/superpowers/plans/2026-09-04-zabiyaka.md

## Pre-flight

- Workspace: /Users/laptop/dev/zabiyaka
- Branch: feat/zabiyaka-sdd (isolated from main)
- Baseline: repository contains only design spec and implementation plan; no package.json or tests yet.
- OpenCode: 1.18.27 installed.
- Local @opencode-ai/plugin V2 typings discovered under OpenCode package caches.

## Plan scan

| Task | Shared files/interfaces | Finding | Ruling |
|---|---|---|---|
| 1 ↔ 2 | index.ts/project metadata | Task 1 owns scaffold; Task 2 adds context module. No conflict. | Proceed. |
| 2 ↔ 3 | ConversationMessage | Task 2 produces the message shape consumed by Task 3. | Proceed. |
| 3 ↔ 4 | SemanticAssessment | Task 3 defines validated categories consumed by Task 4. | Proceed. |
| 3 ↔ 5 | SemanticAssessment | Task 3 output consumed by intervention policy. | Proceed. |
| 4 ↔ 5 | aggression/state getter | Task 4 owns aggression transitions; Task 5 reads aggression. | Proceed. |
| 5 ↔ 6 | probability function | Task 5 depends on a decision policy whose numerical mapping is contradicted by the spec text. | Task 6 resolves against spec authority before integration. |
| 6 ↔ 7 | category/confidence policy | Resolved policy must be used by classifier integration. | Proceed after ruling. |
| 7 ↔ 8 | model context | Classification and generation both use verified OpenCode model access. No ownership conflict. | Proceed. |
| 7 ↔ 9 | classifier/state pipeline | Task 9 wires existing classifier/state components. | Proceed. |
| 8 ↔ 9 | generation/output | Task 9 invokes generator; no duplicate ownership. | Proceed. |
| 9 ↔ 10 | plugin entry point | Task 10 documents loader path and manual verification. | Proceed. |
| 10 ↔ 11 | acceptance verification | Task 11 performs final verification after docs/manual checks. | Proceed. |

## Self-consistency scan

| Task | Self-consistency | Ruling |
|---|---|---|
| 1 | Tests/scaffold/API verification are internally consistent once exact installed API is used. | Proceed. |
| 2 | Tests match 20-message sliding-window interface. | Proceed. |
| 3 | Tests match five-category validation contract. | Proceed. |
| 4 | Tests match stated category deltas and clamping. | Proceed. |
| 5 | Numeric mapping matches spec values but is intentionally revisited in Task 6. | Proceed; Task 6 binding ruling. |
| 6 | Explicitly resolves the formula/value contradiction before integration. | Proceed. |
| 7 | Depends on verified API and Task 6 policy; interface is narrow. | Proceed. |
| 8 | Keeps LLM wording subordinate to plugin behavior contract. | Proceed. |
| 9 | Owns event wiring and orchestration only. | Proceed. |
| 10 | Documentation/manual verification is separated from runtime logic. | Proceed. |
| 11 | Final verification/review/branch completion is last. | Proceed. |

## Rulings

- Ruling: Use OpenCode APIs from the installed 1.18.27 plugin typings, not examples from older docs — the project must run against the user's installed OpenCode version; cost if wrong is API mismatch requiring adjustment.
- Ruling: Do not add a Superpowers dependency — the spec explicitly excludes it; cost if wrong is violating the core product boundary.
- Ruling: Do not modify main directly — SDD requires isolated work; cost if wrong is contaminating the user's main branch.


## Completed implementation work

- Task 1: OpenCode plugin scaffold — commit ed1f9f5.
- Task 2: 20-message context — commit debfcad.
- Task 3: semantic validation — commit d0926be.
- Task 4: aggression state — commit 2464166.
- Task 5/6: adaptive intervention + formula ruling — commit 56a4b27; spec midpoint corrected to 13.5%.
- Task 7: model-backed semantic classification contract — commit 707473f.
- Task 8: bounded generation — commit 2edbb9b.
- Task 9: deterministic runtime flow — commit 2a0180a.
- OpenCode adapter/config tests are currently uncommitted pending final review.
