import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(fs.readFileSync(path.join(root, 'sources.lock.json'), 'utf8'));
function git(args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'Git failed.');
  return result.stdout.trim();
}

try {
  for (const [name, source] of Object.entries(sources)) {
    const directory = path.join(root, source.directory);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(path.dirname(directory), { recursive: true });
      git(['clone', '--config', 'core.longpaths=true', '--no-checkout', '--filter=blob:none', source.url, directory]);
      git(['-C', directory, 'fetch', '--depth=1', 'origin', source.commit]);
      git(['-C', directory, 'checkout', '--detach', source.commit]);
    }
    if (git(['-C', directory, 'remote', 'get-url', 'origin']) !== source.url ||
        git(['-C', directory, 'rev-parse', 'HEAD']) !== source.commit ||
        git(['-C', directory, 'status', '--porcelain'])) {
      throw new Error(`${name}: existing clone differs from the pinned source. Review it manually; nothing was reset.`);
    }
    console.log(`${name}: ${source.commit} OK`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
