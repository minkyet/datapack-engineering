/**
 * Rule 5: Resource Naming Conventions (Objectives, Fake Players, Entity Tags, Storages, Bossbars)
 * Covers: R20, R21, R22, R23
 */

const { hasMacroVariable } = require('../parser');

function isValidDotSnakeCase(str) {
  if (!str) return false;
  return /^[a-z0-9_]+(\.[a-z0-9_]+)*$/.test(str);
}

function toSnakeCaseSuggestion(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase();
}

module.exports = {
  id: 'rule-5-naming',
  category: 'naming',
  severity: 'error',

  check(context) {
    const diagnostics = [];
    const { parsed, projectContext } = context;
    const { fileMeta, extracted, commands } = parsed;

    const ns =
      fileMeta.namespace ||
      (projectContext && projectContext.primaryNamespace) ||
      '<namespace>';

    // R20: Scoreboard Objectives Naming
    const checkedObjectives = new Set();
    const allObjectives = [
      ...extracted.objectiveDefs.map(d => ({ objective: d.objective, line: d.line })),
      ...extracted.scoreRefs.map(r => ({ objective: r.objective, line: r.line }))
    ];

    for (const { objective, line } of allObjectives) {
      if (!objective || hasMacroVariable(objective) || checkedObjectives.has(`${objective}:${line}`)) continue;
      checkedObjectives.add(`${objective}:${line}`);

      const isRootObj = objective === ns;
      const isSubObj =
        objective.startsWith(`${ns}.`) &&
        isValidDotSnakeCase(objective.slice(ns.length + 1).replace(/([A-Z])/g, m => m.toLowerCase()));

      if (!isRootObj && !isSubObj) {
        diagnostics.push({
          ruleId: 'rule-5-naming',
          severity: 'warn',
          line,
          col: 1,
          message: `Scoreboard objective '${objective}' does not follow namespace dot-hierarchy ('${ns}' or '${ns}.<role>')`
        });
      }
    }

    // R21: Scoreboard Fake Players Naming & Objective-Based Prefixes
    for (const ref of extracted.scoreRefs) {
      const { holder, objective, line } = ref;
      if (!holder || holder.startsWith('@') || holder === '*' || hasMacroVariable(holder) || hasMacroVariable(objective)) {
        continue;
      }

      const isConstObjective =
        objective === `${ns}.const` ||
        objective.startsWith(`${ns}.const.`) ||
        /\.const(\.|$)/.test(objective);
      const isDisplayObjective =
        objective === `${ns}.display` ||
        objective.startsWith(`${ns}.display.`) ||
        /\.display(\.|$)/.test(objective);

      const stripped = holder.replace(/^(?:##|#|\$)/, '');

      if (isConstObjective) {
        if (!holder.startsWith('##')) {
          diagnostics.push({
            ruleId: 'rule-5-naming',
            severity: 'error',
            line,
            col: 1,
            message: `Fake player '${holder}' on constant objective '${objective}' must use '##' prefix (recommended: '##${toSnakeCaseSuggestion(stripped)}')`
          });
          continue;
        }
      } else if (isDisplayObjective) {
        if (!holder.startsWith('$')) {
          diagnostics.push({
            ruleId: 'rule-5-naming',
            severity: 'error',
            line,
            col: 1,
            message: `Fake player '${holder}' on display objective '${objective}' must use '$' prefix (recommended: '$${toSnakeCaseSuggestion(stripped)}')`
          });
          continue;
        }
      } else {
        if (holder.startsWith('##')) {
          diagnostics.push({
            ruleId: 'rule-5-naming',
            severity: 'error',
            line,
            col: 1,
            message: `Constant prefix '##' on '${holder}' is reserved for '${ns}.const[.<role>]' objectives (found '${objective}')`
          });
          continue;
        }
        if (holder.startsWith('$')) {
          diagnostics.push({
            ruleId: 'rule-5-naming',
            severity: 'error',
            line,
            col: 1,
            message: `Display prefix '$' on '${holder}' is reserved for '${ns}.display[.<role>]' objectives (found '${objective}')`
          });
          continue;
        }
        if (!holder.startsWith('#')) {
          diagnostics.push({
            ruleId: 'rule-5-naming',
            severity: 'error',
            line,
            col: 1,
            message: `Fake player '${holder}' is missing required '#' prefix (recommended: '#${toSnakeCaseSuggestion(stripped)}')`
          });
          continue;
        }
      }

      // Validate body format: numeric constant (for ##) or dot-separated snake_case
      const isNumericConst = holder.startsWith('##') && /^-?\d+(\.\d+)?$/.test(stripped);
      if (!isNumericConst && !isValidDotSnakeCase(stripped)) {
        const prefix = holder.startsWith('##') ? '##' : holder.startsWith('$') ? '$' : '#';
        diagnostics.push({
          ruleId: 'rule-5-naming',
          severity: 'error',
          line,
          col: 1,
          message: `Fake player '${holder}' violates snake_case naming convention (recommended: '${prefix}${toSnakeCaseSuggestion(stripped)}')`
        });
      }
    }

    // R22: Entity Tags Naming (in selectors and 'tag' commands)
    const tagOccurrences = [];
    for (const sel of extracted.selectors) {
      if (!sel.argsStr) continue;
      const tagRegex = /(?:^|,)\s*tag\s*=\s*!?([^,\s\]]+)/g;
      let match;
      while ((match = tagRegex.exec(sel.argsStr)) !== null) {
        tagOccurrences.push({ tag: match[1], line: sel.line });
      }
    }

    for (const cmd of commands) {
      const { tokens, startLine } = cmd;
      if (!tokens || tokens.length === 0) continue;
      const subCommandStarts = [0];
      for (let i = 0; i < tokens.length - 1; i++) {
        if (tokens[i] === 'run') subCommandStarts.push(i + 1);
      }
      for (const idx of subCommandStarts) {
        if (tokens[idx] === 'tag' && (tokens[idx + 2] === 'add' || tokens[idx + 2] === 'remove')) {
          if (tokens[idx + 3]) {
            tagOccurrences.push({ tag: tokens[idx + 3], line: startLine });
          }
        }
      }
    }

    for (const { tag, line } of tagOccurrences) {
      if (hasMacroVariable(tag)) continue;

      const isValidTag =
        tag === ns ||
        (tag.startsWith(`${ns}.`) && isValidDotSnakeCase(tag.slice(ns.length + 1)));

      if (!isValidTag) {
        diagnostics.push({
          ruleId: 'rule-5-naming',
          severity: 'error',
          line,
          col: 1,
          message: `Entity tag '${tag}' must be namespaced as '${ns}.<role>[.<subrole>]' (e.g. '${ns}.${toSnakeCaseSuggestion(tag)}')`
        });
      }
    }

    // R23.1: Storage Identifiers (<namespace>:<table>)
    const checkedStorages = new Set();
    for (const st of extracted.storageRefs) {
      const key = `${st.id}:${st.line}`;
      if (checkedStorages.has(key)) continue;
      checkedStorages.add(key);

      if (hasMacroVariable(st.id)) continue;

      if (!st.id.startsWith(`${ns}:`) || st.id.length <= ns.length + 1) {
        diagnostics.push({
          ruleId: 'rule-5-naming',
          severity: 'error',
          line: st.line,
          col: 1,
          message: `Storage ID '${st.id}' must use colon-separated datapack namespace '${ns}:<table>'`
        });
      }
    }

    // R23.2: Bossbar Identifiers (<namespace>:<name>)
    const checkedBossbars = new Set();
    for (const bb of extracted.bossbarRefs) {
      const key = `${bb.id}:${bb.line}`;
      if (checkedBossbars.has(key)) continue;
      checkedBossbars.add(key);

      if (hasMacroVariable(bb.id)) continue;

      if (!bb.id.startsWith(`${ns}:`) || bb.id.length <= ns.length + 1) {
        diagnostics.push({
          ruleId: 'rule-5-naming',
          severity: 'error',
          line: bb.line,
          col: 1,
          message: `Bossbar ID '${bb.id}' must use colon-separated datapack namespace '${ns}:<name>'`
        });
      }
    }

    return diagnostics;
  }
};
