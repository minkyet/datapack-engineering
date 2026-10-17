/**
 * Linter Engine & File Scanner for Datapack Convention Linter.
 */

const fs = require('fs');
const path = require('path');
const { parseFunction } = require('./parser');

const DEFAULT_RULE_FILES = [
  'rule-2-entrypoints.js',
  'rule-3-tiers.js',
  'rule-1-formatting.js',
  'rule-4-namespace.js',
  'rule-5-naming.js',
  'rule-6-selectors.js',
  'rule-7-text.js'
];

/**
 * Loads the default 7 convention rule modules that currently exist in ./rules/.
 * Note: rule-2 and rule-3 are placed before rule-1 so their directive autofixes
 * (@public on uninstall/reset, @private within on zzz/) are formatted in canonical
 * order by rule-1-formatting in a single pass.
 *
 * @returns {object[]}
 */
function loadDefaultRules() {
  const rulesDir = path.join(__dirname, 'rules');
  const rules = [];
  if (!fs.existsSync(rulesDir)) {
    return rules;
  }
  for (const file of DEFAULT_RULE_FILES) {
    const fullPath = path.join(rulesDir, file);
    if (fs.existsSync(fullPath)) {
      rules.push(require(fullPath));
    }
  }
  return rules;
}

/**
 * Recursively collects all .mcfunction files under a directory.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function collectMcfunctionFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMcfunctionFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.mcfunction')) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

/**
 * Discovers datapack structure (data/ directory, custom namespaces, root entrypoints)
 * given a target directory or file path.
 *
 * @param {string} targetPath
 * @returns {object}
 */
function discoverProjectContext(targetPath) {
  const absPath = path.resolve(targetPath);
  let dataDir = null;

  if (fs.existsSync(absPath) && fs.statSync(absPath).isDirectory()) {
    if (path.basename(absPath) === 'data') {
      dataDir = absPath;
    } else if (fs.existsSync(path.join(absPath, 'data')) && fs.statSync(path.join(absPath, 'data')).isDirectory()) {
      dataDir = path.join(absPath, 'data');
    }
  }

  // If targetPath is inside a data/ directory, walk up to find it
  if (!dataDir) {
    let curr = absPath;
    while (curr && curr !== path.dirname(curr)) {
      if (path.basename(curr) === 'data' && fs.existsSync(curr) && fs.statSync(curr).isDirectory()) {
        dataDir = curr;
        break;
      }
      curr = path.dirname(curr);
    }
  }

  const allNamespaces = [];
  const customNamespaces = [];
  const rootFilesByNamespace = {};

  if (dataDir && fs.existsSync(dataDir)) {
    const entries = fs.readdirSync(dataDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        allNamespaces.push(entry.name);
        if (entry.name !== 'minecraft') {
          customNamespaces.push(entry.name);
        }

        const fnDir = fs.existsSync(path.join(dataDir, entry.name, 'function'))
          ? path.join(dataDir, entry.name, 'function')
          : fs.existsSync(path.join(dataDir, entry.name, 'functions'))
          ? path.join(dataDir, entry.name, 'functions')
          : null;

        if (fnDir) {
          const fnEntries = fs.readdirSync(fnDir, { withFileTypes: true });
          rootFilesByNamespace[entry.name] = fnEntries
            .filter(e => e.isFile() && e.name.endsWith('.mcfunction'))
            .map(e => path.basename(e.name, '.mcfunction'));
        }
      }
    }
  }

  const primaryNamespace = customNamespaces.length === 1 ? customNamespaces[0] : customNamespaces[0] || null;

  return {
    targetPath: absPath,
    dataDir,
    allNamespaces,
    customNamespaces,
    primaryNamespace,
    rootFilesByNamespace
  };
}

/**
 * Lints in-memory .mcfunction content against active rules, optionally applying autofixes.
 *
 * @param {string} content
 * @param {string} [filePath='']
 * @param {object} [options={}]
 * @returns {object}
 */
function lintContent(content, filePath = '', options = {}) {
  const rules = options.rules || loadDefaultRules();
  const fix = Boolean(options.fix);
  const projectContext = options.projectContext || (filePath ? discoverProjectContext(filePath) : null);

  let currentContent = content;
  let parsed = parseFunction(currentContent, filePath);
  let fixed = false;

  if (fix) {
    // Up to 2 passes to ensure directive additions + header formatting converge cleanly
    for (let pass = 0; pass < 2; pass++) {
      let changedInPass = false;
      for (const rule of rules) {
        if (typeof rule.fix === 'function') {
          const ctx = {
            content: currentContent,
            filePath,
            parsed,
            projectContext,
            options
          };
          const updated = rule.fix(ctx);
          if (typeof updated === 'string' && updated !== currentContent) {
            currentContent = updated;
            parsed = parseFunction(currentContent, filePath);
            fixed = true;
            changedInPass = true;
          }
        }
      }
      if (!changedInPass) break;
    }
  }

  const diagnostics = [];
  for (const rule of rules) {
    if (typeof rule.check === 'function') {
      const ctx = {
        content: currentContent,
        filePath,
        parsed,
        projectContext,
        options
      };
      const ruleDiags = rule.check(ctx) || [];
      for (const d of ruleDiags) {
        diagnostics.push({
          ruleId: d.ruleId || rule.id,
          severity: d.severity || rule.severity || 'error',
          line: d.line || 1,
          col: d.col || 1,
          message: d.message,
          target: d.target || parsed.fileMeta.functionId || filePath
        });
      }
    }
  }

  const errors = diagnostics.filter(d => d.severity === 'error');
  const warnings = diagnostics.filter(d => d.severity === 'warn');

  return {
    filePath,
    functionId: parsed.fileMeta.functionId,
    originalContent: content,
    content: currentContent,
    fixed,
    diagnostics,
    errors,
    warnings,
    exitCode: errors.length > 0 ? 1 : 0
  };
}

/**
 * Lints a single .mcfunction file on disk, writing back changes only if --fix modified content.
 *
 * @param {string} filePath
 * @param {object} [options={}]
 * @returns {object}
 */
function lintFile(filePath, options = {}) {
  const absPath = path.resolve(filePath);
  const originalContent = fs.readFileSync(absPath, 'utf8');
  const result = lintContent(originalContent, absPath, options);

  if (options.fix && result.fixed && result.content !== originalContent) {
    fs.writeFileSync(absPath, result.content, 'utf8');
  }

  return result;
}

/**
 * Lints an entire directory (datapack root or data/ folder), running both project-level
 * and per-file rules.
 *
 * @param {string} dirPath
 * @param {object} [options={}]
 * @returns {object}
 */
function lintDirectory(dirPath, options = {}) {
  const absDir = path.resolve(dirPath);
  const rules = options.rules || loadDefaultRules();
  const projectContext = options.projectContext || discoverProjectContext(absDir);
  const files = collectMcfunctionFiles(absDir);

  const projectDiagnostics = [];
  for (const rule of rules) {
    if (typeof rule.checkProject === 'function') {
      const pDiags = rule.checkProject({ projectContext, files, options }) || [];
      for (const d of pDiags) {
        projectDiagnostics.push({
          ruleId: d.ruleId || rule.id,
          severity: d.severity || rule.severity || 'error',
          line: d.line || 1,
          col: d.col || 1,
          message: d.message,
          target: d.target || projectContext.primaryNamespace || absDir
        });
      }
    }
  }

  const results = [];
  for (const file of files) {
    results.push(lintFile(file, { ...options, rules, projectContext }));
  }

  const projectErrors = projectDiagnostics.filter(d => d.severity === 'error').length;
  const projectWarnings = projectDiagnostics.filter(d => d.severity === 'warn').length;

  const totalErrors =
    projectErrors + results.reduce((sum, r) => sum + r.errors.length, 0);
  const totalWarnings =
    projectWarnings + results.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalFixed = results.filter(r => r.fixed).length;

  return {
    dirPath: absDir,
    projectContext,
    projectDiagnostics,
    results,
    totalFiles: files.length,
    totalErrors,
    totalWarnings,
    totalFixed,
    exitCode: totalErrors > 0 ? 1 : 0
  };
}

module.exports = {
  loadDefaultRules,
  collectMcfunctionFiles,
  discoverProjectContext,
  lintContent,
  lintFile,
  lintDirectory
};
