import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT, initProject, buildBatches, inspectProject, finalize, rebuild } from '../scripts/workflow.mjs';
import { extractMv, loadMv } from '../scripts/rpg_maker_mv.mjs';
import { jsonDocument, renderDocument, validateMv } from '../scripts/mv_text.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
const command = (code, parameters = [], indent = 0) => ({ code, parameters, indent });

function fixture(t, prepare = () => {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mv-test-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'game/www');
  for (const folder of ['data', 'js', 'quest', 'fonts']) fs.mkdirSync(path.join(root, folder), { recursive: true });
  const work = initProject('test', 'en', path.join(base, 'projects'));
  fs.writeFileSync(path.join(root, 'js/rpg_core.js'), 'Utils.RPGMAKER_NAME = "MV";');
  fs.writeFileSync(path.join(root, 'fonts/gamefont.css'), 'font: GameFont;');
  const plugins = [
    { name: 'Galv_QuestLog', status: true, parameters: { File: 'Quests', Folder: 'quest', 'Separator Character': ',', Categories: 'Main|#fff,Side|#aaa', 'Quest Command': 'Quest Log' } },
    { name: 'RecipeCrafting', status: true, parameters: { 'Required Material Text': 'Required materials:', 'Crafting XP Formula': '80 * lvl' } },
    { name: 'Unrecognized', status: true, parameters: { text: 'Untouched' } },
    { name: 'RecipeCrafting', status: false, parameters: { 'Crafting Text': 'Disabled' } }
  ];
  fs.writeFileSync(path.join(root, 'js/plugins.js'), '// Generated\r\nvar $plugins =\r\n' + JSON.stringify(plugins) + ';\r\n');
  fs.writeFileSync(path.join(root, 'quest/Quests.txt'), 'Notes outside quests\r\n<quest 7:Find herbs|2|0>\r\nFind herbs,Return home\r\nDone|Well done,Failed\r\nBring herbs to the shop.\r\n</quest>\r\n');
  fs.writeFileSync(path.join(root, 'data/Recipes.txt'), 'result: 5\n');
  const map = { displayName: 'Town', note: '<technical>', precision: 'huge', events: [null, { id: 1, name: 'Editor name', pages: [{ conditions: { switch1Id: 12 }, list: [
    command(101, ['FaceActor', 0, 0, 2]), command(401, ['\\c[2]Hello \\V[1]\\C[0]']), command(401, ['Second line.']),
    command(102, [['Leave', 'Stay'], -1, 0, 2, 0]), command(402, [0, 'Leave']), command(355, ['runCode("Leave")'], 1),
    command(402, [1, 'Stay']), command(404), command(0)
  ] }] }] };
  const mapBytes = Buffer.from('\uFEFF' + JSON.stringify(map, null, 2).replace('"huge"', '9007199254740993123').replaceAll('\n', '\r\n') + '\r\n');
  fs.writeFileSync(path.join(root, 'data/Map001.json'), mapBytes);
  save(path.join(root, 'data/System.json'), { terms: { commands: ['Save', 'Load'] }, switches: ['', 'Internal'], variables: ['', 'Counter'], currencyUnit: 'Gold' });
  save(path.join(root, 'data/Actors.json'), [null, { id: 1, name: 'Alex', profile: 'A traveler.', characterName: 'ActorSprite' }]);
  fs.writeFileSync(path.join(root, 'data/Map001 - Copy.json'), 'not json');
  prepare({ root, work });
  const report = extractMv(work, root);
  const rows = fs.readFileSync(path.join(work, 'corpus.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  const batches = buildBatches(work);
  function edits(change = text => text) {
    for (const batch of batches) fs.writeFileSync(path.join(work, `E/${batch.name}.part01.jsonl`), batch.ids.map(id => {
      const row = rows.find(r => r.id === id);
      return JSON.stringify({ id, vi: change(row.en, row) });
    }).join('\n') + '\n');
  }
  return { root, work, rows, report, mapBytes, edits };
}

test('MV lossless JSON spans preserve BOM, CRLF, unsafe integers and reject duplicate keys', () => {
  const bytes = Buffer.from('\uFEFF{\r\n"number":9007199254740993123,"s":"Hi","obj":{"s":"again"}}\r\n');
  const doc = jsonDocument(bytes);
  assert.deepEqual(renderDocument(doc, new Map()), bytes);
  assert.equal(renderDocument(doc, new Map([['["s"]', 'Chào']])).toString(), bytes.toString().replace('"Hi"', '"Chào"'));
  assert.throws(() => jsonDocument(Buffer.from('{"x":{"a":1,"a":2}}')), /Duplicate/);
  assert.throws(() => jsonDocument(Buffer.from([0xff])), /encoded data/);
});

test('MV corpus groups messages, mirrors choices and selects only known display fields', t => {
  const f = fixture(t);
  assert.equal(f.report.identity, 'byte-identical');
  assert.equal(f.report.counts.dlg, 1);
  assert.equal(f.report.counts.choice, 2);
  const message = f.rows.find(r => r.kind === 'dlg');
  assert.equal(message.targets.length, 2);
  assert.equal(message.scene, 'Map001/event:1/page:0');
  assert.equal(f.rows.find(r => r.en === 'Leave').targets.length, 2);
  assert.ok(!f.rows.some(r => ['Internal', 'Counter', 'Editor name', 'ActorSprite', '80 * lvl', 'Disabled', 'Untouched'].includes(r.en)));
  assert.ok(f.report.unhandled_text_files.includes('data/Recipes.txt'));
  assert.ok(f.report.unsupported_plugins.includes('Unrecognized'));
});

test('MV pipeline rebuilds text, quest and plugin fields; ZIP is changed-only and sources remain identical', t => {
  const f = fixture(t);
  const replacements = new Map([['Leave', 'Rời đi'], ['Main', 'Nhiệm vụ chính'], ['Side', 'Phụ'], ['Find herbs', 'Tìm thảo dược'], ['Required materials:', 'Nguyên liệu:']]);
  f.edits(text => replacements.get(text) ?? text.replace('\\c[2]Hello', '\\C[2]Xin chào'));
  assert.deepEqual(inspectProject(f.work).errors, []);
  finalize(f.work);
  const result = rebuild(f.work);
  assert.equal(result.changed_files, 3);
  const patched = fs.readFileSync(path.join(result.output, 'www/data/Map001.json'), 'utf8');
  const expected = f.mapBytes.toString().replace('\\\\c[2]Hello', '\\\\C[2]Xin chào').replace('"Leave"', '"Rời đi"').replace('"Leave"', '"Rời đi"');
  assert.equal(patched, expected);
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'data/Map001.json')), f.mapBytes);
  const plugins = jsonDocument(fs.readFileSync(path.join(result.output, 'www/js/plugins.js')), true).value;
  assert.equal(plugins[0].parameters.Categories, 'Nhiệm vụ chính|#fff,Phụ|#aaa');
  assert.equal(plugins[1].parameters['Crafting XP Formula'], '80 * lvl');
  const quests = fs.readFileSync(path.join(result.output, 'www/quest/Quests.txt'), 'utf8');
  assert.ok(quests.includes('<quest 7:Tìm thảo dược|2|0>\r\nTìm thảo dược,Return home'));
  const manifest = read(path.join(result.output, 'patch-manifest.json'));
  assert.equal(manifest.playtest, 'not-run');
  assert.ok(manifest.compatibility['www/js/rpg_core.js']);
  const zip = spawnSync('python', ['-c', 'import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps(z.namelist()))', result.archive], { encoding: 'utf8' });
  assert.equal(zip.status, 0, zip.stderr);
  assert.deepEqual(JSON.parse(zip.stdout), ['INSTALL.txt', 'patch-manifest.json', ...Object.keys(manifest.files)].sort());
  assert.throws(() => rebuild(f.work), /already exists/);
});

test('MV identity delivery has no runtime payload, no original game or backups', t => {
  const f = fixture(t);
  f.edits();
  finalize(f.work);
  const built = rebuild(f.work);
  assert.equal(built.changed_files, 0);
  assert.deepEqual(read(path.join(built.output, 'patch-manifest.json')).files, {});
  assert.equal(fs.existsSync(path.join(built.output, 'www')), false);
});

test('MV controls normalize command case but preserve arguments, ordering, multiplicity and syntax', () => {
  assert.deepEqual(validateMv('\\c[2]Hi\\C[0] \\V[1]\\!', '\\C[2]Chào\\c[0] \\v[1]\\!'), { errors: [], warnings: [] });
  assert.deepEqual(validateMv('\\FBHello\\FB \\GGold', '\\FBXin chào\\FB \\GVàng').errors, []);
  for (const [source, target] of [
    ['\\C[2]Anna', '\\C[2)Anna'], ['\\V[1]', '\\V[2]'], ['\\V[1] \\V[1]', '\\V[1]'],
    ['\\!Hi\\.', 'Chào\\.'], ['%1 / %2', '%2 / %1'], ['<br>Hi', 'Chào'], ['<line break>Hi', 'Chào'], ['\\C[2]Hi', '\\C<2>Chào'], ['Hi', 'A\0B']
  ]) assert.ok(validateMv(source, target).errors.length, JSON.stringify([source, target]));
  assert.equal(validateMv('\\C[2]Red', '\\C[3]Đỏ').errors.length, 0);
  assert.equal(validateMv('\\C[2]Red', '\\C[3]Đỏ').warnings.length, 1);
  assert.equal(validateMv('\\C[2)Legacy', '\\C[2)Legacy').errors.length, 0);
  assert.equal(validateMv('\\C[2)Legacy', '\\C[2)Legacy').warnings.length, 1);
});

test('MV check reports style warnings and blocks broken controls and delimiter injection', t => {
  const f = fixture(t);
  f.edits(text => text.replace('\\c[2]', '\\C[3]'));
  assert.equal(inspectProject(f.work).errors.length, 0);
  assert.equal(inspectProject(f.work).warnings.length, 1);
  f.edits(text => text.replace('\\V[1]', '\\V[2]'));
  assert.throws(() => finalize(f.work), /MV control/);
  f.edits(text => text === 'Main' ? 'Main|#000' : text);
  assert.throws(() => finalize(f.work), /delimiter/);
  f.edits((text, row) => row.id.includes('quest:7:name') ? 'Quest: herbs' : text);
  assert.throws(() => finalize(f.work), /delimiter/);
});

test('Galv headers accept trailing spaces that the runtime accepts', t => {
  const f = fixture(t, ({ root }) => {
    const file = path.join(root, 'quest/Quests.txt');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('<quest 7:Find herbs|2|0>', '<quest 7:Find herbs|2|0> '));
  });
  f.edits(text => text === 'Find herbs' ? 'Tìm thảo dược' : text);
  finalize(f.work);
  const result = rebuild(f.work);
  assert.ok(fs.readFileSync(path.join(result.output, 'www/quest/Quests.txt'), 'utf8').includes('<quest 7:Tìm thảo dược|2|0> \r\n'));
});

test('MV corpus locations, source snapshots, live source and final edits are guarded', t => {
  const f = fixture(t);
  f.edits();
  finalize(f.work);
  const corpusFile = path.join(f.work, 'corpus.jsonl');
  const corpus = fs.readFileSync(corpusFile);
  const tampered = structuredClone(f.rows);
  tampered[0].targets = [{ slot: '["note"]' }];
  fs.writeFileSync(corpusFile, tampered.map(r => JSON.stringify(r)).join('\n'));
  assert.throws(() => inspectProject(f.work), /corpus source/);
  fs.writeFileSync(corpusFile, corpus);
  const sourceFile = path.join(f.work, 'original/mv/data/Map001.json');
  fs.appendFileSync(sourceFile, ' ');
  assert.throws(() => loadMv(f.work), /source hash/);
  fs.writeFileSync(sourceFile, f.mapBytes);
  fs.appendFileSync(path.join(f.root, 'js/rpg_core.js'), '\n// updated');
  assert.throws(() => rebuild(f.work), /Live MV source hash/);
  assert.equal(fs.existsSync(path.join(f.work, 'build/mv-patch')), false);
  fs.writeFileSync(path.join(f.root, 'js/rpg_core.js'), 'Utils.RPGMAKER_NAME = "MV";');
  const finalFile = path.join(f.work, 'final.json');
  const final = read(finalFile);
  final[f.rows[0].id] = 'Different';
  save(finalFile, final);
  assert.throws(() => rebuild(f.work), /stale/);
});

test('MV extraction rejects mismatched choice mirrors and MZ sources before writing a snapshot', t => {
  assert.throws(() => fixture(t, ({ root }) => {
    const file = path.join(root, 'data/Map001.json');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('"Leave"', '"Different"'));
  }), /mirror differs/);
  assert.throws(() => fixture(t, ({ root }) => fs.writeFileSync(path.join(root, 'js/rpg_core.js'), 'Utils.RPGMAKER_NAME = "MZ";')), /Expected an RPG Maker MV/);
});

test('MV accepts source and project on separate Windows drives', t => {
  if (process.platform !== 'win32' || path.parse(os.tmpdir()).root === path.parse(ROOT).root) return t.skip('Two drives required');
  const f = fixture(t);
  fs.mkdirSync(path.join(ROOT, '.codex/task-state'), { recursive: true });
  const base = fs.mkdtempSync(path.join(ROOT, '.codex/task-state/mv-cross-drive-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const work = initProject('cross-drive', 'en', base);
  assert.equal(extractMv(work, f.root).identity, 'byte-identical');
});
