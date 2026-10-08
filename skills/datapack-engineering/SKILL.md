---
name: datapack-engineering
description: Core verification lifecycles, project coding conventions, directory hierarchy standards, and IMP-Doc v2 function contracts for Minecraft Java Edition datapacks. Use this skill whenever enforcing datapack conventions (Big 3 entrypoints, zzz private subroutines, naming rules), verifying NBT/components with mcdoc, analyzing project integrity with Spyglass, or writing IMP-Doc v2 function contracts and safe tick loops.
---

# Minecraft Datapack Engineering (Verification, Contracts & Conventions)

A comprehensive engineering standard defining the core verification lifecycle, directory structure, resource naming conventions, and IMP-Doc v2 function contracts for Minecraft Java Edition datapacks.

---

## 1. Core Engineering Workflow: The 4-Stage Lifecycle

Minecraft commands lack traditional compile-time type checking. Silent failures are the primary source of bugs. Always follow this 4-stage lifecycle, powered strictly by the companion [`datapack-mcp`](https://github.com/minkyet/datapack-mcp) plugin (MineCode & Spyglass Language Server). If `datapack-mcp` is not installed, operations must halt until the prerequisite MCP tools are present (see Section 4).

```mermaid
flowchart LR
    A[1. Pre-Implementation Check\nmcdoc / Syntax] --> B[2. Structured Implementation\nClean mcfunction Files]
    B --> C[3. Immediate File Diagnostics\nSingle-file mcdoc & Casing]
    C --> D[4. Project Integrity Gate\nCross-references & Tags]
```

### Stage 1: Pre-Implementation Specification Check
- **NBT & Component Schema**: Before using `summon`, `data modify`, or item components, inspect the authoritative schema via mcdoc symbols (e.g. `spyglass_get_mcdoc_symbol("minecraft::entity::Interaction")`).
  - *Critical Trap*: Minecraft silently ignores casing errors in NBT (e.g., `{Width: 4.0f}` instead of `{width: 4.0f}`). The entity will summon with default values and report success, causing silent runtime failures.
- **Brigadier Syntax**: Verify command arguments and subcommands before writing unfamiliar syntax using Brigadier usage tools (`get_command_usage`).

### Stage 2: Clean Implementation & Tool Safety
- Implement functions adhering strictly to coding conventions, IMP-Doc v2 contracts, and scheduled loop safety idioms.
- Avoid raw shell redirections (`cat << 'EOF'`). Always use dedicated, safe file editing tools to prevent character encoding corruption and shell escaping artifacts.

### Stage 3: Immediate Single-File Diagnostics
- Immediately after creating or updating any `.mcfunction` or `.json` file, run single-file static diagnostics (`spyglass_diagnose_file`).
- Verify mcdoc field name casing, SNBT syntax, and local selector arguments before proceeding to the next file.

### Stage 4: Project-Wide Integrity Analysis
- Before finishing any multi-file task, refactoring, or feature, run whole-project static analysis (`spyglass_analyze_project`).
- Ensure all function paths (`function <namespace>:...`), function tags (`#minecraft:tick`, `#minecraft:load`), and entity tags resolve correctly with zero undefined symbols or dead references.
*(Detailed guide: [references/verification-and-mcdoc.md](references/verification-and-mcdoc.md))*

---

## 2. Fundamental Engineering & Coding Conventions

### Rule 1: Function Formatting & IMP-Doc v2 Contracts
- **Mandatory Header Format**: Every `.mcfunction` file MUST start with the standard IMP-Doc v2 header:
  ```mcfunction
  #> <namespace>:path/to/function
  # Brief explanation (one-line summary)
  #
  # @context @root (or target context: player, entity, etc.)
  # @public / @internal / @private within <path>
  # @handles function_tag <tag> (include if triggered by function tag/advancement)
  # @reads / @writes / @input / @returns (include if applicable; explicit holders required)
  ```
- **Comment Hierarchy**:
  - Subsections/topic dividers in the function body use `##` without section numbers (e.g., `## Initialize variables`, never `## 1. Initialize variables`).
  - Contextual comments use `#` minimally, only for essential context.
- **Line Wrapping & Indentation**:
  - Trailing backslash (`\`) for long commands.
  - Continuation lines must use **4 spaces** indentation. Hard tabs (`\t`) are strictly prohibited.
- **Safe Tick Loop Pattern**:
  - Check `#stop_requested_*` at the very top of scheduled loops; if set, branch to cleanup and `return run`.
  - Reschedule at the bottom via `schedule function <function_name> 1t append`.
*(Detailed guides: [references/code-conventions.md](references/code-conventions.md) | [references/imp-doc-v2.md](references/imp-doc-v2.md))*

### Rule 2: Datapack Entry Points & Directory Hierarchy (`zzz` Pattern)
- **Lifecycle Entry Points**: In `data/<namespace>/function/` root, **ONLY** designated lifecycle entrypoints are permitted:
  - `load.mcfunction`: Registered in `#minecraft:load` (`data/minecraft/tags/function/load.json`, `@internal`, `@handles function_tag minecraft:load`). `@writes` directives are omitted to prevent header bloat. Must NEVER call `reset.mcfunction`.
  - `tick.mcfunction`: Registered in `#minecraft:tick` (`data/minecraft/tags/function/tick.json`, `@internal`, `@handles function_tag minecraft:tick`).
  - `reset.mcfunction`: Pre-distribution factory reset hook (`@public`). Resets runtime scores and temporary entities to pristine initial state, and calls `function <namespace>:load` at the end (strictly run during dev/pre-release; never during normal runtime; `load` must never call `reset`).
  - `uninstall.mcfunction`: Completely removes all created objectives, storages, bossbars, and entities to return the world to its pre-installation state (for standalone/library packs only; **strictly forbidden in map-dependent packs**).
- **Mandatory Subdirectory Placement**: Apart from the designated root entrypoints, **all other functions MUST reside in a subdirectory** (no loose functions in the root directory). A 3-domain structure (`game/`, `system/`, `data/`) is recommended, but other project-appropriate layouts are fully permitted.
- **Private Subroutine Functions (`zzz/`)**:
  - Functions dedicated to a specific parent function must be placed in a `zzz/` folder inside the parent's directory (e.g. `system/timer/zzz/tick_helper.mcfunction`).
  - Subroutines must declare `@private within <namespace>:path/to/parent` pointing explicitly to the parent function ID.
*(Detailed guide: [references/code-conventions.md](references/code-conventions.md))*

### Rule 3: Namespace & Resource Naming Standards
- **Datapack Name & Namespace**: Follow `snake_case` (`^[a-z0-9_.-]+$`). The namespace must match the datapack name (`<namespace>` == datapack name). Only 1 custom namespace per pack (+ `minecraft`).
- **Scoreboard Objectives**:
  - Global state: `<namespace>`
  - General dummy: `<namespace>.<role>`
  - Display (sidebar, belowname): `<namespace>.display.<role>`
  - Constants: `<namespace>.const` | Temp calculation: `<namespace>.temp`
  - Non-dummy criteria: `<namespace>.<criteria>.<role>`
- **Fake Players (Score Holders)**: Use `snake_case`:
  - General registers: `#` prefix (e.g. `#time`, `#mob_count`)
  - Constants: `##` prefix (e.g. `##20`, `##3600`)
  - Display / HUD slots: `$` prefix (e.g. `$line1`, `$line6`)
- **Other Resources**:
  - Entity tags: `<namespace>.<role>[.<subrole>]`
  - Storage: `<namespace>:<table>` | Bossbars: `<namespace>:<name>`
  - Item custom_data: `[custom_data={<namespace>:{<nbt>}}]`
*(Detailed guide: [references/code-conventions.md](references/code-conventions.md))*

---

## 3. Quick-Start Assets & Templates

Reusable boilerplate templates are located in `assets/templates/`:
- `assets/templates/pack.mcmeta`: Modern pack metadata template.
- `assets/templates/function_template.mcfunction`: IMP-Doc v2 documented function skeleton adhering to the header standard.
- `assets/templates/entrypoints/`: Lifecycle entrypoint templates (`load.mcfunction`, `tick.mcfunction`, `reset.mcfunction`, `uninstall.mcfunction`).
- `assets/templates/loops/safe_tick_loop.mcfunction`: Safe scheduled loop with stop flag check.

---

## 4. Mandatory Dependency Gate: `datapack-mcp` Prerequisite

`datapack-engineering` is intentionally designed with a strict dependency on [`datapack-mcp`](https://github.com/minkyet/datapack-mcp). Minecraft command execution has no compile-time checking; attempting to write or refactor datapacks without Spyglass static type checking and MineCode syntax verification undermines engineering safety and introduces silent failures.

- **Non-Negotiable Prerequisite**: If `spyglass_*` (`spyglass_diagnose_file`, `spyglass_analyze_project`) or `minecode_*` tools are not available in the active toolset, **this skill MUST NOT proceed**.
- **Action Required**: The agent must halt immediately and instruct the user to install `datapack-mcp`:
  - **Claude Code**: `/plugin install datapack-mcp`
  - **Antigravity CLI**: `agy plugin install https://github.com/minkyet/datapack-mcp`
  - **Codex CLI**: `codex plugin add datapack-mcp@datapack-mcp-marketplace`

