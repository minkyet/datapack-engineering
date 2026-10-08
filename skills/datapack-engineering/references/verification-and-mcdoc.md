# Verification Pipeline & mcdoc Schema Guardrails

Minecraft commands lack compile-time type checking. Errors in function syntax, entity NBT, or data component schemas often result in **Silent Failures**—where the engine accepts the command, emits no error logs, but ignores invalid fields or fails to execute logic.

This document provides deep-dive guidance on Minecraft validation layers and Spyglass Language Server tools.

---

## 1. The Silent Failure Trap: Brigadier vs. mcdoc

Understanding how Minecraft validates commands is critical to writing bug-free datapacks:

| Layer | Tool | What It Validates | Limitations |
|---|---|---|---|
| **Brigadier Parser** | Command line / `validate_command` | Top-level grammar, command tree, SNBT syntax | Treats `{Width: 4.0f}` as valid SNBT syntax; does **NOT** check if the entity has a `Width` field. |
| **mcdoc Type Checker** | Spyglass LSP / `spyglass_diagnose_file` | Precise field names, casing, types, component schemas | Validates statically against Minecraft's actual entity & component schemas. |
| **Runtime Entity Loader** | In-game `/data get entity` | Actual entity memory after summon | Runtime-only observation. |

### The Silent Ignore Hazard
If you summon an entity with an incorrectly cased NBT field:
```mcfunction
# BUG: Silent failure!
summon interaction ~ ~ ~ {Width:4.0f,Height:2.0f}
```
Minecraft will:
1. Parse the SNBT string without throwing a Brigadier error.
2. Summon the interaction entity successfully.
3. Silently drop `Width` and `Height` because the valid fields are lowercase `width` and `height`.
4. The hitbox remains at default (1×1), and in-game debugging becomes extremely perplexing.

---

## 2. Spyglass LSP Static Analysis Recipes

Use the `datapack-mcp` tools throughout the 4-Stage Lifecycle (see [SKILL.md](../SKILL.md) for workflow stages):

### Schema Introspection (`spyglass_get_mcdoc_symbol`)
Before authoring NBT or component compounds:
- **Interaction Entity**: `spyglass_get_mcdoc_symbol("minecraft::entity::Interaction")` -> reveals `width`, `height`, `response`.
- **Display Entity**: `spyglass_get_mcdoc_symbol("minecraft::entity::Display")` -> reveals `transformation`, `billboard`, `view_range`.
- **Item Components (1.20.5+)**: `spyglass_get_mcdoc_symbol("minecraft::item::DataComponentType")` -> reveals `custom_data`, `item_name`, `lore`, `enchantments`.

### Immediate File Diagnostic (`spyglass_diagnose_file`)
Run immediately on every created or modified `.mcfunction` or `.json` file:
- Catches invalid field casing, unknown NBT keys, unquoted SNBT strings, and unescaped characters.
- Must return zero errors before proceeding to next file.

### Project Integrity Gate (`spyglass_analyze_project`)
Run across the whole project before declaring any task complete:
- Verifies every `function <namespace>:<path>` call resolves to an existing file.
- Verifies every tag in `data/<namespace>/tags/function/` resolves correctly.
- Ensures zero dead references or dangling symbol links.
