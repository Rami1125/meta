import React from 'react';
import { 
  Menu, 
  MessageSquare, 
  Image as ImageIcon, 
  Sparkles, 
  CheckSquare, 
  Webhook, 
  Trash2, 
  Settings2, 
  ArrowLeft,
  ChevronRight,
  Zap,
  Tag
} from 'lucide-react';
import { 
  StudioNode, 
  ListMenuData, 
  TextData, 
  ImageData, 
  AiQuestionData, 
  TaskData, 
  WebhookData 
} from '../../types/studio';

interface NodeCardProps {
  node: StudioNode;
  isSelected: boolean;
  onSelect: (node: StudioNode) => void;
  onDelete: (id: string) => void;
  onStartConnect?: (nodeId: string, handleId?: string) => void;
}

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  isSelected,
  onSelect,
  onDelete,
  onStartConnect
}) => {
  const getHeaderMeta = () => {
    switch (node.type) {
      case 'list_menu':
        return {
          icon: Menu,
          color: 'from-emerald-500 to-teal-600',
          borderColor: 'border-emerald-500/50',
          badgeText: 'תפריט מעוצב',
          badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
        };
      case 'text':
        return {
          icon: MessageSquare,
          color: 'from-blue-500 to-indigo-600',
          borderColor: 'border-blue-500/50',
          badgeText: 'הודעת טקסט',
          badgeBg: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
        };
      case 'image':
        return {
          icon: ImageIcon,
          color: 'from-purple-500 to-pink-600',
          borderColor: 'border-purple-500/50',
          badgeText: 'תמונה / קובץ',
          badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
        };
      case 'ai_question':
        return {
          icon: Sparkles,
          color: 'from-amber-500 to-orange-600',
          borderColor: 'border-amber-500/50',
          badgeText: 'שאלת AI',
          badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
        };
      case 'task':
        return {
          icon: CheckSquare,
          color: 'from-rose-500 to-red-600',
          borderColor: 'border-rose-500/50',
          badgeText: 'יצירת משימה',
          badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
        };
      case 'webhook':
        return {
          icon: Webhook,
          color: 'from-cyan-500 to-blue-600',
          borderColor: 'border-cyan-500/50',
          badgeText: 'JONI Webhook',
          badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
        };
      default:
        return {
          icon: Zap,
          color: 'from-slate-500 to-slate-700',
          borderColor: 'border-slate-500/50',
          badgeText: 'בלוק',
          badgeBg: 'bg-slate-500/15 text-slate-300 border-slate-500/30'
        };
    }
  };

  const meta = getHeaderMeta();
  const Icon = meta.icon;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node);
      }}
      className={`relative w-80 bg-slate-900/95 backdrop-blur-md rounded-2xl border transition-all shadow-xl cursor-pointer group ${
        isSelected
          ? 'ring-2 ring-orange-500 border-orange-500 shadow-orange-500/20'
          : `border-slate-700/80 hover:border-slate-500`
      }`}
    >
      {/* Input connector handle on right (for RTL canvas incoming connection) */}
      <div 
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-800 border-2 border-slate-400 group-hover:border-orange-400 flex items-center justify-center shadow-md transition-colors"
        title="חיבור נכנס"
      >
        <span className="w-2 h-2 rounded-full bg-slate-400 group-hover:bg-orange-400"></span>
      </div>

      {/* Header */}
      <div className={`p-3.5 rounded-t-2xl bg-gradient-to-r ${meta.color} flex items-center justify-between text-white shadow-sm`}>
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-black/25 rounded-lg">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight leading-tight">{node.title}</div>
            <div className="text-[10px] text-white/80 font-mono mt-0.5 flex items-center gap-1">
              <Tag className="w-3 h-3 inline" />
              <span>ID: {node.id}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {node.isRoot && (
            <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full shadow-sm">
              ראשי
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(node);
            }}
            title="ערוך הגדרות"
            className="p-1 rounded-md hover:bg-white/20 text-white/90 hover:text-white transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
          {!node.isRoot && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
              title="מחק בלוק"
              className="p-1 rounded-md hover:bg-red-500/30 text-white/90 hover:text-red-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body Content Preview */}
      <div className="p-3.5 space-y-3 text-slate-200 text-xs">
        {/* Type Badge */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${meta.badgeBg}`}>
            {meta.badgeText}
          </span>
          <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
            {node.description}
          </span>
        </div>

        {/* List Menu Content */}
        {node.data.type === 'list_menu' && (
          <div className="space-y-2">
            <div className="p-2 bg-slate-950/70 rounded-xl border border-slate-800 text-[11px] text-slate-300 line-clamp-2">
              {node.data.body}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-400 font-semibold flex items-center justify-between">
                <span>ענפי תפריט WhatsApp (עד 10):</span>
                <span className="text-emerald-400 font-mono">{node.data.rows.length} אפשרויות</span>
              </div>

              {node.data.rows.map((row) => (
                <div
                  key={row.id}
                  className="group/row flex items-center justify-between p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-emerald-500/50 transition-all"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                    <div className="truncate">
                      <div className="font-semibold text-xs text-slate-100 truncate">{row.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">id: {row.id}</div>
                    </div>
                  </div>

                  {/* Output Port for this Row */}
                  <div className="flex items-center gap-1 shrink-0">
                    {row.targetBlockId ? (
                      <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded font-mono border border-emerald-800/60">
                        ➜ {row.targetBlockId}
                      </span>
                    ) : (
                      <span className="text-[9px] text-amber-400/80 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/30">
                        ללא יעד
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onStartConnect) onStartConnect(node.id, row.id);
                      }}
                      className="w-5 h-5 rounded-full bg-emerald-600/30 hover:bg-emerald-500 text-emerald-300 hover:text-white flex items-center justify-center transition-colors"
                      title="חבר ענף זה לבלוק יעד"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Text Message Content */}
        {node.data.type === 'text' && (
          <div className="p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300 whitespace-pre-line max-h-24 overflow-y-auto">
            {node.data.text || 'הודעה ריקה'}
          </div>
        )}

        {/* Image Content */}
        {node.data.type === 'image' && (
          <div className="space-y-1.5">
            <div className="h-20 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 overflow-hidden">
              {node.data.imageUrl ? (
                <img src={node.data.imageUrl} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-[10px]">
                  <ImageIcon className="w-5 h-5 mb-1" />
                  <span>הגדר כתובת תמונה</span>
                </div>
              )}
            </div>
            {node.data.caption && (
              <div className="text-[11px] text-slate-400 truncate">{node.data.caption}</div>
            )}
          </div>
        )}

        {/* AI Question Content */}
        {node.data.type === 'ai_question' && (
          <div className="space-y-1.5 p-2 bg-amber-950/20 rounded-xl border border-amber-900/40">
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>מודל: {node.data.model || 'gemini-3.8-flash'}</span>
            </div>
            <div className="text-[11px] text-slate-300 line-clamp-2">
              {node.data.systemPrompt}
            </div>
          </div>
        )}

        {/* Task Content */}
        {node.data.type === 'task' && (
          <div className="space-y-1.5 p-2 bg-rose-950/20 rounded-xl border border-rose-900/40">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-rose-300">{node.data.taskTitleTemplate}</span>
              <span className="text-[9px] bg-rose-900/50 text-rose-200 px-1.5 py-0.5 rounded">
                דחיפות: {node.data.urgency}
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              מוקצה ל: {node.data.assignedTo || 'צוות סבן'}
            </div>
          </div>
        )}

        {/* Webhook Content */}
        {node.data.type === 'webhook' && (
          <div className="p-2 bg-cyan-950/20 rounded-xl border border-cyan-900/40 space-y-1">
            <div className="text-[10px] font-mono text-cyan-300 truncate dir-ltr">
              POST {node.data.endpointUrl}
            </div>
            <div className="text-[10px] text-slate-400">
              שולח נתוני הזמנה ל-JONI Firebase
            </div>
          </div>
        )}

        {/* Single Target Connection Output (For non-list blocks) */}
        {node.data.type !== 'list_menu' && (
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
            <span className="text-slate-400">חיבור המשך:</span>
            <div className="flex items-center gap-1.5">
              {node.data.targetBlockId ? (
                <span className="font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">
                  ➜ {node.data.targetBlockId}
                </span>
              ) : (
                <span className="text-slate-500">סוף ענף</span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onStartConnect) onStartConnect(node.id);
                }}
                className="w-5 h-5 rounded-full bg-slate-800 hover:bg-orange-500 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
                title="חבר בלוק זה לשלב הבא"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
