import { FlowTree, StudioSettings, LogEntry, Conversation, StudioTask } from '../types/studio';

export const api = {
  // Flow
  async getFlow(): Promise<FlowTree> {
    const res = await fetch('/api/flow');
    const data = await res.json();
    return data.flow;
  },

  async saveFlow(flow: FlowTree): Promise<{ success: boolean; message?: string }> {
    const res = await fetch('/api/flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flow),
    });
    return res.json();
  },

  async resetFlow(): Promise<FlowTree> {
    const res = await fetch('/api/flow/reset', { method: 'POST' });
    const data = await res.json();
    return data.flow;
  },

  // Settings
  async getSettings(): Promise<StudioSettings> {
    const res = await fetch('/api/settings');
    const data = await res.json();
    return data.settings;
  },

  async saveSettings(settings: Partial<StudioSettings>): Promise<{ success: boolean; settings?: StudioSettings; message?: string }> {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  // Logs
  async getLogs(params?: { menu?: string; phone?: string; query?: string }): Promise<LogEntry[]> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    const res = await fetch(`/api/logs?${query}`);
    const data = await res.json();
    return data.logs || [];
  },

  async clearLogs(): Promise<void> {
    await fetch('/api/logs', { method: 'DELETE' });
  },

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    const res = await fetch('/api/conversations');
    const data = await res.json();
    return data.conversations || [];
  },

  async sendReply(convId: string, text: string): Promise<any> {
    const res = await fetch(`/api/conversations/${convId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    return res.json();
  },

  // AI Smart Reply Suggestions
  async getSmartReplySuggestions(message: string, history: any[] = [], customerName?: string): Promise<string[]> {
    try {
      const res = await fetch('/api/chat/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, customerName })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          return data.suggestions.slice(0, 3);
        }
      }
    } catch (err) {
      console.error('Failed to fetch smart reply suggestions:', err);
    }
    return [];
  },

  // Tasks
  async getTasks(): Promise<StudioTask[]> {
    const res = await fetch('/api/tasks');
    const data = await res.json();
    return data.tasks || [];
  },

  async createTask(task: Partial<StudioTask>): Promise<StudioTask> {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    const data = await res.json();
    return data.task;
  },

  async updateTask(id: string, updates: Partial<StudioTask>): Promise<StudioTask> {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    return data.task;
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<any> {
    const res = await fetch('/api/dashboard/stats');
    return res.json();
  },

  // Simulator
  async simulateIncoming(payload: {
    from: string;
    text?: string;
    listReplyId?: string;
    customerName?: string;
    newConversation?: boolean;
  }): Promise<any> {
    const res = await fetch('/api/simulate-incoming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  // Live Meta WhatsApp Cloud API
  async getMetaStatus(): Promise<any> {
    const res = await fetch('/api/meta/status');
    return res.json();
  },

  async testMetaConnection(): Promise<any> {
    const res = await fetch('/api/meta/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
  },

  async sendLiveMetaMenu(to?: string): Promise<any> {
    const res = await fetch('/api/meta/send-live-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to })
    });
    return res.json();
  }
};
