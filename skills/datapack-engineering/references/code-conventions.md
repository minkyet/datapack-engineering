# Map Datapack Coding & Project Conventions

Comprehensive coding standards, 4-tier directory hierarchy, validation boundary rules, factory reset lifecycles, and resource naming conventions for Minecraft Java Edition map-making datapacks.

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
# @reads / @writes / @input / @returns (include if applicable; explicit holders required, literal * allowed only for batch operations)
```

*(For the complete IMP-Doc v2 specification and directive reference, see [imp-doc-v2.md](imp-doc-v2.md)).*

### Context and Visibility Constraints
- **`user/` Functions**: MUST declare `@context player` (or player-centric execution context). Calling `user/` functions from `@root` or non-player entities directly is prohibited.
- **`game/` Functions**: MUST declare `@internal` (or `@private within ...`). Declaring `@public` on `game/` functions is strictly prohibited.
- **`@root` Functions**: Bare `@s` and relative/local coordinates (`~ ~ ~`, `^ ^ ^`) are strictly prohibited because `@root` has no executing entity and anchors to world spawn `(0, 0, 0)`. Commands requiring entity or spatial context MUST explicitly establish it via `execute` (`execute as <selector>`, `execute at <selector>`, etc.) or delegate to a subordinate function with explicit `@context`.

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
- **Score Directives (`@reads` / `@writes`)**: Explicit score holders (e.g. `@s`, `@a`, `#reg`, `##const`) must be specified. Using `*` as a lazy placeholder is prohibited; however, literal `*` is permitted when commands legitimately execute batch operations across all tracked holders in that objective (e.g. `scoreboard players operation * records += * primes`).

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
| `load.mcfunction` | `data/<namespace>/function/load.mcfunction` | Mandatory (All packs) | **Initialization Hook** (`@internal`, `@handles function_tag minecraft:load`). Boot environment setup for objectives and immutable constants (`##<value>`).<br>**Hot-Reload Safety Contract**: Fires on startup, joining, and any mid-game `/reload`; MUST be strictly non-destructive and idempotent. Resetting runtime/player scores (`@a`, `#state`), manipulating entities (`summon`, `kill`), altering map blocks (`fill`, `setblock`), or modifying gamerules (`gamerule`) is strictly forbidden. |
| `tick.mcfunction` | `data/<namespace>/function/tick.mcfunction` | Mandatory (All packs) | **Tick Dispatcher** (`@internal`, `@handles function_tag minecraft:tick`). Registered in `data/minecraft/tags/function/tick.json`. Dispatches main clocks, timers, and active game loops. |
| `uninstall.mcfunction` | `data/<namespace>/function/uninstall.mcfunction` | **Mandatory (All packs)** | **Universal Teardown Hook** (`@public`). Completely purges all created objectives, storages, bossbars, entities tagged `<namespace>`, and cancels active scheduled loops (`schedule clear`) to clean up dynamic map state. |
| `reset.mcfunction` | `data/<namespace>/function/reset.mcfunction` | Mandatory (All Map Packs) | **Pre-distribution Factory Reset Hook** (`@public`). Resets the world to pristine factory state before export. Sequentially executes:<br>1. `function <namespace>:uninstall`<br>2. `function <namespace>:load`<br>3. Initial map seeding (permanent NPCs, gamemodes, spawns, initial gamerules).<br>**MUST NEVER be called during active gameplay or tick loops.** |

> **Root Cleanliness Rule**:  
> No other `.mcfunction` file may exist directly under `data/<namespace>/function/`. Every other function must reside within a categorized subdirectory.

---

## 3. Directory Structure, 4 Functional Tiers & Validation Boundaries

### 4 Core Functional Tiers
Apart from designated root entrypoints, all functions belong to structured domain tiers:

| Tier | Role / Pattern | Key Responsibilities | Examples |
|---|---|---|---|
| **`user/`** | Controller / Gatekeeper | • Player input protocol handling (`/trigger`, NPC interaction bridge)<br>• **Request Qualification (range, state, cooldown, currency)**<br>• Early exit on failure (`return fail`) with feedback via `visual/`<br>• **Strictly `@context player` and `@public`** | Shop buy request, unit placement click, menu GUI interaction |
| **`game/`** | Model / Domain Logic | • Core game business logic, mechanics, and state changes<br>• Omits redundant input checks when called from `user/`<br>• Enforces Domain State Guards on async/tick calls<br>• **Strictly `@internal` or `@private with` for `zzz` subroutine (NEVER `@public`)** | Currency deduction, inventory item grant, mob summoning, victory condition check |
| **`visual/`** | View / Render | • Pure presentation side-effects; never mutates game state scores/storages<br>• Controls sounds, particles, text messages, display entities | Skill effects, `playsound`, `tellraw`, `item_display` animations |
| **`system/`** | Infrastructure | • Root entrypoint sub-modules (`load`, `tick`), schedulers, GC<br>• **Sensor Listeners**: detects clicks on interaction entities and bridges to `user/` via `execute on target` | Scoreboard registration, timer schedulers, interaction bridges |

*(Note: Datapack authors retain discretion to add project-specific top-level folders, such as `event/` or `custom/`, when required by domain architecture).*

### Validation Boundaries & The Subject-of-Validation Principle

To prevent leaky abstractions and maintain clean domain encapsulation, validation is split into two distinct tiers based on the **Subject of Validation**:

| Layer | Validation Category | Guiding Question (Subject) | Typical Guard Targets |
|---|---|---|---|
| **`user/`** | **Actor Qualification** | *"Does the calling player (@s) qualify to execute this action?"* | • Distance to NPC/station (`distance=..3`)<br>• Player debounce cooldowns<br>• Permission/driver role tags (`tag=driver`)<br>• Player alive & not stunned |
| **`game/`** | **Domain Invariant Guard** | *"Can the target object or domain state accept this operation?"* | • **Target object capacity (e.g. taxi available seats)**<br>• Shop limited stock counters<br>• Match phase or entity survival<br>• Target interaction entity validity |

#### Domain Encapsulation Rule
Functions in `game/` must be safely reusable across human players, AI agents, and system events. Therefore, **target object invariants (e.g. `taxi_seats > 0`, `shop_stock > 0`) MUST be encapsulated inside `game/`**, never in `user/`.

```text
[Player Action / Interaction Sensor]
       │
       ▼ (execute on target -> @context player)
1. user:taxi/accept_passenger (Gatekeeper / Actor Qualification)
   - [Context: @context player]
   - Is player a qualified driver? (@s[tag=driver])
   - Is player in vehicle/driver seat? (distance <= 3 blocks)
   - Is player off input debounce cooldown?
   - ❌ Mismatch: return fail & visual error
   -  Success: delegate to game
       │
       ▼ (internal call)
2. game:taxi/board_passenger (Domain Model & Invariant Guard)
   - [Context: @internal]
   - [Domain Guard]: Are taxi seats available? (seats > 0)
   - [Domain Guard]: Is waiting passenger entity still valid?
   - ❌ Capacity full: return run visual:msg/taxi_full
   -  Success: atomic state mutation (seats -= 1, attach passenger)
   - Trigger: visual:taxi/board_fx
```

#### Anti-Pattern vs Best Practice (The Taxi Problem)
- ❌ **Anti-Pattern (Leaking Target Invariants into `user/`)**:
  Checking `#taxi_seats` inside `user/taxi/accept` and omitting the check in `game/taxi/board`. When an AI driver or automated quest needs to board a passenger, it cannot use `game/` safely without duplicating the seat check or risking taxi overcapacity bugs.
-  **Best Practice (Encapsulated Invariant)**:
  `user/` only checks if the caller is a valid driver close to the wheel. `game/` encapsulates the seat availability guard, making it bulletproof whether called by a player, an AI driver, or a scripted sequence.

#### The Canonical `user/` Controller Pattern (3-Step Protocol)
All functions in `user/` should follow this standardized 3-step sequence:

```mcfunction
#> <namespace>:user/category/action
# Brief description of user interaction
#
# @context player
# @public
# @reads score @s <namespace>.cd_action
# @writes score @s <namespace>.trigger.action

## Consume Input & Reset Triggers (Optional)
# Always clear trigger scores first to prevent infinite loop errors on early exit, then re-enable for next input
scoreboard players reset @s <namespace>.trigger.action
scoreboard players enable @s <namespace>.trigger.action
# advancement revoke @s only <namespace>:trigger/action

## Actor Qualification & Early Exit (Optional)
# Verify caller distance, cooldown, permission tags, and alive/stun states
execute at @e[type=marker, tag=<namespace>.target, limit=1] unless entity @s[distance=..5] run \
    return run function <namespace>:visual/msg/too_far
execute if score @s <namespace>.cd_action matches 1.. run \
    return run function <namespace>:visual/fail/invalid

## Delegate to Domain Logic (or View for UI)
# Forward validated request to game/ (or directly to visual/ for pure UI/info)
function <namespace>:game/category/do_action
# (For stateless UI/menus, skip game/ and call visual/ directly)
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
- **No Subroutines in `user/`**: Functions in `user/` must remain concise controllers without `zzz/` subroutines. Logic requiring subroutines must be factored into `game/` or `system/`.
- **IMP-Doc Contract**: Subroutines MUST declare `@private within <parent_function_id>`.

---

## 4. Datapack Name & Namespace Standards

- **Name Constraints**: Datapack names must match `^[a-z0-9_.-]+$`. Standardize on `snake_case`. Hyphens (`-`) and dots (`.`) should be avoided.
- **Map Correlation**: Derive the pack name directly from the map name (`<namespace>` == map name).
- **Single Custom Namespace**: A map-making datapack must only define **one** custom namespace, plus the `minecraft` namespace for vanilla datapack overrides. Never split logic across multiple custom namespaces; modularity must be achieved through the 4 functional tiers (`user/`, `game/`, `visual/`, `system/`).

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
