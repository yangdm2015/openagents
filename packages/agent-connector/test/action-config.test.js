'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { Config } = require('../src/config');
const { AgentConnector } = require('../src/index');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-action-config-'));
}

test('config stores local CLI actions separately from agents', () => {
  const config = new Config(tmpDir());

  const action = config.addAction({
    name: 'summarize-with-coco',
    runtime: 'coco',
    model: 'coco-default',
    description: 'Summarize workspace updates',
    path: '/tmp/project',
    env: { COCO_BIN: '/bin/echo', COCO_ARGS: '--json' },
    network: 'sdk-local',
    channels: ['u_owner_alpha'],
  });

  assert.equal(action.name, 'summarize-with-coco');
  assert.equal(action.runtime, 'coco');

  const reloaded = new Config(config.configDir);
  assert.deepEqual(reloaded.getActions(), [{
    name: 'summarize-with-coco',
    runtime: 'coco',
    model: 'coco-default',
    description: 'Summarize workspace updates',
    path: '/tmp/project',
    env: { COCO_BIN: '/bin/echo', COCO_ARGS: '--json' },
    network: 'sdk-local',
    channels: ['u_owner_alpha'],
  }]);
  assert.deepEqual(reloaded.getAgents(), []);
});

test('connector exposes actions as agn up runnable local runtimes', () => {
  const connector = new AgentConnector({ configDir: tmpDir() });
  connector.addAction({
    name: 'coco-action',
    runtime: 'coco',
    model: 'coco-default',
    description: 'Coco local runtime action',
    path: '/tmp/work',
    env: { COCO_WORKDIR: '/tmp/work' },
    network: 'sdk-local',
    channels: ['u_owner_alpha'],
  });

  const actions = connector.listActions();
  assert.equal(actions.length, 1);
  assert.equal(actions[0].name, 'coco-action');
  assert.equal(actions[0].runtime, 'coco');
  assert.equal(actions[0].model, 'coco-default');
  assert.equal(actions[0].description, 'Coco local runtime action');
  assert.equal(actions[0].type, 'coco');
  assert.equal(actions[0].network, 'sdk-local');
  assert.deepEqual(actions[0].channels, ['u_owner_alpha']);
});
