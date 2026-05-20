'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const CocoAdapter = require('../src/adapters/coco');
const { ADAPTER_MAP, createAdapter } = require('../src/adapters');

function writeExecutable(name, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-coco-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, source, 'utf8');
  fs.chmodSync(file, 0o755);
  return file;
}

test('coco adapter is registered', () => {
  assert.equal(ADAPTER_MAP.coco, CocoAdapter);
  const adapter = createAdapter('coco', {
    workspaceId: 'sdk-local',
    channelName: 'general',
    token: 't',
    agentName: 'coco-one',
    endpoint: 'http://127.0.0.1:8700',
  });
  assert.ok(adapter instanceof CocoAdapter);
});

test('coco adapter sends prompt on stdin and returns stdout', async () => {
  const bin = writeExecutable('fake-coco', `#!/bin/sh
input=$(cat)
printf 'reply:%s' "$input"
`);
  const adapter = new CocoAdapter({
    workspaceId: 'sdk-local',
    channelName: 'general',
    token: 't',
    agentName: 'coco-one',
    endpoint: 'http://127.0.0.1:8700',
    agentEnv: { COCO_BIN: bin },
  });

  const result = await adapter._runCoco('hello coco');
  assert.equal(result, 'reply:hello coco');
});

test('coco adapter reports non-zero exit with stderr', async () => {
  const bin = writeExecutable('fake-coco-fail', `#!/bin/sh
echo 'bad coco' >&2
exit 7
`);
  const adapter = new CocoAdapter({
    workspaceId: 'sdk-local',
    channelName: 'general',
    token: 't',
    agentName: 'coco-one',
    endpoint: 'http://127.0.0.1:8700',
    agentEnv: { COCO_BIN: bin },
  });

  await assert.rejects(() => adapter._runCoco('hello'), /exit code 7: bad coco/);
});
