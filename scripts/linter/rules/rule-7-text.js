/**
 * Rule 7: Minecraft 1.21.5+ Text Component Formatting
 * Covers: R27
 */

module.exports = {
  id: 'rule-7-text',
  category: 'text-formatting',
  severity: 'warn',

  check(context) {
    const diagnostics = [];
    const { parsed } = context;

    for (const cmd of parsed.commands) {
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
        let payloadToken = null;

        if (head === 'tellraw') {
          payloadToken = tokens[idx + 2];
        } else if (head === 'title') {
          const subAction = tokens[idx + 2];
          if (['title', 'subtitle', 'actionbar'].includes(subAction)) {
            payloadToken = tokens[idx + 3];
          }
        }

        if (payloadToken) {
          const trimmed = payloadToken.trim();
          // Detect single-quoted or double-quoted string wrapping a JSON object or array
          const isSingleQuotedJson =
            trimmed.startsWith("'") &&
            trimmed.endsWith("'") &&
            /^\s*[\[{]/.test(trimmed.slice(1, -1));
          const isEscapedJsonString =
            trimmed.startsWith('"') &&
            trimmed.endsWith('"') &&
            /^\s*[\[{].*[\]}]\s*$/.test(trimmed.slice(1, -1)) &&
            trimmed.includes('\\"');

          if (isSingleQuotedJson || isEscapedJsonString) {
            diagnostics.push({
              ruleId: 'rule-7-text',
              severity: 'warn',
              line: startLine,
              col: 1,
              message: `Quoted JSON text component detected (${trimmed.slice(0, 24)}...); in Minecraft 1.21.5+, write text components as unquoted JSON objects or plain string literals`
            });
          }
        }
      }
    }

    return diagnostics;
  }
};
