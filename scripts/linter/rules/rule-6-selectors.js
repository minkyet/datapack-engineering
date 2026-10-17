'use strict';

const RULE_ID = 'rule-6-selectors';

/**
 * Rule 6: Entity Selectors & Context Efficiency
 * - R24: Forbid nbt={...} inside any selector -> Error
 * - R25: Warn when @e is missing type= -> Warning ([WARN])
 * - R26: In @context @root functions, forbid bare @s or relative/local coordinates (~, ^)
 *        without establishing context via execute as / at / positioned -> Error
 */
function check({ parsed }) {
  const diagnostics = [];
  const { fileMeta, header, commands, extracted } = parsed;

  // R24 & R25: Check all selectors
  for (const sel of extracted.selectors) {
    // R24: nbt={...} inside selector
    if (/\bnbt\s*=\s*\{/.test(sel.argsStr)) {
      diagnostics.push({
        ruleId: RULE_ID,
        severity: 'error',
        line: sel.line,
        col: 1,
        functionId: fileMeta.functionId,
        filePath: fileMeta.filePath,
        message: `Selector '${sel.raw}' uses 'nbt={...}', which is forbidden for performance reasons. Use predicates, tags, or scoreboard checks instead.`
      });
    }

    // R25: @e without type= is a Warning ([WARN])
    if (sel.type === 'e' && !/\btype\s*=/.test(sel.argsStr)) {
      diagnostics.push({
        ruleId: RULE_ID,
        severity: 'warn',
        line: sel.line,
        col: 1,
        functionId: fileMeta.functionId,
        filePath: fileMeta.filePath,
        message: `Selector '${sel.raw}' uses '@e' without a 'type=' filter. Specify 'type=' whenever possible to avoid scanning all world entities.`
      });
    }
  }

  // R26: @context @root validation
  const isRootContext =
    fileMeta.isLoad ||
    header.directives.context.some(c => c.value.includes('@root'));

  if (isRootContext) {
    for (const cmd of commands) {
      const tokens = cmd.tokens;
      if (tokens.length === 0) continue;

      let inExecuteChain = tokens[0] === 'execute';
      let hasEntityContext = false;
      let hasPositionContext = false;
      let reportedSelf = false;
      let reportedCoord = false;

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];

        if (tok === 'execute' && (i === 0 || tokens[i - 1] === 'run')) {
          inExecuteChain = true;
          continue;
        }

        if (inExecuteChain && tok === 'run') {
          inExecuteChain = false;
          continue;
        }

        // Check if current token references @s without entity context
        if (!hasEntityContext && !reportedSelf && /^@s(\[|$)/.test(tok)) {
          diagnostics.push({
            ruleId: RULE_ID,
            severity: 'error',
            line: cmd.startLine,
            col: 1,
            functionId: fileMeta.functionId,
            filePath: fileMeta.filePath,
            message: `Selector '@s' cannot be used in '@context @root' without establishing entity context via 'execute as' first.`
          });
          reportedSelf = true;
        }

        // Check if current token is a relative (~) or local (^) coordinate without position context
        if (!hasPositionContext && !reportedCoord && /^[~^][-+]?(\d+(\.\d+)?)?$/.test(tok)) {
          diagnostics.push({
            ruleId: RULE_ID,
            severity: 'error',
            line: cmd.startLine,
            col: 1,
            functionId: fileMeta.functionId,
            filePath: fileMeta.filePath,
            message: `Relative/local coordinate '${tok}' cannot be used in '@context @root' without establishing spatial context via 'execute at' or 'execute positioned' first.`
          });
          reportedCoord = true;
        }

        // Update context state while walking execute subcommands
        if (inExecuteChain && i >= 2) {
          const prev = tokens[i - 1];
          if (prev === 'as' || prev === 'summon') {
            hasEntityContext = true;
          } else if (prev === 'at') {
            hasPositionContext = true;
          } else if (tokens[i - 2] === 'positioned' && (prev === 'as' || prev === 'over')) {
            hasPositionContext = true;
          } else if (
            i >= 4 &&
            tokens[i - 3] === 'positioned' &&
            tokens[i - 2] !== 'as' &&
            tokens[i - 2] !== 'over'
          ) {
            hasPositionContext = true;
          }
        }
      }
    }
  }

  return diagnostics;
}

module.exports = {
  id: RULE_ID,
  category: 'selectors',
  severity: 'error',
  check
};

