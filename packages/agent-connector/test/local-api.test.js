'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { AgentConnector } = require('../src/index');
const { LocalApiServer } = require('../src/local-api');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openagents-local-api-'));
}

async function request(baseUrl, method, pathname, body, token) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { res, data };
}

test('local API requires pairing token and stores SDK action config locally', async () => {
  const connector = new AgentConnector({ configDir: tmpDir() });
  const server = new LocalApiServer({ connector, port: 0 });
  await server.start();
  const baseUrl = `http://127.0.0.1:${server.port}`;

  try {
    const denied = await request(baseUrl, 'GET', '/api/actions');
    assert.equal(denied.res.status, 401);

    const token = connector.getPairingToken();
    const created = await request(baseUrl, 'POST', '/api/actions', {
      name: 'coco-one',
      runtime: 'coco',
      path: '/tmp/work',
      env: { COCO_BIN: '/bin/echo', SECRET_KEY: 'local-only' },
      network: {
        slug: 'sdk-local',
        endpoint: 'http://127.0.0.1:8700',
        owner_connect_token: 'one-shot',
        channels: ['u_owner_alpha'],
      },
    }, token);

    assert.equal(created.res.status, 200);
    assert.equal(created.data.success, true);

    const actions = connector.listActions();
    assert.equal(actions.length, 1);
    assert.equal(actions[0].name, 'coco-one');
    assert.equal(actions[0].runtime, 'coco');
    assert.equal(actions[0].network, 'sdk-local');
    assert.deepEqual(actions[0].channels, ['u_owner_alpha']);
    assert.equal(actions[0].env.COCO_BIN, '/bin/echo');
    assert.equal(actions[0].env.SECRET_KEY, 'local-only');

    const networks = connector.config.getNetworks();
    assert.equal(networks.length, 1);
    assert.equal(networks[0].slug, 'sdk-local');
    assert.equal(networks[0].protocol, 'sdk');
    assert.equal(networks[0].endpoint, 'http://127.0.0.1:8700');
    assert.equal(networks[0].owner_connect_token, 'one-shot');
    assert.equal(networks[0].SECRET_KEY, undefined);
  } finally {
    await server.stop();
  }
});
