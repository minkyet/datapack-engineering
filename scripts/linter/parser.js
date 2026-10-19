/**
 * Core Parser & Command Tokenizer for Minecraft .mcfunction files and IMP-Doc v2 headers.
 */

const path = require('path');

const CANONICAL_DIRECTIVE_ORDER = [
  'context',
  'scope',
  'handles',
  'input',
  'reads',
  'writes',
  'returns'
];

const DIRECTIVE_RANK = Object.fromEntries(
  CANONICAL_DIRECTIVE_ORDER.map((name, idx) => [name, idx])
);

/**
 * Tokenizes a Minecraft command string into whitespace-delimited tokens while keeping
 * bracketed selector arguments `[...]`, NBT braces `{...}`, and quoted strings `"..."` / `'...'`
 * intact within a single token.
 *
 * @param {string} cmdStr
 * @returns {string[]}
 */
function tokenizeCommand(cmdStr) {
  const tokens = [];
  let current = '';
  let bracketDepth = 0;
  let braceDepth = 0;
  let inQuote = null;
  let escaped = false;

  for (let i = 0; i < cmdStr.length; i++) {
    const ch = cmdStr[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }

    if (inQuote) {
      current += ch;
      if (ch === inQuote) {
        inQuote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }

    if (ch === '[') {
      bracketDepth++;
      current += ch;
      continue;
    }

    if (ch === ']') {
      if (bracketDepth > 0) bracketDepth--;
      current += ch;
      continue;
    }

    if (ch === '{') {
      braceDepth++;
      current += ch;
      continue;
    }

    if (ch === '}') {
      if (braceDepth > 0) braceDepth--;
      current += ch;
      continue;
    }

    if (/\s/.test(ch) && bracketDepth === 0 && braceDepth === 0) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += ch;
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Resolves datapack namespace, function path, tier, and subroutine metadata from a file path.
 *
 * @param {string} filePath
 * @param {string} [content='']
 * @returns {object}
 */
function resolveFunctionMeta(filePath, content = '') {
  const normalized = filePath ? filePath.replace(/\\/g, '/') : '';
  const dataMatch = normalized.match(/(?:^|\/)data\/([^/]+)\/functions?\/(.+)\.mcfunction$/);

  let namespace = null;
  let funcPath = null;
  let isDataPath = false;

  if (dataMatch) {
    namespace = dataMatch[1];
    funcPath = dataMatch[2];
    isDataPath = true;
  } else {
    // Fallback: try to extract from #> header opener if present
    const openerMatch = content.match(/^#>\s*([^\s:]+):([^\s]+)\s*$/m);
    if (openerMatch) {
      namespace = openerMatch[1];
      funcPath = openerMatch[2];
    } else if (normalized) {
      const base = path.basename(normalized, '.mcfunction');
      namespace = '<namespace>';
      funcPath = base;
    }
  }

  const functionId = namespace && funcPath ? `${namespace}:${funcPath}` : null;
  const segments = funcPath ? funcPath.split('/') : [];
  const tier = segments.length === 0 ? 'unknown' : segments.length === 1 ? 'root' : segments[0];
  const isLoad = funcPath === 'load';
  const isEntrypoint = ['load', 'tick', 'uninstall', 'reset'].includes(funcPath);
  const zzzIndices = segments.reduce((acc, seg, idx) => {
    if (seg === 'zzz') acc.push(idx);
    return acc;
  }, []);
  const isSubroutine = zzzIndices.length > 0;
  const hasNestedZzz = zzzIndices.length > 1;

  let parentPrefix = null;
  if (isSubroutine && namespace) {
    const firstZzz = zzzIndices[0];
    const parentDir = segments.slice(0, firstZzz).join('/');
    parentPrefix = parentDir ? `${namespace}:${parentDir}` : `${namespace}`;
  }

  return {
    filePath: normalized,
    isDataPath,
    namespace,
    funcPath,
    functionId,
    segments,
    tier,
    isLoad,
    isEntrypoint,
    isSubroutine,
    hasNestedZzz,
    parentPrefix
  };
}

/**
 * Classifies an IMP-Doc directive token (e.g. '@context', '@public') into its canonical category.
 *
 * @param {string} tag
 * @returns {string}
 */
function classifyDirective(tag) {
  switch (tag) {
    case '@context':
      return 'context';
    case '@public':
    case '@internal':
    case '@private':
      return 'scope';
    case '@handles':
      return 'handles';
    case '@input':
      return 'input';
    case '@reads':
      return 'reads';
    case '@writes':
      return 'writes';
    case '@returns':
      return 'returns';
    default:
      return 'other';
  }
}

/**
 * Parses the leading IMP-Doc v2 comment header block from raw lines.
 *
 * @param {string[]} rawLines
 * @returns {object}
 */
function parseHeader(rawLines) {
  const headerLines = [];
  let endLineIndex = -1;

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();
    // Section dividers (##) or non-comment lines terminate the top header block
    if (!trimmed.startsWith('#') || trimmed.startsWith('##')) {
      break;
    }
    headerLines.push({ lineNumber: i + 1, raw: rawLines[i], trimmed });
    endLineIndex = i;
  }

  let openerId = null;
  let openerLine = null;
  const summaryLines = [];
  const directives = {
    context: [],
    scope: [],
    handles: [],
    input: [],
    reads: [],
    writes: [],
    returns: [],
    other: []
  };
  const headerReads = [];
  const headerWrites = [];
  const seenCategories = [];

  let seenDirective = false;
  let activeBlockCategory = null;

  for (let i = 0; i < headerLines.length; i++) {
    const { lineNumber, raw, trimmed } = headerLines[i];

    if (i === 0 && trimmed.startsWith('#>')) {
      openerLine = lineNumber;
      openerId = trimmed.slice(2).trim();
      continue;
    }

    // Strip leading '#'
    const afterHash = raw.replace(/^\s*#/, '');
    const contentTrimmed = afterHash.trim();

    if (contentTrimmed === '') {
      activeBlockCategory = null;
      continue;
    }

    // Check if this is an indented continuation item for @reads or @writes
    if (
      (activeBlockCategory === 'reads' || activeBlockCategory === 'writes') &&
      !contentTrimmed.startsWith('@') &&
      /^\s{2,}/.test(afterHash)
    ) {
      const normalizedItem = contentTrimmed.replace(/\s+/g, ' ');
      if (activeBlockCategory === 'reads') {
        headerReads.push(normalizedItem);
      } else {
        headerWrites.push(normalizedItem);
      }
      directives[activeBlockCategory].push({
        lineNumber,
        raw,
        isBlockItem: true,
        value: normalizedItem
      });
      continue;
    }

    if (contentTrimmed.startsWith('@')) {
      seenDirective = true;
      const parts = contentTrimmed.split(/\s+/);
      const tag = parts[0];
      const rest = contentTrimmed.slice(tag.length).trim().replace(/\s+/g, ' ');
      const category = classifyDirective(tag);

      seenCategories.push({ category, tag, lineNumber });

      if (category === 'reads' || category === 'writes') {
        if (rest.length > 0) {
          activeBlockCategory = null;
          if (category === 'reads') {
            headerReads.push(rest);
          } else {
            headerWrites.push(rest);
          }
          directives[category].push({
            lineNumber,
            raw,
            tag,
            value: rest,
            isInline: true
          });
        } else {
          activeBlockCategory = category;
          directives[category].push({
            lineNumber,
            raw,
            tag,
            value: '',
            isBlockHeader: true
          });
        }
      } else {
        activeBlockCategory = null;
        directives[category].push({
          lineNumber,
          raw,
          tag,
          value: rest,
          fullDirective: rest ? `${tag} ${rest}` : tag
        });
      }
    } else {
      summaryLines.push(contentTrimmed);
    }
  }

  // Check if directive order is canonical
  let isOrderCanonical = true;
  let maxRank = -1;
  for (const item of seenCategories) {
    const rank = DIRECTIVE_RANK[item.category];
    if (rank === undefined) continue;
    if (rank < maxRank) {
      isOrderCanonical = false;
      break;
    }
    maxRank = rank;
  }

  return {
    hasHeader: headerLines.length > 0,
    endLineIndex,
    headerLines,
    openerId,
    openerLine,
    summaryLines,
    directives,
    headerReads,
    headerWrites,
    seenCategories,
    isOrderCanonical
  };
}

/**
 * Merges multi-line backslash continuations and parses body commands.
 *
 * @param {string[]} rawLines
 * @param {number} headerEndLineIndex
 * @returns {object}
 */
function parseCommands(rawLines, headerEndLineIndex) {
  const commands = [];
  const continuations = [];
  const sectionDividers = [];
  const tabLines = [];

  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].includes('\t')) {
      tabLines.push(i + 1);
    }
    const trimmed = rawLines[i].trim();
    if (trimmed.startsWith('##') && !trimmed.startsWith('###')) {
      sectionDividers.push({
        lineNumber: i + 1,
        raw: rawLines[i],
        text: trimmed
      });
    }
  }

  let currentCmd = null;

  function finalizeCommand(cmd) {
    const text = cmd.parts.join(' ');
    cmd.text = text;
    const normalizedText = cmd.isMacro && text.startsWith('$') ? text.slice(1).trimStart() : text;
    cmd.tokens = tokenizeCommand(normalizedText);
    return cmd;
  }

  for (let i = Math.max(0, headerEndLineIndex + 1); i < rawLines.length; i++) {
    const raw = rawLines[i];
    const trimmed = raw.trim();
    const lineNumber = i + 1;

    if (!currentCmd) {
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }

      const hasBackslash = /\\\s*$/.test(raw);
      const cleanPart = hasBackslash ? raw.replace(/\\\s*$/, '').trim() : trimmed;
      const isMacro = cleanPart.startsWith('$');

      currentCmd = {
        startLine: lineNumber,
        endLine: lineNumber,
        rawLines: [raw],
        lineNumbers: [lineNumber],
        isMacro,
        parts: [cleanPart]
      };

      if (!hasBackslash) {
        commands.push(finalizeCommand(currentCmd));
        currentCmd = null;
      }
    } else {
      // Inside a continuation
      const leadingMatch = raw.match(/^([ \t]*)/);
      const leadingWhitespace = leadingMatch ? leadingMatch[1] : '';
      continuations.push({
        lineNumber,
        raw,
        leadingWhitespace,
        isFourSpaces: leadingWhitespace === '    '
      });

      const hasBackslash = /\\\s*$/.test(raw);
      const cleanPart = hasBackslash ? raw.replace(/\\\s*$/, '').trim() : trimmed;

      currentCmd.endLine = lineNumber;
      currentCmd.rawLines.push(raw);
      currentCmd.lineNumbers.push(lineNumber);
      if (cleanPart && !cleanPart.startsWith('#')) {
        currentCmd.parts.push(cleanPart);
      }

      if (!hasBackslash) {
        commands.push(finalizeCommand(currentCmd));
        currentCmd = null;
      }
    }
  }

  if (currentCmd) {
    commands.push(finalizeCommand(currentCmd));
  }

  return {
    commands,
    continuations,
    sectionDividers,
    tabLines
  };
}

/**
 * Extracts score/storage reads and writes, resource references, and selectors from parsed commands.
 *
 * @param {object[]} commands
 * @returns {object}
 */
function extractDataContracts(commands) {
  const readsSet = new Set();
  const writesSet = new Set();
  const scoreRefs = [];
  const objectiveDefs = [];
  const storageRefs = [];
  const bossbarRefs = [];
  const functionCalls = [];
  const selectors = [];

  function addScoreRead(holder, objective, line) {
    if (!holder || !objective) return;
    readsSet.add(`score ${holder} ${objective}`);
    scoreRefs.push({ holder, objective, mode: 'read', line });
  }

  function addScoreWrite(holder, objective, line) {
    if (!holder || !objective) return;
    writesSet.add(`score ${holder} ${objective}`);
    scoreRefs.push({ holder, objective, mode: 'write', line });
  }

  function addStorageRead(id, storagePath, line) {
    if (!id) return;
    const entry = storagePath ? `storage ${id} ${storagePath}` : `storage ${id}`;
    readsSet.add(entry);
    storageRefs.push({ id, path: storagePath || null, mode: 'read', line });
  }

  function addStorageWrite(id, storagePath, line) {
    if (!id) return;
    const entry = storagePath ? `storage ${id} ${storagePath}` : `storage ${id}`;
    writesSet.add(entry);
    storageRefs.push({ id, path: storagePath || null, mode: 'write', line });
  }

  for (const cmd of commands) {
    const { tokens, startLine } = cmd;
    if (!tokens || tokens.length === 0) continue;

    // Extract all entity selectors across tokens (using balanced bracket scanning for nested [...])
    for (const token of tokens) {
      const selStartRegex = /@([eaprsn])/g;
      let match;
      while ((match = selStartRegex.exec(token)) !== null) {
        if (match.index > 0 && /[a-zA-Z0-9_]/.test(token[match.index - 1])) {
          continue;
        }
        const selType = match[1];
        const nextIdx = match.index + 2;
        let bracketPart = '';
        if (token[nextIdx] === '[') {
          let depth = 0;
          let inStr = null;
          let endBracketIdx = -1;
          for (let k = nextIdx; k < token.length; k++) {
            const c = token[k];
            if (inStr) {
              if (c === '\\') {
                k++;
              } else if (c === inStr) {
                inStr = null;
              }
              continue;
            }
            if (c === '"' || c === "'") {
              inStr = c;
            } else if (c === '[') {
              depth++;
            } else if (c === ']') {
              depth--;
              if (depth === 0) {
                endBracketIdx = k;
                break;
              }
            }
          }
          if (endBracketIdx !== -1) {
            bracketPart = token.slice(nextIdx, endBracketIdx + 1);
            selStartRegex.lastIndex = endBracketIdx + 1;
          }
        } else if (nextIdx < token.length && /[a-zA-Z0-9_]/.test(token[nextIdx])) {
          continue;
        }

        selectors.push({
          raw: `@${selType}${bracketPart}`,
          type: selType,
          hasBrackets: Boolean(bracketPart),
          argsStr: bracketPart ? bracketPart.slice(1, -1) : '',
          line: startLine
        });
      }
    }

    // Scan execute clauses if command contains execute
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];

      // execute if|unless score <target> <targetObj> ...
      if ((tok === 'if' || tok === 'unless') && tokens[i + 1] === 'score') {
        const target = tokens[i + 2];
        const targetObj = tokens[i + 3];
        const op = tokens[i + 4];
        addScoreRead(target, targetObj, startLine);
        if (['=', '<', '<=', '>', '>='].includes(op)) {
          const source = tokens[i + 5];
          const sourceObj = tokens[i + 6];
          addScoreRead(source, sourceObj, startLine);
        }
      }

      // execute if|unless data storage <id> [<path>]
      if ((tok === 'if' || tok === 'unless') && tokens[i + 1] === 'data' && tokens[i + 2] === 'storage') {
        const id = tokens[i + 3];
        const nextTok = tokens[i + 4];
        const executeKeywords = new Set([
          'as', 'at', 'positioned', 'align', 'facing', 'rotated', 'in', 'anchored',
          'if', 'unless', 'store', 'on', 'summon', 'run'
        ]);
        const storagePath = nextTok && !executeKeywords.has(nextTok) ? nextTok : null;
        addStorageRead(id, storagePath, startLine);
      }

      // execute store (result|success) ...
      if (tok === 'store' && (tokens[i + 1] === 'result' || tokens[i + 1] === 'success')) {
        const storeTargetType = tokens[i + 2];
        if (storeTargetType === 'score') {
          addScoreWrite(tokens[i + 3], tokens[i + 4], startLine);
        } else if (storeTargetType === 'storage') {
          addStorageWrite(tokens[i + 3], tokens[i + 4], startLine);
        } else if (storeTargetType === 'bossbar') {
          if (tokens[i + 3]) {
            bossbarRefs.push({ id: tokens[i + 3], line: startLine });
          }
        }
      }
    }

    // Identify all subcommand start indices (0, or right after 'run')
    const subCommandStarts = [0];
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] === 'run') {
        subCommandStarts.push(i + 1);
      }
    }

    for (const idx of subCommandStarts) {
      const head = tokens[idx];
      if (!head) continue;

      if (head === 'scoreboard') {
        const category = tokens[idx + 1];
        if (category === 'players') {
          const action = tokens[idx + 2];
          const holder = tokens[idx + 3];
          const obj = tokens[idx + 4];
          if (['set', 'add', 'remove', 'enable'].includes(action)) {
            addScoreWrite(holder, obj, startLine);
          } else if (action === 'reset') {
            if (obj) {
              addScoreWrite(holder, obj, startLine);
            }
          } else if (action === 'get') {
            addScoreRead(holder, obj, startLine);
          } else if (action === 'operation') {
            const op = tokens[idx + 5];
            const srcHolder = tokens[idx + 6];
            const srcObj = tokens[idx + 7];
            addScoreWrite(holder, obj, startLine);
            addScoreRead(srcHolder, srcObj, startLine);
            if (op === '><') {
              addScoreRead(holder, obj, startLine);
              addScoreWrite(srcHolder, srcObj, startLine);
            }
          }
        } else if (category === 'objectives' && tokens[idx + 2] === 'add') {
          const obj = tokens[idx + 3];
          const criteria = tokens[idx + 4];
          if (obj) {
            objectiveDefs.push({ objective: obj, criteria: criteria || 'dummy', line: startLine });
          }
        }
      } else if (head === 'data') {
        const action = tokens[idx + 1];
        const targetType = tokens[idx + 2];
        if (targetType === 'storage') {
          const id = tokens[idx + 3];
          const rawPath = tokens[idx + 4];
          if (action === 'get') {
            const isScaleOnly = rawPath && /^-?\d+(\.\d+)?$/.test(rawPath);
            addStorageRead(id, isScaleOnly ? null : rawPath, startLine);
          } else if (action === 'modify') {
            addStorageWrite(id, rawPath, startLine);
          } else if (action === 'remove') {
            addStorageWrite(id, rawPath, startLine);
          } else if (action === 'merge') {
            addStorageWrite(id, null, startLine);
          }
        }
        if (action === 'modify') {
          // Check for '... from storage <srcId> [<srcPath>]' regardless of targetType (storage, entity, block)
          const restTokens = tokens.slice(idx + 4);
          const fromIdx = restTokens.indexOf('from');
          if (fromIdx !== -1 && restTokens[fromIdx + 1] === 'storage') {
            const srcId = restTokens[fromIdx + 2];
            const srcPath = restTokens[fromIdx + 3];
            addStorageRead(srcId, srcPath, startLine);
          }
        }
      } else if (head === 'bossbar') {
        const action = tokens[idx + 1];
        const id = tokens[idx + 2];
        if (['add', 'set', 'remove', 'get'].includes(action) && id) {
          bossbarRefs.push({ id, line: startLine });
        }
      } else if (head === 'function') {
        const funcId = tokens[idx + 1];
        if (funcId) {
          functionCalls.push({ id: funcId, line: startLine });
        }
      } else if (head === 'schedule') {
        const sub = tokens[idx + 1];
        const funcId = tokens[idx + 2];
        if ((sub === 'function' || sub === 'clear') && funcId) {
          functionCalls.push({ id: funcId, line: startLine });
        }
      }
    }
  }

  return {
    reads: Array.from(readsSet).sort(),
    writes: Array.from(writesSet).sort(),
    scoreRefs,
    objectiveDefs,
    storageRefs,
    bossbarRefs,
    functionCalls,
    selectors
  };
}

/**
 * Formats an IMP-Doc v2 header block in canonical directive order:
 * @context -> scope (@public|@internal|@private) -> @handles -> @input -> @reads -> @writes -> @returns
 *
 * @param {object} parsed - Output of parseFunction
 * @param {object} [options={}]
 * @returns {string}
 */
function formatHeader(parsed, options = {}) {
  const { fileMeta, header, extracted } = parsed;
  const openerId = options.openerId || fileMeta.functionId || header.openerId || '<namespace>:unknown';

  const lines = [`#> ${openerId}`];

  if (header.summaryLines && header.summaryLines.length > 0) {
    for (const s of header.summaryLines) {
      lines.push(`# ${s}`);
    }
  }

  const directiveLines = [];

  // 1. @context
  const contextItems = options.contextDirectives || header.directives.context || [];
  for (const item of contextItems) {
    directiveLines.push(`# ${item.fullDirective || `@context ${item.value}`}`);
  }

  // 2. Scope (@public | @internal | @private within)
  const scopeItems = options.scopeDirectives || header.directives.scope || [];
  for (const item of scopeItems) {
    directiveLines.push(`# ${item.fullDirective || item.tag}`);
  }

  // 3. @handles
  const handlesItems = header.directives.handles || [];
  for (const item of handlesItems) {
    directiveLines.push(`# ${item.fullDirective}`);
  }

  // 4. @input
  const inputItems = header.directives.input || [];
  for (const item of inputItems) {
    directiveLines.push(`# ${item.fullDirective}`);
  }

  // 5. @reads
  const reads = options.reads !== undefined ? options.reads : extracted.reads;
  if (reads && reads.length === 1) {
    directiveLines.push(`# @reads ${reads[0]}`);
  } else if (reads && reads.length > 1) {
    directiveLines.push('# @reads');
    for (const r of reads) {
      directiveLines.push(`#   ${r}`);
    }
  }

  // 6. @writes (Omitted in load.mcfunction per R7)
  const isLoad = options.isLoad !== undefined ? options.isLoad : fileMeta.isLoad;
  const writes = options.writes !== undefined ? options.writes : extracted.writes;
  if (!isLoad) {
    if (writes && writes.length === 1) {
      directiveLines.push(`# @writes ${writes[0]}`);
    } else if (writes && writes.length > 1) {
      directiveLines.push('# @writes');
      for (const w of writes) {
        directiveLines.push(`#   ${w}`);
      }
    }
  }

  // 7. @returns
  const returnsItems = header.directives.returns || [];
  for (const item of returnsItems) {
    directiveLines.push(`# ${item.fullDirective}`);
  }

  // Other custom directives if any
  const otherItems = header.directives.other || [];
  for (const item of otherItems) {
    directiveLines.push(`# ${item.fullDirective}`);
  }

  if (directiveLines.length > 0) {
    lines.push('#');
    lines.push(...directiveLines);
  }

  return lines.join('\n');
}

/**
 * Parses a .mcfunction file content and path into a comprehensive AST/context object.
 *
 * @param {string} content
 * @param {string} [filePath='']
 * @returns {object}
 */
function parseFunction(content, filePath = '') {
  const safeContent = typeof content === 'string' ? content : '';
  const lineEnding = safeContent.includes('\r\n') ? '\r\n' : '\n';
  const rawLines = safeContent.length === 0 ? [] : safeContent.split(/\r?\n/);

  const fileMeta = resolveFunctionMeta(filePath, safeContent);
  const header = parseHeader(rawLines);
  const body = parseCommands(rawLines, header.endLineIndex);
  const extracted = extractDataContracts(body.commands);

  return {
    content: safeContent,
    lineEnding,
    rawLines,
    fileMeta,
    header,
    commands: body.commands,
    continuations: body.continuations,
    sectionDividers: body.sectionDividers,
    tabLines: body.tabLines,
    extracted
  };
}

/**
 * Checks whether an identifier or argument contains a Minecraft 1.20.2+ macro template variable $(...).
 * Note: $foo (UI display prefix) does not match; only $(foo) matches.
 *
 * @param {string} str
 * @returns {boolean}
 */
function hasMacroVariable(str) {
  return typeof str === 'string' && /\$\([^)]+\)/.test(str);
}

module.exports = {
  CANONICAL_DIRECTIVE_ORDER,
  DIRECTIVE_RANK,
  tokenizeCommand,
  resolveFunctionMeta,
  parseHeader,
  parseCommands,
  extractDataContracts,
  formatHeader,
  parseFunction,
  hasMacroVariable
};
