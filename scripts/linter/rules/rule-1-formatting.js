/**
 * Rule 1: Function Formatting & IMP-Doc v2 Comment Standards
 * Covers: R5, R6, R7, R8, R9
 */

const { parseFunction, formatHeader } = require('../parser');

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isContractFormattingValid(directiveItems, expectedItems) {
  if (expectedItems.length === 0) {
    return directiveItems.length === 0;
  }
  if (expectedItems.length === 1) {
    return directiveItems.length === 1 && Boolean(directiveItems[0].isInline);
  }
  // expectedItems.length > 1: must be a single block header followed by expectedItems.length block items
  if (directiveItems.length !== expectedItems.length + 1) return false;
  if (!directiveItems[0].isBlockHeader) return false;
  for (let i = 1; i < directiveItems.length; i++) {
    if (!directiveItems[i].isBlockItem) return false;
  }
  return true;
}

module.exports = {
  id: 'rule-1-formatting',
  category: 'formatting',
  severity: 'error',

  check(context) {
    const diagnostics = [];
    const { parsed } = context;
    const { fileMeta, header, extracted, tabLines, continuations, sectionDividers } = parsed;

    // R5.1: Header opener check
    if (!header.openerId) {
      diagnostics.push({
        ruleId: 'rule-1-formatting',
        severity: 'error',
        line: 1,
        col: 1,
        message: `Missing IMP-Doc v2 header opener (expected '#> ${fileMeta.functionId || '<namespace>:<path>'}')`
      });
    } else if (fileMeta.isDataPath && fileMeta.functionId && header.openerId !== fileMeta.functionId) {
      diagnostics.push({
        ruleId: 'rule-1-formatting',
        severity: 'error',
        line: header.openerLine || 1,
        col: 1,
        message: `Header opener '#> ${header.openerId}' does not match file path (expected '#> ${fileMeta.functionId}')`
      });
    }

    // R5.2: Canonical directive ordering check
    if (!header.isOrderCanonical) {
      diagnostics.push({
        ruleId: 'rule-1-formatting',
        severity: 'error',
        line: 1,
        col: 1,
        message: 'IMP-Doc directives are not in canonical order (@context -> scope -> @handles -> @input -> @reads -> @writes -> @returns)'
      });
    }

    // R6: @reads contract synchronization check
    const readsMatch =
      arraysEqual(header.headerReads, extracted.reads) &&
      isContractFormattingValid(header.directives.reads, extracted.reads);
    if (!readsMatch) {
      diagnostics.push({
        ruleId: 'rule-1-formatting',
        severity: 'error',
        line: 1,
        col: 1,
        message: `@reads contract out of sync with function commands (expected: ${
          extracted.reads.length > 0 ? extracted.reads.join(', ') : 'none'
        })`
      });
    }

    // R6 & R7: @writes contract synchronization check (with load.mcfunction omission)
    if (fileMeta.isLoad) {
      if (header.headerWrites.length > 0 || header.directives.writes.length > 0) {
        diagnostics.push({
          ruleId: 'rule-1-formatting',
          severity: 'error',
          line: 1,
          col: 1,
          message: '@writes directive must be omitted in load.mcfunction (bootstrap exception)'
        });
      }
    } else {
      const writesMatch =
        arraysEqual(header.headerWrites, extracted.writes) &&
        isContractFormattingValid(header.directives.writes, extracted.writes);
      if (!writesMatch) {
        diagnostics.push({
          ruleId: 'rule-1-formatting',
          severity: 'error',
          line: 1,
          col: 1,
          message: `@writes contract out of sync with function commands (expected: ${
            extracted.writes.length > 0 ? extracted.writes.join(', ') : 'none'
          })`
        });
      }
    }

    // R8.1: Hard tabs check
    for (const lineNum of tabLines) {
      diagnostics.push({
        ruleId: 'rule-1-formatting',
        severity: 'error',
        line: lineNum,
        col: 1,
        message: 'Hard tab (\\t) detected; use 4 spaces for indentation'
      });
    }

    // R8.2: 4-space continuation line indentation check
    for (const cont of continuations) {
      if (!cont.isFourSpaces) {
        diagnostics.push({
          ruleId: 'rule-1-formatting',
          severity: 'error',
          line: cont.lineNumber,
          col: 1,
          message: "Continuation line after '\\' must be indented with exactly 4 spaces"
        });
      }
    }

    // R9: Numbered section divider check (Warning)
    for (const sec of sectionDividers) {
      if (/^##\s+\d+[.)]\s*/.test(sec.text)) {
        diagnostics.push({
          ruleId: 'rule-1-formatting',
          severity: 'warn',
          line: sec.lineNumber,
          col: 1,
          message: `Section divider '${sec.text}' should not include numerical numbering`
        });
      }
    }

    return diagnostics;
  },

  fix(context) {
    const { parsed, filePath } = context;
    const { lineEnding, rawLines, header } = parsed;

    // 1. Fix tabs and continuation indentation across body lines
    const bodyStartIdx = header.endLineIndex + 1;
    const fixedRawLines = [...rawLines];

    for (let i = 0; i < fixedRawLines.length; i++) {
      if (fixedRawLines[i].includes('\t')) {
        // If at the beginning of a non-continuation command line, strip leading tabs; otherwise replace with 4 spaces
        fixedRawLines[i] = fixedRawLines[i].replace(/\t/g, '    ');
      }
    }

    let inContinuation = false;
    for (let i = Math.max(0, bodyStartIdx); i < fixedRawLines.length; i++) {
      const line = fixedRawLines[i];
      const trimmed = line.trim();

      if (!inContinuation) {
        if (trimmed === '' || trimmed.startsWith('#')) {
          continue;
        }
        // Top-level command line should not have leading spaces introduced by tab replacement
        fixedRawLines[i] = line.trimStart();
        inContinuation = /\\\s*$/.test(fixedRawLines[i]);
      } else {
        fixedRawLines[i] = `    ${line.trimStart()}`;
        inContinuation = /\\\s*$/.test(fixedRawLines[i]);
      }
    }

    // 2. Re-parse and regenerate canonical header with synced @reads / @writes
    const intermediateContent = fixedRawLines.join(lineEnding);
    const reParsed = parseFunction(intermediateContent, filePath);
    const formattedHeaderStr = formatHeader(reParsed);
    const headerOutLines = formattedHeaderStr.split('\n');

    const remainingBodyLines = fixedRawLines.slice(reParsed.header.endLineIndex + 1);
    let finalLines;
    if (remainingBodyLines.length > 0) {
      finalLines = [...headerOutLines, ...remainingBodyLines];
    } else {
      finalLines = [...headerOutLines];
    }

    return finalLines.join(lineEnding);
  }
};
