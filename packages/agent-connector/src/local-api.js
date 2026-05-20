'use strict';

const http = require('http');

class LocalApiServer {
  constructor({ connector, host = '127.0.0.1', port = 45555 } = {}) {
    if (!connector) throw new Error('connector is required');
    this.connector = connector;
    this.host = host || '127.0.0.1';
    this.requestedPort = Number(port || 45555);
    this.server = null;
    this.port = this.requestedPort;
  }

  async start() {
    if (this.server) return;
    this.server = http.createServer((req, res) => this._handle(req, res));
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.requestedPort, this.host, () => {
        this.server.off('error', reject);
        this.port = this.server.address().port;
        resolve();
      });
    });
  }

  async stop() {
    if (!this.server) return;
    const server = this.server;
    this.server = null;
    await new Promise((resolve) => server.close(resolve));
  }

  async _handle(req, res) {
    try {
      const url = new URL(req.url, `http://${this.host}`);
      if (req.method === 'OPTIONS') {
        res.writeHead(204, this._corsHeaders());
        res.end();
        return;
      }
      if (url.pathname === '/health') {
        return this._json(res, 200, { success: true });
      }
      if (!url.pathname.startsWith('/api/')) {
        return this._json(res, 404, { success: false, error: 'not found' });
      }
      if (!this._authorized(req)) {
        return this._json(res, 401, { success: false, error: 'invalid pairing token' });
      }

      if (req.method === 'GET' && url.pathname === '/api/agents') {
        return this._json(res, 200, { success: true, agents: this.connector.listAgents() });
      }
      if (req.method === 'POST' && url.pathname === '/api/agents') {
        return this._createAgent(req, res);
      }
      const agentMatch = url.pathname.match(/^\/api\/agents\/([^/]+)(?:\/(start|stop|restart|logs))?$/);
      if (agentMatch) {
        return this._agentAction(req, res, decodeURIComponent(agentMatch[1]), agentMatch[2]);
      }

      if (req.method === 'GET' && url.pathname === '/api/actions') {
        return this._json(res, 200, { success: true, actions: this.connector.listActions() });
      }
      if (req.method === 'POST' && url.pathname === '/api/actions') {
        return this._createAction(req, res);
      }
      const actionMatch = url.pathname.match(/^\/api\/actions\/([^/]+)(?:\/(start|stop|restart|logs))?$/);
      if (actionMatch) {
        return this._actionCommand(req, res, decodeURIComponent(actionMatch[1]), actionMatch[2]);
      }

      if (req.method === 'GET' && url.pathname === '/api/providers') {
        const catalog = await this.connector.getCatalog().catch(() => []);
        return this._json(res, 200, { success: true, providers: catalog });
      }
      const providerMatch = url.pathname.match(/^\/api\/providers\/([^/]+)$/);
      if (providerMatch && req.method === 'PUT') {
        const body = await this._readJson(req);
        this.connector.saveAgentEnv(decodeURIComponent(providerMatch[1]), body.env || {});
        return this._json(res, 200, { success: true });
      }

      return this._json(res, 404, { success: false, error: 'not found' });
    } catch (e) {
      return this._json(res, 500, { success: false, error: e.message });
    }
  }

  async _createAgent(req, res) {
    const body = await this._readJson(req);
    const name = body.name || body.agent_id;
    if (!name) return this._json(res, 400, { success: false, error: 'name is required' });

    if (body.network) {
      const network = body.network;
      const slug = network.slug || network.id || 'sdk-local';
      this.connector.config.addNetwork({
        id: network.id || slug,
        slug,
        name: network.name || slug,
        endpoint: network.endpoint,
        token: network.owner_connect_token || network.token,
        owner_connect_token: network.owner_connect_token || network.token,
        protocol: 'sdk',
      });
    }

    this.connector.addAgent({
      name,
      type: body.type || body.agent_type || 'coco',
      role: body.role || 'worker',
      path: body.path || body.workdir,
      env: body.env || {},
      network: body.network ? (body.network.slug || body.network.id || 'sdk-local') : body.networkSlug,
      channels: (body.network && body.network.channels) || body.channels || [],
    });
    try { this.connector.sendDaemonCommand('reload'); } catch {}
    return this._json(res, 200, { success: true, agent: this.connector.config.getAgent(name) });
  }

  async _createAction(req, res) {
    const body = await this._readJson(req);
    const name = body.name || body.action_id || body.agent_id;
    if (!name) return this._json(res, 400, { success: false, error: 'name is required' });

    const networkSlug = this._saveNetwork(body.network);
    this.connector.addAction({
      name,
      runtime: body.runtime || body.type || body.agent_type || 'coco',
      path: body.path || body.workdir,
      env: body.env || {},
      network: body.network ? networkSlug : body.networkSlug,
      channels: (body.network && body.network.channels) || body.channels || [],
    });
    try { this.connector.sendDaemonCommand('reload'); } catch {}
    return this._json(res, 200, { success: true, action: this.connector.config.getAction(name) });
  }

  _saveNetwork(network) {
    if (!network) return null;
    const slug = network.slug || network.id || 'sdk-local';
    this.connector.config.addNetwork({
      id: network.id || slug,
      slug,
      name: network.name || slug,
      endpoint: network.endpoint,
      token: network.owner_connect_token || network.token,
      owner_connect_token: network.owner_connect_token || network.token,
      protocol: 'sdk',
    });
    return slug;
  }

  async _agentAction(req, res, name, action) {
    if (req.method === 'DELETE' && !action) {
      this.connector.removeAgent(name);
      try { this.connector.sendDaemonCommand('reload'); } catch {}
      return this._json(res, 200, { success: true });
    }
    if (req.method === 'POST' && action === 'start') {
      this.connector.sendDaemonCommand(`restart:${name}`);
      return this._json(res, 200, { success: true });
    }
    if (req.method === 'POST' && action === 'stop') {
      this.connector.sendDaemonCommand(`stop:${name}`);
      return this._json(res, 200, { success: true });
    }
    if (req.method === 'POST' && action === 'restart') {
      this.connector.sendDaemonCommand(`restart:${name}`);
      return this._json(res, 200, { success: true });
    }
    if (req.method === 'GET' && action === 'logs') {
      return this._json(res, 200, { success: true, lines: this.connector.getLogs(name, 200) });
    }
    return this._json(res, 404, { success: false, error: 'not found' });
  }

  async _actionCommand(req, res, name, action) {
    if (req.method === 'DELETE' && !action) {
      this.connector.removeAction(name);
      try { this.connector.sendDaemonCommand('reload'); } catch {}
      return this._json(res, 200, { success: true });
    }
    if (req.method === 'POST' && action === 'start') {
      this.connector.sendDaemonCommand(`restart:${name}`);
      return this._json(res, 200, { success: true });
    }
    if (req.method === 'POST' && action === 'stop') {
      this.connector.sendDaemonCommand(`stop:${name}`);
      return this._json(res, 200, { success: true });
    }
    if (req.method === 'POST' && action === 'restart') {
      this.connector.sendDaemonCommand(`restart:${name}`);
      return this._json(res, 200, { success: true });
    }
    if (req.method === 'GET' && action === 'logs') {
      return this._json(res, 200, { success: true, lines: this.connector.getLogs(name, 200) });
    }
    return this._json(res, 404, { success: false, error: 'not found' });
  }

  _authorized(req) {
    const header = req.headers.authorization || '';
    return header === `Bearer ${this.connector.getPairingToken()}`;
  }

  _readJson(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!text) return resolve({});
        try { resolve(JSON.parse(text)); } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });
  }

  _json(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
      'content-type': 'application/json',
      ...this._corsHeaders(),
    });
    res.end(body);
  }

  _corsHeaders() {
    return {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
    };
  }
}

module.exports = { LocalApiServer };
