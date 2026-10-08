# datapack-engineering

datapack-engineering is an AI agent development plugin and engineering standards suite for Minecraft Java Edition datapacks, defining strict verification lifecycles, IMP-Doc v2 function contracts, and directory hierarchy conventions.

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

TBD

### Bundled Agent Skills

| Skill | Description | Core Conventions & Features |
| :--- | :--- | :--- |
| `datapack-engineering` | Core verification lifecycle, IMP-Doc v2 contracts, and directory hierarchy standards. | Mandatory IMP-Doc v2 headers (`@context`, `@public`/`@private`), root entrypoints (`load`, `tick`, `reset`, `uninstall`), `zzz/` private subroutines, safe tick loops. |
| `datapack-best-practices` | Battle-tested runtime patterns and complex mechanics recipes. | Scoreboard state machines (FSM), deterministic UUID entity anchors, ephemeral `.this` tags, passenger display traversal, unified cooldown pipelines, sidebar HUDs. |

### Dependency Architecture & Bootstrap

`datapack-engineering` is architecturally coupled to `datapack-mcp`:

- **Automatic Dependency Bootstrap**: If `datapack-engineering` is installed alone, the plugin's background lifecycle hook (`hooks.json` -> `scripts/ensure-datapack-mcp.js`) attempts to auto-install `datapack-mcp` on supported platforms (Antigravity CLI, Codex).
- **Mandatory Hard Stop**: If `datapack-mcp` is not present and cannot be provisioned, `datapack-engineering` halts execution immediately. Because Minecraft commands lack compile-time checks, developing without the Spyglass static analyzer and MineCode syntax engine introduces silent runtime failures and is strictly prohibited.

## License

MIT License
