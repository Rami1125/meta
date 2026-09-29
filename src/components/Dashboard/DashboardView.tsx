import React from 'react';
import { 
  BarChart3, 
  Truck, 
  Store, 
  Trash2, 
  MapPin, 
  MessageSquare, 
  CheckSquare, 
  Smartphone, 
  ArrowUpRight, 
  Activity,
  Flame,
  Radio
} from 'lucide-react';
import { LogEntry, Conversation, StudioTask } from '../../types/studio';

interface DashboardViewProps {
  logs: LogEntry[];
  conversations: Conversation[];
  tasks: StudioTask[];
  onNavigate: (tab: 'studio' | 'chat' | 'logs' | 'settings') => void;
  onOpenSimulator: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  logs,
  conversations,
  tasks,
  onNavigate,
  onOpenSimulator,
}) => {
  // Compute counts
  const menuCounts = {
    delivery: logs.filter(l => l.selected_menu_id === 'delivery' || l.selected_menu_title?.includes('הובלה')).length,
    pickup: logs.filter(l => l.selected_menu_id === 'pickup' || l.selected_menu_title?.includes('איסוף')).length,
    containers: logs.filter(l => l.selected_menu_id === 'containers' || l.selected_menu_title?.includes('מכולה')).length,
    tracking: logs.filter(l => l.selected_menu_id === 'tracking' || l.selected_menu_title?.includes('מעקב')).length,
  };

  const totalSelections = menuCounts.delivery + menuCounts.pickup + menuCounts.containers + menuCounts.tracking || 1;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;

  const menuStats = [
    {
      id: 'delivery',
      title: 'הזמנת הובלה לאתר',
      icon: Truck,
      count: menuCounts.delivery,
      percent: Math.round((menuCounts.delivery / totalSelections) * 100),
      color: 'from-orange-500 to-amber-600',
      bgColor: 'bg-orange-500/10 border-orange-500/30 text-orange-400'
    },
    {
      id: 'pickup',
      title: 'איסוף עצמי מסניף',
      icon: Store,
      count: menuCounts.pickup,
      percent: Math.round((menuCounts.pickup / totalSelections) * 100),
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
    },
    {
      id: 'containers',
      title: 'מכולות פינוי פסולת',
      icon: Trash2,
      count: menuCounts.containers,
      percent: Math.round((menuCounts.containers / totalSelections) * 100),
      color: 'from-amber-500 to-yellow-600',
      bgColor: 'bg-amber-500/10 border-amber-500/30 text-amber-400'
    },
    {
      id: 'tracking',
      title: 'מעקב אחרי הזמנה',
      icon: MapPin,
      count: menuCounts.tracking,
      percent: Math.round((menuCounts.tracking / totalSelections) * 100),
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-500/10 border-purple-500/30 text-purple-400'
    }
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-slate-950 p-6 space-y-6 text-right">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950/40 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-orange-400 uppercase bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
            ח. סבן חומרי בניין בע״מ • WhatsApp Studio
          </span>
          <h1 className="text-2xl font-bold text-slate-100 mt-2">
            דשבורד ביצועים ופעילות תפריט
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            נתוני שימוש חיים ב-WhatsApp Business (+972 50-8860896), קליטת פניות מתוסף JONI ושליחת מענה אוטומטי בענפי ההובלה, האיסוף והמכולות.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('studio')}
            className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-orange-600/20 transition-all hover:scale-[1.02]"
          >
            ערוך עץ תפריטים ➜
          </button>
          <button
            onClick={onOpenSimulator}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-700/20 transition-all hover:scale-[1.02]"
          >
            בדיקת סימולטור 📱
          </button>
        </div>
      </div>

      {/* 4 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>סה״כ פניות ויומנים</span>
            <Activity className="w-4 h-4 text-orange-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2 font-mono">
            {logs.length}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
            <span>פעיל ומסונכרן מול JONI</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>שיחות WhatsApp פעילות</span>
            <MessageSquare className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-slate-100 mt-2 font-mono">
            {conversations.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            לקוחות יצרו קשר דרך המספר
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>משימות פתוחות לטיפול</span>
            <CheckSquare className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400 mt-2 font-mono">
            {pendingTasks}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            מתוך {tasks.length} משימות במערכת
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>ענף מבוקש ביותר</span>
            <Truck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-100 mt-2 truncate">
            🚚 הזמנת הובלה לאתר
          </div>
          <div className="text-[11px] text-amber-400 mt-1">
            {menuCounts.delivery} פניות נקלטו
          </div>
        </div>
      </div>

      {/* 4 Menu Choices Breakdown */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-100 text-sm">פילוח בחירות בתפריט WhatsApp של סבן</h3>
            <p className="text-xs text-slate-400">כמה לקוחות בחרו בכל אחת מ-4 האפשרויות בתפריט</p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
            סה״כ: {totalSelections} בחירות
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {menuStats.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border ${item.bgColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-100">{item.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ענף: {item.id}</div>
                    </div>
                  </div>
                  <div className="text-left font-mono">
                    <div className="text-sm font-bold text-slate-100">{item.count} פניות</div>
                    <div className="text-[10px] text-slate-400">{item.percent}%</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(item.percent, 8)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Integration Status Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* JONI Webhook status */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-100">JONI Incoming Webhook Bridge</div>
              <div className="text-[10px] text-slate-400 font-mono dir-ltr text-right">
                POST /api/webhooks/joni
              </div>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full font-semibold border border-emerald-500/20">
            פעיל ומקבל פניות
          </span>
        </div>

        {/* Firebase status */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-xs text-slate-100">Firebase RTDB External Sync</div>
              <div className="text-[10px] text-slate-400 font-mono dir-ltr text-right truncate max-w-[200px]">
                saban-ai-drive-default-rtdb...
              </div>
            </div>
          </div>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full font-semibold border border-amber-500/20">
            חיבור קיים
          </span>
        </div>

      </div>

    </div>
  );
};
