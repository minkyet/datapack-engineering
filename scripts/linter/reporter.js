/**
 * Terminal Reporter and Diagnostic Formatter for Datapack Convention Linter.
 */

/**
 * Formats a single diagnostic item:
 * [ERROR|WARN] <namespace>:<func_path>:<line>:<col>: <message> (<rule-id>)
 *
 * @param {object} diag
 * @param {object} [fileResult]
 * @returns {string}
 */
function formatDiagnostic(diag, fileResult = {}) {
  const tag = diag.severity === 'warn' ? 'WARN' : 'ERROR';
  const target = diag.target || fileResult.functionId || fileResult.filePath || '<unknown>';
  const line = diag.line || 1;
  const col = diag.col || 1;
  const ruleSuffix = diag.ruleId ? ` (${diag.ruleId})` : '';
  return `[${tag}] ${target}:${line}:${col}: ${diag.message}${ruleSuffix}`;
}

/**
 * Formats a full lint run result (either single file or directory run) into a multi-line string.
 *
 * @param {object} runResult
 * @param {object} [options={}]
 * @returns {string}
 */
function formatReport(runResult, options = {}) {
  const lines = [];
  const fileResults = runResult.results || [runResult];

  if (runResult.projectDiagnostics && runResult.projectDiagnostics.length > 0) {
    for (const diag of runResult.projectDiagnostics) {
      lines.push(formatDiagnostic(diag, { filePath: runResult.dirPath || 'datapack' }));
    }
  }

  for (const res of fileResults) {
    if (res.fixed) {
      const label = res.functionId || res.filePath;
      lines.push(`[FIXED] ${label}`);
    }
    const sorted = [...(res.diagnostics || [])].sort((a, b) => (a.line || 1) - (b.line || 1));
    for (const diag of sorted) {
      lines.push(formatDiagnostic(diag, res));
    }
  }

  const totalFiles = runResult.totalFiles !== undefined ? runResult.totalFiles : fileResults.length;
  const totalErrors =
    runResult.totalErrors !== undefined
      ? runResult.totalErrors
      : fileResults.reduce((sum, r) => sum + (r.errors ? r.errors.length : 0), 0);
  const totalWarnings =
    runResult.totalWarnings !== undefined
      ? runResult.totalWarnings
      : fileResults.reduce((sum, r) => sum + (r.warnings ? r.warnings.length : 0), 0);
  const totalFixed =
    runResult.totalFixed !== undefined
      ? runResult.totalFixed
      : fileResults.filter(r => r.fixed).length;

  if (!options.quietSummary) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push(
      `Summary: ${totalFiles} file(s) checked, ${totalErrors} error(s), ${totalWarnings} warning(s), ${totalFixed} file(s) fixed.`
    );
  }

  return lines.join('\n');
}

/**
 * Prints the formatted report to stdout/stderr and returns the exit code (1 if errors > 0, else 0).
 *
 * @param {object} runResult
 * @param {object} [options={}]
 * @returns {number}
 */
function printReport(runResult, options = {}) {
  const output = formatReport(runResult, options);
  if (output) {
    const hasErrors = (runResult.totalErrors || (runResult.errors && runResult.errors.length) || 0) > 0;
    if (hasErrors) {
      console.error(output);
    } else {
      console.log(output);
    }
  }
  const exitCode =
    runResult.exitCode !== undefined
      ? runResult.exitCode
      : (runResult.errors && runResult.errors.length > 0 ? 1 : 0);
  return exitCode;
}

module.exports = {
  formatDiagnostic,
  formatReport,
  printReport
};
