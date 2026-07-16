import { defineStore } from 'pinia';
import api from '@/lib/api.js';
import { connectSocket, disconnectSocket } from '@/lib/socket.js';

export const useSessionsStore = defineStore('sessions', {
  state: () => ({
    list: [],
    now: Date.now(),
    connected: false,
    _tick: null,
  }),
  getters: {
    activeCount: (s) => s.list.length,
  },
  actions: {
    async fetchActive() {
      const { data } = await api.get('/sessions');
      this.list = data.sessions;
    },
    async start(payload) {
      const { data } = await api.post('/sessions', payload);
      data.sessions.forEach((s) => this._upsert(s));
      return data.sessions;
    },
    async addTime(id, minutes) {
      const { data } = await api.post(`/sessions/${id}/add-time`, { minutes });
      this._upsert(data.session);
      return data.session;
    },
    async end(id) {
      const { data } = await api.post(`/sessions/${id}/end`);
      this._remove(id);
      return data.session;
    },
    async get(id) {
      const { data } = await api.get(`/sessions/${id}`);
      return data.session;
    },
    _upsert(s) {
      if (!s) return;
      if (s.status === 'completed') { this._remove(s.id); return; }
      const i = this.list.findIndex((x) => x.id === s.id);
      if (i >= 0) this.list.splice(i, 1, s);
      else this.list.push(s);
    },
    _remove(id) {
      this.list = this.list.filter((x) => x.id !== id);
    },
    startClock() {
      clearInterval(this._tick);
      this._tick = setInterval(() => { this.now = Date.now(); }, 1000);
    },
    stopClock() {
      clearInterval(this._tick);
      this._tick = null;
    },
    connect(token) {
      connectSocket(token, {
        onConnected: () => { this.connected = true; },
        onDisconnect: () => { this.connected = false; },
        onCreated: ({ session }) => this._upsert(session),
        onUpdated: ({ session }) => this._upsert(session),
        onEnded: ({ id }) => this._remove(id),
        onTick: ({ now, sessions }) => {
          this.now = Date.now();
          // reconcile authoritative status/ends_at from the server tick
          (sessions || []).forEach((t) => {
            const s = this.list.find((x) => x.id === t.id);
            if (s) { s.status = t.status; s.ends_at = t.ends_at; }
          });
        },
      });
    },
    disconnect() {
      disconnectSocket();
      this.connected = false;
    },
  },
});
