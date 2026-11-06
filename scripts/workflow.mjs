import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const readJson = file => JSON.parse(decodeUtf8(fs.readFileSync(file)));
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const json = value => JSON.stringify(value, null, 2) + '\n';
const languageTag = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

function decodeUtf8(bytes) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return fail('Input must be valid UTF-8. Convert a copy explicitly before extraction/editing.'); }
}

function write(file, value) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, value, { flag: 'wx' });
  fs.renameSync(temp, file);
}

export function initProject(slug, language, base = path.join(ROOT, 'projects')) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64 ||
      /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(slug)) fail('Use a short lowercase game slug, e.g. my-game.');
  if (!languageTag.test(language)) fail('Specify a source language, e.g. en, ja, zh-CN.');
  const work = path.join(base, slug);
  fs.mkdirSync(base, { recursive: true });
  fs.mkdirSync(work); // An existing project must never be replaced.
  fs.cpSync(path.join(ROOT, 'templates/game'), work, { recursive: true });
  for (const folder of ['original', 'E', 'build']) fs.mkdirSync(path.join(work, folder));
  write(path.join(work, 'project.json'), json({ name: slug, source_language: language, target_language: 'vi', adapter: null }));
  return work;
}

export function parseTable(bytes) {
  const text = decodeUtf8(bytes);
  const table = JSON.parse(text);
  if (!table || Array.isArray(table) || typeof table !== 'object' ||
      Object.values(table).some(value => typeof value !== 'string')) fail('Only a flat JSON object of string values is supported.');
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}:,]/g) || [];
  const keys = tokens.filter((token, i) => tokens[i + 1] === ':').map(token => JSON.parse(token));
  if (new Set(keys).size !== keys.length) fail('Duplicate JSON keys would lose data.');
  if (keys.some(key => !key || /[\r\n\0]/.test(key))) fail('Keys must be non-empty single-line IDs.');
  return table;
}

function render(bytes, table, translations) {
  if (Object.entries(table).every(([key, value]) => translations[key] === value)) return bytes;
  const translated = Object.fromEntries(Object.keys(table).map(key => [key, translations[key]]));
  return Buffer.from(json(translated));
}

export function extractFlatJson(work, input) {
  const project = readJson(path.join(work, 'project.json'));
  if (fs.existsSync(path.join(work, 'corpus.jsonl')) || fs.existsSync(path.join(work, 'original/strings.json'))) {
    fail('This project already has source data. Use a new project for a new source version.');
  }
  const bytes = fs.readFileSync(input);
  const table = parseTable(bytes);
  const corpus = Object.entries(table).map(([id, en], order) => ({ id, key: id, kind: 'text', en, vi: '', group: 'strings', order }));
  if (!render(bytes, table, Object.fromEntries(corpus.map(row => [row.id, row.en]))).equals(bytes)) fail('Identity round trip failed.');
  write(path.join(work, 'original/strings.json'), bytes);
  write(path.join(work, 'corpus.jsonl'), corpus.map(row => JSON.stringify(row)).join('\n') + '\n');
  write(path.join(work, 'project.json'), json({ ...project, adapter: 'flat-json', source_sha256: hash(bytes), identity_roundtrip: 'byte-identical' }));
  return { entries: corpus.length, identity: 'byte-identical', sha256: hash(bytes) };
}

function readRows(file) {
  return decodeUtf8(fs.readFileSync(file)).split(/\r?\n/).flatMap((line, i) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; }
    catch { return fail(`${file}:${i + 1}: invalid JSON`); }
  });
}

function loadCorpus(work) {
  const rows = readRows(path.join(work, 'corpus.jsonl'));
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row.id !== 'string' || !row.id || /[\r\n\0]/.test(row.id) || ids.has(row.id) ||
        typeof row.en !== 'string' || typeof row.vi !== 'string' || !['dlg', 'choice', 'text'].includes(row.kind) || row.dupOf) {
      fail('Invalid corpus row or duplicate ID; keep distinct occurrences separate.');
    }
    ids.add(row.id);
  }
  const project = readJson(path.join(work, 'project.json'));
  if (project.adapter === 'flat-json') {
    const bytes = fs.readFileSync(path.join(work, 'original/strings.json'));
    if (hash(bytes) !== project.source_sha256) fail('Original source hash changed.');
    const table = parseTable(bytes);
    if (Object.keys(table).length !== rows.length || rows.some(row => !Object.hasOwn(table, row.id) || row.key !== row.id || row.en !== table[row.id])) {
      fail('Corpus source/IDs changed since extraction. Create a new project for updated game text.');
    }
  }
  return { rows, project };
}

export function buildBatches(work) {
  loadCorpus(work);
  if (fs.existsSync(path.join(work, 'B/manifest.json'))) fail('Batches already exist; keep their IDs stable when resuming.');
  if (fs.readdirSync(path.join(work, 'E')).some(name => name.endsWith('.jsonl'))) fail('Review existing edits before creating batches.');
  const result = spawnSync(process.execPath, [path.join(ROOT, 'vendor/vh-workflow/build_batches.cjs')], {
    cwd: work, encoding: 'utf8', env: { ...process.env, LIMIT: '15000' }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) fail(result.stderr || 'Batch builder failed.');
  return JSON.parse(fs.readFileSync(path.join(work, 'B/manifest.json'), 'utf8'));
}

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = (text, regex) => text.match(regex) || [];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function validateTranslation(source, target, config) {
  const errors = [];
  if (!target.trim() && source.trim()) errors.push('empty translation');
  const tags = new RegExp('<\\/?(?:' + config.tag_names.map(escapeRegex).join('|') + ')(?:[\\s=][^>]*)?\\/?>', 'gi');
  if (!equal(matches(source, tags), matches(target, tags))) errors.push('tag sequence/attributes changed');
  const printf = /%%|%(?:[1-9][0-9]*\$)?[-+ #0]*(?:[0-9]+|\*)?(?:\.[0-9*]+)?[sdifuxXoegGc]/g;
  const sourceArgs = matches(source, printf);
  const targetArgs = matches(target, printf);
  if (!equal([...sourceArgs].sort(), [...targetArgs].sort())) errors.push('printf tokens changed');
  const unnumbered = args => args.filter(token => token !== '%%' && !/^%[1-9][0-9]*\$/.test(token));
  if (!equal(unnumbered(sourceArgs), unnumbered(targetArgs))) errors.push('unnumbered printf argument order changed');
  for (const pattern of config.protected_patterns) {
    const regex = new RegExp(pattern, 'g');
    if (!equal(matches(source, regex).sort(), matches(target, regex).sort())) errors.push('protected token changed: ' + pattern);
  }
  for (const pattern of config.ordered_patterns) {
    const regex = new RegExp(pattern, 'g');
    if (!equal(matches(source, regex), matches(target, regex))) errors.push('ordered token changed: ' + pattern);
    const atStart = new RegExp('^(?:' + pattern + ')');
    if (atStart.test(source) && !atStart.test(target)) errors.push('leading control/timing mark moved');
  }
  if (config.preserve_newlines && !equal(matches(source, /\r?\n/g), matches(target, /\r?\n/g))) errors.push('newlines changed');
  return errors;
}

export function inspectProject(work) {
  const { rows: corpus, project } = loadCorpus(work);
  const byId = new Map(corpus.map(row => [row.id, row]));
  const manifest = readJson(path.join(work, 'B/manifest.json'));
  const config = readJson(path.join(work, 'qa.json'));
  const expected = new Set(corpus.filter(row => row.en.trim()).map(row => row.id));
  const assigned = new Set();
  const names = new Set();
  for (const batch of manifest) {
    if (!/^b\d+_(dialogue|choices|text)$/.test(batch.name) || names.has(batch.name)) fail('Invalid or repeated batch name.');
    names.add(batch.name);
    for (const id of batch.ids) {
      if (!expected.has(id) || assigned.has(id)) fail('Manifest has an unknown, empty or repeated ID: ' + id);
      assigned.add(id);
    }
  }
  if (assigned.size !== expected.size) fail('Manifest does not cover every source ID.');
  const edits = new Map();
  for (const file of fs.readdirSync(path.join(work, 'E')).filter(name => name.endsWith('.jsonl')).sort()) {
    const batch = manifest.find(item => file.startsWith(item.name + '.'));
    if (!batch) fail('Edit file has no matching batch: ' + file);
    const seen = new Set();
    for (const row of readRows(path.join(work, 'E', file))) {
      if (!row || typeof row.vi !== 'string' || !batch.ids.includes(row.id) || seen.has(row.id)) fail('Invalid, extra or duplicate edit in ' + file);
      seen.add(row.id);
      edits.set(row.id, row.vi);
    }
  }
  const errors = [];
  const translations = Object.fromEntries(corpus.map(row => [row.id, row.en]));
  for (const id of expected) {
    if (!edits.has(id)) { errors.push(id + ': missing translation'); continue; }
    const value = edits.get(id);
    const row = byId.get(id);
    errors.push(...validateTranslation(row.en, value, config).map(error => id + ': ' + error));
    for (const token of row.tokens || []) {
      const regex = new RegExp(escapeRegex(token), 'g');
      if (matches(row.en, regex).length !== matches(value, regex).length) errors.push(id + ': literal token changed: ' + token);
    }
    translations[id] = value;
  }
  return { total: expected.size, translated: edits.size, errors, translations, corpus, manifest, language: project.source_language };
}

function checked(work) {
  const result = inspectProject(work);
  if (result.errors.length) fail(`${result.errors.length} QA error(s):\n` + result.errors.slice(0, 30).join('\n'));
  return result;
}

function renderDialogue(work, { corpus, manifest, translations, language }) {
  const dialogue = new Map(corpus.filter(row => row.kind === 'dlg').map(row => [row.id, row]));
  const ids = manifest.flatMap(batch => batch.ids).filter(id => dialogue.has(id));
  if (!ids.length) return;

  const englishFile = path.join(work, 'dialogue.en.json');
  const english = fs.existsSync(englishFile) ? readJson(englishFile) : {};
  if (!english || typeof english !== 'object' || Array.isArray(english) ||
      Object.entries(english).some(([id, value]) => !dialogue.has(id) || typeof value !== 'string')) {
    fail('dialogue.en.json must map dialogue IDs to English strings.');
  }

  const sourceLabel = typeof language === 'string' && languageTag.test(language) ? language.toUpperCase() : 'SOURCE';
  const englishSource = /^EN(?:-|$)/.test(sourceLabel);
  const field = (label, value) => label + ': ' + value.replace(/\r\n?|\n/g, '\n    ');
  const inline = value => String(value).replace(/[\r\n]+/g, ' ');
  const lines = ['# Hội thoại', ''];
  let previousScene;
  for (const id of ids) {
    const row = dialogue.get(id);
    const scene = inline(row.scene ?? '(chưa rõ)');
    if (scene !== previousScene) lines.push('## CẢNH ' + scene, '');
    previousScene = scene;
    lines.push('@' + id + (row.speaker ? ' | ' + inline(row.speaker) : ''));
    if (!englishSource) lines.push(field(sourceLabel, row.en));
    const reference = Object.hasOwn(english, id) ? english[id] : '';
    const englishText = englishSource ? row.en : reference;
    lines.push(field('EN', englishText.trim() ? englishText : '[Không có]'));
    lines.push(field('VI', translations[id]), '');
  }
  return lines.join('\n') + '\n';
}

export function finalize(work) {
  const result = checked(work);
  const report = renderDialogue(work, result);
  write(path.join(work, 'final.json'), json(result.translations));
  const summary = { entries: Object.keys(result.translations).length, errors: 0 };
  if (report) {
    summary.dialogue = path.join(work, 'dialogue.txt');
    write(summary.dialogue, report);
  }
  return summary;
}

export function rebuild(work) {
  const project = readJson(path.join(work, 'project.json'));
  if (project.adapter !== 'flat-json') fail('This project needs an engine-specific rebuild adapter. See docs/workflow.md.');
  const { translations } = checked(work);
  const final = readJson(path.join(work, 'final.json'));
  if (!equal(final, translations)) fail('final.json is stale or modified. Run finalize again.');
  const bytes = fs.readFileSync(path.join(work, 'original/strings.json'));
  const table = parseTable(bytes);
  const output = render(bytes, table, final);
  if (!equal(parseTable(output), final)) fail('Rebuilt output differs from final translations.');
  const file = path.join(work, 'build/strings.vi.json');
  write(file, output);
  return file;
}

function main() {
  const [command, input, extra, ...rest] = process.argv.slice(2);
  const arity = { init: 2, extract: 2, batch: 1, check: 1, status: 1, finalize: 1, rebuild: 1 };
  if (!(command in arity) || rest.length || process.argv.slice(3).length !== arity[command]) {
    fail('Usage: workflow.mjs init <slug> <source-language> | extract <project> <flat-json> | batch|check|status|finalize|rebuild <project>');
  }
  const work = path.resolve(input);
  switch (command) {
    case 'init': return initProject(input, extra);
    case 'extract': return extractFlatJson(work, path.resolve(extra));
    case 'batch': return buildBatches(work).map(({ name, lines }) => ({ name, lines }));
    case 'check': { const { total, translated } = checked(work); return { total, translated, errors: 0 }; }
    case 'status': { const { total, translated, errors } = inspectProject(work); return { total, translated, errors: errors.length, first_errors: errors.slice(0, 10) }; }
    case 'finalize': return finalize(work);
    case 'rebuild': return rebuild(work);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(main()); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
