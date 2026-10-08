/**
 * Test suite for datapack-engineering plugin manifests and bootstrap logic.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
  } else {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  }
}

console.log('=== Datapack Engineering Plugin Verification Suite ===\n');

// 1. Manifest JSON Parsing
const rootDir = path.resolve(__dirname, '..');
const pluginJsonPath = path.join(rootDir, 'plugin.json');
const claudePluginPath = path.join(rootDir, '.claude-plugin', 'plugin.json');
const claudeMarketplacePath = path.join(rootDir, '.claude-plugin', 'marketplace.json');
const packageJsonPath = path.join(rootDir, 'package.json');
const hooksJsonPath = path.join(rootDir, 'hooks.json');
const rulesPath = path.join(rootDir, 'rules', 'AGENTS.md');
const engineeringSkillPath = path.join(rootDir, 'skills', 'datapack-engineering', 'SKILL.md');
const bestPracticesSkillPath = path.join(rootDir, 'skills', 'datapack-best-practices', 'SKILL.md');

let pluginJson, claudePlugin, claudeMarketplace, packageJson, hooksJson;

try {
  pluginJson = JSON.parse(fs.readFileSync(pluginJsonPath, 'utf8'));
  assert(true, 'plugin.json parsed successfully');
} catch (e) {
  assert(false, `plugin.json failed to parse: ${e.message}`);
}

try {
  claudePlugin = JSON.parse(fs.readFileSync(claudePluginPath, 'utf8'));
  assert(true, '.claude-plugin/plugin.json parsed successfully');
} catch (e) {
  assert(false, `.claude-plugin/plugin.json failed to parse: ${e.message}`);
}

try {
  claudeMarketplace = JSON.parse(fs.readFileSync(claudeMarketplacePath, 'utf8'));
  assert(true, '.claude-plugin/marketplace.json parsed successfully');
} catch (e) {
  assert(false, `.claude-plugin/marketplace.json failed to parse: ${e.message}`);
}

try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  assert(true, 'package.json parsed successfully');
} catch (e) {
  assert(false, `package.json failed to parse: ${e.message}`);
}

try {
  hooksJson = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf8'));
  assert(true, 'hooks.json parsed successfully');
} catch (e) {
  assert(false, `hooks.json failed to parse: ${e.message}`);
}

// 2. Consistent Plugin Name
assert(pluginJson && pluginJson.name === 'datapack-engineering', "plugin.json name is 'datapack-engineering'");
assert(claudePlugin && claudePlugin.name === 'datapack-engineering', ".claude-plugin/plugin.json name is 'datapack-engineering'");
assert(packageJson && packageJson.name === 'datapack-engineering', "package.json name is 'datapack-engineering'");

const marketplacePlugin = claudeMarketplace && claudeMarketplace.plugins && claudeMarketplace.plugins[0];
assert(marketplacePlugin && marketplacePlugin.name === 'datapack-engineering', "marketplace.json contains 'datapack-engineering'");

// 3. Core Skills Presence & Mandatory Dependency
assert(fs.existsSync(engineeringSkillPath), 'skills/datapack-engineering/SKILL.md exists');
assert(fs.existsSync(bestPracticesSkillPath), 'skills/datapack-best-practices/SKILL.md exists');

if (fs.existsSync(engineeringSkillPath)) {
  const content = fs.readFileSync(engineeringSkillPath, 'utf8');
  assert(content.includes('name: datapack-engineering'), 'datapack-engineering SKILL.md frontmatter matches');
  assert(content.includes('datapack-mcp'), 'datapack-engineering SKILL.md references companion datapack-mcp');
  assert(content.includes('Mandatory Dependency Gate'), 'datapack-engineering SKILL.md enforces Mandatory Dependency Gate');
  assert(!content.includes('Environment Fallback Protocol'), 'datapack-engineering SKILL.md has fallback protocol removed');
}

// 4. Universal Agent Rules (Hard Stop Enforcement)
assert(fs.existsSync(rulesPath), 'rules/AGENTS.md exists');
if (fs.existsSync(rulesPath)) {
  const content = fs.readFileSync(rulesPath, 'utf8');
  assert(content.includes('datapack-mcp'), 'rules/AGENTS.md references datapack-mcp');
  assert(content.includes('Hard Stop Policy (No Fallback)'), 'rules/AGENTS.md specifies Hard Stop Policy (No Fallback)');
  assert(!content.includes('Fallback Mode'), 'rules/AGENTS.md has Fallback Mode removed');
}

// 5. Hooks & Bootstrap Script Execution
assert(hooksJson && hooksJson['ensure-datapack-mcp'] && hooksJson['ensure-datapack-mcp'].PreInvocation, 'hooks.json defines PreInvocation hook for ensure-datapack-mcp');

try {
  execSync('node scripts/ensure-datapack-mcp.js', {
    cwd: rootDir,
    env: { ...process.env, DATAPACK_MCP_INSTALLED: '1' },
    stdio: 'ignore'
  });
  assert(true, 'scripts/ensure-datapack-mcp.js executes cleanly when installed');
} catch (e) {
  assert(false, `scripts/ensure-datapack-mcp.js threw an unexpected error: ${e.message}`);
}

console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All plugin verification tests passed successfully!\n');
  process.exit(0);
}
