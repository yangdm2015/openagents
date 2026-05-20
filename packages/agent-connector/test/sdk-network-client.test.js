'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const { SdkNetworkClient } = require('../src/sdk-network-client');

function readJson(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      resolve(text ? JSON.parse(text) : {});
    });
  });
}

test('SDK network client registers, polls and sends via /api endpoints', async () => {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'POST' && url.pathname === '/api/register') {
      const body = await readJson(req);
      calls.push(['register', body]);
      res.end(JSON.stringify({ success: true, secret: 'sdk-secret' }));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/poll') {
      calls.push(['poll', Object.fromEntries(url.searchParams.entries())]);
      res.end(JSON.stringify({
        success: true,
        messages: [{
          event_id: 'evt-1',
          source_id: 'studio-user',
          payload: {
            message_type: 'channel_message',
            channel: 'u_owner_alpha',
            content: { text: 'hello' },
          },
        }],
      }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/send_event') {
      const body = await readJson(req);
      calls.push(['send', body]);
      res.end(JSON.stringify({ success: true }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/unregister') {
      const body = await readJson(req);
      calls.push(['unregister', body]);
      res.end(JSON.stringify({ success: true }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;

  try {
    const client = new SdkNetworkClient(endpoint);
    const joined = await client.joinNetwork('coco-one', 'one-shot', {
      agentType: 'coco',
      privateChannels: ['u_owner_alpha'],
    });
    assert.equal(joined.secret, 'sdk-secret');
    assert.equal(calls[0][0], 'register');
    assert.equal(calls[0][1].agent_id, 'coco-one');
    assert.equal(calls[0][1].owner_connect_token, 'one-shot');
    assert.deepEqual(calls[0][1].metadata.private_channels, ['u_owner_alpha']);

    const polled = await client.pollPending('sdk-local', 'coco-one', 'one-shot');
    assert.equal(polled.messages.length, 1);
    assert.equal(polled.messages[0].content, 'hello');
    assert.equal(polled.messages[0].sessionId, 'u_owner_alpha');
    assert.equal(calls[1][1].secret, 'sdk-secret');

    await client.sendMessage('sdk-local', 'u_owner_alpha', 'one-shot', 'pong', {
      senderName: 'coco-one',
    });
    assert.equal(calls[2][0], 'send');
    assert.equal(calls[2][1].event.source_id, 'coco-one');
    assert.equal(calls[2][1].event.payload.content.text, 'pong');

    await client.disconnect('sdk-local', 'coco-one', 'one-shot');
    assert.equal(calls[3][0], 'unregister');
    assert.equal(calls[3][1].secret, 'sdk-secret');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
