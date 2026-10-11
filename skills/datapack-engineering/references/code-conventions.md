# Datapack Coding & Project Conventions

Comprehensive coding standards, 5-tier directory hierarchy, validation boundary rules, and resource naming conventions for Minecraft Java Edition datapacks.

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
# @reads / @writes / @input / @returns (include if applicable; explicit holders required, no wildcard *)
```

### Context and Visibility Constraints
- **`user/` Functions**: MUST declare `@context player` (or player-centric execution context). Calling `user/` functions from `@root` or non-player entities directly is prohibited.
- **`game/` Functions**: MUST declare `@internal` (or `@private within ...`). Declaring `@public` on `game/` functions is strictly prohibited.

### Comment Hierarchy
- **Section Dividers (`##`)**: Major topic branches and logical subheadings within the function body must be prefixed with `##`. Do NOT include numerical numbering (e.g., use `## Validate Target and State`, not `## 1. Validate Target and State`) to prevent renumbering friction during refactoring.
  ```mcfunction
  ## Validate Target and State
  execute unless entity @s run return fail

  ## Process Core Calculation
  scoreboard players operation #result <namespace>.temp = @s <namespace>.score
  ```
- **Contextual Notes (`#`)**: General explanatory comments should be used minimally, only when essential context or edge cases must be clarified. Language choice is flexible based on the project's requirements.

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
    run function <namespace>:system/dialogue/open
```

---

## 2. Datapack Entry Points (Root Function Rules)

In the root function directory (`data/<namespace>/function/`), **ONLY** the designated lifecycle entrypoint files are permitted:

| Entrypoint File | Path | Requirement | Scope & Description |
|---|---|---|---|
| `load.mcfunction` | `data/<namespace>/function/load.mcfunction` | Mandatory (All packs) | **Initialization Hook** (`@internal`, `@handles function_tag minecraft:load`). Registered in `data/minecraft/tags/function/load.json`. Sets up objectives, constants, and boot initialization. `@writes` directives are omitted. |
| `tick.mcfunction` | `data/<namespace>/function/tick.mcfunction` | Mandatory (All packs) | **Tick Dispatcher** (`@internal`, `@handles function_tag minecraft:tick`). Registered in `data/minecraft/tags/function/tick.json`. Dispatches main clocks, timers, and active game loops. |
| `uninstall.mcfunction` | `data/<namespace>/function/uninstall.mcfunction` | **Mandatory (All packs)** | **Universal Teardown Hook** (`@public`). Completely purges all created objectives, storages, bossbars, entities tagged `<namespace>`, and cancels active scheduled loops (`schedule clear`). |
| `reset.mcfunction` | `data/<namespace>/function/reset.mcfunction` | Mandatory for Map Packs | **Pre-distribution Factory Reset Hook** (`@public`, optional for standalone). Resets the world to pristine factory state before export. Sequentially executes:<br>1. `function <namespace>:uninstall`<br>2. `function <namespace>:load`<br>3. Initial map seeding (permanent NPCs, gamemodes, spawns).<br>**MUST NEVER be called during active gameplay or tick loops.** |

> **Root Cleanliness Rule**:  
> No other `.mcfunction` file may exist directly under `data/<namespace>/function/`. Every other function must reside within a categorized subdirectory.

---

## 3. Directory Structure, 5 Functional Tiers & Validation Boundaries

### 5 Core Functional Tiers
Apart from designated root entrypoints, all functions belong to structured domain tiers:

| Tier | Role / Pattern | Key Responsibilities | Examples |
|---|---|---|---|
| **`user/`** | Controller / Gatekeeper | • Player input protocol handling (`/trigger`, NPC interaction bridge)<br>• **Request Qualification (range, state, cooldown, currency)**<br>• Early exit on failure (`return fail`) with feedback via `visual/`<br>• **Strictly `@context player`** | Shop buy request, unit placement click, menu GUI interaction |
| **`game/`** | Model / Domain Logic | • Core game business logic, mechanics, and state changes<br>• Omits redundant input checks when called from `user/`<br>• Enforces Domain State Guards on async/tick calls<br>• **Strictly `@internal` (NEVER `@public`)** | Currency deduction, inventory item grant, mob summoning, victory condition check |
| **`visual/`** | View / Render | • Pure presentation side-effects; never mutates game state scores/storages<br>• Controls sounds, particles, text messages, display entities | Skill effects, `playsound`, `tellraw`, `item_display` animations |
| **`system/`** | Infrastructure | • Root entrypoint sub-modules (`load`, `tick`), schedulers, GC<br>• **Sensor Listeners**: detects clicks on interaction entities and bridges to `user/` via `execute on target` | Scoreboard registration, timer schedulers, interaction bridges |
| **`system/util/`** | Library | • Pure, stateless algorithms independent of specific game rules<br>• Input-to-output pure computation | RNG generator, vector arithmetic, raycasting template, string parsing |

*(Note: Datapack authors retain discretion to add project-specific top-level folders, such as `event/` or `custom/`, when required by domain architecture).*

### Validation Boundaries & Sensor Bridge Pattern

```text
[Player Action / Interaction Sensor]
       │
       ▼ (execute on target -> @context player)
1. user:shop/buy_sword (Gatekeeper / Request Qualification)
   - [Context: @context player]
   - Is player alive? Not stunned?
   - Within 5 blocks of shop? Off click cooldown?
   - Has >= 100 gold?
   - ❌ Mismatch: return fail & invoke visual:msg/error
   -  Success: delegate to game
       │
       ▼ (internal call)
2. game:shop/execute_buy_sword (Domain Logic)
   - [Context: @internal]
   - Omit redundant cost/distance check (No Redundant Validation)
   - Deduct 100 gold
   - Grant sword to inventory
   - Trigger: visual:shop/success_fx
       │
       ▼
3. visual:shop/success_fx (Side-Effect View)
   - Play levelup sound
   - Particle blast
   - tellraw {"text":"Purchased sword!","color":"green"}
```

#### Sensor Bridge Pattern (`system/` $\rightarrow$ `user/`)
Sensors (such as `interaction` entities) must not call `user/` as the interaction entity. Instead, `system/` detects the interaction and bridges context to the player:

```mcfunction
#> <namespace>:system/interaction/shop_listener
# Detects shop interaction and bridges to user layer
#
# @context @root
# @internal

execute as @e[type=interaction, tag=<namespace>.shop, nbt={interacted:1b}] at @s \
    on target run function <namespace>:user/shop/interact
```

#### Asynchronous Safety & Domain State Guards in `game/`
When functions in `game/` are invoked asynchronously (e.g. via `schedule` or `tick`), the world state may have drifted between scheduling and execution. These functions MUST implement Domain State Guards:

```mcfunction
#> <namespace>:game/bomb/explode
# Detonates bomb entity after scheduled delay
#
# @context bomb marker entity
# @internal

## Domain State Guard: Verify bomb entity still exists and is primed
execute unless entity @s run return fail
execute unless score @s <namespace>.bomb_primed matches 1 run return fail

## Execute Domain Detonation
summon tnt ~ ~ ~
kill @s
```

### Private Subroutine Functions (`zzz/` Pattern)
- **Flat Subroutines**: Helper functions dedicated to a parent function reside inside a `zzz/` folder under the parent's directory:
  - Parent: `data/<namespace>/function/game/combat/strike.mcfunction`
  - Helper: `data/<namespace>/function/game/combat/zzz/calc_damage.mcfunction`
- **No Subroutine Nesting**: `zzz/zzz/` directories are forbidden. All helper functions for a module reside flatly inside the single `zzz/` directory.
- **No Subroutines in `user/`**: Functions in `user/` must remain concise controllers without `zzz/` subroutines. Logic requiring subroutines must be factored into `game/` or `system/util/`.
- **IMP-Doc Contract**: Subroutines MUST declare `@private within <parent_function_id>`.

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
- **Immutable Constants**: `<namespace>.const[.<role>]` (e.g. `<namespace>.const`, `<namespace>.price`)
- **Calculation Temporary Registers**: `<namespace>.temp`
- **Non-Dummy Criteria**: `<namespace>.<criteria>.<role>` (e.g. `<namespace>.trigger.menu`, `<namespace>.deathCount.player`)

### Scoreboard Fake Players (Score Holders)
Fake player names must use `snake_case` and distinguish registers by prefix:
- **General Engine Registers**: `#` prefix (e.g. `#time`, `#mob_count`, `#current_wave`)
- **Constants**: `##` prefix (e.g. `##-1`, `##20`, `##3600`, `##apple`, `##max_player`). Negative number constants (e.g. `##-1`) use the minus sign as a numerical prefix and are fully valid.
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

---

## 6. Target Selector Conventions & Performance

- **Always Specify `type=`**: Unscoped `@e[...]` selectors scan every entity loaded across all ticking dimensions. Always supply `type=<entity_type>` first (e.g. `@e[type=interaction, tag=<namespace>.npc]`) to let Minecraft prune the candidate search via the entity type index.
- **Tag Narrowing**: Follow `type=` with specific namespaced tags (`tag=<namespace>.<role>`).
- **Avoid Heavy NBT Filtering in Selectors**: Never use `nbt={...}` inside entity selectors (e.g. `@e[nbt={...}]`), as it parses and serializes full entity memory every tick. Use scoreboards or entity tags as fast filter indices instead.

---

## 7. Text Component Formatting in Minecraft 1.21.5+

Starting in Minecraft 1.21.5+, text component parsing changed significantly:

### The Quote-Wrapping Trap
In older versions, text components in commands like `tellraw` or `title` were often wrapped in single quotes as JSON strings:
```mcfunction
# BROKEN IN 1.21.5+: Outputs the literal string '{"text":"Hello"}' to chat!
tellraw @a '{"text":"Hello","color":"green"}'
```
In 1.21.5+, wrapping an object in quotes treats it as a raw string literal, causing the JSON syntax itself to appear in chat.

### Standard 1.21.5+ Syntax
Always write text components as unquoted JSON objects or raw string literals:

```mcfunction
## Unquoted JSON object (formatted text)
tellraw @a {"text":"Hello","color":"green"}

## Raw string literal (plain text)
tellraw @a "Hello"

## Array of components
tellraw @a [{"text":"[System] ","color":"gray"},{"text":"Match started!","color":"gold"}]
```
