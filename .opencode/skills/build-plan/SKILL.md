---
name: build-plan
description: >
  Build order, phase scope, acceptance criteria, and review gates for CIDA Craft.
  Load at the start of every session before touching code; states the current phase.
---

# build-plan

The master copy of the plan is **`PLAN.md` at the repo root**. This skill is an index into it —
never duplicate phase details here.

## Session protocol

1. Read `PLAN.md` → "Phase status overview".
2. State the current phase (and its gates) to the user before writing any code.
3. Work only inside that phase's Scope. If a task crosses into another phase, say so and
   propose moving it or sequencing it after.
4. On completion, tick the phase's acceptance criteria checkboxes in `PLAN.md` and advance
   its Status: `pending` → `in-progress` → `in-review` → `done`.

## Where to find things in PLAN.md

| Need                                             | Section                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Which phase, what status                         | Phase status overview                                                              |
| What a phase includes / excludes                 | That phase's **Scope**                                                             |
| Definition of done                               | That phase's **Acceptance criteria**                                               |
| Blocking reviews                                 | That phase's **Gates** (`@schema-review`, `@payments-review`, `@bilingual-review`) |
| Settled choices (pnpm, CI, provider abstraction) | Decisions log D1–D5                                                                |

## Rules

- One phase = one PR. Conventional Commits.
- Gates are blocking: do not merge P5/P6 without `@payments-review`; no migration merges
  without `@schema-review`; publishable UI/content needs `@bilingual-review`.
- AGENTS.md non-negotiables apply to every phase by reference — they are not restated in PLAN.md.
- When a requirement touches money, tax, or government policy and is ambiguous: stop and ask.
