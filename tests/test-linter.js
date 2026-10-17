/**
 * Unit and integration test suite for the Datapack Convention Linter.
 */

const fs = require('fs');
const path = require('path');

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

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    console.error(`❌ FAIL: ${message}\n   Expected: ${expectedJson}\n   Actual:   ${actualJson}`);
    testsFailed++;
  } else {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  }
}

console.log('=== Datapack Linter Verification Suite ===\n');

// --- U1: Core Parser & Command Tokenizer Tests ---
const {
  tokenizeCommand,
  parseFunction,
  formatHeader,
  resolveFunctionMeta
} = require('../scripts/linter/parser');

console.log('--- U1: Parser & Command Tokenizer ---');

// 1. Bracket-aware tokenization
{
  const tokens = tokenizeCommand('execute as @e[type=interaction, tag=arena.npc, nbt={interacted:1b}] at @s run scoreboard players set #timer.minigame arena.temp 20');
  assert(tokens.includes('@e[type=interaction, tag=arena.npc, nbt={interacted:1b}]'), 'tokenizeCommand preserves spaces inside selector brackets');
  assert(tokens.includes('#timer.minigame'), 'tokenizeCommand extracts dot-separated fake player');
}

// 2. Function path metadata resolution
{
  const meta = resolveFunctionMeta('/workspace/data/arena/function/game/combat/zzz/apply_damage.mcfunction');
  assert(meta.namespace === 'arena', 'resolveFunctionMeta extracts namespace');
  assert(meta.funcPath === 'game/combat/zzz/apply_damage', 'resolveFunctionMeta extracts funcPath');
  assert(meta.functionId === 'arena:game/combat/zzz/apply_damage', 'resolveFunctionMeta constructs functionId');
  assert(meta.tier === 'game', 'resolveFunctionMeta identifies game tier');
  assert(meta.isSubroutine === true, 'resolveFunctionMeta detects zzz subroutine');
  assert(meta.parentPrefix === 'arena:game/combat', 'resolveFunctionMeta computes parentPrefix for zzz');
}

// 3. Multi-line continuation & score/storage extraction
{
  const sample = [
    '#> arena:game/combat/zzz/apply_damage',
    '# 데미지 계산 및 반영',
    '#',
    '# @context target enemy entity',
    '# @internal',
    '# @private within arena:game/combat',
    '',
    'data modify storage arena:combat log append value {damage:5}',
    'execute if data storage arena:config settings.pvp \\',
    '    if score @s arena.shield matches 1.. \\',
    '    store result storage arena:combat last_shield int 1 \\',
    '    run scoreboard players get @s arena.shield',
    'scoreboard players operation #result.damage arena.temp = @s arena.damage',
    'scoreboard players add @s arena.hp -5'
  ].join('\n');

  const parsed = parseFunction(sample, '/workspace/data/arena/function/game/combat/zzz/apply_damage.mcfunction');
  assert(parsed.header.openerId === 'arena:game/combat/zzz/apply_damage', 'parseFunction extracts header opener ID');
  assertDeepEqual(parsed.header.summaryLines, ['데미지 계산 및 반영'], 'parseFunction extracts summary lines');
  assert(parsed.commands.length === 4, 'parseFunction merges multi-line backslash continuations into 1 logical command');
  assertDeepEqual(
    parsed.extracted.reads,
    [
      'score @s arena.damage',
      'score @s arena.shield',
      'storage arena:config settings.pvp'
    ],
    'parseFunction extracts sorted deduplicated score & storage reads'
  );
  assertDeepEqual(
    parsed.extracted.writes,
    [
      'score #result.damage arena.temp',
      'score @s arena.hp',
      'storage arena:combat last_shield',
      'storage arena:combat log'
    ],
    'parseFunction extracts sorted deduplicated score & storage writes'
  );
}

// 4. Canonical directive order & header formatting (including load.mcfunction @writes omission)
{
  const outOfOrderSample = [
    '#> arena:user/shop/buy',
    '# 상점 구매 처리',
    '#',
    '# @returns @success 구매 성공 여부',
    '# @public',
    '# @context player',
    '# @handles function_tag arena:shop_click',
    '# @input macro {item_id: string}',
    '',
    'scoreboard players remove @s arena.gold 100',
    'execute if score ##price.apple arena.const matches 1.. run data modify storage arena:shop history append value "apple"'
  ].join('\n');

  const parsed = parseFunction(outOfOrderSample, '/workspace/data/arena/function/user/shop/buy.mcfunction');
  assert(parsed.header.isOrderCanonical === false, 'parseFunction detects non-canonical directive order');

  const formatted = formatHeader(parsed);
  const expectedHeader = [
    '#> arena:user/shop/buy',
    '# 상점 구매 처리',
    '#',
    '# @context player',
    '# @public',
    '# @handles function_tag arena:shop_click',
    '# @input macro {item_id: string}',
    '# @reads score ##price.apple arena.const',
    '# @writes',
    '#   score @s arena.gold',
    '#   storage arena:shop history',
    '# @returns @success 구매 성공 여부'
  ].join('\n');
  assertDeepEqual(formatted, expectedHeader, 'formatHeader enforces canonical directive order and inline/block formatting');

  // load.mcfunction omits @writes
  const loadSample = [
    '#> arena:load',
    '# 초기화 함수',
    '#',
    '# @context @root',
    '# @internal',
    '# @handles function_tag minecraft:load',
    '',
    'scoreboard objectives add arena.const dummy',
    'scoreboard players set ##price.apple arena.const 50',
    'data modify storage arena:config initialized set value 1b'
  ].join('\n');
  const parsedLoad = parseFunction(loadSample, '/workspace/data/arena/function/load.mcfunction');
  const formattedLoad = formatHeader(parsedLoad);
  assert(!formattedLoad.includes('@writes'), 'formatHeader omits @writes in load.mcfunction');
}

// 5. Edge cases: empty file, comment-only file, storage from storage & remove
{
  const emptyParsed = parseFunction('', '/workspace/data/arena/function/game/empty.mcfunction');
  assert(emptyParsed.commands.length === 0, 'parseFunction handles empty file gracefully');
  assert(emptyParsed.extracted.reads.length === 0, 'empty file has 0 reads');

  const commentOnly = parseFunction('# Just a comment\n## Section header', '/workspace/data/arena/function/game/comment.mcfunction');
  assert(commentOnly.commands.length === 0, 'parseFunction handles comment-only file gracefully');
  assert(commentOnly.sectionDividers.length === 1, 'parseFunction captures ## section divider');

  const storageCopy = parseFunction(
    'data modify storage arena:dst target set from storage arena:src origin\ndata remove storage arena:temp cache',
    '/workspace/data/arena/function/game/copy.mcfunction'
  );
  assertDeepEqual(storageCopy.extracted.reads, ['storage arena:src origin'], 'data modify ... from storage extracts source read');
  assertDeepEqual(storageCopy.extracted.writes, ['storage arena:dst target', 'storage arena:temp cache'], 'data modify and remove extract storage writes');
}

// --- U2: Linter Engine & Reporter Tests ---
const { lintContent, lintFile, lintDirectory } = require('../scripts/linter/engine');
const { formatDiagnostic, formatReport } = require('../scripts/linter/reporter');

console.log('\n--- U2: Linter Engine & Reporter ---');
{
  const dummyRule = {
    id: 'dummy-no-say',
    category: 'test',
    severity: 'error',
    check(ctx) {
      const diags = [];
      for (const cmd of ctx.parsed.commands) {
        if (cmd.tokens[0] === 'say') {
          diags.push({
            ruleId: 'dummy-no-say',
            severity: 'error',
            line: cmd.startLine,
            col: 1,
            message: 'say command is forbidden'
          });
        }
      }
      return diags;
    },
    fix(ctx) {
      return ctx.content.replace(/^say /gm, '# say ');
    }
  };

  const samplePath = '/workspace/data/arena/function/game/test.mcfunction';
  const resCheck = lintContent('say hello', samplePath, { rules: [dummyRule], fix: false });
  assert(resCheck.errors.length === 1, 'engine.lintContent collects rule errors');
  assert(resCheck.fixed === false, 'engine.lintContent does not fix when fix=false');

  const formattedDiag = formatDiagnostic(resCheck.errors[0], resCheck);
  assert(
    formattedDiag === '[ERROR] arena:game/test:1:1: say command is forbidden (dummy-no-say)',
    'reporter.formatDiagnostic formats [ERROR] <id>:<line>:<col>: <msg> (<rule>)'
  );

  const resFix = lintContent('say hello', samplePath, { rules: [dummyRule], fix: true });
  assert(resFix.fixed === true, 'engine.lintContent marks fixed=true when rule modifies content');
  assert(resFix.errors.length === 0, 'engine.lintContent re-checks after fix and finds 0 residual errors');
  assert(resFix.content === '# say hello', 'engine.lintContent returns fixed content');
}

// --- U3: Rule 1 (Formatting & IMP-Doc) & Rule 7 (1.21.5+ Text) Tests ---
const rule1Formatting = require('../scripts/linter/rules/rule-1-formatting');
const rule7Text = require('../scripts/linter/rules/rule-7-text');

console.log('\n--- U3: Rule 1 (Formatting) & Rule 7 (1.21.5+ Text) ---');
{
  const unformatted = [
    '# 데미지 계산 및 반영',
    '# @internal',
    '# @context target enemy entity',
    '## 1. 상태 기록',
    '\tdata modify storage arena:combat log append value {damage:5}',
    'execute as @s \\',
    '  if score @s arena.damage matches 1.. \\',
    '    run scoreboard players operation #result.damage arena.temp = @s arena.damage'
  ].join('\n');

  const pathU3 = '/workspace/data/arena/function/game/combat/apply_damage.mcfunction';
  const checkRes = lintContent(unformatted, pathU3, { rules: [rule1Formatting], fix: false });
  assert(checkRes.errors.some(e => e.message.includes('header opener')), 'Rule 1 detects missing header opener');
  assert(checkRes.errors.some(e => e.message.includes('canonical order')), 'Rule 1 detects non-canonical directive order');
  assert(checkRes.errors.some(e => e.message.includes('@reads')), 'Rule 1 detects out-of-sync @reads');
  assert(checkRes.errors.some(e => e.message.includes('@writes')), 'Rule 1 detects out-of-sync @writes');
  assert(checkRes.errors.some(e => e.message.includes('Hard tab')), 'Rule 1 detects hard tab');
  assert(checkRes.errors.some(e => e.message.includes('4 spaces')), 'Rule 1 detects non-4-space continuation indent');
  assert(checkRes.warnings.some(w => w.message.includes('numbering')), 'Rule 1 warns on numbered ## section divider');

  const fixRes = lintContent(unformatted, pathU3, { rules: [rule1Formatting], fix: true });
  assert(fixRes.fixed === true, 'Rule 1 --fix modifies unformatted file');
  assert(fixRes.errors.length === 0, 'Rule 1 --fix resolves all formatting/contract errors');
  assert(fixRes.content.startsWith('#> arena:game/combat/apply_damage\n# 데미지 계산 및 반영\n#\n# @context target enemy entity\n# @internal\n# @reads score @s arena.damage\n# @writes\n#   score #result.damage arena.temp\n#   storage arena:combat log'), 'Rule 1 --fix produces canonical IMP-Doc header with synced reads/writes');
  assert(!fixRes.content.includes('\t'), 'Rule 1 --fix removes hard tabs');
  assert(fixRes.content.includes('execute as @s \\\n    if score @s arena.damage matches 1.. \\'), 'Rule 1 --fix normalizes continuation indent to 4 spaces');

  // Rule 7 tests
  const textSample = [
    '#> arena:visual/msg',
    '# 메시지 출력',
    '#',
    '# @context @root',
    '# @internal',
    'tellraw @a \'{"text":"Hello","color":"green"}\'',
    'title @a actionbar \'[{"text":"Alert"}]\'',
    'tellraw @a {"text":"Valid 1.21.5+","color":"gold"}'
  ].join('\n');
  const r7Res = lintContent(textSample, '/workspace/data/arena/function/visual/msg.mcfunction', { rules: [rule7Text] });
  assert(r7Res.warnings.length === 2, 'Rule 7 warns on single-quoted JSON text components in tellraw and title');
}

// --- U4: Rule 2 (Entrypoints) & Rule 3 (4-Tier Hierarchy) Tests ---
const rule2Entrypoints = require('../scripts/linter/rules/rule-2-entrypoints');
const rule3Tiers = require('../scripts/linter/rules/rule-3-tiers');

console.log('\n--- U4: Rule 2 (Entrypoints) & Rule 3 (4-Tier Hierarchy) ---');
{
  // R10: Unauthorized root function
  const rootBad = lintContent(
    '#> arena:helper\n# 잘못된 루트 함수\n#\n# @context @root\n# @internal\nsay hi',
    '/workspace/data/arena/function/helper.mcfunction',
    { rules: [rule2Entrypoints] }
  );
  assert(rootBad.errors.some(e => e.message.includes('Unauthorized root function')), 'Rule 2 blocks non-entrypoint function in root directory');

  // R11: Non-idempotent commands in load.mcfunction
  const loadBad = lintContent(
    [
      '#> arena:load',
      '# 부트스트랩',
      '#',
      '# @context @root',
      '# @internal',
      'gamerule keepInventory true',
      'summon armor_stand ~ ~ ~',
      'kill @e[type=zombie]',
      'setblock 0 64 0 stone',
      'scoreboard players set @a arena.gold 0'
    ].join('\n'),
    '/workspace/data/arena/function/load.mcfunction',
    { rules: [rule2Entrypoints] }
  );
  assert(loadBad.errors.length === 5, 'Rule 2 detects gamerule, summon, kill, setblock, and player score reset in load.mcfunction');

  // R12: uninstall & reset must be @public (and --fix adds @public)
  const uninstallMissingPublic = lintContent(
    '#> arena:uninstall\n# 제거\n#\n# @context @root\nschedule clear arena:tick',
    '/workspace/data/arena/function/uninstall.mcfunction',
    { rules: [rule2Entrypoints, rule1Formatting], fix: false }
  );
  assert(uninstallMissingPublic.errors.some(e => e.message.includes('@public')), 'Rule 2 requires @public on uninstall.mcfunction');

  const uninstallFixed = lintContent(
    '#> arena:uninstall\n# 제거\n#\n# @context @root\nschedule clear arena:tick',
    '/workspace/data/arena/function/uninstall.mcfunction',
    { rules: [rule2Entrypoints, rule1Formatting], fix: true }
  );
  assert(uninstallFixed.errors.length === 0 && uninstallFixed.content.includes('# @public'), 'Rule 2 --fix adds @public to uninstall.mcfunction');

  // R13: user/ requires @context player and forbids zzz/
  const userNoPlayer = lintContent(
    '#> arena:user/click\n# 클릭\n#\n# @context @root\n# @public\nfunction arena:game/act',
    '/workspace/data/arena/function/user/click.mcfunction',
    { rules: [rule3Tiers] }
  );
  assert(userNoPlayer.errors.some(e => e.message.includes('@context player')), 'Rule 3 requires @context player in user/ tier');

  const userZzz = lintContent(
    '#> arena:user/zzz/sub\n# 서브\n#\n# @context player\n# @private within arena:user/click\nfunction arena:game/act',
    '/workspace/data/arena/function/user/zzz/sub.mcfunction',
    { rules: [rule3Tiers] }
  );
  assert(userZzz.errors.some(e => e.message.includes("prohibited inside the 'user/'")), 'Rule 3 forbids zzz/ subroutine inside user/ tier');

  // R14: game/ forbids @public
  const gamePublic = lintContent(
    '#> arena:game/combat/strike\n# 공격\n#\n# @context player\n# @public\nscoreboard players add @s arena.hits 1',
    '/workspace/data/arena/function/game/combat/strike.mcfunction',
    { rules: [rule3Tiers] }
  );
  assert(gamePublic.errors.some(e => e.message.includes("never declare '@public'")), 'Rule 3 forbids @public in game/ tier');

  // R15: visual/ allows score and storage writes without error
  const visualWrites = lintContent(
    [
      '#> arena:visual/hud/update',
      '# HUD 갱신',
      '#',
      '# @context player',
      '# @internal',
      'scoreboard players set $line.1 arena.display.sidebar 10',
      'scoreboard players set @s arena.mana 50',
      'data modify storage arena:ui state set value 1b',
      'playsound minecraft:entity.experience_orb.pickup master @s'
    ].join('\n'),
    '/workspace/data/arena/function/visual/hud/update.mcfunction',
    { rules: [rule3Tiers] }
  );
  assert(visualWrites.errors.length === 0, 'Rule 3 allows scoreboard and storage writes inside visual/ tier (R15)');

  // R16: zzz/ nested forbidden & @private within required (and --fix adds it)
  const nestedZzz = lintContent(
    '#> arena:game/combat/zzz/a/zzz/b\n# 중첩\n#\n# @internal\n',
    '/workspace/data/arena/function/game/combat/zzz/a/zzz/b.mcfunction',
    { rules: [rule3Tiers] }
  );
  assert(nestedZzz.errors.some(e => e.message.includes('Nested subroutine')), 'Rule 3 forbids nested zzz/zzz/ directories');

  const zzzMissingPrivate = lintContent(
    '#> arena:game/combat/zzz/calc\n# 계산\n#\n# @context player\nscoreboard players set #dmg arena.temp 5',
    '/workspace/data/arena/function/game/combat/zzz/calc.mcfunction',
    { rules: [rule3Tiers, rule1Formatting], fix: true }
  );
  assert(zzzMissingPrivate.errors.length === 0 && zzzMissingPrivate.content.includes('# @private within arena:game/combat'), 'Rule 3 --fix adds @private within <parent> to zzz/ subroutine');

  // R17: Non-visual tiers cannot execute tellraw, playsound, particle, title directly
  const gameDirectVisual = lintContent(
    [
      '#> arena:game/combat/hit',
      '# 타격',
      '#',
      '# @context player',
      '# @internal',
      'playsound minecraft:entity.player.attack.strong player @s',
      'particle minecraft:crit ~ ~1 ~ 0 0 0 0.1 10',
      'tellraw @s {"text":"Hit!"}',
      'title @s actionbar {"text":"Combo!"}'
    ].join('\n'),
    '/workspace/data/arena/function/game/combat/hit.mcfunction',
    { rules: [rule3Tiers] }
  );
  assert(gameDirectVisual.errors.length === 4, 'Rule 3 blocks direct playsound, particle, tellraw, and title outside visual/ tier');
}

// --- U5: Rule 4 (Namespace) & Rule 5 (Resource Naming) Tests ---
const rule4Namespace = require('../scripts/linter/rules/rule-4-namespace');
const rule5Naming = require('../scripts/linter/rules/rule-5-naming');

console.log('\n--- U5: Rule 4 (Namespace) & Rule 5 (Resource Naming) ---');
{
  // R18: Multiple custom namespaces
  const multiNsDiags = rule4Namespace.checkProject({
    projectContext: {
      dataDir: '/workspace/data',
      customNamespaces: ['arena', 'custom_lib'],
      primaryNamespace: 'arena'
    }
  });
  assert(multiNsDiags.length === 1 && multiNsDiags[0].severity === 'error', 'Rule 4 detects multiple custom namespaces');

  // R19: Foreign namespace in function call
  const foreignCall = lintContent(
    '#> arena:game/run\n# 실행\n#\n# @context @root\n# @internal\nfunction other_pack:game/do_something',
    '/workspace/data/arena/function/game/run.mcfunction',
    { rules: [rule4Namespace] }
  );
  assert(foreignCall.errors.length === 1, 'Rule 4 detects function call to foreign namespace');

  // R20 & R21: Valid dot-separated fake players & objective-based prefixes
  const validNaming = lintContent(
    [
      '#> arena:game/shop/calc',
      '# 계산',
      '#',
      '# @context player',
      '# @internal',
      'scoreboard players set #timer.minigame arena.temp 60',
      'scoreboard players operation #cost.total arena.temp = ##price.apple arena.const',
      'scoreboard players operation #cost.tax arena.temp = ##-1 arena.const.math',
      'scoreboard players set $line.1 arena.display.sidebar 1',
      'execute as @e[type=interaction, tag=arena.shop.npc] run data modify storage arena:shop cache set value 1b',
      'bossbar set arena:wave_timer visible true'
    ].join('\n'),
    '/workspace/data/arena/function/game/shop/calc.mcfunction',
    { rules: [rule5Naming] }
  );
  assert(
    validNaming.errors.length === 0 && validNaming.warnings.length === 0,
    'Rule 5 accepts #timer.minigame, ##price.apple on .const, $line.1 on .display, namespaced tags, and colon storage/bossbar'
  );

  // R21, R22, R23: Invalid naming cases
  const invalidNaming = lintContent(
    [
      '#> arena:game/shop/bad',
      '# 위반 모음',
      '#',
      '# @context player',
      '# @internal',
      'scoreboard players set #myCounter arena.temp 1',
      'scoreboard players set #apple arena.const 50',
      'scoreboard players set #line1 arena.display.sidebar 1',
      'execute as @e[type=interaction, tag=shop_npc] run data modify storage bad_storage cache set value 1b',
      'bossbar set bad_bossbar visible true'
    ].join('\n'),
    '/workspace/data/arena/function/game/shop/bad.mcfunction',
    { rules: [rule5Naming] }
  );
  assert(invalidNaming.errors.some(e => e.message.includes('#myCounter')), 'Rule 5 detects camelCase fake player #myCounter');
  assert(invalidNaming.errors.some(e => e.message.includes("must use '##' prefix")), 'Rule 5 enforces ## prefix when objective is <ns>.const[.<role>]');
  assert(invalidNaming.errors.some(e => e.message.includes("must use '$' prefix")), 'Rule 5 enforces $ prefix when objective is <ns>.display[.<role>]');
  assert(invalidNaming.errors.some(e => e.message.includes('shop_npc')), 'Rule 5 detects un-namespaced bare entity tag');
  assert(invalidNaming.errors.some(e => e.message.includes('bad_storage')), 'Rule 5 detects storage ID missing namespace:');
  assert(invalidNaming.errors.some(e => e.message.includes('bad_bossbar')), 'Rule 5 detects bossbar ID missing namespace:');
}

const rule6Selectors = require('../scripts/linter/rules/rule-6-selectors');

console.log('\n--- U6: Rule 6 (Entity Selectors & Context Efficiency) ---');
{
  // R24: nbt={...} inside selector -> Error
  const nbtSel = lintContent(
    '#> arena:game/check\n# 검사\n#\n# @context player\n# @internal\nexecute if entity @s[nbt={SelectedItem:{id:"minecraft:diamond"}}] run say hi',
    '/workspace/data/arena/function/game/check.mcfunction',
    { rules: [rule6Selectors] }
  );
  assert(nbtSel.errors.length === 1 && nbtSel.errors[0].message.includes('nbt='), 'Rule 6 reports nbt={...} in selector as Error (R24)');

  // R25: @e without type= -> Warning (NOT Error!)
  const bareE = lintContent(
    '#> arena:game/clear_tags\n# 태그 제거\n#\n# @context @root\n# @internal\ntag @e[tag=arena.temp_target] remove arena.temp_target\nkill @e',
    '/workspace/data/arena/function/game/clear_tags.mcfunction',
    { rules: [rule6Selectors] }
  );
  assert(bareE.errors.length === 0, 'Rule 6 does NOT report @e without type= as Error (R25)');
  assert(bareE.warnings.length === 2, 'Rule 6 reports @e[tag=...] and bare @e without type= as Warning [WARN] (R25)');

  // R25: @e with type= -> Clean
  const typedE = lintContent(
    '#> arena:game/npc\n# NPC 처리\n#\n# @context @root\n# @internal\nexecute as @e[type=interaction, tag=arena.shop.npc] at @s run tp @s ~ ~0.1 ~',
    '/workspace/data/arena/function/game/npc.mcfunction',
    { rules: [rule6Selectors] }
  );
  assert(typedE.errors.length === 0 && typedE.warnings.length === 0, 'Rule 6 passes @e[type=...] and @s / ~ after execute as/at');

  // R26: @context @root using @s or ~ / ^ without execute as/at/positioned -> Error
  const badRootContext = lintContent(
    [
      '#> arena:game/root_bad',
      '# 루트 컨텍스트 오류',
      '#',
      '# @context @root',
      '# @internal',
      'scoreboard players set @s arena.state 1',
      'setblock ~ ~1 ~ stone',
      'execute as @a run setblock ^ ^ ^1 dirt',
      'execute as @a at @s run setblock ^ ^ ^1 dirt'
    ].join('\n'),
    '/workspace/data/arena/function/game/root_bad.mcfunction',
    { rules: [rule6Selectors] }
  );
  assert(badRootContext.errors.some(e => e.line === 6 && e.message.includes('@s')), 'Rule 6 reports bare @s in @context @root without execute as (R26)');
  assert(badRootContext.errors.some(e => e.line === 7 && e.message.includes('coordinate')), 'Rule 6 reports ~ coordinate in @context @root without execute at/positioned (R26)');
  assert(badRootContext.errors.some(e => e.line === 8 && e.message.includes('coordinate')), 'Rule 6 reports ^ coordinate after execute as without at/positioned (R26)');
  assert(!badRootContext.errors.some(e => e.line === 9), 'Rule 6 allows ^ coordinate when preceded by execute as ... at @s (R26)');
}

const { spawnSync } = require('child_process');
const os = require('os');

console.log('\n--- U7: CLI Entrypoint (scripts/lint-datapack.js) ---');
{
  const cliPath = path.join(__dirname, '..', 'scripts', 'lint-datapack.js');

  // --help
  const helpRun = spawnSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });
  assert(helpRun.status === 0 && helpRun.stdout.includes('Usage:'), 'CLI --help prints usage and exits 0');

  // Create temporary test directory in os.tmpdir() for CLI verification
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-lint-cli-'));
  const tmpDir = path.join(tmpBase, 'data', 'arena', 'function', 'game');
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpFile = path.join(tmpDir, 'test_cli.mcfunction');

  try {
    // Write file with fixable errors (missing header opener, wrong directive order, missing @writes, wrong continuation indent)
    fs.writeFileSync(
      tmpFile,
      [
        '# CLI 테스트 함수',
        '#',
        '# @internal',
        '# @context @root',
        'execute as @a \\',
        '  run scoreboard players add @s arena.score 1'
      ].join('\n'),
      'utf8'
    );

    // 1. Check without --fix -> should exit 1
    const checkFail = spawnSync(process.execPath, [cliPath, tmpFile], { encoding: 'utf8' });
    assert(checkFail.status === 1, 'CLI exits 1 when file has convention errors');
    assert((checkFail.stderr + checkFail.stdout).includes('[ERROR]'), 'CLI outputs [ERROR] diagnostic');

    // 2. Run with --fix -> should fix all formatting/header issues and exit 0
    const fixRun = spawnSync(process.execPath, [cliPath, '--fix', tmpFile], { encoding: 'utf8' });
    assert(fixRun.status === 0, 'CLI --fix resolves fixable errors and exits 0');
    assert(fixRun.stdout.includes('[FIXED]'), 'CLI --fix outputs [FIXED] tag');

    // 3. Re-check without --fix -> should exit 0 (idempotent)
    const checkPass = spawnSync(process.execPath, [cliPath, tmpFile], { encoding: 'utf8' });
    assert(checkPass.status === 0, 'CLI exits 0 on subsequent check after --fix');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

console.log('\n--- U8: Fixture Integration Suite (valid & invalid datapacks) ---');
{
  const validDir = path.join(__dirname, 'fixtures', 'valid');
  const validResult = lintDirectory(validDir);
  assert(validResult.totalFiles === 7, 'Valid fixture datapack contains 7 .mcfunction files');
  assert(
    validResult.totalErrors === 0 && validResult.totalWarnings === 0 && validResult.exitCode === 0,
    'Valid fixture datapack passes all 7 rules with 0 errors and 0 warnings'
  );

  const invalidDir = path.join(__dirname, 'fixtures', 'invalid');
  const invalidResult = lintDirectory(invalidDir);
  assert(invalidResult.totalFiles === 1, 'Invalid fixture datapack contains 1 .mcfunction file');
  assert(invalidResult.exitCode === 1 && invalidResult.totalErrors >= 5, 'Invalid fixture datapack triggers errors across multiple rules');
  assert(invalidResult.totalWarnings >= 2, 'Invalid fixture datapack triggers warnings (numbered section, @e without type=, single-quoted JSON)');

  // Review regression checks: nested selector brackets, data merge storage, positioned Y/Z, sibling @private within
  const nestedSel = parseFunction('execute as @e[nbt={Items:[{id:"minecraft:stone"}]}, type=item] run data merge storage arena:shop {open:1b}');
  assert(nestedSel.extracted.selectors[0].argsStr.includes('type=item'), 'Balanced selector scanner preserves args after nested brackets');
  assert(nestedSel.extracted.writes.includes('storage arena:shop'), 'data merge storage extracts storage write contract');

  const badPos = lintContent(
    '#> arena:game/pos\n# 좌표 검사\n#\n# @context @root\n# @internal\nexecute positioned 10 ~ 10 run setblock 0 64 0 stone',
    '/workspace/data/arena/function/game/pos.mcfunction',
    { rules: [rule6Selectors] }
  );
  assert(badPos.errors.length === 1, 'Rule 6 catches relative coordinate ~ in Y argument of execute positioned in @context @root');

  const badSiblingWithin = lintContent(
    '#> arena:game/combat/zzz/calc\n# 서브루틴\n#\n# @context player\n# @private within arena:game/combat_other\nscoreboard players add @s arena.gold 1',
    '/workspace/data/arena/function/game/combat/zzz/calc.mcfunction',
    { rules: [rule3Tiers] }
  );
  assert(badSiblingWithin.errors.length === 1, 'Rule 3 rejects @private within matching sibling prefix arena:game/combat_other');
}

console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`);
if (testsFailed > 0) {
  process.exit(1);
}




