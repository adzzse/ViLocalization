import * as fs from 'node:fs';
import path from 'node:path';
import { ROOT, initProject, extractFlatJson, buildBatches, finalize, rebuild } from './workflow.mjs';

const base = path.join(ROOT, '.codex/task-state');
fs.mkdirSync(base, { recursive: true });
const run = fs.mkdtempSync(path.join(base, 'demo-'));
const work = initProject('demo', 'en', run);
console.log(extractFlatJson(work, path.join(ROOT, 'examples/flat-json/strings.en.json')));
buildBatches(work);
fs.copyFileSync(path.join(ROOT, 'examples/flat-json/b001_text.part01.jsonl'), path.join(work, 'E/b001_text.part01.jsonl'));
console.log(finalize(work));
console.log('Vietnamese output:', rebuild(work));
