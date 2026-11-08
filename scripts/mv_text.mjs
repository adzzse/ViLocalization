import assert from 'node:assert/strict';

export const decode = bytes => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);

export function jsonDocument(bytes, plugin = false) {
  const text = decode(bytes);
  const assignment = plugin && text.match(/^([\s\S]*?\bvar\s+\$plugins\s*=\s*)(\[[\s\S]*\])(\s*;?\s*)$/);
  if (plugin && !assignment) throw new Error('Expected plugins.js with a JSON array assigned to var $plugins.');
  const body = plugin ? assignment[2] : text.replace(/^\uFEFF/, '');
  const offset = plugin ? assignment[1].length : text.length - body.length;
  const value = JSON.parse(body);
  const tokens = [...body.matchAll(/"(?:\\.|[^"\\])*"|[{}[\],:]|[^\s{}[\],:]+/g)];
  const slots = new Map();
  let cursor = 0;
  function walk(location) {
    const token = tokens[cursor++];
    if (token[0] === '{') {
      const keys = new Set();
      while (tokens[cursor][0] !== '}') {
        const key = JSON.parse(tokens[cursor++][0]);
        if (keys.has(key)) throw new Error('Duplicate JSON key: ' + key);
        keys.add(key);
        cursor++; // colon, already validated by JSON.parse
        walk([...location, key]);
        if (tokens[cursor][0] === ',') cursor++;
      }
      cursor++;
    } else if (token[0] === '[') {
      let index = 0;
      while (tokens[cursor][0] !== ']') {
        walk([...location, index++]);
        if (tokens[cursor][0] === ',') cursor++;
      }
      cursor++;
    } else if (token[0].startsWith('"')) {
      slots.set(JSON.stringify(location), { start: offset + token.index, end: offset + token.index + token[0].length,
        text: JSON.parse(token[0]), quoted: true });
    }
  }
  walk([]);
  return { text, value, slots };
}

export function renderDocument(doc, changes) {
  const edits = [...changes].map(([key, value]) => {
    const slot = doc.slots.get(key);
    if (!slot) throw new Error('Unknown source slot: ' + key);
    return { ...slot, replacement: slot.quoted ? JSON.stringify(value) : value };
  }).filter(edit => edit.replacement !== doc.text.slice(edit.start, edit.end)).sort((a, b) => a.start - b.start);
  let end = 0;
  let output = '';
  const undo = [];
  for (const edit of edits) {
    assert.ok(edit.start >= end, 'Overlapping source edits');
    output += doc.text.slice(end, edit.start);
    undo.push({ start: output.length, end: output.length + edit.replacement.length, original: doc.text.slice(edit.start, edit.end) });
    output += edit.replacement;
    end = edit.end;
  }
  output += doc.text.slice(end);
  let restored = output;
  for (const edit of undo.reverse()) restored = restored.slice(0, edit.start) + edit.original + restored.slice(edit.end);
  assert.equal(restored, doc.text, 'Bytes outside selected strings changed');
  return Buffer.from(output, 'utf8');
}

function controls(text) {
  const tokens = [];
  const errors = [];
  const numeric = new Set(['C', 'I', 'V', 'N', 'P', 'FS', 'PX', 'PY', 'OC', 'OW', 'W', 'AN', 'AC', 'AP', 'PN', 'PC', 'PP']);
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '\\') continue;
    // MV/Yanfly expand these fixed prefixes before the general escape parser.
    const match = text.slice(i + 1).match(/^(?:G|FB|FI|FR)/i) || text.slice(i + 1).match(/^[\$\.\|\^!><{}\\]|^[A-Za-z]+[1-5]?(?=<)|^[A-Za-z]+/);
    if (!match) { errors.push('invalid escape at ' + i); continue; }
    const name = match[0].toUpperCase();
    let token = '\\' + name;
    i += match[0].length;
    const tail = text.slice(i + 1);
    if (tail[0] === '[' || tail[0] === '<') {
      const arg = tail.match(tail[0] === '[' ? /^\[[^\]\r\n\\]*\]/ : /^<[^>\r\n]*>/);
      if (!arg || (numeric.has(name) && (tail[0] === '[' ? !/^\[\d+\]$/.test(arg[0]) : name !== 'N'))) {
        errors.push('malformed ' + name + ' argument at ' + (i + 1));
      } else {
        token += arg[0];
        i += arg[0].length;
      }
    } else if (numeric.has(name)) errors.push('missing ' + name + ' argument at ' + (i + 1));
    tokens.push(token);
  }
  tokens.push(...(text.match(/%\d+|<\/?(?:br|line break|wordwrap|wrap|center|left|right)>/gi) || []).map(t => t.toUpperCase()));
  return { tokens, errors };
}

export function validateMv(source, target) {
  const before = controls(source);
  const after = controls(target);
  const style = token => /^\\(?:C|FS|OC|OW)\[|^\\[{}]$/.test(token);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const errors = source === target ? [] : [...after.errors];
  const warnings = source === target && after.errors.length ? ['source already contains malformed controls'] : [];
  if (!same(before.tokens.filter(t => !style(t)), after.tokens.filter(t => !style(t)))) errors.push('MV control sequence/arguments changed');
  if (!same(before.tokens.filter(style), after.tokens.filter(style))) warnings.push('MV color/font controls changed; review presentation');
  if (target.includes('\0')) errors.push('NUL is not allowed');
  return { errors, warnings };
}
