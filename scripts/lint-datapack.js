#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { lintFile, lintDirectory } = require('./linter/engine');
const { printReport } = require('./linter/reporter');

function printHelp() {
  console.log(`Usage: node scripts/lint-datapack.js [--fix] [path...]

Minecraft Datapack Convention Linter & Autofixer (1.21.5+)

Options:
  --fix       Automatically fix formatting, IMP-Doc headers, and @reads/@writes contracts
  -h, --help  Show this help message

Arguments:
  [path...]   Target .mcfunction file(s) or directory (defaults to ./data if present)
`);
}

function runCli(argv = process.argv.slice(2)) {
  let fix = false;
  const targets = [];

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp();
      return 0;
    } else if (arg === '--fix') {
      fix = true;
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      printHelp();
      return 1;
    } else {
      targets.push(arg);
    }
  }

  if (targets.length === 0) {
    const defaultDataDir = path.join(process.cwd(), 'data');
    const fallbackValidFixtures = path.join(process.cwd(), 'tests', 'fixtures', 'valid');
    if (fs.existsSync(defaultDataDir)) {
      targets.push(defaultDataDir);
    } else if (fs.existsSync(fallbackValidFixtures)) {
      targets.push(fallbackValidFixtures);
    } else {
      console.log('Summary: 0 file(s) checked, 0 error(s), 0 warning(s), 0 file(s) fixed.');
      return 0;
    }
  }

  const aggregated = {
    projectDiagnostics: [],
    results: [],
    totalFiles: 0,
    totalErrors: 0,
    totalWarnings: 0,
    totalFixed: 0,
    exitCode: 0
  };

  for (const target of targets) {
    const absTarget = path.resolve(target);
    if (!fs.existsSync(absTarget)) {
      console.error(`[ERROR] Path not found: ${target}`);
      return 1;
    }

    const stat = fs.statSync(absTarget);
    if (stat.isDirectory()) {
      const dirRes = lintDirectory(absTarget, { fix });
      aggregated.projectDiagnostics.push(...dirRes.projectDiagnostics);
      aggregated.results.push(...dirRes.results);
      aggregated.totalFiles += dirRes.totalFiles;
      aggregated.totalErrors += dirRes.totalErrors;
      aggregated.totalWarnings += dirRes.totalWarnings;
      aggregated.totalFixed += dirRes.totalFixed;
    } else if (stat.isFile()) {
      const fileRes = lintFile(absTarget, { fix });
      aggregated.results.push(fileRes);
      aggregated.totalFiles += 1;
      aggregated.totalErrors += fileRes.errors.length;
      aggregated.totalWarnings += fileRes.warnings.length;
      aggregated.totalFixed += fileRes.fixed ? 1 : 0;
    }
  }

  aggregated.exitCode = aggregated.totalErrors > 0 ? 1 : 0;
  return printReport(aggregated);
}

if (require.main === module) {
  const code = runCli();
  process.exit(code);
}

module.exports = { runCli };
