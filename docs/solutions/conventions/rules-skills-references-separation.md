---
title: "Separation of Concerns Across Rules, Skills, and References"
date: "2026-10-12"
category: "conventions"
module: "datapack-engineering"
problem_type: "convention"
component: "documentation"
severity: "medium"
applies_when:
  - "Organizing agent plugin rules, skills, and technical reference documents"
  - "Preventing token bloat in global system prompt rules"
tags:
  - "documentation-architecture"
  - "agent-rules"
  - "skills-workflow"
  - "single-source-of-truth"
  - "context-window-optimization"
---

# Separation of Concerns Across Rules, Skills, and References

## Context
In agent plugin systems (such as Antigravity, Claude Code, and Codex plugins), documentation files operate at different execution lifecycles:
- **Global Rules (`rules/AGENTS.md`)**: Injected into the system prompt on every agent turn.
- **Skills (`skills/datapack-engineering/SKILL.md`)**: Loaded on-demand when the agent is directed to execute specific tasks.
- **References (`skills/datapack-engineering/references/code-conventions.md`)**: Read on-demand when deep domain knowledge or implementation syntax is required.

Without clear separation of concerns, documentation tends to duplicate content across all three tiers. In this codebase, the IMP-Doc v2 comment skeleton, 4-tier directory hierarchy descriptions, lifecycle entrypoint definitions (`load`, `tick`, `uninstall`, `reset`), and Minecraft 1.21.5+ unquoted text component warnings were repeated almost verbatim across `rules/AGENTS.md`, `skills/datapack-engineering/SKILL.md`, and `skills/datapack-engineering/references/code-conventions.md`.

This duplication caused:
1. **Unnecessary Token Consumption**: Every conversation turn loaded lengthy code blocks and verbose explanatory prose in the global system prompt.
2. **Synchronization Overhead & Drift Risk**: Modifying a convention required editing three separate files in lockstep.
3. **Loss of Focus**: The skill documentation acted like an encyclopedic reference rather than an actionable workflow orchestration guide.

## Guidance
Enforce a strict 3-tier documentation architecture based on lifecycle and consumer:

### 1. `rules/AGENTS.md` — Invariants & Hard Guardrails (Global System Context)
- **Purpose**: Non-negotiable policies, hard stop gates, and architectural boundaries.
- **Format**: Concise bullet points stating what MUST or MUST NOT happen.
- **Prohibitions**: Do not include large code skeletons, tutorial prose, philosophical rationales, or full resource naming tables. Delegate deep explanations to reference files.

### 2. `skills/<name>/SKILL.md` — Workflow & Orchestration (Skill Invocation Context)
- **Purpose**: Procedural guide for executing tasks (e.g., the 4-Stage Verification Pipeline).
- **Format**: Actionable instructions explaining *when* and *how* to invoke tools, verify intermediate outputs, and navigate templates.
- **Prohibitions**: Do not duplicate encyclopedic reference tables or detailed syntax tutorials. Provide a 1-2 sentence invariant summary and link directly to the relevant reference document.

### 3. `skills/<name>/references/<topic>.md` — Authoritative Specification (On-Demand Deep Reference)
- **Purpose**: Single Source of Truth (SSOT) for detailed syntax, design patterns, naming catalogs, and edge cases.
- **Format**: Comprehensive explanations, architectural diagrams (such as the Taxi Problem), code examples, and comparison tables.
- **Prohibitions**: Do not include agent execution mandates or auto-installation CLI instructions; focus strictly on domain specification.

## Why This Matters
- **Prompt Economy**: Streamlining `rules/AGENTS.md` saves context window tokens on every single turn for every interaction.
- **Single Source of Truth**: When conventions or language syntax evolve, changes are localized to `skills/datapack-engineering/references/code-conventions.md`.
- **Workflow Clarity**: The skill file remains a clean, actionable execution manual rather than an overwhelming reference text.

## When to Apply
- Architecting or refactoring agent rules, skills, and documentation in plugin repositories.
- Reviewing system prompt tokens when rules files become bloated with multi-line code examples.
- Establishing documentation standards across multiple collaborating skills.

## Examples
### Before (Triplicate Duplication)
- `rules/AGENTS.md`: Embedded a 10-line IMP-Doc v2 code skeleton, full paragraphs explaining actor qualification versus domain invariants, and 1.21.5+ text formatting examples.
- `skills/datapack-engineering/SKILL.md`: Re-embedded the same IMP-Doc v2 code skeleton, entrypoint definitions, and the entire scoreboard and entity tag naming hierarchy.
- `skills/datapack-engineering/references/code-conventions.md`: Re-embedded the same IMP-Doc v2 code skeleton, naming hierarchy, and entrypoint rules.

### After (Layered Separation)
- `rules/AGENTS.md`:
  Concise rules with pointers:
  - Header Standard: Functions must start with `#> <namespace>:path/to/function` and explicit `@reads`/`@writes` directives.
  - Visibility: Domain functions in the game tier must declare `@internal`; controllers in the user tier must declare `@context player`.
  - Pointers: Links to `skills/datapack-engineering/references/imp-doc-v2.md` and `skills/datapack-engineering/references/code-conventions.md`.

- `skills/datapack-engineering/SKILL.md`:
  Workflow execution with pointers:
  - Focuses on the 4-Stage Verification Pipeline.
  - Summarizes entrypoints and 4 functional tiers in single-line invariants.
  - Links to `skills/datapack-engineering/references/code-conventions.md` for complete tables and patterns.

- `skills/datapack-engineering/references/code-conventions.md`:
  Acts as the sole home for the complete IMP-Doc v2 directive details, full resource naming tables, and architectural code patterns.

## Related
- Implemented in branch `refactor/deduplicate-docs` (pending upstream PR).
- Core invariants verified by test suite in `tests/test-bootstrap.js`.
- Specification documents:
  - [rules/AGENTS.md](../../../rules/AGENTS.md)
  - [SKILL.md](../../../skills/datapack-engineering/SKILL.md)
  - [code-conventions.md](../../../skills/datapack-engineering/references/code-conventions.md)
