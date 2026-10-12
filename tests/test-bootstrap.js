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
const conventionsPath = path.join(rootDir, 'skills', 'datapack-engineering', 'references', 'code-conventions.md');
const impDocPath = path.join(rootDir, 'skills', 'datapack-engineering', 'references', 'imp-doc-v2.md');
const uninstallTemplatePath = path.join(rootDir, 'skills', 'datapack-engineering', 'assets', 'templates', 'entrypoints', 'uninstall.mcfunction');
const resetTemplatePath = path.join(rootDir, 'skills', 'datapack-engineering', 'assets', 'templates', 'entrypoints', 'reset.mcfunction');
const userTemplatePath = path.join(rootDir, 'skills', 'datapack-engineering', 'assets', 'templates', 'user_function_template.mcfunction');

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

if (fs.existsSync(engineeringSkillPath)) {
  const content = fs.readFileSync(engineeringSkillPath, 'utf8');
  assert(content.includes('name: datapack-engineering'), 'datapack-engineering SKILL.md frontmatter matches');
  assert(content.includes('datapack-mcp'), 'datapack-engineering SKILL.md references companion datapack-mcp');
  assert(content.includes('Mandatory Dependency Gate'), 'datapack-engineering SKILL.md enforces Mandatory Dependency Gate');
  assert(!content.includes('Environment Fallback Protocol'), 'datapack-engineering SKILL.md has fallback protocol removed');
  assert(content.includes('4-Tier Directory Hierarchy') || content.includes('4 Core Functional Tiers'), 'datapack-engineering SKILL.md enforces 4 functional tiers');
  assert(!content.includes('system/util'), 'datapack-engineering SKILL.md does not mention system/util');
  assert(content.includes('uninstall.mcfunction'), 'datapack-engineering SKILL.md specifies uninstall.mcfunction as universal teardown');
}

// 4. Universal Agent Rules (4 Tiers, Validation Boundaries, Composite Lifecycle, Root Context Rule)
assert(fs.existsSync(rulesPath), 'rules/AGENTS.md exists');
if (fs.existsSync(rulesPath)) {
  const content = fs.readFileSync(rulesPath, 'utf8');
  assert(content.includes('datapack-mcp'), 'rules/AGENTS.md references datapack-mcp');
  assert(content.includes('Hard Stop Policy (No Fallback)'), 'rules/AGENTS.md specifies Hard Stop Policy (No Fallback)');
  assert(!content.includes('Fallback Mode'), 'rules/AGENTS.md has Fallback Mode removed');
  assert(content.includes('4 Core Functional Tiers') || content.includes('4 Functional Tiers'), 'rules/AGENTS.md enforces 4 functional tiers');
  assert(!content.includes('system/util'), 'rules/AGENTS.md does not mention system/util');
  assert(content.includes('user/') && content.includes('game/') && content.includes('visual/'), 'rules/AGENTS.md defines functional tiers');
  assert(content.includes('@context player'), 'rules/AGENTS.md enforces @context player for user/ layer');
  assert(content.includes('@internal'), 'rules/AGENTS.md enforces @internal for game/ layer');
  assert(content.includes('uninstall.mcfunction'), 'rules/AGENTS.md enforces universal uninstall.mcfunction teardown');
  assert(content.includes('1.21.5+'), 'rules/AGENTS.md documents 1.21.5+ unquoted text component warning');
  assert(content.includes('Standard 3-Step Protocol'), 'rules/AGENTS.md defines Standard 3-Step Protocol for user/ layer');
  assert(content.includes('Context Rule for `@root`') && content.includes('@context @root'), 'rules/AGENTS.md enforces Context Rule for @context @root');
}

// 5. Code Conventions Constraints
assert(fs.existsSync(conventionsPath), 'references/code-conventions.md exists');
if (fs.existsSync(conventionsPath)) {
  const content = fs.readFileSync(conventionsPath, 'utf8');
  assert(content.includes('`@root` Functions') && content.includes('@context @root'), 'code-conventions.md documents @context @root constraints');
}

// 6. Template Assets Correctness
assert(fs.existsSync(uninstallTemplatePath), 'uninstall.mcfunction template exists');
if (fs.existsSync(uninstallTemplatePath)) {
  const content = fs.readFileSync(uninstallTemplatePath, 'utf8');
  assert(content.includes('schedule clear'), 'uninstall.mcfunction template clears scheduled tasks');
  assert(content.includes('kill @e[tag=<namespace>]'), 'uninstall.mcfunction template removes tagged entities');
}

assert(fs.existsSync(resetTemplatePath), 'reset.mcfunction template exists');
if (fs.existsSync(resetTemplatePath)) {
  const content = fs.readFileSync(resetTemplatePath, 'utf8');
  assert(content.includes('function <namespace>:uninstall'), 'reset.mcfunction calls uninstall as step 1');
  assert(content.includes('function <namespace>:load'), 'reset.mcfunction calls load as step 2');
  assert(!content.includes('spawnpoint @a ~ ~ ~'), 'reset.mcfunction template does not use un-scoped spawnpoint @a ~ ~ ~');
  assert(content.includes('execute as @a at @s run spawnpoint @s ~ ~ ~'), 'reset.mcfunction template scopes spawnpoint with execute');
}

assert(fs.existsSync(userTemplatePath), 'user_function_template.mcfunction template exists');
if (fs.existsSync(userTemplatePath)) {
  const content = fs.readFileSync(userTemplatePath, 'utf8');
  assert(content.includes('Consume Input & Reset Triggers'), 'user_function_template includes Consume Input step');
  assert(content.includes('Actor Qualification & Early Exit'), 'user_function_template includes Actor Qualification step');
  assert(content.includes('Delegate to Domain Logic'), 'user_function_template includes Delegation step');
}

// 7. Hooks & Bootstrap Script Execution
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
