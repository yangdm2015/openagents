'use strict';

const { spawn } = require('child_process');
const BaseAdapter = require('./base');

class CocoAdapter extends BaseAdapter {
  async _handleMessage(msg) {
    const channel = msg.sessionId || this.channelName || 'general';
    const prompt = msg.content || '';
    if (!prompt.trim()) return;

    try {
      await this._autoTitleChannel(channel, prompt);
    } catch {}

    try {
      const reply = await this._runCoco(prompt);
      await this.sendResponse(channel, reply || '(empty response)');
    } catch (e) {
      this._log(`Coco failed: ${e.message}`);
      await this.sendError(channel, `Coco failed: ${e.message}`);
    }
  }

  _runCoco(prompt) {
    const env = this.agentEnv || process.env;
    const bin = env.COCO_BIN || 'coco';
    const args = splitArgs(env.COCO_ARGS || '');
    const cwd = env.COCO_WORKDIR || this.workingDir || process.cwd();

    return new Promise((resolve, reject) => {
      const proc = spawn(bin, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`exit code ${code}: ${stderr.trim() || stdout.trim() || 'no output'}`));
        }
      });
      proc.stdin.on('error', () => {});
      try {
        proc.stdin.write(prompt || '');
        proc.stdin.end();
      } catch {}
    });
  }
}

function splitArgs(value) {
  if (!value || !String(value).trim()) return [];
  const matches = String(value).match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((part) => part.replace(/^['"]|['"]$/g, ''));
}

module.exports = CocoAdapter;
