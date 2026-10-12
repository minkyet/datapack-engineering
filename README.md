# datapack-engineering

datapack-engineering is an AI agent development plugin and engineering standards suite for Minecraft Java Edition datapacks, defining strict verification lifecycles, 4-tier directory architectures, validation boundaries, IMP-Doc v2 function contracts, and lifecycle entrypoint standards.

## Prerequisites

- **Node.js**: v18.0.0 or later
- **Python** (for MineCode MCP): Python 3.10+ or [`uv`](https://docs.astral.sh/uv/) (recommended)
- **VS Code Extension** (for Spyglass LSP): [Datapack Helper Plus](https://marketplace.visualstudio.com/items?itemName=spgoding.datapack-language-server) installed in VS Code, Cursor, or VSCodium (or specify custom path via `SPYGLASS_SERVER_PATH` environment variable)

## Install

### Claude Code

```text
/plugin marketplace add minkyet/datapack-engineering
/plugin install datapack-engineering
```

### Codex

#### Codex CLI
```bash
codex plugin marketplace add minkyet/datapack-engineering
codex plugin add datapack-engineering@datapack-devkit-marketplace
```

#### Codex App (GUI)
1. In the Codex App - open **Plugins** from the sidebar.
2. Click the arrow next to Create, then select **Add marketplace**.
3. Enter:
   - **Source**: `minkyet/datapack-engineering`
   - **Git ref**: `main`
   - **Sparse paths**: (leave blank)
4. Click **Add marketplace**, select **datapack-engineering** plugin from list and install.
5. Restart Codex.

### Antigravity CLI (`agy`)

```bash
agy plugin install https://github.com/minkyet/datapack-engineering
```

## Usage

Once installed, the plugin and its companion `datapack-mcp` tools activate automatically whenever you develop or debug Minecraft Java Edition datapacks.

### Workflow with AI Agents

When working with your AI agent (Claude Code, Antigravity CLI, or Codex), prompt it with datapack tasks:

- **Scaffolding a Pack**:
  `"Create a new arena minigame datapack with namespace 'arena', following datapack-engineering standards."`
- **Authoring Features & Contracts**:
  `"Add a wave spawner loop in 'system/spawner' with break checks and a private calculation subroutine under flat 'zzz/'."`
- **Schema & Casing Verification**:
  `"Inspect the Interaction entity schema with mcdoc and diagnose all functions in 'data/arena/function/' for casing errors."`
- **Project Integrity Gate**:
  `"Run project-wide static analysis across the datapack to ensure all function paths and tags resolve with zero errors."`

### Core Agent Skill

| Skill | Description | Core Conventions & Features |
| :--- | :--- | :--- |
| `datapack-engineering` | Core verification lifecycle, 4-tier architecture, IMP-Doc v2 contracts, and directory hierarchy standards. | • **4 Functional Tiers**: `user/` (gatekeeper, `@context player`), `game/` (domain logic, `@internal`), `visual/` (render view), `system/` (infrastructure & sensors).<br>• **Validation Boundaries**: Request qualification in `user/`, domain state guards in `game/` with zero redundant input checks.<br>• **Composite Lifecycle**: Universal `uninstall.mcfunction` teardown, composite `reset.mcfunction` (`uninstall` $\rightarrow$ `load` $\rightarrow$ map seeding).<br>• **Subroutine Cleanliness**: Flat `zzz/` helper directories (no nesting; forbidden in `user/`).<br>• **Minecraft 1.21.5+ Syntax**: Unquoted JSON text components.<br>• **Static Verification**: Mandatory 4-Stage pipeline via `datapack-mcp`. |

### Dependency Architecture & Bootstrap

`datapack-engineering` is architecturally coupled to `datapack-mcp`:

- **Automatic Dependency Bootstrap**: If `datapack-engineering` is installed alone, the plugin's background lifecycle hook (`hooks.json` -> `scripts/ensure-datapack-mcp.js`) attempts to auto-install `datapack-mcp` on supported platforms (Antigravity CLI, Codex).

## License

MIT License
