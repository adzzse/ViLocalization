import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../scripts/workflow.mjs';

const sources = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.lock.json'), 'utf8'));
for (const [name, source] of Object.entries(sources)) {
  test(`${name}: selected offline files match their recorded SHA256`, () => {
    assert.ok(source.files.length > 0);
    for (const file of source.files) {
      const digest = createHash('sha256').update(fs.readFileSync(path.join(ROOT, file.local))).digest('hex');
      assert.equal(digest, file.sha256, file.local);
      if (!file.modified) assert.equal(digest, file.upstream_sha256, file.local + ' differs from upstream');
    }
  });
}
