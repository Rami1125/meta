import React from 'react';
import { 
  X, 
  Menu, 
  MessageSquare, 
  Image as ImageIcon, 
  Sparkles, 
  CheckSquare, 
  Webhook,
  Plus
} from 'lucide-react';
import { BlockType } from '../../types/studio';

interface AddBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBlock: (type: BlockType) => void;
}

export const AddBlockModal: React.FC<AddBlockModalProps> = ({
  isOpen,
  onClose,
  onAddBlock
}) => {
  if (!isOpen) return null;

  const blockTypes: Array<{
    type: BlockType;
    title: string;
    description: string;
    icon: any;
    color: string;
    badge: string;
  }> = [
    {
      type: 'list_menu',
      title: 'תפריט מעוצב (List Menu)',
      description: 'תפריט וואטסאפ אינטראקטיבי עם כפתור פתיחה ועד 10 שורות בחירה (כמו תפריט ראשי סבן)',
      icon: Menu,
      color: 'from-emerald-500 to-teal-600 border-emerald-500/40 text-emerald-400',
      badge: 'מומלץ לוואטסאפ'
    },
    {
      type: 'text',
      title: 'הודעת טקסט',
      description: 'הודעת טקסט פשוטה או מועשרת עם אימוג\'ים (הנחיות, כתובת, פרטי תשלום)',
      icon: MessageSquare,
      color: 'from-blue-500 to-indigo-600 border-blue-500/40 text-blue-400',
      badge: 'מהיר'
    },
    {
      type: 'image',
      title: 'הודעת תמונה / קובץ',
      description: 'שליחת תמונת מחירון, קטלוג חומרי בניין או מפת סניפי סבן',
      icon: ImageIcon,
      color: 'from-purple-500 to-pink-600 border-purple-500/40 text-purple-400',
      badge: 'מדיה'
    },
    {
      type: 'ai_question',
      title: 'שאלת AI (Gemini / ChatGPT)',
      description: 'מענה אוטומטי חכם לשאלות לקוחות על חומרי בניין, כמויות והמלצות מקצועיות',
      icon: Sparkles,
      color: 'from-amber-500 to-orange-600 border-amber-500/40 text-amber-400',
      badge: 'בינה מלאכותית'
    },
    {
      type: 'task',
      title: 'יצירת משימה',
      description: 'יוצר כרטיס משימה חדש לצוות המכירות או הלוגיסטיקה עם פרטי הפונה',
      icon: CheckSquare,
      color: 'from-rose-500 to-red-600 border-rose-500/40 text-rose-400',
      badge: 'לוגיסטיקה'
    },
    {
      type: 'webhook',
      title: 'Webhook ל-JONI Firebase',
      description: 'שליחת קריאת POST ישירה ל-Firebase RTDB של JONI לחיבור מערכות',
      icon: Webhook,
      color: 'from-cyan-500 to-blue-600 border-cyan-500/40 text-cyan-400',
      badge: 'אינטגרציה'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-slate-100 text-sm">הוספת בלוק חדש לעץ התפריטים</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {blockTypes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                onClick={() => {
                  onAddBlock(item.type);
                  onClose();
                }}
                className="p-3.5 rounded-2xl bg-slate-950/70 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-600 transition-all text-right flex flex-col justify-between group hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-xl bg-slate-900 border ${item.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded-full text-slate-400 border border-slate-800 group-hover:border-slate-700">
                      {item.badge}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-slate-100 group-hover:text-orange-400 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="mt-3 text-[10px] text-orange-400 font-semibold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                  <span>+ הוסף לעץ</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
