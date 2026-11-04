import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, initProject, extractFlatJson, buildBatches, inspectProject, finalize, rebuild, parseTable, validateTranslation } from '../scripts/workflow.mjs';

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/game/qa.json'), 'utf8'));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
const jsonl = rows => rows.map(row => JSON.stringify(row)).join('\n') + '\n';

function fixture(t, table = { greeting: 'Hello, {PLAYER}!', again: 'Hello, {PLAYER}!', blank: '' }, language = 'en') {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'vilocalization-test-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const work = initProject('test-game', language, base);
  const input = path.join(base, 'source.json');
  const bytes = Buffer.isBuffer(table) ? table : Buffer.from(JSON.stringify(table));
  fs.writeFileSync(input, bytes);
  const extracted = extractFlatJson(work, input);
  const manifest = buildBatches(work);
  function edits(rows, revision = '01', batch = manifest[0].name) {
    const file = path.join(work, `E/${batch}.part${revision}.jsonl`);
    fs.writeFileSync(file, jsonl(rows));
    return file;
  }
  return { base, work, input, bytes, extracted, manifest, edits };
}

test('Japanese to Vietnamese completes the CLI-backed batch pipeline without changing the source', t => {
  const table = JSON.parse('{"menu":"はじめから","hello":"こんにちは、{PLAYER}！","__proto__":"秘密","blank":""}');
  const f = fixture(t, table, 'ja');
  assert.equal(read(path.join(f.work, 'project.json')).source_language, 'ja');
  assert.equal(f.extracted.identity, 'byte-identical');
  assert.equal(f.extracted.entries, 4);
  const target = JSON.parse('{"menu":"Chơi mới","hello":"Chào, {PLAYER}!","__proto__":"Bí mật","blank":""}');
  f.edits(Object.entries(target).filter(([id]) => id !== 'blank').map(([id, vi]) => ({ id, vi })));
  assert.deepEqual(finalize(f.work), { entries: 4, errors: 0 });
  assert.deepEqual(read(rebuild(f.work)), target);
  assert.deepEqual(fs.readFileSync(f.input), f.bytes);
  assert.deepEqual(fs.readFileSync(path.join(f.work, 'original/strings.json')), f.bytes);
});

test('identity rebuild preserves BOM, CRLF and original formatting byte for byte', t => {
  const bytes = Buffer.from('\uFEFF{\r\n  "same": "Keep {VAR}",\r\n  "space": "  "\r\n}\r\n');
  const f = fixture(t, bytes);
  f.edits([{ id: 'same', vi: 'Keep {VAR}' }]);
  finalize(f.work);
  assert.deepEqual(fs.readFileSync(rebuild(f.work)), bytes);
});

test('QA preserves case, multiplicity, tag order, timing, printf, control codes and newlines', () => {
  const bad = [
    ['Hi {PLAYER}', 'Chào {player}'],
    ['{A} {A}', '{A}'],
    ['{0:N2}', '{0}'],
    ['${amount}', '{amount}'],
    ['<b><i>Hello</i></b>', '<i><b>Chào</b></i>'],
    ['<B>Hello</B>', 'Chào'],
    ['<B>Hello</B>', '<b>Chào</b>'],
    ['<color=RED>Hi</color>', '<color=red>Chào</color>'],
    ['[0.00-2.50]Hello', 'Chào[0.00-2.50]'],
    ['[0-1]Hello [1-2]again', '[1-2]Chào [0-1]lại'],
    ['Slot %02d', 'Ô %d'],
    ['Hello %1$s', 'Chào %s'],
    ['Hi [player]', 'Chào [Player]'],
    ['Hi $hero$', 'Chào $Hero$'],
    ['\\V[1] gold', '\\V[2] vàng'],
    ['\\C[1]Red\\C[0]', '\\C[0]Đỏ\\C[1]'],
    ['a\nb', 'a b'],
    ['a\r\nb', 'a\nb'],
    ['a\\nb', 'a b'],
    ['Hello', '   ']
  ];
  for (const [source, target] of bad) assert.ok(validateTranslation(source, target, config).length, JSON.stringify([source, target]));
  assert.deepEqual(validateTranslation('{A} before {B}', '{B} sau {A}', config), []);
  assert.deepEqual(validateTranslation('%1$s scored %2$d points', '%2$d điểm thuộc về %1$s', config), []);
  assert.deepEqual(validateTranslation('Literal %%s then %d', 'Chuỗi %%s rồi %d', config), []);
  assert.deepEqual(validateTranslation('[0-1]<b>Hi {PLAYER}</b>\nSlot %02d', '[0-1]<b>Chào {PLAYER}</b>\nÔ %02d', config), []);
});

test('unnumbered printf arguments retain runtime order while numbered arguments can move', () => {
  assert.ok(validateTranslation('%s scored %d points', '%d điểm thuộc về %s', config).length);
  assert.deepEqual(validateTranslation('%1$s scored %2$d points', '%2$d điểm thuộc về %1$s', config), []);
});

test('flat parser rejects duplicate or nested keys, non-strings and damaged UTF-8', () => {
  for (const text of ['{"a":"x","a":"y"}', '{"a":"x","\\u0061":"y"}', '{"a":{}}', '{"a":3}', '[]', 'null', '{"":"x"}', '{"line\\nbreak":"x"}']) {
    assert.throws(() => parseTable(Buffer.from(text)), undefined, text);
  }
  assert.throws(() => parseTable(Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d])), /UTF-8/);
  assert.deepEqual(parseTable(Buffer.from('{"a":"Text with \\"key\\": and comma, braces {}"}')), { a: 'Text with "key": and comma, braces {}' });
});

test('missing edits block finalization and return failure from the actual CLI', t => {
  const f = fixture(t);
  assert.equal(inspectProject(f.work).errors.length, 2);
  assert.throws(() => finalize(f.work), /missing translation/);
  assert.equal(fs.existsSync(path.join(f.work, 'final.json')), false);
  const cli = path.join(ROOT, 'scripts/workflow.mjs');
  const result = spawnSync(process.execPath, [cli, 'check', f.work], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing translation/);
  assert.equal(spawnSync(process.execPath, [cli, 'status', f.work]).status, 0);
});

test('malformed, duplicate, unknown or non-string edits cannot silently disappear', t => {
  const f = fixture(t);
  const file = f.edits([{ id: 'greeting', vi: 'Chào {PLAYER}!' }]);
  const invalid = [
    '{broken json\n',
    jsonl([{ id: 'greeting', vi: null }]),
    jsonl([{ id: 'unknown', vi: 'abc' }]),
    jsonl([{ id: 'greeting', vi: 'x' }, { id: 'greeting', vi: 'y' }])
  ];
  for (const value of invalid) {
    fs.writeFileSync(file, value);
    assert.throws(() => finalize(f.work));
  }
  fs.unlinkSync(file);
  fs.writeFileSync(path.join(f.work, 'E/unowned.part01.jsonl'), '{}\n');
  assert.throws(() => finalize(f.work), /no matching batch/);
});

test('damaged UTF-8 in edits or corpus cannot be exported as replacement characters', t => {
  const f = fixture(t, { greeting: 'Hello' });
  const file = f.edits([{ id: 'greeting', vi: 'Xin chào' }]);
  fs.writeFileSync(file, Buffer.concat([Buffer.from('{"id":"greeting","vi":"Xin '), Buffer.from([0xff]), Buffer.from('"}\n')]));
  assert.throws(() => finalize(f.work), /UTF-8/);
  assert.equal(fs.existsSync(path.join(f.work, 'final.json')), false);
  f.edits([{ id: 'greeting', vi: 'Xin chào' }]);
  const corpus = path.join(f.work, 'corpus.jsonl');
  fs.writeFileSync(corpus, Buffer.concat([Buffer.from('{"id":"greeting","key":"greeting","kind":"text","en":"Hello","vi":"'), Buffer.from([0xff]), Buffer.from('"}\n')]));
  assert.throws(() => inspectProject(f.work), /UTF-8/);
});

test('ordered revisions override earlier edits and stale final output is rejected', t => {
  const f = fixture(t);
  f.edits([{ id: 'greeting', vi: 'Chào {PLAYER}!' }, { id: 'again', vi: 'Chào {PLAYER}!' }]);
  finalize(f.work);
  const output = rebuild(f.work);
  const before = fs.readFileSync(output);
  f.edits([{ id: 'greeting', vi: 'Xin chào {PLAYER}!' }], '02');
  assert.throws(() => rebuild(f.work), /stale/);
  assert.deepEqual(fs.readFileSync(output), before);
  finalize(f.work);
  assert.equal(read(rebuild(f.work)).greeting, 'Xin chào {PLAYER}!');
  f.edits([{ id: 'greeting', vi: 'Sai biến {player}' }], '03');
  assert.throws(() => finalize(f.work), /protected token/);
  assert.throws(() => rebuild(f.work), /protected token/);
});

test('source file and corpus drift both stop export', t => {
  const f = fixture(t);
  const corpusFile = path.join(f.work, 'corpus.jsonl');
  const originalCorpus = fs.readFileSync(corpusFile, 'utf8');
  const rows = originalCorpus.trim().split('\n').map(JSON.parse);
  rows[0].en = 'An unreviewed game update';
  fs.writeFileSync(corpusFile, jsonl(rows));
  assert.throws(() => inspectProject(f.work), /source\/IDs changed/);
  fs.writeFileSync(corpusFile, originalCorpus);
  fs.appendFileSync(path.join(f.work, 'original/strings.json'), ' ');
  assert.throws(() => inspectProject(f.work), /hash changed/);
});

test('manifest cannot drop, duplicate or add a source occurrence', t => {
  const f = fixture(t);
  const file = path.join(f.work, 'B/manifest.json');
  for (const ids of [['greeting'], ['greeting', 'greeting'], ['greeting', 'again', 'extra']]) {
    save(file, [{ ...f.manifest[0], ids }]);
    assert.throws(() => inspectProject(f.work), /Manifest/);
  }
});

test('dialogue batching keeps occurrences distinct and sorts inside each scene', t => {
  const f = fixture(t);
  const file = path.join(f.work, 'corpus.jsonl');
  const rows = fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  rows[0] = { ...rows[0], kind: 'dlg', scene: 'scene-a', order: 2, speaker: 'A' };
  rows[1] = { ...rows[1], kind: 'dlg', scene: 'scene-a', order: 1, speaker: 'B' };
  fs.writeFileSync(file, jsonl(rows));
  // Recreate the untouched fixture manifest before any translation exists.
  fs.unlinkSync(path.join(f.work, 'B/manifest.json'));
  const manifest = buildBatches(f.work);
  assert.deepEqual(manifest[0].ids, ['again', 'greeting']);
  assert.equal(manifest[0].lines, 2);
  assert.throws(() => buildBatches(f.work), /already exist/);
});

test('per-row literal engine tokens are checked', t => {
  const f = fixture(t, { code: 'Press <IDLE NEUTRAL 1>' });
  const corpus = path.join(f.work, 'corpus.jsonl');
  const row = JSON.parse(fs.readFileSync(corpus, 'utf8'));
  fs.writeFileSync(corpus, jsonl([{ ...row, tokens: ['<IDLE NEUTRAL 1>'] }]));
  f.edits([{ id: 'code', vi: 'Nhấn <IDLE NEUTRAL 2>' }]);
  assert.throws(() => finalize(f.work), /literal token changed/);
});

test('init preserves existing projects and rejects paths or Windows device names', t => {
  const f = fixture(t);
  assert.throws(() => initProject('test-game', 'en', f.base), /EEXIST/);
  for (const slug of ['../outside', 'CON', 'con', 'aux', 'a/b', 'a b', 'a--b']) {
    assert.throws(() => initProject(slug, 'en', f.base), /slug/);
  }
  assert.throws(() => initProject('valid', '../en', f.base), /source language/);
  assert.deepEqual(fs.readFileSync(f.input), f.bytes);
});

test('custom engine can use core QA but cannot invoke the flat JSON writer', t => {
  const f = fixture(t);
  const file = path.join(f.work, 'project.json');
  save(file, { ...read(file), adapter: null });
  f.edits([{ id: 'greeting', vi: 'Chào {PLAYER}!' }, { id: 'again', vi: 'Chào {PLAYER}!' }]);
  assert.equal(finalize(f.work).errors, 0);
  assert.throws(() => rebuild(f.work), /engine-specific/);
});
