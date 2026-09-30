import React from 'react';
import { 
  GitFork, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Settings, 
  Smartphone, 
  Radio, 
  Flame, 
  Building2,
  FileSpreadsheet,
  Zap
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'studio' | 'builder' | 'chat' | 'logs' | 'dashboard' | 'settings' | 'tools';
  setActiveTab: (tab: 'studio' | 'builder' | 'chat' | 'logs' | 'dashboard' | 'settings' | 'tools') => void;
  openSimulator: () => void;
  pendingTasksCount: number;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  openSimulator,
  pendingTasksCount,
}) => {
  const navItems = [
    {
      id: 'builder' as const,
      label: 'בונה ענפים ויזואלי',
      sublabel: 'WhatsApp Flow Builder',
      icon: GitFork,
      badge: 'חדש ✨',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    },
    {
      id: 'tools' as const,
      label: 'כלים ו-Function Calling',
      sublabel: 'JONI Make Webhook',
      icon: Zap,
      badge: 'Live ⚡',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
    },
    {
      id: 'studio' as const,
      label: 'עורך עץ תפריטים',
      sublabel: 'Flow Studio',
      icon: Building2,
    },
    {
      id: 'chat' as const,
      label: 'צ\'אט וואטסאפ חי',
      sublabel: 'WhatsApp & AI',
      icon: MessageSquare,
      badge: pendingTasksCount > 0 ? `${pendingTasksCount} משימות` : undefined,
      badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    },
    {
      id: 'logs' as const,
      label: 'תיעוד ויומנים',
      sublabel: 'Logs & Audit',
      icon: FileText,
    },
    {
      id: 'dashboard' as const,
      label: 'דשבורד וניתוח',
      sublabel: 'Analytics',
      icon: BarChart3,
    },
    {
      id: 'settings' as const,
      label: 'הגדרות ו-JONI',
      sublabel: 'Meta & Webhook',
      icon: Settings,
    },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-slate-900 border-l border-slate-800 flex-col justify-between shrink-0 select-none">
      {/* Top Header */}
      <div>
        <div className="p-4 border-b border-slate-800/80 bg-gradient-to-b from-slate-900 to-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/20 text-slate-950 font-black text-xl">
              <Building2 className="w-6 h-6 text-slate-950 stroke-[2.4]" />
            </div>
            <div>
              <h1 className="font-bold text-base text-slate-100 tracking-tight leading-tight">
                ח. סבן סטודיו
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] text-emerald-400 font-medium font-mono dir-ltr">
                  +972 50-8860896
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2 bg-slate-800/60 rounded-lg border border-slate-700/50 flex items-center justify-between text-[11px] text-slate-300">
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>JONI Bridge</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              מחובר
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-right transition-all group ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/25 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70 font-normal'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-amber-400'
                    }`}
                  />
                  <div>
                    <div className="text-sm leading-tight">{item.label}</div>
                    <div
                      className={`text-[10px] ${
                        isActive ? 'text-orange-200' : 'text-slate-400'
                      }`}
                    >
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : item.badgeColor || 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Simulator & Integration Status */}
      <div className="p-3 border-t border-slate-800/80 space-y-2">
        <button
          onClick={openSimulator}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm shadow-lg shadow-emerald-700/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Smartphone className="w-4 h-4 text-emerald-200" />
          <span>בדיקת סימולטור WhatsApp</span>
        </button>

        <div className="px-2 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[10px] text-slate-400 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-amber-500" />
              <span>Firebase RTDB:</span>
            </span>
            <span className="text-slate-300 font-mono text-[9px] truncate max-w-[110px]" title="saban-ai-drive-default-rtdb">
              saban-ai-drive...
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Meta API v20.0:</span>
            <span className="text-emerald-400 font-medium">מוכן + Fallback</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
              <span>Google Sheets:</span>
            </span>
            <span className="text-emerald-400 font-medium">נועה AI מחובר ✅</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
