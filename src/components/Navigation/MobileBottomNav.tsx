import React from 'react';
import { 
  GitFork, 
  MessageSquare, 
  FileText, 
  BarChart3, 
  Settings, 
  Smartphone 
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'studio' | 'chat' | 'logs' | 'dashboard' | 'settings';
  setActiveTab: (tab: 'studio' | 'chat' | 'logs' | 'dashboard' | 'settings') => void;
  pendingTasksCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  pendingTasksCount,
}) => {
  const navItems = [
    {
      id: 'studio' as const,
      label: 'סטודיו',
      icon: GitFork,
    },
    {
      id: 'chat' as const,
      label: 'צ\'אט',
      icon: MessageSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
    },
    {
      id: 'logs' as const,
      label: 'לוגים',
      icon: FileText,
    },
    {
      id: 'dashboard' as const,
      label: 'דשבורד',
      icon: BarChart3,
    },
    {
      id: 'settings' as const,
      label: 'הגדרות',
      icon: Settings,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      <div className="grid grid-cols-5 h-16 max-w-md mx-auto items-center px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center h-full min-h-[44px] relative transition-transform active:scale-90 ${
                isActive ? 'text-[#25D366]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {item.badge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-slate-900">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 font-medium leading-none ${isActive ? 'font-bold text-[#25D366]' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="w-5 h-1 bg-[#25D366] rounded-full absolute -top-0.5 shadow-[0_0_8px_#25D366]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
