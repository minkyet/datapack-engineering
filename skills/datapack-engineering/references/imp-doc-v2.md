# IMP-Doc v2 (Function Contracts & Documentation Standard)

> **Source Specification**: [IMP-Doc v2 Official Google Doc](https://docs.google.com/document/d/1ayElBb9jN_1NAUgPhfwu5uOR2uhn8bKYq2HTURIwGbI)  
> **Status**: Official Reference Specification

IMP-Doc v2 (Interoperable Module Protocol - Documentation Format, v2) defines machine-readable and human-readable documentation directives for Minecraft Java Edition `.mcfunction` files. Analyzers (such as Spyglass Language Server) parse these directives to validate function calls, visibility, and data flow.

---

## 1. Function Header Syntax

Every `.mcfunction` file MUST begin with a documentation block in leading comments:

```mcfunction
#> <namespace>:path/to/function
# One-line functional summary of what this function does
#
# @context <execution_context>
# @public | @internal | @private within <parent_function>
# @handles function_tag <tag>
# @reads score <holder> <objective>
# @writes score <holder> <objective>
# @input macro <type>
# @returns @result <description>
```

- **Header Opener (`#>`)**: The very first line of documentation MUST start with `#> ` followed by the function ID.
- **Header Section Dividers**: Group directives logically, separated by `#` empty comment lines.

---

## 2. Visibility & Scope Directives

Visibility controls which functions may execute this function:

| Directive | Scope & Usage |
|---|---|
| `@public` | Callable from anywhere (including external datapacks or player triggers). Used for public APIs and `reset.mcfunction`. |
| `@internal` | Callable anywhere within the **same** datapack namespace. Standard for normal domain functions (`load.mcfunction`, `tick.mcfunction`). |
| `@private within <parent_id>` | **Subroutine Isolation**: Callable **only** from the specified parent function. Mandatory for all helper functions in `zzz/` subdirectories. |

---

## 3. Execution Context Directives (`@context`)

Specifies the expected entity/position execution context (`execute as ... at ...`):

- `@context @root`: Server root execution context (default command execution, dimension root). Standard for `load.mcfunction` and global clock tickers.
- `@context player`: Executed as a player entity.
- `@context <description>`: Specific custom context (e.g. `@context target enemy entity`, `@context caster player at feet`).

---

## 4. Invocation Triggers (`@handles`)

Declares event tags or advancement triggers that automatically execute this function:

- `@handles function_tag minecraft:load`: Invoked by Minecraft's boot/reload tag.
- `@handles function_tag minecraft:tick`: Invoked every game tick (20Hz).
- `@handles advancement <id>`: Invoked as an advancement reward function.

---

## 5. State & Data Contracts

Declare data read, written, or passed into the function. Analyzers and maintainers use these to trace side effects:

- **`@reads score <holder> <objective>`**: Scores read by conditionals or arithmetic. Explicit score holders are required (no wildcards `*`).
- **`@writes score <holder> <objective>`**: Scores modified or stored into. *(Note: Omitted in `load.mcfunction` to prevent header bloat).*
- **`@reads storage <id> <path>`** / **`@writes storage <id> <path>`**: NBT storage paths accessed.
- **`@input macro { <key>: <type> }`**: Parameters expected when called via `function ... with ...`.
- **`@returns @result <description>`**: Value returned by the `return run` or `return <int>` command.

---

## 6. Practical Mcfunction Header Examples

### Example A: Public Reset Entrypoint (Map Factory Reset)
```mcfunction
#> arena:reset
# Restores arena world and all scores to pristine pre-release factory state
#
# @context @root
# @public
```

### Example B: Private Subroutine (`zzz/`)
```mcfunction
#> arena:game/combat/zzz/calc_damage
# Computes defense scaling and applies final damage score
#
# @context target enemy entity
# @private within arena:game/combat/strike
# @reads score @s arena.defense
# @reads score #raw_damage arena.temp
# @writes score #final_damage arena.temp
```
