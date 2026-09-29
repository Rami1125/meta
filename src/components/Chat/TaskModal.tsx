import React, { useState } from 'react';
import { X, CheckSquare, AlertCircle } from 'lucide-react';
import { StudioTask } from '../../types/studio';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Partial<StudioTask>) => Promise<void>;
  initialData?: {
    clientPhone: string;
    clientName: string;
    title: string;
    description: string;
    category?: 'delivery' | 'pickup' | 'containers' | 'tracking' | 'general';
    conversationId?: string;
  };
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData
}) => {
  const [phone, setPhone] = useState(initialData?.clientPhone || '');
  const [name, setName] = useState(initialData?.clientName || '');
  const [title, setTitle] = useState(initialData?.title || 'פנייה מוואטסאפ');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState<'delivery' | 'pickup' | 'containers' | 'tracking' | 'general'>(
    initialData?.category || 'delivery'
  );
  const [priority, setPriority] = useState<'low' | 'normal' | 'urgent'>('normal');
  const [assignedTo, setAssignedTo] = useState('מוקד הזמנות סבן');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state if initialData changes
  React.useEffect(() => {
    if (initialData) {
      setPhone(initialData.clientPhone || '');
      setName(initialData.clientName || '');
      setTitle(initialData.title || 'פנייה מוואטסאפ');
      setDescription(initialData.description || '');
      if (initialData.category) setCategory(initialData.category);
    }
  }, [initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit({
      clientPhone: phone,
      clientName: name,
      title,
      description,
      category,
      priority,
      assignedTo,
      status: 'pending',
      conversationId: initialData?.conversationId
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-right">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm">יצירת משימה חדשה</h3>
              <p className="text-[11px] text-slate-400">פרטי הפנייה מהשיחה מולאו אוטומטית</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs text-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">טלפון לקוח:</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 font-mono text-left focus:outline-none focus:border-rose-500"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">שם לקוח / חברה:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="למשל: יוסי כהן - קבלן"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">כותרת משימה:</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: הזמנת הובלת בלוקים לרחוב הברזל"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">קטגוריה:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-200"
              >
                <option value="delivery">🚚 הובלה</option>
                <option value="pickup">🏪 איסוף עצמי</option>
                <option value="containers">🗑️ מכולות</option>
                <option value="tracking">📍 מעקב</option>
                <option value="general">כללי</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">עדיפות:</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-200"
              >
                <option value="urgent">🔴 דחופה</option>
                <option value="normal">🟡 רגילה</option>
                <option value="low">🟢 נמוכה</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">אחראי טיפול:</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-slate-400 mb-1">פירוט הבקשה והערות:</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="כתובת אתר, חומרים מבוקשים, שעת אספקה..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl shadow-lg shadow-rose-600/25 disabled:opacity-50"
            >
              {isSubmitting ? 'יוצר...' : 'צור משימה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
