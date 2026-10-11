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
- **Scope Rule for `game/`**: Functions in `game/` MUST declare `@internal` (or `@private within ...` for subroutines). Declaring `@public` on `game/` functions is strictly prohibited to prevent bypassing `user/` validation.
- **Context Rule for `user/`**: Functions in `user/` MUST declare `@context player` (or player-centric context). Calling `user/` functions from `@root` or non-player entities directly is prohibited.

### Directory Hierarchy & 5 Functional Tiers
In `data/<namespace>/function/`, all logic resides in designated lifecycle entrypoints and functional tiers:

1. **Lifecycle Entrypoints (Root Function Directory)**:
   - ONLY designated lifecycle entrypoints are permitted directly in `data/<namespace>/function/`:
     - `load.mcfunction`: Runtime boot initialization (`@internal`, registered in `#minecraft:load`).
     - `tick.mcfunction`: 20Hz clock loop dispatcher (`@internal`, registered in `#minecraft:tick`).
     - `uninstall.mcfunction`: **Mandatory Teardown Hook for ALL datapacks** (`@public`). Completely purges created objectives, storages, bossbars, entities tagged `<namespace>`, and scheduled tasks (`schedule clear`).
     - `reset.mcfunction`: **Mandatory Pre-distribution Factory Reset for map-dependent packs** (`@public`, optional for standalone libraries). Executes composite teardown and setup in order:
       1. `function <namespace>:uninstall` (Teardown)
       2. `function <namespace>:load` (Bootstrap)
       3. Initial map seeding (spawning permanent map NPCs, resetting player coordinates/gamemodes).
     - `reset` and `uninstall` MUST NEVER be called during active gameplay or runtime ticks/triggers (strictly manual developer execution prior to release or complete teardown).
2. **5 Core Functional Tiers**:
   - `user/`: Controller / Gatekeeper. Player input reception (`/trigger`, NPC interaction bridge). Performs **Request Qualification** (distance, cooldown, cost, permissions). Bails out early with `return fail` on mismatch.
   - `game/`: Model / Domain Logic. Executes core game state changes and mechanics. Marked `@internal` only.
   - `visual/`: View / Render. Pure presentation and side-effects (`playsound`, `particle`, displays, `tellraw`). Never mutates game state scores or storages.
   - `system/`: Infrastructure. Schedulers, garbage collection, and sensor listeners (e.g. detecting interaction entities and bridging to `user/` via `execute on target`).
   - `system/util/`: Library. Stateless, reusable pure functions (RNG, vector arithmetic, raycasting).
   - *(Note: Projects may introduce additional top-level domain folders such as `event/` or `custom/` when demanded by specific architecture requirements.)*
3. **Private Subroutines (`zzz/`)**:
   - Helper functions dedicated to a parent function must reside in a flat `zzz/` folder inside the parent's directory and declare `@private within <namespace>:path/to/parent`.
   - **No Subroutine Nesting**: `zzz/zzz/` chaining is strictly forbidden; all subroutines in a module share the same flat `zzz/` directory.
   - **No Subroutines in `user/`**: Functions in `user/` MUST NOT contain `zzz/` subroutines. Complex logic belongs in `game/` or `system/util/`.

### Validation Boundaries & Asynchronous Safety
- **Subject-of-Validation Principle**:
  - **Actor Qualification (`user/`)**:
    - *Subject*: *"Does the calling player (@s) qualify to make this request?"*
    - Checks actor constraints: distance to target (`distance=..3`), debounce/cooldowns, role/permission tags, player alive/not stunned.
    - Unmet conditions trigger immediate early exit (`return fail`) and user feedback via `visual/`.
  - **Domain Invariant Guards (`game/`)**:
    - *Subject*: *"Can the target object or world state accept this domain action?"*
    - Checks target/aggregate invariants: available seats in vehicle/taxi, remaining limited shop stock, validity of target interaction entity, match/phase state.
    - **Domain Encapsulation Mandate**: Because `game/` domain functions must be safely reusable across human players, AI agents, quests, and system schedulers, target invariants (e.g. `taxi_seats > 0`) MUST be encapsulated inside `game/`. Checking target entity states inside `user/` is an anti-pattern.
- **Asynchronous Safety (`game/`)**:
  - When invoked downstream of `user/`, `game/` omits redundant input checks (distance, player cooldowns) already verified by the caller.
  - When invoked asynchronously via `schedule` or `tick`, `game/` MUST include domain state guards (`execute unless entity @s run return fail`, game phase matches) to guard against world drift during scheduling delays.
- **Standard 3-Step Protocol for `user/` Functions**:
  All `user/` functions must structure their logic in this strict sequential order:
  1. *Consume Input & Reset Triggers* (optional): Clear `/trigger` scores or revoke advancements. **MUST** precede any condition checks so triggers are consumed even if qualification fails, preventing infinite execution loops.
  2. *Actor Qualification & Early Exit* (optional): Check caller distance, cooldown, and permission tags; exit early on mismatch (`return fail` or `return run function visual:...`).
  3. *Delegate to Domain Logic*: Delegate state mutations to `game/`, or directly invoke `visual/` for stateless UI/menu requests.

### Safe Tick Loop Pattern
- Schedulers and tick loops MUST check `#stop_requested_<name>` at the very top. If set, clean up and terminate with `return run`.
- Reschedule at the bottom via `schedule function <function_name> 1t append`.

### Minecraft 1.21.5+ Text Component Formatting
- **Quote-Wrapping Deprecation**: Starting in Minecraft 1.21.5+, wrapping JSON text components in string quotes (e.g. `'{"text":"hello"}'`) outputs the raw JSON literal string in chat.
- **Modern Syntax**: Always supply unquoted JSON objects (e.g. `tellraw @a {"text":"hello","color":"green"}`) or raw string literals (e.g. `tellraw @a "hello"`) in commands and examples.

---

## 3. Mandatory 4-Stage Verification Pipeline

Because Minecraft commands lack compile-time checks, every implementation or modification MUST execute all 4 stages of the verification pipeline using `datapack-mcp`:

1. **Stage 1 (Pre-Implementation Check)**:
   - Query authoritative entity/component schemas via `spyglass_get_mcdoc_symbol` and Brigadier syntax via `get_command_usage`.
2. **Stage 2 (Clean Implementation)**:
   - Implement functions strictly adhering to IMP-Doc v2 contracts, 5-tier architecture, `zzz/` isolation, and 4-space continuation line indentation.
3. **Stage 3 (Single-File Diagnostics)**:
   - Run `spyglass_diagnose_file` immediately on every created or modified `.mcfunction` and `.json` file. Fix all reported mcdoc field name casing errors and SNBT syntax issues.
4. **Stage 4 (Project Integrity Gate)**:
   - Run `spyglass_analyze_project` across the entire datapack before declaring tasks complete. Ensure zero broken function references, missing tags, or unresolvable symbols.
