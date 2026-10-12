# Core Domain Concepts

Glossary of domain terms and architectural concepts for `datapack-engineering`.

---

## Lifecycle Entrypoints

### Lifecycle Entrypoint
A root function located directly in the namespace function root, reserved exclusively for engine lifecycle hooks or operator distribution commands.
*Avoid: Global function, root script*

Only `load`, `tick`, `uninstall`, and `reset` may reside in the function root. All other datapack logic must reside in categorized subdirectories.

### Teardown Hook (`uninstall`)
A universal teardown entrypoint that completely purges all created objectives, storages, bossbars, namespace-tagged entities, and active scheduled loops.

Every datapack must provide an `uninstall` entrypoint. It must never be called during active gameplay or tick loops.

### Factory Reset (`reset`)
A pre-distribution composite routine for map-dependent packs that restores the world to a pristine factory state prior to release.

`reset` executes a strict composite pipeline: teardown via `uninstall`, bootstrap via `load`, followed by initial map seeding (NPCs, spawn points, gamemodes). Like `uninstall`, it is strictly an operator command and must never be invoked during active gameplay.

---

## 4-Tier Architecture

### User Layer (`user/`)
The controller and gatekeeper tier that receives player inputs, `/trigger` commands, and bridged interaction events.

Functions in this tier must execute under player context (`@context player`) and must declare `@public`. They enforce the Standard 3-Step Protocol: input consumption/trigger reset, actor qualification, and delegation to domain logic.

### Game Layer (`game/`)
The domain model tier that executes core game mechanics, score mutations, and atomic state transitions.

Functions in this tier must declare `@internal` and are never exposed as public entrypoints. They omit redundant player qualification checks when called from `user/`, while enforcing domain state guards when scheduled asynchronously.

### Visual Layer (`visual/`)
The presentation tier responsible for rendering sensory side-effects such as sounds, particles, chat messages, and display entities.

This tier is strictly read-only with respect to game state: it must never mutate scoreboard values, storages, or gameplay-critical tags.

### System Layer (`system/`)
The infrastructure tier responsible for background schedulers, periodic cleanup, and sensor listeners that bridge non-player entity interactions to the user layer.

---

## Validation Boundaries

### Actor Qualification
Validation evaluating whether the calling entity qualifies to make a request (distance, cooldown, permissions, alive status).

Actor qualification is strictly owned by the user layer. Unmet conditions trigger immediate early exit with feedback.

### Domain Invariant Guard
Validation evaluating whether the target object, world state, or entity aggregate can accept a requested domain mutation (available seats, shop stock, match phase).

Domain invariant guards are strictly owned by the game layer. Encapsulating invariants within the domain model ensures operations remain safe whether initiated by human players, AI agents, or system schedulers.

---

## Module Organization

### Private Subroutine (`zzz/`)
A dedicated helper function located in a flat `zzz/` folder inside a parent function's directory, callable only by that specific parent.

Subroutines declare `@private within <parent_path>`. Nested subroutines (`zzz/zzz/`) and subroutines within the user layer are prohibited.
