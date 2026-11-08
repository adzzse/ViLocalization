import * as fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { decode, jsonDocument, renderDocument } from './mv_text.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(decode(fs.readFileSync(file)).replace(/^\uFEFF/, ''));
const save = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const inside = (root, target) => {
  const relative = path.relative(root, target);
  return !path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep);
};
const databases = new Set(['Actors', 'Classes', 'Skills', 'Items', 'Weapons', 'Armors', 'Enemies', 'Troops', 'States', 'Animations', 'Tilesets', 'CommonEvents', 'System', 'MapInfos']);
const pluginFields = {
  Galv_QuestLog: ['Quest Command', 'Active Cmd Txt', 'Completed Cmd Txt', 'Failed Cmd Txt', 'Desc Txt', 'Objectives Txt', 'Difficulty Txt', 'No Tracked Quest', 'Pop New Quest', 'Pop Complete Quest', 'Pop Fail Quest', 'Pop New Objective', 'Pop Complete Objective', 'Pop Fail Objective'],
  RecipeCrafting: ['Dismantle Category', 'Main Menu String', 'Required Level Text', 'Required Material Text', 'Returned Material Text', 'Reverse Recipe Prefix', 'Success Rate Text', 'Exp Gained Text', 'Crafting Cost Text', 'Crafting Text', 'Crafted Text', 'Crafting Failed', 'Dismantle Text', 'Dismantled Text', 'Dismantle Fail', 'Max Level Test']
};

function safeFile(root, relative) {
  if (!relative || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..' || p.includes(':'))) throw new Error('Unsafe source path: ' + relative);
  const file = path.join(root, relative);
  const real = fs.realpathSync(file);
  if (!inside(fs.realpathSync(root), real) || !fs.statSync(real).isFile()) throw new Error('Source escapes root or is not a file: ' + relative);
  return file;
}

function sourceNames(root) {
  const files = [];
  for (const dir of ['data', 'js', 'fonts', 'quest']) {
    if (!fs.existsSync(path.join(root, dir))) continue;
    for (const name of fs.readdirSync(path.join(root, dir), { recursive: true })) {
      const relative = dir + '/' + name.replaceAll('\\', '/');
      if (fs.lstatSync(path.join(root, relative)).isSymbolicLink()) throw new Error('Symlink in input: ' + relative);
      if (!fs.statSync(path.join(root, relative)).isFile()) continue;
      if (dir === 'data' && !(/^data\/Map\d{3,}\.json$/.test(relative) || databases.has(path.basename(name, '.json')) && name.endsWith('.json') || name.endsWith('.txt'))) continue;
      if (dir === 'quest' && !name.endsWith('.txt')) continue;
      safeFile(root, relative);
      files.push(relative);
    }
  }
  return files.sort();
}

function questDocument(bytes, separator) {
  if (separator.length !== 1 || /[<>|\r\n]/.test(separator)) throw new Error('Unsupported Galv quest separator');
  const text = decode(bytes);
  const slots = new Map();
  const seen = new Set();
  let quest = null;
  let desc = 0;
  function add(start, value, key, forbidden) {
    if (value.trim()) slots.set(key, { start, end: start + value.length, text: value, quoted: false, forbidden });
  }
  for (const line of text.matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
    const value = line[0].replace(/[\r\n]+$/, '');
    if (value.startsWith('<quest')) {
      const match = value.match(/^<quest (\d+):([^|>:]*)(?:\|[^>:]*)?>\s*$/i);
      if (!match || quest !== null || seen.has(match[1])) throw new Error('Malformed or duplicate Galv quest header');
      quest = match[1]; seen.add(quest); desc = 0;
      add(line.index + value.indexOf(':') + 1, match[2], `quest:${quest}:name`, '|<>:');
    } else if (value.startsWith('</quest>')) {
      if (quest === null) throw new Error('Unmatched Galv quest closing tag');
      quest = null;
    } else if (quest !== null && !value.startsWith('<')) {
      let start = 0;
      let part = 0;
      for (let i = 0; i <= value.length; i++) {
        if (i === value.length || desc < 2 && (value[i] === separator || desc === 1 && value[i] === '|')) {
          add(line.index + start, value.slice(start, i), `quest:${quest}:line:${desc}:part:${part++}`, desc < 2 ? separator + '|' : '');
          start = i + 1;
        }
      }
      desc++;
    }
  }
  if (quest !== null) throw new Error('Unclosed Galv quest');
  return { text, slots };
}

function catalog(files) {
  const docs = new Map();
  const rows = [];
  const report = { sources: {}, excluded_commands: {}, unsupported_plugins: [], unhandled_text_files: [], coverage: 'Selected display fields only; scripts, images, editor names and unknown plugins are not covered.' };
  function add(file, locations, kind = 'text', context = {}, slices = null, forbidden = '') {
    const doc = docs.get(file);
    const targets = locations.map((location, i) => ({ slot: typeof location === 'string' ? location : JSON.stringify(location), ...(slices ? { slice: slices[i] } : {}) }));
    if (targets.some(target => !doc.slots.has(target.slot))) {
      if (kind !== 'text') throw new Error('Expected display string: ' + file + ' ' + targets[0].slot);
      return;
    }
    const values = targets.map(t => t.slice ? doc.slots.get(t.slot).text.slice(...t.slice) : doc.slots.get(t.slot).text);
    const en = kind === 'dlg' ? values.join('\n') : values[0];
    if (!en.trim()) return;
    const id = file + '#' + targets[0].slot + (slices ? ':' + context.part : '');
    rows.push({ id, key: id, file, targets, kind, en, vi: '', order: rows.length, ...context, ...(forbidden ? { forbidden } : {}) });
    report.sources[file] = (report.sources[file] || 0) + 1;
  }
  function commands(file, list, location, context) {
    if (!Array.isArray(list)) throw new Error('Expected MV command list: ' + file);
    for (let i = 0; i < list.length; i++) {
      const cmd = list[i];
      if (!cmd || !Number.isInteger(cmd.code) || !Array.isArray(cmd.parameters)) throw new Error('Invalid MV event command: ' + file);
      if (cmd.code === 101 || cmd.code === 105) {
        const continuation = cmd.code === 101 ? 401 : 405;
        const locations = [];
        while (list[i + 1]?.code === continuation) locations.push([...location, ++i, 'parameters', 0]);
        if (locations.length) add(file, locations, 'dlg', { ...context, speaker: 'unknown', message: cmd.parameters });
      } else if (cmd.code === 102) {
        if (!Array.isArray(cmd.parameters[0])) throw new Error('Invalid MV choices');
        cmd.parameters[0].forEach((choice, index) => {
          const locations = [[...location, i, 'parameters', 0, index]];
          for (let j = i + 1; j < list.length; j++) {
            if (list[j].indent < cmd.indent || list[j].code === 404 && list[j].indent === cmd.indent) break;
            if (list[j].code === 402 && list[j].indent === cmd.indent && list[j].parameters[0] === index) {
              if (list[j].parameters[1] !== choice) throw new Error(`Choice mirror differs: ${file} ${JSON.stringify(location)} ${i}`);
              locations.push([...location, j, 'parameters', 1]);
            }
          }
          add(file, locations, 'choice', context);
        });
      } else if ([355, 655, 356, 401, 405].includes(cmd.code)) {
        report.excluded_commands[cmd.code] = (report.excluded_commands[cmd.code] || 0) + 1;
      }
    }
  }
  for (const [file, bytes] of files) {
    if (!file.startsWith('data/') || !file.endsWith('.json')) continue;
    const doc = jsonDocument(bytes);
    docs.set(file, doc);
    const data = doc.value;
    const name = path.basename(file, '.json');
    if (/^Map\d+$/.test(name)) {
      add(file, [['displayName']]);
      data.events.forEach((event, e) => event?.pages.forEach((page, p) => commands(file, page.list, ['events', e, 'pages', p, 'list'], { scene: `${name}/event:${event.id}/page:${p}`, event: event.name })));
    } else if (name === 'CommonEvents') {
      data.forEach((event, i) => event && commands(file, event.list, [i, 'list'], { scene: `CommonEvents/${event.id}`, event: event.name }));
    } else if (name === 'Troops') {
      data.forEach((troop, i) => troop?.pages.forEach((page, p) => commands(file, page.list, [i, 'pages', p, 'list'], { scene: `Troops/${troop.id}/page:${p}` })));
    } else if (name === 'System') {
      for (const [key] of doc.slots) {
        const location = JSON.parse(key);
        if (['gameTitle', 'currencyUnit', 'terms', 'armorTypes', 'elements', 'equipTypes', 'skillTypes', 'weaponTypes'].includes(location[0])) add(file, [location]);
      }
    } else if (['Actors', 'Classes', 'Skills', 'Items', 'Weapons', 'Armors', 'Enemies', 'States'].includes(name)) {
      const fields = name === 'Actors' ? ['name', 'nickname', 'profile'] : name === 'States' ? ['name', 'message1', 'message2', 'message3', 'message4'] : ['name', 'description'];
      data.forEach((item, i) => item && fields.forEach(field => add(file, [[i, field]])));
    }
  }
  const pluginDoc = jsonDocument(files.get('js/plugins.js'), true);
  docs.set('js/plugins.js', pluginDoc);
  if (!Array.isArray(pluginDoc.value)) throw new Error('Expected plugin array');
  pluginDoc.value.forEach((plugin, i) => {
    if (!plugin.status) return;
    if (!pluginFields[plugin.name]) report.unsupported_plugins.push(plugin.name);
    for (const field of pluginFields[plugin.name] || []) add('js/plugins.js', [[i, 'parameters', field]]);
    if (plugin.name === 'Galv_QuestLog') {
      const params = plugin.parameters;
      const key = [i, 'parameters', 'Categories'];
      const categories = params.Categories || '';
      let partIndex = 0;
      for (const part of categories.matchAll(/([^,|]+)\|[^,]*/g)) {
        add('js/plugins.js', [key], 'text', { part: partIndex++ }, [[part.index, part.index + part[1].length]], ',|');
      }
      const file = (params.Folder ? params.Folder + '/' : '') + params.File + '.txt';
      if (!files.has(file)) throw new Error('Galv quest source not captured: ' + file);
      const doc = questDocument(files.get(file), params['Separator Character']);
      docs.set(file, doc);
      for (const [key, slot] of doc.slots) add(file, [key], 'text', { scene: key.split(':').slice(0, 2).join(':') }, null, slot.forbidden);
    }
  });
  report.unhandled_text_files = [...files.keys()].filter(file => file.endsWith('.txt') && !docs.has(file));
  report.entries = rows.length;
  assert.equal(new Set(rows.map(row => row.id)).size, rows.length, 'Duplicate MV occurrence IDs');
  report.counts = Object.fromEntries(['dlg', 'choice', 'text'].map(kind => [kind, rows.filter(row => row.kind === kind).length]));
  return { docs, rows, report };
}

function renderSources(source, translations) {
  const edits = new Map();
  for (const row of source.rows) {
    const value = translations[row.id];
    if (typeof value !== 'string') throw new Error('Missing translation: ' + row.id);
    if (value === row.en) continue;
    if ((row.forbidden || '').split('').some(c => value.includes(c)) || value.includes('\r') && !row.en.includes('\r') || value.startsWith('<') && !row.en.startsWith('<') && !row.file.endsWith('.json') && row.file !== 'js/plugins.js') throw new Error('Translation changes source delimiters: ' + row.id);
    let lines = value.split('\n');
    for (const target of row.targets) {
      const slot = source.docs.get(row.file).slots.get(target.slot);
      const replacement = row.kind === 'dlg' ? lines.splice(0, slot.text.split('\n').length).join('\n') : value;
      if (row.kind === 'dlg' && replacement.split('\n').length !== slot.text.split('\n').length || row.kind !== 'dlg' && replacement.includes('\n') && !slot.text.includes('\n')) throw new Error('Message/field line count changed: ' + row.id);
      if (!edits.has(row.file)) edits.set(row.file, new Map());
      const slots = edits.get(row.file);
      if (!slots.has(target.slot)) slots.set(target.slot, []);
      slots.get(target.slot).push({ slice: target.slice || [0, slot.text.length], value: replacement });
    }
    if (row.kind === 'dlg' && lines.length) throw new Error('Message block line count changed: ' + row.id);
  }
  const output = new Map();
  for (const [file, slots] of edits) {
    const doc = source.docs.get(file);
    const changes = new Map();
    for (const [key, parts] of slots) {
      let text = doc.slots.get(key).text;
      let last = text.length;
      for (const part of parts.sort((a, b) => b.slice[0] - a.slice[0])) {
        assert.ok(part.slice[1] <= last, 'Overlapping translated slots');
        text = text.slice(0, part.slice[0]) + part.value + text.slice(part.slice[1]);
        last = part.slice[0];
      }
      changes.set(key, text);
    }
    output.set(file, renderDocument(doc, changes));
  }
  return output;
}

export function extractMv(work, root) {
  const project = read(path.join(work, 'project.json'));
  const snapshot = path.join(work, 'original/mv');
  if (project.adapter || fs.existsSync(snapshot) || fs.existsSync(path.join(work, 'corpus.jsonl'))) throw new Error('Use a fresh project for MV extraction.');
  root = fs.realpathSync(root);
  if (inside(root, fs.realpathSync(work)) || inside(fs.realpathSync(work), root)) throw new Error('Keep project and game in separate directories.');
  const files = new Map(sourceNames(root).map(file => [file, fs.readFileSync(safeFile(root, file))]));
  if (!files.has('js/rpg_core.js') || !decode(files.get('js/rpg_core.js')).match(/RPGMAKER_NAME\s*=\s*['"]MV['"]/)) throw new Error('Expected an RPG Maker MV www directory.');
  const source = catalog(files);
  for (const [file, doc] of source.docs) assert.deepEqual(renderDocument(doc, new Map()), files.get(file), 'Identity round trip: ' + file);
  const manifest = { source_root: root, files: Object.fromEntries([...files].map(([file, bytes]) => [file, hash(bytes)])), report: source.report };
  fs.mkdirSync(snapshot);
  for (const [file, bytes] of files) {
    const target = path.join(snapshot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes, { flag: 'wx' });
  }
  save(path.join(snapshot, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(work, 'corpus.jsonl'), source.rows.map(row => JSON.stringify(row)).join('\n') + '\n', { flag: 'wx' });
  save(path.join(work, 'mv-report.json'), source.report);
  const qa = read(path.join(work, 'qa.json'));
  qa.protected_patterns = qa.protected_patterns.filter(p => p !== String.raw`\\[nr]`);
  qa.ordered_patterns = qa.ordered_patterns.filter(p => p !== String.raw`\\[A-Za-z]+\[[^\]\r\n]*\]`);
  fs.writeFileSync(path.join(work, 'qa.json'), JSON.stringify(qa, null, 2) + '\n');
  fs.writeFileSync(path.join(work, 'project.json'), JSON.stringify({ ...project, adapter: 'rpg-maker-mv', source_sha256: hash(fs.readFileSync(path.join(snapshot, 'manifest.json'))), identity_roundtrip: 'byte-identical' }, null, 2) + '\n');
  return { ...source.report, identity: 'byte-identical' };
}

export function loadMv(work, rows, live = false) {
  const snapshot = path.join(work, 'original/mv');
  const manifestFile = path.join(snapshot, 'manifest.json');
  if (hash(fs.readFileSync(manifestFile)) !== read(path.join(work, 'project.json')).source_sha256) throw new Error('MV source manifest changed.');
  const manifest = read(manifestFile);
  const files = new Map();
  if (live && !same(sourceNames(manifest.source_root), Object.keys(manifest.files))) throw new Error('Live MV source file list changed.');
  for (const [file, digest] of Object.entries(manifest.files)) {
    const bytes = fs.readFileSync(safeFile(snapshot, file));
    if (hash(bytes) !== digest) throw new Error('MV original source hash changed: ' + file);
    if (live && hash(fs.readFileSync(safeFile(manifest.source_root, file))) !== digest) throw new Error('Live MV source hash changed: ' + file);
    files.set(file, bytes);
  }
  const source = catalog(files);
  if (rows && !same(rows.map(({ vi, ...row }) => row), source.rows.map(({ vi, ...row }) => row))) throw new Error('MV corpus source/IDs/locations changed.');
  return { ...source, files, manifest };
}

export function rebuildMv(work, translations) {
  const source = loadMv(work, null, true);
  if (!same(Object.keys(translations).sort(), source.rows.map(r => r.id).sort())) throw new Error('Final MV occurrences differ.');
  const changed = renderSources(source, translations);
  const readback = catalog(new Map([...source.files, ...changed]));
  for (const row of readback.rows) if (translations[row.id] !== row.en) throw new Error('MV readback differs: ' + row.id);
  assert.equal(readback.rows.length, source.rows.length, 'MV readback occurrence count changed');
  const output = path.join(work, 'build/mv-patch');
  if (fs.existsSync(output)) throw new Error('build/mv-patch already exists; preserve/move the previous build first.');
  const stage = fs.mkdtempSync(path.join(work, 'build/.mv-'));
  try {
    const payload = {};
    for (const [file, bytes] of changed) {
      if (bytes.equals(source.files.get(file))) continue;
      const name = 'www/' + file;
      const target = path.join(stage, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes, { flag: 'wx' });
      payload[name] = { original_sha256: source.manifest.files[file], sha256: hash(bytes) };
    }
    save(path.join(stage, 'patch-manifest.json'), { adapter: 'rpg-maker-mv', files: payload,
      compatibility: Object.fromEntries(Object.entries(source.manifest.files).map(([file, digest]) => ['www/' + file, digest])),
      readback: 'exact-text-and-unchanged-surrounding-bytes', playtest: 'not-run' });
    fs.writeFileSync(path.join(stage, 'INSTALL.txt'), 'Match every compatibility SHA256 in patch-manifest.json before installation.\nClose the game. Back up each listed original file outside the game/patch.\nCopy the www/ payload into the game root. Restore those backups to roll back.\nThis build has not been playtested. Keep saves separately.\n');
    const packer = fileURLToPath(new URL('./pack_mv_patch.py', import.meta.url));
    const result = spawnSync('python', ['-X', 'utf8', packer, stage], { encoding: 'utf8', windowsHide: true });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Patch archive verification failed: ' + result.stderr);
    fs.renameSync(stage, output);
    return { output, changed_files: Object.keys(payload).length, archive: path.join(output, 'patch.zip'), readback: 'verified', playtest: 'not-run' };
  } finally {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true });
  }
}
