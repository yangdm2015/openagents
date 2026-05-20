'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const CodexAdapter = require('../src/adapters/codex');

test('codex adapter passes model reasoning config to CLI mode', async () => {
  const adapter = new CodexAdapter({
    workspaceId: 'sdk-local',
    channelName: 'general',
    token: 't',
    agentName: 'codex-one',
    endpoint: 'http://127.0.0.1:8700',
    agentEnv: {
      CODEX_MODEL: 'gpt-5.1-codex',
      CODEX_REASONING_EFFORT: 'high',
      CODEX_VERBOSITY: 'low',
    },
  });

  adapter.sendStatus = async () => {};
  adapter.sendResponse = async () => {};
  adapter.sendError = async () => {};
  adapter._codexBin = '/bin/codex';
  adapter._useCliMode = true;
  adapter._directMode = false;

  let captured;
  adapter._spawnCodex = async (cmd, env, channel, prompt) => {
    captured = { cmd, env, channel, prompt };
    return { responseText: 'ok', exitCode: 0, stderr: '' };
  };

  await adapter._handleViaSubprocess('hello', 'general');

  assert.ok(captured);
  assert.equal(captured.env.CODEX_MODEL, 'gpt-5.1-codex');
  assert.equal(captured.env.CODEX_REASONING_EFFORT, 'high');
  assert.equal(captured.env.CODEX_VERBOSITY, 'low');
  assert.ok(captured.cmd.includes('-m'));
  assert.ok(captured.cmd.includes('gpt-5.1-codex'));
  assert.ok(captured.cmd.includes('-c'));
  assert.ok(captured.cmd.includes('model_reasoning_effort="high"'));
  assert.ok(captured.cmd.includes('model_verbosity="low"'));
});
