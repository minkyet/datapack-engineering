# Minecraft Datapack Engineering Agent Guardrails

These rules define the required engineering standards, mandatory dependency enforcement, and static verification guardrails when developing Minecraft Java Edition datapacks with the `datapack-engineering` plugin active.

---

## 1. Strict Dependency Gate: `datapack-mcp` Prerequisite

`datapack-engineering` is architecturally coupled to the companion plugin [`datapack-mcp`](https://github.com/minkyet/datapack-mcp) (which provides MineCode Brigadier/version reference and Spyglass Language Server AST/mcdoc diagnostics).

### Pre-Flight Verification & Hard Stop
At the start of any datapack engineering task, check whether `spyglass_*` (`spyglass_diagnose_file`, `spyglass_analyze_project`) and `minecode_*` tools are present in your active toolset:

1. **If MCP tools are missing**:
   - If the environment supports CLI tool execution, attempt auto-installation immediately:
     - **Antigravity CLI**: `agy plugin install https://github.com/minkyet/datapack-mcp`
     - **Codex CLI**: `codex plugin add datapack-mcp@datapack-mcp-marketplace`
     - **Claude Code**: Inform the user: `💡 Notice: Run '/plugin install datapack-mcp' to enable required MCP tools.`
2. **Hard Stop Policy (No Fallback)**:
   - If `datapack-mcp` is not installed or tools cannot be provisioned:
     - **YOU MUST HALT EXECUTION IMMEDIATELY.**
     - **DO NOT** attempt to scaffold, write, or modify `.mcfunction` or `.json` files.
     - **DO NOT** attempt manual guessing or unstructured fallback checklists.
     - Inform the user that `datapack-engineering` strictly requires `datapack-mcp` to prevent silent runtime failures, and request installation of `datapack-mcp` before proceeding.

---

## 2. Core Engineering Standards & Conventions

### Function Headers (IMP-Doc v2)
Every `.mcfunction` file MUST start with an IMP-Doc v2 header:
```mcfunction
#> <namespace>:path/to/function
# Brief one-line summary
#
# @context @root (or player, entity, etc.)
# @public / @internal / @private within <parent_path>
# @handles function_tag <tag> (if triggered by #minecraft:load, etc.)
# @reads score / @writes score (explicit score holders, no *)
```

### Directory Hierarchy & Entrypoint Hygiene
- **Root Function Directory (`data/<namespace>/function/`)**:
  - ONLY designated lifecycle entrypoints are permitted: `load.mcfunction`, `tick.mcfunction`, `reset.mcfunction` (pre-release factory reset), and `uninstall.mcfunction` (standalone libraries only).
  - `load` MUST NEVER call `reset`.
  - All other logic MUST reside in categorized subdirectories (e.g. `game/`, `system/`, `data/`).
- **Private Subroutines (`zzz/`)**:
  - Dedicated helper functions must be placed in a `zzz/` subfolder under the parent function's directory and declare `@private within <namespace>:path/to/parent`.

### Safe Tick Loop Pattern
- Schedulers and tick loops MUST check `#stop_requested_<name>` at the very top. If set, clean up and terminate with `return run`.
- Reschedule at the bottom via `schedule function <function_name> 1t append`.

---

## 3. Mandatory 4-Stage Verification Pipeline

Because Minecraft commands lack compile-time checks, every implementation or modification MUST execute all 4 stages of the verification pipeline using `datapack-mcp`:

1. **Stage 1 (Pre-Implementation Check)**:
   - Query authoritative entity/component schemas via `spyglass_get_mcdoc_symbol` and Brigadier syntax via `get_command_usage`.
2. **Stage 2 (Clean Implementation)**:
   - Implement functions strictly adhering to IMP-Doc v2 contracts, `zzz/` isolation, and 4-space continuation line indentation.
3. **Stage 3 (Single-File Diagnostics)**:
   - Run `spyglass_diagnose_file` immediately on every created or modified `.mcfunction` and `.json` file. Fix all reported mcdoc field name casing errors and SNBT syntax issues.
4. **Stage 4 (Project Integrity Gate)**:
   - Run `spyglass_analyze_project` across the entire datapack before declaring tasks complete. Ensure zero broken function references, missing tags, or unresolvable symbols.
