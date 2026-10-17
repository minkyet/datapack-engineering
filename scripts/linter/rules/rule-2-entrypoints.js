/**
 * Rule 2: Datapack Entry Points (Root Function Rules)
 * Covers: R10, R11, R12
 */

const { formatHeader } = require('../parser');

module.exports = {
  id: 'rule-2-entrypoints',
  category: 'entrypoints',
  severity: 'error',

  checkProject({ projectContext }) {
    const diagnostics = [];
    if (!projectContext || !projectContext.dataDir) {
      return diagnostics;
    }

    for (const ns of projectContext.customNamespaces || []) {
      const rootFiles = projectContext.rootFilesByNamespace[ns];
      if (!Array.isArray(rootFiles)) continue;

      if (!rootFiles.includes('uninstall')) {
        diagnostics.push({
          ruleId: 'rule-2-entrypoints',
          severity: 'error',
          line: 1,
          col: 1,
          target: `${ns}:uninstall`,
          message: `Missing mandatory teardown entrypoint 'data/${ns}/function/uninstall.mcfunction'`
        });
      }

      if (!rootFiles.includes('reset')) {
        diagnostics.push({
          ruleId: 'rule-2-entrypoints',
          severity: 'error',
          line: 1,
          col: 1,
          target: `${ns}:reset`,
          message: `Missing mandatory factory reset entrypoint 'data/${ns}/function/reset.mcfunction'`
        });
      }
    }

    return diagnostics;
  },

  check(context) {
    const diagnostics = [];
    const { parsed } = context;
    const { fileMeta, header, commands } = parsed;

    // R10: Only load, tick, uninstall, reset permitted directly in root function directory
    if (fileMeta.isDataPath && fileMeta.tier === 'root' && !fileMeta.isEntrypoint) {
      diagnostics.push({
        ruleId: 'rule-2-entrypoints',
        severity: 'error',
        line: 1,
        col: 1,
        message: `Unauthorized root function '${fileMeta.funcPath}.mcfunction'; only lifecycle entrypoints (load, tick, uninstall, reset) are permitted directly in 'data/${fileMeta.namespace}/function/'`
      });
    }

    // R11: load.mcfunction Hot-Reload Idempotency
    if (fileMeta.isLoad) {
      for (const cmd of commands) {
        const { tokens, startLine } = cmd;
        if (!tokens || tokens.length === 0) continue;

        const subCommandStarts = [0];
        for (let i = 0; i < tokens.length - 1; i++) {
          if (tokens[i] === 'run') {
            subCommandStarts.push(i + 1);
          }
        }

        // Check for execute ... summon inside execute chain
        let reportedSummon = false;
        if (tokens[0] === 'execute') {
          for (let i = 1; i < tokens.length; i++) {
            if (tokens[i] === 'run') break;
            if (tokens[i] === 'summon') {
              diagnostics.push({
                ruleId: 'rule-2-entrypoints',
                severity: 'error',
                line: startLine,
                col: 1,
                message: "Non-idempotent entity manipulation 'summon' is forbidden in load.mcfunction (violates hot-reload safety)"
              });
              reportedSummon = true;
              break;
            }
          }
        }

        for (const idx of subCommandStarts) {
          const head = tokens[idx];
          if (!head) continue;

          if (head === 'gamerule') {
            diagnostics.push({
              ruleId: 'rule-2-entrypoints',
              severity: 'error',
              line: startLine,
              col: 1,
              message: "Non-idempotent command 'gamerule' is forbidden in load.mcfunction (violates hot-reload safety; move initial gamerules to reset.mcfunction)"
            });
          } else if (head === 'summon' && !reportedSummon) {
            diagnostics.push({
              ruleId: 'rule-2-entrypoints',
              severity: 'error',
              line: startLine,
              col: 1,
              message: "Non-idempotent entity manipulation 'summon' is forbidden in load.mcfunction (violates hot-reload safety)"
            });
          } else if (head === 'kill') {
            diagnostics.push({
              ruleId: 'rule-2-entrypoints',
              severity: 'error',
              line: startLine,
              col: 1,
              message: "Non-idempotent entity manipulation 'kill' is forbidden in load.mcfunction (violates hot-reload safety)"
            });
          } else if (head === 'setblock' || head === 'fill') {
            diagnostics.push({
              ruleId: 'rule-2-entrypoints',
              severity: 'error',
              line: startLine,
              col: 1,
              message: `Non-idempotent block modification '${head}' is forbidden in load.mcfunction (violates hot-reload safety)`
            });
          } else if (
            head === 'scoreboard' &&
            tokens[idx + 1] === 'players' &&
            ['set', 'add', 'remove', 'reset', 'operation'].includes(tokens[idx + 2])
          ) {
            const holder = tokens[idx + 3];
            if (holder && holder.startsWith('@')) {
              diagnostics.push({
                ruleId: 'rule-2-entrypoints',
                severity: 'error',
                line: startLine,
                col: 1,
                message: `Resetting or mutating entity/player score ('${holder}') is forbidden in load.mcfunction (violates hot-reload safety)`
              });
            }
          }
        }
      }
    }

    // R12: uninstall.mcfunction and reset.mcfunction must declare @public
    if (fileMeta.funcPath === 'uninstall' || fileMeta.funcPath === 'reset') {
      const hasPublic = header.directives.scope.some(s => s.tag === '@public');
      if (!hasPublic) {
        diagnostics.push({
          ruleId: 'rule-2-entrypoints',
          severity: 'error',
          line: 1,
          col: 1,
          message: `Lifecycle entrypoint '${fileMeta.funcPath}.mcfunction' must declare '@public' visibility`
        });
      }
    }

    return diagnostics;
  },

  fix(context) {
    const { parsed } = context;
    const { fileMeta, header, rawLines, lineEnding } = parsed;

    if (fileMeta.funcPath === 'uninstall' || fileMeta.funcPath === 'reset') {
      const hasPublic = header.directives.scope.some(s => s.tag === '@public');
      if (!hasPublic) {
        const newScope = [
          ...header.directives.scope.filter(s => s.tag !== '@internal' && s.tag !== '@private'),
          { tag: '@public', value: '', fullDirective: '@public' }
        ];
        const formattedHeaderStr = formatHeader(parsed, { scopeDirectives: newScope });
        const headerOutLines = formattedHeaderStr.split('\n');
        const remainingBodyLines = rawLines.slice(header.endLineIndex + 1);
        return [...headerOutLines, ...remainingBodyLines].join(lineEnding);
      }
    }

    return context.content;
  }
};
