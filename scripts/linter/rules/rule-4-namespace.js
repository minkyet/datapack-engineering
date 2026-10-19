/**
 * Rule 4: Datapack Name & Single Custom Namespace Hygiene
 * Covers: R18, R19
 */

const { hasMacroVariable } = require('../parser');

module.exports = {
  id: 'rule-4-namespace',
  category: 'namespace',
  severity: 'error',

  checkProject({ projectContext }) {
    const diagnostics = [];
    if (!projectContext) return diagnostics;

    const customNs = projectContext.customNamespaces || [];

    // R18: Single custom namespace rule
    if (customNs.length > 1) {
      diagnostics.push({
        ruleId: 'rule-4-namespace',
        severity: 'error',
        line: 1,
        col: 1,
        target: projectContext.dataDir || 'data/',
        message: `Multiple custom namespaces detected under 'data/' (${customNs.join(', ')}); map-making datapacks must define only a single custom namespace plus 'minecraft'`
      });
    }

    for (const ns of customNs) {
      if (ns !== '<namespace>' && !/^[a-z0-9_]+$/.test(ns)) {
        diagnostics.push({
          ruleId: 'rule-4-namespace',
          severity: 'warn',
          line: 1,
          col: 1,
          target: `data/${ns}`,
          message: `Custom namespace '${ns}' should use lowercase snake_case without hyphens or dots`
        });
      }
    }

    return diagnostics;
  },

  check(context) {
    const diagnostics = [];
    const { parsed, projectContext } = context;
    const { fileMeta, extracted } = parsed;

    const expectedNs =
      (projectContext &&
        projectContext.customNamespaces &&
        projectContext.customNamespaces.length === 1 &&
        projectContext.customNamespaces[0]) ||
      fileMeta.namespace;

    if (!expectedNs) return diagnostics;

    // R19: Check function calls for foreign namespaces
    for (const call of extracted.functionCalls) {
      if (hasMacroVariable(call.id)) continue;

      const cleanId = call.id.startsWith('#') ? call.id.slice(1) : call.id;
      const colonIdx = cleanId.indexOf(':');
      if (colonIdx !== -1) {
        const callNs = cleanId.slice(0, colonIdx);
        if (callNs !== expectedNs && callNs !== 'minecraft') {
          diagnostics.push({
            ruleId: 'rule-4-namespace',
            severity: 'error',
            line: call.line,
            col: 1,
            message: `Function reference '${call.id}' uses foreign namespace '${callNs}' (expected '${expectedNs}')`
          });
        }
      } else {
        diagnostics.push({
          ruleId: 'rule-4-namespace',
          severity: 'error',
          line: call.line,
          col: 1,
          message: `Function reference '${call.id}' is missing explicit namespace '${expectedNs}:'`
        });
      }
    }

    return diagnostics;
  }
};
