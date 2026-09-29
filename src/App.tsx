import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileHeader } from './components/Navigation/MobileHeader';
import { MobileBottomNav } from './components/Navigation/MobileBottomNav';
import { PWAInstallBanner } from './components/Navigation/PWAInstallBanner';
import { usePWAInstall } from './hooks/usePWAInstall';
import { StudioCanvas } from './components/Studio/StudioCanvas';
import { ChatView } from './components/Chat/ChatView';
import { LogsView } from './components/Logs/LogsView';
import { DashboardView } from './components/Dashboard/DashboardView';
import { SettingsView } from './components/Settings/SettingsView';
import { WhatsAppSimulator } from './components/Simulator/WhatsAppSimulator';
import { api } from './services/api';
import { 
  DEFAULT_FLOW, 
  DEFAULT_SETTINGS, 
  INITIAL_CONVERSATIONS, 
  INITIAL_LOGS, 
  INITIAL_TASKS 
} from './data/defaultFlow';
import { 
  FlowTree, 
  StudioSettings, 
  LogEntry, 
  Conversation, 
  StudioTask 
} from './types/studio';

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'chat' | 'logs' | 'dashboard' | 'settings'>('studio');
  const [flow, setFlow] = useState<FlowTree>(DEFAULT_FLOW);
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [tasks, setTasks] = useState<StudioTask[]>(INITIAL_TASKS);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // PWA Install State & Hook
  const { isInstallable, isInstalled, isIOS, promptInstall } = usePWAInstall();

  // Load all data from API on start
  const refreshData = useCallback(async () => {
    try {
      const [fetchedFlow, fetchedSettings, fetchedLogs, fetchedConversations, fetchedTasks] = await Promise.all([
        api.getFlow().catch(() => DEFAULT_FLOW),
        api.getSettings().catch(() => DEFAULT_SETTINGS),
        api.getLogs().catch(() => INITIAL_LOGS),
        api.getConversations().catch(() => INITIAL_CONVERSATIONS),
        api.getTasks().catch(() => INITIAL_TASKS)
      ]);

      if (fetchedFlow) setFlow(fetchedFlow);
      if (fetchedSettings) setSettings(fetchedSettings);
      if (fetchedLogs) setLogs(fetchedLogs);
      if (fetchedConversations) setConversations(fetchedConversations);
      if (fetchedTasks) setTasks(fetchedTasks);
    } catch (err) {
      console.error('Failed to refresh data from server:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();

    // Polling interval every 6 seconds to update incoming chats and logs
    const interval = setInterval(() => {
      api.getLogs().then(setLogs).catch(() => {});
      api.getConversations().then(setConversations).catch(() => {});
      api.getTasks().then(setTasks).catch(() => {});
    }, 6000);

    return () => clearInterval(interval);
  }, [refreshData]);

  // Actions
  const handleSaveFlow = async (updatedFlow: FlowTree) => {
    setFlow(updatedFlow);
    try {
      await api.saveFlow(updatedFlow);
    } catch (err) {
      console.error('Failed to save flow to server:', err);
    }
  };

  const handleResetFlow = async () => {
    if (confirm('האם לשחזר את עץ התפריט של ח. סבן לברירת המחדל?')) {
      try {
        const reset = await api.resetFlow();
        setFlow(reset);
      } catch (err) {
        setFlow(JSON.parse(JSON.stringify(DEFAULT_FLOW)));
      }
    }
  };

  const handleClearLogs = async () => {
    try {
      await api.clearLogs();
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleSendReply = async (convId: string, text: string) => {
    try {
      const res = await api.sendReply(convId, text);
      if (res && res.conversation) {
        setConversations(prev => prev.map(c => c.id === convId ? res.conversation : c));
        // refresh logs
        api.getLogs().then(setLogs);
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    }
  };

  const handleCreateTask = async (taskData: Partial<StudioTask>) => {
    try {
      const newTask = await api.createTask(taskData);
      setTasks(prev => [newTask, ...prev]);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleSaveSettings = async (newSettings: Partial<StudioSettings>) => {
    try {
      const res = await api.saveSettings(newSettings);
      if (res && res.settings) {
        setSettings(res.settings);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleTestWebhook = async (text: string) => {
    return api.simulateIncoming({
      from: '+972508860896',
      text,
      customerName: 'בדיקת מנהל'
    });
  };

  const pendingTasksCount = tasks.filter(t => t.status === 'pending').length;

  return (
    <div className="flex flex-col md:flex-row h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 font-['Assistant',sans-serif]">
      {/* Mobile Top Header */}
      <MobileHeader
        onOpenSimulator={() => setIsSimulatorOpen(true)}
        isInstallable={isInstallable}
        onInstall={promptInstall}
      />

      {/* Android/iOS PWA Install Banner */}
      <PWAInstallBanner
        isInstallable={isInstallable}
        onInstall={promptInstall}
        isIOS={isIOS}
      />

      {/* Desktop Left Navigation Sidebar (Hidden on mobile) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openSimulator={() => setIsSimulatorOpen(true)}
        pendingTasksCount={pendingTasksCount}
      />

      {/* Main View Area */}
      <main className="flex-1 h-full overflow-hidden flex flex-col relative">
        {activeTab === 'studio' && (
          <StudioCanvas
            flow={flow}
            onSaveFlow={handleSaveFlow}
            onResetFlow={handleResetFlow}
            onOpenSimulator={() => setIsSimulatorOpen(true)}
          />
        )}

        {activeTab === 'chat' && (
          <ChatView
            conversations={conversations}
            onRefresh={refreshData}
            onSendReply={handleSendReply}
            onCreateTask={handleCreateTask}
          />
        )}

        {activeTab === 'logs' && (
          <LogsView
            logs={logs}
            onRefresh={refreshData}
            onClearLogs={handleClearLogs}
            onCreateTask={handleCreateTask}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView
            logs={logs}
            conversations={conversations}
            tasks={tasks}
            onNavigate={setActiveTab}
            onOpenSimulator={() => setIsSimulatorOpen(true)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onSaveSettings={handleSaveSettings}
            onTestWebhook={handleTestWebhook}
            isInstallable={isInstallable}
            isInstalled={isInstalled}
            onInstall={promptInstall}
            isIOS={isIOS}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (WhatsApp style, hidden on desktop) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingTasksCount={pendingTasksCount}
      />

      {/* WhatsApp Client Simulator Drawer/Modal */}
      <WhatsAppSimulator
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        flow={flow}
        onEventSent={refreshData}
      />
    </div>
  );
}
