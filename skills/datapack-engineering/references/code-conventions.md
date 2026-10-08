# Datapack Coding & Project Conventions

Comprehensive coding standards, directory hierarchy rules, and resource naming conventions for Minecraft Java Edition datapacks.

---

## 1. Function Formatting & Comment Standards

### Mandatory Function Header (IMP-Doc v2)
Every `.mcfunction` file MUST start with the standard IMP-Doc v2 documentation header:

```mcfunction
#> <namespace>:path/to/function
# Brief explanation (one-line summary)
#
# @context @root (or target context: player, entity, etc.)
# @public / @internal / @private within <path>
# @handles function_tag <tag> (include if triggered by function tag/advancement)
# @reads / @writes / @input / @returns (explicit score holders required, no wildcard *)
```

### Comment Hierarchy
- **Section Dividers (`##`)**: Major topic branches and logical subheadings within the function body must be prefixed with `##`. Do NOT include numerical numbering (e.g., use `## Validate Target and State`, not `## 1. Validate Target and State`) to prevent renumbering friction during refactoring and future edits.
  ```mcfunction
  ## Validate Target and State
  execute unless entity @s run return 0

  ## Process Core Calculation
  scoreboard players operation #result <namespace>.temp = @s <namespace>.score
  ```
- **Contextual Notes (`#`)**: General explanatory comments should be used minimally, only when essential context or edge cases must be clarified.

### Special Directives Rules
- **Omission of `@writes` in `load.mcfunction`**: Because `load.mcfunction` is the root bootstrapper that registers objectives, populates constants, and sets up initialization storages, listing every individual `@writes` directive causes excessive header bloat. Therefore, `@writes` directives must be omitted in `load.mcfunction`.

### Line Wrapping & Indentation
- **Line Continuation**: When command lines become long (such as complex `execute` conditionals), wrap them onto new lines using a trailing backslash (`\`).
- **4-Space Indentation**: Continuation lines MUST be indented with exactly **4 spaces**.
- **No Hard Tabs**: Hard tabs (`\t`) are strictly prohibited to prevent cross-editor display corruption.

```mcfunction
execute as @e[type=interaction, tag=<namespace>.npc] at @s \
    if score #state <namespace> matches 1 \
    positioned ~ ~1.5 ~ \
    run function <namespace>:game/dialogue/open
```

---

## 2. Datapack Entry Points (Root Function Rules)

In the root function directory (`data/<namespace>/function/`), **ONLY** the designated lifecycle entrypoint files are permitted based on the datapack type:

| Entrypoint File | Path | Allowed Pack Type | Scope & Description |
|---|---|---|---|
| `load.mcfunction` | `data/<namespace>/function/load.mcfunction` | Common (All packs) | **Initialization Hook** (`@internal`, `@handles function_tag minecraft:load`). Registered in `data/minecraft/tags/function/load.json`. Sets up objectives, constants, and boot initialization. `@writes` directives are omitted to prevent header bloat. **Must NEVER call `reset.mcfunction`** (calling reset on boot or `/reload` would wipe player save/quest progression). |
| `tick.mcfunction` | `data/<namespace>/function/tick.mcfunction` | Common (All packs) | **Tick Dispatcher** (`@internal`, `@handles function_tag minecraft:tick`). Registered in `data/minecraft/tags/function/tick.json`. Dispatches main clocks, timers, and active game loops. |
| `reset.mcfunction` | `data/<namespace>/function/reset.mcfunction` | Map-dependent / Game packs | **Pre-distribution Factory Reset Hook** (`@public`). Resets the map/world to its pristine initial state before packaging and release. Strictly executed during development or prior to world export, and **never during normal gameplay runtime**. Resets runtime scores, clears temporary entities, and calls `function <namespace>:load` at the end to guarantee a completely initialized, boot-ready factory state for the released save. |
| `uninstall.mcfunction` | `data/<namespace>/function/uninstall.mcfunction` | Standalone / Library packs only | **Complete Teardown Hook** (`@public`). Complete uninstallation entrypoint dedicated to standalone libraries and utility datapacks. Completely purges all created objectives, storages, bossbars, and entities to return the world to its pre-installation state. **Strictly forbidden in map-dependent datapacks (must never be included).** |

> **Root Cleanliness Rule**:  
> No other `.mcfunction` file may exist directly under `data/<namespace>/function/`. Every other function must reside within a categorized subdirectory.

---

## 3. Directory Structure & Visibility (`zzz` Pattern)

### Mandatory Subdirectory Rule & 1st-Level Domains
- **Core Invariant**: Apart from the designated root entrypoints (`load`, `tick`, `reset`, `uninstall`), **all other functions MUST belong to a subdirectory**. No loose functions may exist directly in the root directory.
- **Recommended Domain Archetype**: While any well-structured directory layout suited to the project is permitted, the following 3-domain system is recommended:
  - `game/`: In-game mechanics, combat, stages, waves, player actions.
  - `system/`: Timers, schedulers, state dispatchers, UI/HUD drivers, utility engines.
  - `data/`: Data loading, configuration tables, static registries.

### Function Visibility & The `zzz` Subroutine Pattern
- **Public Functions**: Placed in standard category directories and marked `@public` or `@internal`:
  - Example: `data/<namespace>/function/system/timer/start.mcfunction` (`@public`)
- **Private Subroutine Functions (`zzz/`)**:
  - When a function requires dedicated helper subroutines, create a `zzz/` directory in the parent function's directory.
  - Subroutines are placed inside `zzz/`:
    - Parent: `data/<namespace>/function/game/combat/strike.mcfunction`
    - Subroutine: `data/<namespace>/function/game/combat/zzz/calc_damage.mcfunction`
  - For deeply nested subroutines, chain additional `zzz` directories: `.../zzz/zzz/inner_step.mcfunction`.
- **IMP-Doc v2 Subroutine Contract**:
  - Subroutine functions MUST declare `@private within <parent_function_id>`, strictly specifying the parent function ID.
  ```mcfunction
  #> <namespace>:game/combat/zzz/calc_damage
  # damage calculation subroutine for strike function
  #
  # @context enemy entity
  # @private within <namespace>:game/combat/strike
  # @reads score @s <namespace>.attack
  # @writes score #dmg <namespace>.temp
  ```

---

## 4. Datapack Name & Namespace Standards

- **Name Constraints**: Datapack names must match `^[a-z0-9_.-]+$`. Standardize on `snake_case`. Hyphens (`-`) and dots (`.`) should be avoided.
- **Map Correlation**: For map-bound datapacks, derive the pack name directly from the map name.
- **Namespace Identity**: The root namespace MUST match the datapack name exactly (`<namespace>` == datapack name).
- **Single Custom Namespace**: A datapack must only define **one** custom namespace, plus the `minecraft` namespace for vanilla datapack overrides.

---

## 5. Resource Naming Conventions

### Scoreboard Objectives
Follow a strict structured naming hierarchy:
- **Global State Register**: `<namespace>`
- **General Dummy Objectives**: `<namespace>.<role>` (e.g. `<namespace>.mana`, `<namespace>.wave`)
- **Display Objectives**: `<namespace>.display.<role>` (e.g. `<namespace>.display.sidebar`, `<namespace>.display.belowname`)
- **Immutable Constants**: `<namespace>.const`
- **Calculation Temporary Registers**: `<namespace>.temp`
- **Non-Dummy Criteria**: `<namespace>.<criteria>.<role>` (e.g. `<namespace>.trigger.menu`, `<namespace>.deathCount.player`)

### Scoreboard Fake Players (Score Holders)
Fake player names must use `snake_case` and distinguish registers by prefix:
- **General Engine Registers**: `#` prefix (e.g. `#time`, `#mob_count`, `#current_wave`)
- **Constants**: `##` prefix (e.g. `##-1`, `##0`, `##1`, `##20`, `##60`, `##3600`). Negative number constants (e.g. `##-1`) use the minus sign as a numerical prefix and are fully valid.
- **Display / UI Slots**: `$` prefix (e.g. `$line1`, `$line6`, `$title`)

### Entity Tags
Format entity tags with dot-separated hierarchical namespaces:
- `<namespace>.<role>[.<subrole>]`
  - Example: `<namespace>.enemy.boss`, `<namespace>.shop_npc`, `<namespace>.anchor`

### Storage Identifiers
- Format: `<namespace>:<table>` (e.g. `<namespace>:config`, `<namespace>:runtime_cache`)

### Bossbars
- Format: `<namespace>:<name>` (e.g. `<namespace>:boss_hp`, `<namespace>:wave_timer`)

### Item `custom_data` (Minecraft 1.20.5+)
Structure custom item data under a namespaced compound:
- `[custom_data={<namespace>:{<nbt>}}]`
  - Example: `give @p diamond_sword[custom_data={<namespace>:{weapon_id:"frost_blade",power:10}}]`
