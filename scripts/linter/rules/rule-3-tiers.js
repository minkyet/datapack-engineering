/**
 * Rule 3: Directory Structure, 4 Functional Tiers & Subroutine Isolation
 * Covers: R13, R14, R15, R16, R17
 */

const { formatHeader } = require('../parser');

const PRESENTATION_COMMANDS = new Set([
  'tellraw',
  'playsound',
  'particle',
  'title',
  'subtitle',
  'actionbar'
]);

module.exports = {
  id: 'rule-3-tiers',
  category: 'tiers',
  severity: 'error',

  check(context) {
    const diagnostics = [];
    const { parsed } = context;
    const { fileMeta, header, commands } = parsed;

    // R16.1: Nested zzz/zzz/ is strictly forbidden
    if (fileMeta.hasNestedZzz) {
      diagnostics.push({
        ruleId: 'rule-3-tiers',
        severity: 'error',
        line: 1,
        col: 1,
        message: "Nested subroutine directories ('zzz/.../zzz/') are strictly forbidden; keep all subroutines flat inside a single 'zzz/' folder"
      });
    }

    // R13: user/ tier requires @context player and forbids zzz/
    if (fileMeta.tier === 'user') {
      if (fileMeta.isSubroutine) {
        diagnostics.push({
          ruleId: 'rule-3-tiers',
          severity: 'error',
          line: 1,
          col: 1,
          message: "Subroutine folder 'zzz/' is prohibited inside the 'user/' controller tier; factor complex logic into 'game/' or 'system/'"
        });
      }

      const hasPlayerContext = header.directives.context.some(c => /\bplayer\b/i.test(c.value));
      if (!hasPlayerContext) {
        diagnostics.push({
          ruleId: 'rule-3-tiers',
          severity: 'error',
          line: 1,
          col: 1,
          message: "Functions in 'user/' tier must declare '@context player'"
        });
      }
    }

    // R14: game/ tier forbids @public and requires @internal or @private
    if (fileMeta.tier === 'game') {
      const hasPublic = header.directives.scope.some(s => s.tag === '@public');
      if (hasPublic) {
        diagnostics.push({
          ruleId: 'rule-3-tiers',
          severity: 'error',
          line: 1,
          col: 1,
          message: "Functions in 'game/' tier must never declare '@public'; use '@internal' or '@private within'"
        });
      } else {
        const hasValidScope = header.directives.scope.some(
          s => s.tag === '@internal' || s.tag === '@private'
        );
        if (!hasValidScope) {
          diagnostics.push({
            ruleId: 'rule-3-tiers',
            severity: 'error',
            line: 1,
            col: 1,
            message: "Functions in 'game/' tier must declare '@internal' (or '@private within' for subroutines)"
          });
        }
      }
    }

    // R15: visual/ tier has no write restrictions (allowed to modify scoreboards and storages freely)

    // R16.2: zzz/ subroutines must declare @private within <parent>
    if (fileMeta.isSubroutine && fileMeta.tier !== 'user' && !fileMeta.hasNestedZzz) {
      const expectedPrefix = fileMeta.parentPrefix;
      const privateDirective = header.directives.scope.find(s => s.tag === '@private');
      const withinValue =
        privateDirective && privateDirective.value.startsWith('within ')
          ? privateDirective.value.slice(7).trim()
          : null;

      const isValidWithin =
        Boolean(withinValue) &&
        (!expectedPrefix ||
          withinValue === expectedPrefix ||
          withinValue.startsWith(`${expectedPrefix}/`));

      if (!isValidWithin) {
        diagnostics.push({
          ruleId: 'rule-3-tiers',
          severity: 'error',
          line: 1,
          col: 1,
          message: `Subroutine in 'zzz/' must declare '@private within ${expectedPrefix || '<parent>'}'`
        });
      }
    }

    // R17: Non-visual tiers cannot directly execute presentation commands
    if (fileMeta.tier !== 'visual') {
      for (const cmd of commands) {
        const { tokens, startLine } = cmd;
        if (!tokens || tokens.length === 0) continue;

        const subCommandStarts = [0];
        for (let i = 0; i < tokens.length - 1; i++) {
          if (tokens[i] === 'run') {
            subCommandStarts.push(i + 1);
          }
        }

        for (const idx of subCommandStarts) {
          const head = tokens[idx];
          if (PRESENTATION_COMMANDS.has(head)) {
            diagnostics.push({
              ruleId: 'rule-3-tiers',
              severity: 'error',
              line: startLine,
              col: 1,
              message: `Direct presentation command '${head}' is forbidden in '${fileMeta.tier}' tier; delegate visual/audio effects to a 'visual/' tier function`
            });
          }
        }
      }
    }

    return diagnostics;
  },

  fix(context) {
    const { parsed } = context;
    const { fileMeta, header, rawLines, lineEnding } = parsed;

    if (fileMeta.isSubroutine && fileMeta.tier !== 'user' && !fileMeta.hasNestedZzz) {
      const expectedPrefix = fileMeta.parentPrefix;
      const privateDirective = header.directives.scope.find(s => s.tag === '@private');
      const withinValue =
        privateDirective && privateDirective.value.startsWith('within ')
          ? privateDirective.value.slice(7).trim()
          : null;

      const isValidWithin =
        Boolean(withinValue) &&
        (!expectedPrefix ||
          withinValue === expectedPrefix ||
          withinValue.startsWith(`${expectedPrefix}/`));

      if (!isValidWithin && expectedPrefix) {
        const newScope = [
          ...header.directives.scope.filter(s => s.tag !== '@private'),
          {
            tag: '@private',
            value: `within ${expectedPrefix}`,
            fullDirective: `@private within ${expectedPrefix}`
          }
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
