#!/usr/bin/env node

/**
 * Dependency bootstrap script for datapack-engineering.
 * Checks for companion 'datapack-mcp' plugin and attempts auto-installation if missing.
 * datapack-engineering strictly requires datapack-mcp to operate.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function isCommandAvailable(cmd) {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkMcpInstalled() {
  if (process.env.DATAPACK_MCP_INSTALLED === '1' || process.env.DATAPACK_SKIP_BOOTSTRAP === '1') {
    return true;
  }

  const home = os.homedir();
  const searchPaths = [
    // Antigravity plugin paths
    path.join(home, '.gemini', 'config', 'plugins', 'datapack-mcp'),
    path.join(home, '.gemini', 'config', 'plugins', 'datapack-devkit'),
    path.join(home, '.gemini', 'antigravity-cli', 'mcp', 'datapack-mcp'),
    path.join(home, '.gemini', 'antigravity-cli', 'mcp', 'datapack-devkit'),
    path.join(home, '.gemini', 'antigravity-cli', 'mcp', 'minecode'),
    path.join(home, '.gemini', 'antigravity-cli', 'mcp', 'spyglasslint'),
    // Claude Code plugin paths
    path.join(home, '.claude', 'plugins', 'datapack-mcp'),
    path.join(home, '.claude', 'plugins', 'datapack-devkit'),
    // Codex plugin paths
    path.join(home, '.codex', 'plugins', 'datapack-mcp'),
    path.join(home, '.codex', 'plugins', 'datapack-devkit'),
  ];

  for (const candidate of searchPaths) {
    if (fs.existsSync(candidate)) {
      return true;
    }
  }

  return false;
}

function bootstrap() {
  if (checkMcpInstalled()) {
    process.exit(0);
  }

  process.stderr.write("[datapack-engineering] Prerequisite 'datapack-mcp' is missing. Attempting auto-installation...\n");

  let installed = false;
  try {
    if (isCommandAvailable('agy')) {
      process.stderr.write("[datapack-engineering] Executing: agy plugin install https://github.com/minkyet/datapack-mcp\n");
      execSync('agy plugin install https://github.com/minkyet/datapack-mcp', { stdio: 'inherit', timeout: 30000 });
      installed = true;
    } else if (isCommandAvailable('codex')) {
      process.stderr.write("[datapack-engineering] Executing: codex plugin add datapack-mcp@datapack-mcp-marketplace\n");
      execSync('codex plugin add datapack-mcp@datapack-mcp-marketplace', { stdio: 'inherit', timeout: 30000 });
      installed = true;
    }
  } catch (err) {
    process.stderr.write(`[datapack-engineering] Auto-installation error: ${err.message || err}\n`);
  }

  if (installed && checkMcpInstalled()) {
    process.stderr.write("[datapack-engineering] Successfully installed companion 'datapack-mcp'.\n");
    process.exit(0);
  } else {
    process.stderr.write("[datapack-engineering] HARD STOP: 'datapack-mcp' is a mandatory prerequisite for 'datapack-engineering'.\n");
    process.stderr.write("[datapack-engineering] Please install it manually before proceeding:\n");
    process.stderr.write("  - Claude Code: /plugin install datapack-mcp (or /plugin marketplace add minkyet/datapack-mcp)\n");
    process.stderr.write("  - Antigravity: agy plugin install https://github.com/minkyet/datapack-mcp\n");
    process.stderr.write("  - Codex: codex plugin add datapack-mcp@datapack-mcp-marketplace\n");
    process.exit(1);
  }
}

bootstrap();
