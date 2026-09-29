import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Sparkles, 
  Link2, 
  Sliders, 
  Check,
} from 'lucide-react';
import { 
  StudioNode, 
  FlowTree, 
  ListMenuRow, 
  ListMenuData, 
  TextData, 
  ImageData, 
  AiQuestionData, 
  TaskData, 
  WebhookData 
} from '../../types/studio';

interface InspectorDrawerProps {
  node: StudioNode | null;
  flow: FlowTree;
  isOpen: boolean;
  onClose: () => void;
  onUpdateNode: (updatedNode: StudioNode) => void;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  node,
  flow,
  isOpen,
  onClose,
  onUpdateNode,
}) => {
  const [formData, setFormData] = useState<StudioNode | null>(null);

  useEffect(() => {
    if (node) {
      setFormData(JSON.parse(JSON.stringify(node)));
    }
  }, [node]);

  if (!isOpen || !formData) return null;

  const handleSave = () => {
    onUpdateNode(formData);
    onClose();
  };

  const otherNodes = flow.nodes.filter(n => n.id !== formData.id);

  // List Menu row management
  const addListRow = () => {
    if (formData.data.type !== 'list_menu') return;
    const currentRows = formData.data.rows || [];
    if (currentRows.length >= 10) return;

    const newId = `option_${currentRows.length + 1}`;
    const newRow: ListMenuRow = {
      id: newId,
      title: `אפשרות חדשה ${currentRows.length + 1}`,
      description: 'תיאור השירות עבור הלקוח',
    };

    setFormData({
      ...formData,
      data: {
        ...formData.data,
        rows: [...currentRows, newRow]
      }
    });
  };

  const removeListRow = (index: number) => {
    if (formData.data.type !== 'list_menu') return;
    const rows = [...formData.data.rows];
    rows.splice(index, 1);
    setFormData({
      ...formData,
      data: {
        ...formData.data,
        rows
      }
    });
  };

  const updateListRow = (index: number, updates: Partial<ListMenuRow>) => {
    if (formData.data.type !== 'list_menu') return;
    const rows = [...formData.data.rows];
    rows[index] = { ...rows[index], ...updates };
    setFormData({
      ...formData,
      data: {
        ...formData.data,
        rows
      }
    });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity"
        onClick={onClose}
      />

      <div className="fixed z-40 bg-slate-900 border-slate-800 shadow-2xl flex flex-col text-right transition-transform duration-300
        inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl border-t animate-in slide-in-from-bottom
        md:inset-y-0 md:left-0 md:right-auto md:w-96 md:rounded-none md:border-r md:animate-in md:slide-in-from-left
      ">
        {/* Mobile Drag Pill */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto mt-2.5 mb-1 md:hidden" />

        {/* Header */}
        <div className="p-3.5 md:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-slate-100 text-sm">עריכת בלוק</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-orange-600 hover:bg-orange-500 active:scale-95 text-white rounded-xl text-xs font-semibold shadow-md transition-all"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>שמור</span>
            </button>
            <button
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

      {/* Form Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-200">
        
        {/* Basic Block Info */}
        <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-slate-800">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              כותרת הבלוק:
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              מזהה ייחודי (ID):
            </label>
            <input
              type="text"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-orange-500"
              placeholder="e.g. delivery / pickup / containers"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              תיאור קצר:
            </label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* 1. LIST MENU CONFIGURATION */}
        {formData.data.type === 'list_menu' && (
          <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-emerald-900/40">
            <div className="font-bold text-emerald-400 text-xs flex items-center justify-between">
              <span>הגדרות תפריט WhatsApp מעוצב</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800/60">
                List Menu
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">כותרת עליונה (Header):</label>
              <input
                type="text"
                value={formData.data.header || ''}
                onChange={(e) => {
                  const d = formData.data as ListMenuData;
                  setFormData({ ...formData, data: { ...d, header: e.target.value } });
                }}
                placeholder="למשל: ח. סבן חומרי בניין 🏗️"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">תוכן ההודעה (Body):</label>
              <textarea
                rows={3}
                value={formData.data.body}
                onChange={(e) => {
                  const d = formData.data as ListMenuData;
                  setFormData({ ...formData, data: { ...d, body: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">טקסט כפתור פתיחה:</label>
                <input
                  type="text"
                  value={formData.data.buttonText || ''}
                  onChange={(e) => {
                    const d = formData.data as ListMenuData;
                    setFormData({ ...formData, data: { ...d, buttonText: e.target.value } });
                  }}
                  placeholder="בחר שירות"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">כותרת סקשן:</label>
                <input
                  type="text"
                  value={formData.data.sectionTitle || ''}
                  onChange={(e) => {
                    const d = formData.data as ListMenuData;
                    setFormData({ ...formData, data: { ...d, sectionTitle: e.target.value } });
                  }}
                  placeholder="שירותי ח. סבן"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">כותרת תחתונה (Footer):</label>
              <input
                type="text"
                value={formData.data.footer || ''}
                onChange={(e) => {
                  const d = formData.data as ListMenuData;
                  setFormData({ ...formData, data: { ...d, footer: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* List Rows */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">אפשרויות ברשימה (עד 10):</span>
                <button
                  type="button"
                  onClick={addListRow}
                  disabled={formData.data.rows.length >= 10}
                  className="flex items-center gap-1 text-[10px] bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3 h-3" />
                  <span>הוסף אפשרות</span>
                </button>
              </div>

              {formData.data.rows.map((row, idx) => (
                <div key={idx} className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-emerald-400">אפשרות #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeListRow(idx)}
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={row.id}
                      onChange={(e) => updateListRow(idx, { id: e.target.value })}
                      placeholder="מזהה (id)"
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] font-mono"
                    />
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateListRow(idx, { title: e.target.value })}
                      placeholder="כותרת שורה (עד 24 תווים)"
                      maxLength={24}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px]"
                    />
                  </div>

                  <input
                    type="text"
                    value={row.description}
                    onChange={(e) => updateListRow(idx, { description: e.target.value })}
                    placeholder="תיאור (עד 72 תווים)"
                    maxLength={72}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px]"
                  />

                  {/* Target Block Link */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 shrink-0">חיבור לבלוק:</span>
                    <select
                      value={row.targetBlockId || ''}
                      onChange={(e) => updateListRow(idx, { targetBlockId: e.target.value || undefined })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200"
                    >
                      <option value="">-- ללא יעד --</option>
                      {otherNodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.title} ({n.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. TEXT CONFIGURATION */}
        {formData.data.type === 'text' && (
          <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-blue-900/40">
            <div className="font-bold text-blue-400 text-xs">הגדרות הודעת טקסט</div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">תוכן ההודעה:</label>
              <textarea
                rows={5}
                value={formData.data.text}
                onChange={(e) => {
                  const d = formData.data as TextData;
                  setFormData({ ...formData, data: { ...d, text: e.target.value } });
                }}
                placeholder="הקלד כאן את תוכן ההודעה שתישלח ללקוח..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">חיבור להמשך:</label>
              <select
                value={formData.data.targetBlockId || ''}
                onChange={(e) => {
                  const d = formData.data as TextData;
                  setFormData({ ...formData, data: { ...d, targetBlockId: e.target.value || undefined } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
              >
                <option value="">-- סוף זרימה (ללא בלוק המשך) --</option>
                {otherNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title} ({n.id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 3. IMAGE CONFIGURATION */}
        {formData.data.type === 'image' && (
          <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-purple-900/40">
            <div className="font-bold text-purple-400 text-xs">הגדרות תמונה / מסמך</div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">כתובת תמונה (URL):</label>
              <input
                type="text"
                value={formData.data.imageUrl}
                onChange={(e) => {
                  const d = formData.data as ImageData;
                  setFormData({ ...formData, data: { ...d, imageUrl: e.target.value } });
                }}
                placeholder="https://..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">כיתוב תמונה (Caption):</label>
              <input
                type="text"
                value={formData.data.caption || ''}
                onChange={(e) => {
                  const d = formData.data as ImageData;
                  setFormData({ ...formData, data: { ...d, caption: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">חיבור להמשך:</label>
              <select
                value={formData.data.targetBlockId || ''}
                onChange={(e) => {
                  const d = formData.data as ImageData;
                  setFormData({ ...formData, data: { ...d, targetBlockId: e.target.value || undefined } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
              >
                <option value="">-- ללא בלוק המשך --</option>
                {otherNodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 4. AI QUESTION CONFIGURATION */}
        {formData.data.type === 'ai_question' && (
          <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-amber-900/40">
            <div className="font-bold text-amber-400 text-xs flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>שאלת AI (Google Gemini / ChatGPT)</span>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">הוראות מערכת (System Prompt):</label>
              <textarea
                rows={3}
                value={formData.data.systemPrompt}
                onChange={(e) => {
                  const d = formData.data as AiQuestionData;
                  setFormData({ ...formData, data: { ...d, systemPrompt: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">מידע ורקע על העסק (ח. סבן):</label>
              <textarea
                rows={3}
                value={formData.data.contextInfo}
                onChange={(e) => {
                  const d = formData.data as AiQuestionData;
                  setFormData({ ...formData, data: { ...d, contextInfo: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">מענה גיבוי (Fallback):</label>
              <input
                type="text"
                value={formData.data.fallbackText}
                onChange={(e) => {
                  const d = formData.data as AiQuestionData;
                  setFormData({ ...formData, data: { ...d, fallbackText: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
              />
            </div>
          </div>
        )}

        {/* 5. TASK CONFIGURATION */}
        {formData.data.type === 'task' && (
          <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-rose-900/40">
            <div className="font-bold text-rose-400 text-xs">יצירת משימה אוטומטית</div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">תבנית כותרת משימה:</label>
              <input
                type="text"
                value={formData.data.taskTitleTemplate}
                onChange={(e) => {
                  const d = formData.data as TaskData;
                  setFormData({ ...formData, data: { ...d, taskTitleTemplate: e.target.value } });
                }}
                placeholder="למשל: הזמנת הובלה חדשה - {{from}}"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">קטגוריה:</label>
                <select
                  value={formData.data.category}
                  onChange={(e) => {
                    const d = formData.data as TaskData;
                    setFormData({ ...formData, data: { ...d, category: e.target.value as any } });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                >
                  <option value="delivery">הובלה</option>
                  <option value="pickup">איסוף עצמי</option>
                  <option value="containers">מכולות</option>
                  <option value="tracking">מעקב</option>
                  <option value="general">כללי</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">דחיפות:</label>
                <select
                  value={formData.data.urgency}
                  onChange={(e) => {
                    const d = formData.data as TaskData;
                    setFormData({ ...formData, data: { ...d, urgency: e.target.value as any } });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                >
                  <option value="low">נמוכה</option>
                  <option value="normal">רגילה</option>
                  <option value="urgent">דחופה</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">הודעת אישור ללקוח בוואטסאפ:</label>
              <textarea
                rows={2}
                value={formData.data.confirmationMessage}
                onChange={(e) => {
                  const d = formData.data as TaskData;
                  setFormData({ ...formData, data: { ...d, confirmationMessage: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
              />
            </div>
          </div>
        )}

        {/* 6. WEBHOOK CONFIGURATION */}
        {formData.data.type === 'webhook' && (
          <div className="space-y-3 p-3 bg-slate-950/50 rounded-xl border border-cyan-900/40">
            <div className="font-bold text-cyan-400 text-xs">שליחת Webhook (JONI Firebase)</div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">כתובת ה-Endpoint:</label>
              <input
                type="text"
                value={formData.data.endpointUrl}
                onChange={(e) => {
                  const d = formData.data as WebhookData;
                  setFormData({ ...formData, data: { ...d, endpointUrl: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 font-mono text-[10px] dir-ltr"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">תבנית JSON לגוף הבקשה:</label>
              <textarea
                rows={3}
                value={formData.data.bodyTemplate}
                onChange={(e) => {
                  const d = formData.data as WebhookData;
                  setFormData({ ...formData, data: { ...d, bodyTemplate: e.target.value } });
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100 font-mono text-[10px] dir-ltr"
              />
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
};
