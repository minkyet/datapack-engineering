# Minecraft Map Datapack Engineering Agent Guardrails

These rules define the required engineering standards, mandatory dependency enforcement, and static verification guardrails when developing Minecraft Java Edition map-making datapacks (escape rooms, minigames, adventure maps, RPGs) with the `datapack-engineering` plugin active.

---

## 1. Strict Dependency Gate: `datapack-mcp` Prerequisite

`datapack-engineering` is architecturally coupled to the companion plugin [`datapack-mcp`](https://github.com/minkyet/datapack-mcp) (which provides MineCode Brigadier/version reference and Spyglass Language Server AST/mcdoc diagnostics).

### Pre-Flight Verification & Hard Stop
At the start of any datapack engineering task, check whether `spyglass_*` (`spyglass_diagnose_file`, `spyglass_analyze_project`) and `minecode_*` tools are present in your active toolset:

1. **If MCP tools are missing**:
   - If the environment supports CLI tool execution, attempt auto-installation immediately:
     - **Antigravity CLI**: `agy plugin install https://github.com/minkyet/datapack-mcp`
     - **Codex CLI**: `codex plugin add datapack-mcp@datapack-mcp-marketplace`
     - **Claude Code**: Inform the user: `Notice: Run '/plugin install datapack-mcp' (or '/plugin marketplace add minkyet/datapack-mcp') to enable required MCP tools.`
2. **Hard Stop Policy (No Fallback)**:
   - If `datapack-mcp` is not installed or tools cannot be provisioned:
     - **YOU MUST HALT EXECUTION IMMEDIATELY.**
     - **DO NOT** attempt to scaffold, write, or modify `.mcfunction` or `.json` files.
     - **DO NOT** attempt manual guessing or unstructured fallback checklists.
     - Inform the user that `datapack-engineering` strictly requires `datapack-mcp` to prevent silent runtime failures, and request installation of `datapack-mcp` before proceeding.

---

## 2. Core Engineering Standards & Conventions

### Function Headers (IMP-Doc v2)
Every `.mcfunction` file MUST start with an IMP-Doc v2 header (`#> <namespace>:path/to/function`):
- **Score Directives (`@reads` / `@writes`)**: Explicit score holders (e.g. `@s`, `@a`, `#reg`, `##const`) must be specified. Lazy placeholder use of `*` is prohibited; literal `*` is permitted only when commands execute batch operations across all tracked holders in an objective.
- **Scope Rule for `game/`**: Functions in `game/` MUST declare `@internal` (or `@private within ...` for subroutines). Declaring `@public` on `game/` functions is strictly prohibited.
- **Context Rule for `user/`**: Functions in `user/` MUST declare `@context player` (or player-centric context). `user/` functions must declare `@internal`.
- **Context Rule for `@root`**: Bare `@s` and relative/local coordinates (`~`, `^`) are strictly prohibited in `@context @root` functions; commands requiring entity or spatial context MUST explicitly establish it via `execute` (`execute as`, `execute at`, etc.).
*(Detailed specification: [imp-doc-v2.md](../skills/datapack-engineering/references/imp-doc-v2.md) | [code-conventions.md](../skills/datapack-engineering/references/code-conventions.md))*

### Map Namespace Hygiene
- **Single Map Namespace**: Use exactly one custom namespace derived from the map name (`<namespace>` == map name). Multiple custom namespaces are prohibited; modularity must be achieved through the 4 functional tiers.

### Directory Hierarchy & 4 Functional Tiers
In `data/<namespace>/function/`, all logic resides in designated lifecycle entrypoints and 4 functional tiers:

1. **Lifecycle Entrypoints (Root Function Directory)**:
   - ONLY designated lifecycle entrypoints are permitted directly in `data/<namespace>/function/`:
     - `load.mcfunction`: Runtime boot initialization (`@internal`, registered in `#minecraft:load`). Non-destructive and idempotent (no gamerule modifications, entity manipulation, or score wipes).
     - `tick.mcfunction`: 20Hz clock loop dispatcher (`@internal`, registered in `#minecraft:tick`).
     - `uninstall.mcfunction`: **Mandatory Teardown Hook** (`@public`). Completely purges objectives, storages, bossbars, entities tagged `<namespace>`, and scheduled tasks (`schedule clear`) to clean up dynamic map state.
     - `reset.mcfunction`: **Mandatory Pre-distribution Factory Reset Hook** (`@public`). Restores the map to pristine initial playable state before export. Composite pipeline: 1. `function <namespace>:uninstall` → 2. `function <namespace>:load` → 3. Initial map seeding (permanent NPCs, gamemodes, spawns, initial gamerules).
     - `reset` and `uninstall` MUST NEVER be called during active gameplay or runtime ticks/triggers.
2. **4 Core Functional Tiers**:
   - `user/`: Controller / Gatekeeper. Player input reception (`/trigger`, interaction bridge). Mandatory `@context player`.
   - `game/`: Model / Domain Logic. Executes core game state changes and mechanics. Mandatory `@internal`.
   - `visual/`: View / Render. Pure presentation side-effects (`playsound`, `particle`, displays, `tellraw`). Never mutates game state scores or storages.
   - `system/`: Infrastructure. Schedulers, garbage collection, and sensor listeners (bridges interaction clicks to `user/` via `execute on target`).
   - *(Note: Projects may introduce custom top-level domain folders like `event/` when needed).*
3. **Private Subroutines (`zzz/`)**:
   - Flat `zzz/` folder inside the parent's directory declaring `@private within <namespace>:path/to/parent`.
   - `zzz/zzz/` nesting is strictly forbidden; all subroutines in a module share the same flat `zzz/` directory.
   - `user/` functions MUST NOT contain `zzz/` subroutines.

### Validation Boundaries & Asynchronous Safety
- **Validation Boundaries**:
  - `user/` exclusively owns **Actor Qualification**: Validates caller distance, cooldowns, and permission tags. Exits early on mismatch (`return fail`). Target entity state checks are strictly forbidden here.
  - `game/` exclusively owns **Domain Invariant Guards**: Validates target entity state, inventory stock, vehicle seats, and match phase. Redundant caller qualification checks verified by `user/` are omitted.
- **Asynchronous Safety (`game/`)**:
  - Functions invoked via `schedule` or `tick` MUST enforce domain state guards (`execute unless entity @s run return fail`, phase checks) to guard against world drift during scheduling delays.
- **Standard 3-Step Protocol for `user/` Functions**:
  All `user/` functions must structure their logic in this strict sequential order:
  1. *Consume Input & Reset Triggers* (optional): Clear and re-enable `/trigger` scores (`reset` then `enable`) or revoke advancements first (prevents infinite loop errors on early exit and ensures trigger re-usability).
  2. *Actor Qualification & Early Exit* (optional): Check caller distance, cooldown, and permission tags; exit early on mismatch.
  3. *Delegate to Domain Logic*: Delegate state mutations to `game/`, or directly invoke `visual/` for stateless UI/menu requests.
*(Detailed architectural patterns & The Taxi Problem: [code-conventions.md](../skills/datapack-engineering/references/code-conventions.md))*

### Safe Tick Loop Pattern
- Schedulers and tick loops MUST check `#stop_requested_<name>` at the very top. If set, clean up and terminate with `return run`.
- Reschedule at the bottom via `schedule function <function_name> 1t append`.

### Minecraft 1.21.5+ Text Component Formatting
- **Modern Syntax Mandate**: In Minecraft 1.21.5+, wrapping JSON text components in string quotes (e.g. `'{"text":"hello"}'`) outputs the raw JSON literal string in chat. Always supply unquoted JSON objects (e.g. `tellraw @a {"text":"hello"}`) or raw string literals (`tellraw @a "hello"`).

---

## 3. Mandatory 4-Stage Verification Pipeline

Because Minecraft commands lack compile-time checks, every implementation or modification MUST execute all 4 stages of the verification pipeline using `datapack-mcp`:

1. **Stage 1 (Pre-Implementation Check)**:
   - Query authoritative entity/component schemas via `spyglass_get_mcdoc_symbol` and Brigadier syntax via `get_command_usage`.
2. **Stage 2 (Clean Implementation)**:
   - Implement functions strictly adhering to IMP-Doc v2 contracts, 4-tier architecture, `zzz/` isolation, and 4-space continuation line indentation.
3. **Stage 3 (Single-File Diagnostics)**:
   - Run `spyglass_diagnose_file` immediately on every created or modified `.mcfunction` and `.json` file. Fix all reported mcdoc field name casing errors and SNBT syntax issues.
4. **Stage 4 (Project Integrity Gate)**:
   - Run `spyglass_analyze_project` across the entire datapack before declaring tasks complete. Ensure zero broken function references, missing tags, or unresolvable symbols.
