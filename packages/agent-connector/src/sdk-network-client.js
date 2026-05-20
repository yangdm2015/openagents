'use strict';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:8700';

class SdkNetworkClient {
  constructor(endpoint) {
    this.endpoint = (endpoint || DEFAULT_ENDPOINT).replace(/\/$/, '');
    this._agentSecrets = new Map();
  }

  async joinNetwork(agentName, token, { agentType, serverHost, workingDir, privateChannels } = {}) {
    const body = {
      agent_id: agentName,
      owner_connect_token: token,
      metadata: {
        display_name: agentName,
        platform: 'local-connector',
        agent_type: agentType || 'agent',
        server_host: serverHost,
        working_dir: workingDir,
        private_channels: privateChannels || [],
      },
    };
    const data = await this._request('/api/register', { method: 'POST', body });
    if (data && data.secret) this._agentSecrets.set(agentName, data.secret);
    return data;
  }

  async disconnect(_workspaceId, agentName, token) {
    const secret = this._agentSecrets.get(agentName) || token;
    const data = await this._request('/api/unregister', {
      method: 'POST',
      body: { agent_id: agentName, secret },
    });
    this._agentSecrets.delete(agentName);
    return data;
  }

  async heartbeat() {
    return { success: true };
  }

  async getHeadEventId() {
    return null;
  }

  async pollControl() {
    return [];
  }

  async pollToolResults() {
    return { events: [], cursor: null };
  }

  async pollPending(_workspaceId, agentName, token) {
    const secret = this._agentSecrets.get(agentName) || token;
    const query = new URLSearchParams({ agent_id: agentName });
    if (secret) query.set('secret', secret);
    const data = await this._request(`/api/poll?${query.toString()}`);
    const events = Array.isArray(data.messages) ? data.messages : [];
    return {
      messages: events.map((event) => this._eventToMessage(event)).filter(Boolean),
      cursor: events.length ? (events[events.length - 1].event_id || events[events.length - 1].id) : null,
    };
  }

  async sendMessage(_workspaceId, channelName, token, content, opts = {}) {
    const agentName = opts.senderName || opts.agentName || 'agent';
    const secret = this._agentSecrets.get(agentName) || token;
    const event = {
      event_name: 'thread.channel_message.post',
      source_id: agentName,
      destination_id: `channel:${channelName}`,
      payload: {
        channel: channelName,
        message_type: opts.messageType || 'channel_message',
        content: { text: content || '' },
      },
      metadata: opts.metadata || {},
      visibility: 'channel',
    };
    return this._request('/api/send_event', { method: 'POST', body: { event, secret } });
  }

  async getSession(_workspaceId, channelName) {
    return { id: channelName, title: channelName, titleManuallySet: true, status: 'active' };
  }

  async updateSession() {
    return { success: true };
  }

  async getRecentMessages() {
    return [];
  }

  async getTodos() {
    return { todos: [] };
  }

  async putTodos() {
    return { success: true };
  }

  async listRoutines() {
    return { routines: [] };
  }

  _eventToMessage(event) {
    if (!event || !event.payload) return null;
    const payload = event.payload || {};
    const content = typeof payload.content === 'object'
      ? (payload.content.text || '')
      : (payload.content || payload.text || '');
    const channel = payload.channel || event.destination_id || 'general';
    return {
      id: event.event_id || event.id,
      messageId: event.event_id || event.id,
      sessionId: String(channel).replace(/^channel:/, ''),
      senderType: 'human',
      senderName: event.source_id || 'user',
      content,
      mentions: payload.mentions || [],
      messageType: payload.message_type || 'chat',
      metadata: event.metadata || {},
      rawEvent: event,
    };
  }

  async _request(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(`${this.endpoint}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!res.ok || data.success === false) {
      const msg = data.error_message || data.error || res.statusText || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }
}

module.exports = { SdkNetworkClient };
