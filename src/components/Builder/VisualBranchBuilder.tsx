import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Eye, 
  Sparkles, 
  MessageSquare, 
  ListOrdered, 
  HelpCircle, 
  GitFork, 
  Bot, 
  UserCheck, 
  X,
  Play,
  RotateCcw,
  Check,
  Building2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { WhatsAppChat } from '../WhatsAppChat';

export interface VisualBlock {
  id: string;
  type: 'message' | 'menu' | 'question' | 'condition' | 'ai' | 'agent';
  title: string;
  text: string;
  options?: string[];
  conditionKey?: string;
  position: { x: number; y: number };
}

export interface VisualConnection {
  id: string;
  fromNodeId: string;
  fromOptionIndex?: number;
  toNodeId: string;
}

export interface VisualFlow {
  id: string;
  name: string;
  updatedAt: string;
  nodes: VisualBlock[];
  connections: VisualConnection[];
}

const DEFAULT_VISUAL_FLOW: VisualFlow = {
  id: 'main',
  name: 'עץ שיחות ראשי - ח. סבן חומרי בניין',
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'node_welcome',
      type: 'menu',
      title: 'תפריט ראשי סבן',
      text: 'שלום וברוכים הבאים לח. סבן חומרי בניין בע״מ (כפר ברא) 🏗️\nאיך נוכל לעזור היום?',
      options: ['🚚 הזמנה והובלה', '🏪 איסוף עצמי', '🗑️ מכולות פסולת', '📍 מעקב משלוח'],
      position: { x: 80, y: 160 }
    },
    {
      id: 'node_delivery',
      type: 'question',
      title: 'הזמנה והובלה',
      text: '🚚 מעולה! איזה חומר צריך? (ברזל, בלוקים, מלט נשר, חול/טיט) ולאיזו כתובת?',
      position: { x: 440, y: 40 }
    },
    {
      id: 'node_pickup',
      type: 'message',
      title: 'איסוף עצמי',
      text: '🏪 מחסן כפר ברא פתוח בימים א-ה 06:00-17:00. שלח פירוט ורמי יכין לך הכל!',
      position: { x: 440, y: 190 }
    },
    {
      id: 'node_waste',
      type: 'condition',
      title: 'מכולות פסולת',
      text: '🗑️ איזה גודל מכולה דרוש לך?\n6 קוב / 8 קוב / 12 קוב',
      options: ['6 קוב', '8 קוב', '12 קוב'],
      position: { x: 440, y: 340 }
    },
    {
      id: 'node_ai_free',
      type: 'ai',
      title: 'AI חופשי סבן',
      text: '🤖 מענה אוטומטי חופשי של בינה מלאכותית המתמחה בחומרי בניין וסבן',
      position: { x: 440, y: 500 }
    },
    {
      id: 'node_agent',
      type: 'agent',
      title: 'נציג אנושי - ראמי',
      text: '👷 פנייתך הועברה ישירות לראמי מסארווה (050-886-0896)',
      position: { x: 800, y: 220 }
    }
  ],
  connections: [
    { id: 'c1', fromNodeId: 'node_welcome', fromOptionIndex: 0, toNodeId: 'node_delivery' },
    { id: 'c2', fromNodeId: 'node_welcome', fromOptionIndex: 1, toNodeId: 'node_pickup' },
    { id: 'c3', fromNodeId: 'node_welcome', fromOptionIndex: 2, toNodeId: 'node_waste' },
    { id: 'c4', fromNodeId: 'node_welcome', fromOptionIndex: 3, toNodeId: 'node_ai_free' },
    { id: 'c5', fromNodeId: 'node_delivery', toNodeId: 'node_agent' }
  ]
};

const BLOCK_TEMPLATES = [
  {
    type: 'message' as const,
    label: '💬 הודעת טקסט',
    desc: 'כותב טקסט חופשי',
    color: 'from-blue-600 to-cyan-600',
    borderColor: 'border-blue-500/40',
    icon: MessageSquare,
    defaultTitle: 'הודעת טקסט',
    defaultText: 'הודעה מנציג סבן חומרי בניין 🏗️'
  },
  {
    type: 'menu' as const,
    label: '📋 תפריט',
    desc: 'בונה תפריט בעברית מלאה',
    color: 'from-emerald-600 to-teal-600',
    borderColor: 'border-emerald-500/40',
    icon: ListOrdered,
    defaultTitle: 'תפריט אפשרויות',
    defaultText: 'אנא בחרו מתוך האפשרויות הבאות:',
    defaultOptions: ['אפשרות 1', 'אפשרות 2', 'אפשרות 3']
  },
  {
    type: 'question' as const,
    label: '❓ שאלה',
    desc: 'מה הכמות? / מה הכתובת?',
    color: 'from-amber-600 to-orange-600',
    borderColor: 'border-amber-500/40',
    icon: HelpCircle,
    defaultTitle: 'שאלת כמות/כתובת',
    defaultText: 'לאיזו כתובת לספק ומה הכמות הנדרשת?'
  },
  {
    type: 'condition' as const,
    label: '🔀 תנאי',
    desc: 'אם בחר ברזל -> ענף ברזל',
    color: 'from-purple-600 to-indigo-600',
    borderColor: 'border-purple-500/40',
    icon: GitFork,
    defaultTitle: 'פיצול תנאי',
    defaultText: 'אם הלקוח בחר ברזל או בלוקים:',
    defaultOptions: ['ברזל', 'בלוקים', 'אחר']
  },
  {
    type: 'ai' as const,
    label: '🤖 AI חופשי',
    desc: 'תן ל-AI לענות חופשי',
    color: 'from-rose-600 to-pink-600',
    borderColor: 'border-rose-500/40',
    icon: Bot,
    defaultTitle: 'מענה AI חופשי',
    defaultText: 'סוכן ה-AI של סבן יענה חופשי ויבין את צרכי הלקוח'
  },
  {
    type: 'agent' as const,
    label: '👷 העבר לנציג',
    desc: 'רמי מסארוה זמין',
    color: 'from-amber-500 to-yellow-600',
    borderColor: 'border-yellow-500/40',
    icon: UserCheck,
    defaultTitle: 'העברה לראמי',
    defaultText: 'ראמי מסארווה (050-886-0896) זמין כעת לסגירת ההזמנה'
  }
];

export const VisualBranchBuilder: React.FC = () => {
  const [flow, setFlow] = useState<VisualFlow>(DEFAULT_VISUAL_FLOW);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('node_welcome');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Dragging state for nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Load flow on mount
  useEffect(() => {
    fetch('/api/chat_flows/main')
      .then(res => res.json())
      .then(data => {
        if (data && data.nodes && data.nodes.length > 0) {
          setFlow(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/chat_flows/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flow)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Failed to save visual flow:', e);
    }
    setIsSaving(false);
  };

  const handleAddBlock = (template: typeof BLOCK_TEMPLATES[0]) => {
    const newId = `node_${Date.now()}`;
    const newBlock: VisualBlock = {
      id: newId,
      type: template.type,
      title: template.defaultTitle,
      text: template.defaultText,
      options: template.defaultOptions ? [...template.defaultOptions] : undefined,
      position: { x: 300 + Math.random() * 80, y: 150 + Math.random() * 80 }
    };

    setFlow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newBlock]
    }));
    setSelectedBlockId(newId);
  };

  const handleDeleteBlock = (nodeId: string) => {
    if (flow.nodes.length <= 1) return;
    setFlow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      connections: prev.connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId)
    }));
    if (selectedBlockId === nodeId) {
      setSelectedBlockId(null);
    }
  };

  const selectedBlock = flow.nodes.find(n => n.id === selectedBlockId);

  const updateSelectedBlock = (updates: Partial<VisualBlock>) => {
    if (!selectedBlockId) return;
    setFlow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === selectedBlockId ? { ...n, ...updates } : n)
    }));
  };

  // Node Dragging Handlers
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setSelectedBlockId(nodeId);
    setDragOffset({
      x: e.clientX - node.position.x * zoom,
      y: e.clientY - node.position.y * zoom
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId) return;
    const newX = Math.max(10, Math.round((e.clientX - dragOffset.x) / zoom));
    const newY = Math.max(10, Math.round((e.clientY - dragOffset.y) / zoom));

    setFlow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n)
    }));
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  return (
    <div 
      className="flex-1 h-full flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden font-['Assistant',sans-serif]" 
      dir="rtl"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      
      {/* Top Action Bar */}
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow">
            <GitFork className="w-5 h-5 text-slate-950 stroke-[2.4]" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span>בונה ענפים ויזואלי (Visual Branch Builder)</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Figma-Canvas
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">חבר ענפים, ערוך טקסטים בעברית ושמור ישירות ל-Firebase RTDB</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="hidden sm:flex items-center bg-slate-800/80 rounded-xl p-1 border border-slate-700/60 text-xs">
            <button 
              onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))} 
              className="p-1 hover:text-white text-slate-400 transition-colors"
              title="הקטן"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(prev => Math.min(1.4, prev + 0.1))} 
              className="p-1 hover:text-white text-slate-400 transition-colors"
              title="הגדל"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Preview Button */}
          <button
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all shadow-sm"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>תצוגה מקדימה בוואטסאפ</span>
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-orange-600/20"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>נשמר בהצלחה!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'שומר ל-Firebase...' : 'שמור ענפים (/chat_flows/main)'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace (Left: Blocks Library, Center: Figma Canvas, Right: Block Inspector) */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* 1. Left Sidebar: Blocks Library (ספריית בלוקים) */}
        <div className="w-64 bg-slate-900/90 border-l border-slate-800 p-3 flex flex-col gap-3 shrink-0 overflow-y-auto z-10">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between pb-2 border-b border-slate-800">
            <span>ספריית בלוקים (6 סוגים)</span>
            <span className="text-[10px] text-slate-500 font-mono">הוסף בלוק</span>
          </div>

          <div className="space-y-2">
            {BLOCK_TEMPLATES.map((tmpl, idx) => {
              const Icon = tmpl.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleAddBlock(tmpl)}
                  className="w-full text-right p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all flex items-start gap-2.5 group active:scale-98"
                >
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${tmpl.color} flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                      {tmpl.label}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {tmpl.desc}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0 self-center" />
                </button>
              );
            })}
          </div>

          <div className="mt-auto p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="font-bold text-slate-300 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>הנחיות עריכה</span>
            </div>
            <p>• גרור כל בלוק על הלוח למיקום הנוח לך</p>
            <p>• לחץ על בלוק לעריכת טקסט ואפשרויות</p>
            <p>• כל שינוי מסתנכרן עם Firebase RTDB</p>
          </div>
        </div>

        {/* 2. Center: Canvas (לוח ענפים) with Figma Grid & Bezier Connections */}
        <div 
          ref={canvasRef}
          className="flex-1 h-full relative overflow-auto cursor-grab active:cursor-grabbing bg-slate-950"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        >
          {/* SVG Connection Lines Layer (Bezier curves) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minWidth: '1600px', minHeight: '1200px' }}>
            <defs>
              <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            {flow.connections.map((conn) => {
              const fromNode = flow.nodes.find(n => n.id === conn.fromNodeId);
              const toNode = flow.nodes.find(n => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;

              // Compute anchor coordinates
              const x1 = (fromNode.position.x + 240) * zoom;
              const y1 = (fromNode.position.y + 60 + (conn.fromOptionIndex !== undefined ? conn.fromOptionIndex * 24 : 0)) * zoom;
              const x2 = toNode.position.x * zoom;
              const y2 = (toNode.position.y + 60) * zoom;

              const dx = Math.abs(x2 - x1) * 0.5;
              const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <g key={conn.id}>
                  {/* Glowing shadow curve */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="4"
                    strokeOpacity="0.2"
                  />
                  {/* Main Bezier Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="url(#curveGradient)"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />
                  {/* Arrow Head circle */}
                  <circle cx={x2} cy={y2} r="4" fill="#22c55e" />
                </g>
              );
            })}
          </svg>

          {/* Node Blocks Elements */}
          <div 
            className="absolute inset-0"
            style={{ 
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
              minWidth: '1600px',
              minHeight: '1200px'
            }}
          >
            {flow.nodes.map((node) => {
              const tmpl = BLOCK_TEMPLATES.find(t => t.type === node.type) || BLOCK_TEMPLATES[0];
              const Icon = tmpl.icon;
              const isSelected = selectedBlockId === node.id;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  style={{
                    left: `${node.position.x}px`,
                    top: `${node.position.y}px`
                  }}
                  className={`absolute w-64 rounded-2xl bg-slate-900/95 border transition-shadow cursor-pointer z-10 shadow-lg ${
                    isSelected 
                      ? 'border-amber-500 shadow-amber-500/20 shadow-xl ring-2 ring-amber-500/30' 
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Node Header */}
                  <div className={`p-2.5 rounded-t-2xl bg-gradient-to-r ${tmpl.color} text-white flex items-center justify-between`}>
                    <div className="flex items-center gap-1.5 font-bold text-xs truncate">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{node.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteBlock(node.id);
                      }}
                      className="p-1 hover:bg-black/30 rounded-lg transition-colors text-white/80 hover:text-white"
                      title="מחק בלוק"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Node Body */}
                  <div className="p-3 text-xs text-slate-300 space-y-2">
                    <div className="whitespace-pre-wrap line-clamp-3 text-[11px] leading-relaxed font-['Assistant',sans-serif]">
                      {node.text}
                    </div>

                    {/* Options list if menu/condition */}
                    {node.options && node.options.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1">
                        {node.options.map((opt, i) => (
                          <div 
                            key={i} 
                            className="bg-slate-950 px-2 py-1 rounded-lg text-[10px] text-slate-300 border border-slate-800 flex items-center justify-between font-medium"
                          >
                            <span className="truncate">{opt}</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Output Connection Anchor */}
                  <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-orange-500 border-2 border-slate-900 shadow"></div>
                  {/* Input Connection Anchor */}
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 shadow"></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Right Sidebar: Node Inspector / Editor */}
        {selectedBlock && (
          <div className="w-80 bg-slate-900/95 border-r border-slate-800 p-4 flex flex-col gap-4 shrink-0 overflow-y-auto z-10">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                <span>עריכת בלוק: {selectedBlock.title}</span>
              </h3>
              <button 
                onClick={() => setSelectedBlockId(null)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Block Title */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">כותרת הבלוק:</label>
              <input
                type="text"
                value={selectedBlock.title}
                onChange={(e) => updateSelectedBlock({ title: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Block Text */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">תוכן ההודעה (עברית ואימוג'ים):</label>
              <textarea
                rows={4}
                value={selectedBlock.text}
                onChange={(e) => updateSelectedBlock({ text: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-['Assistant',sans-serif]"
                placeholder="כתוב טקסט חופשי..."
              />
            </div>

            {/* Options editor if applicable */}
            {(selectedBlock.type === 'menu' || selectedBlock.type === 'condition') && (
              <div className="space-y-2">
                <label className="block text-[11px] text-slate-400">אפשרויות בחירה / כפתורים:</label>
                {(selectedBlock.options || []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...(selectedBlock.options || [])];
                        newOpts[i] = e.target.value;
                        updateSelectedBlock({ options: newOpts });
                      }}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                    />
                    <button
                      onClick={() => {
                        const newOpts = (selectedBlock.options || []).filter((_, idx) => idx !== i);
                        updateSelectedBlock({ options: newOpts });
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      title="הסר אפשרות"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const newOpts = [...(selectedBlock.options || []), `אפשרות חדשה ${(selectedBlock.options?.length || 0) + 1}`];
                    updateSelectedBlock({ options: newOpts });
                  }}
                  className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl flex items-center justify-center gap-1 font-semibold transition-all mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>הוסף אפשרות</span>
                </button>
              </div>
            )}

            {/* Quick Test / Trigger Preview */}
            <div className="mt-auto pt-4 border-t border-slate-800">
              <button
                onClick={() => setIsPreviewOpen(true)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                <Eye className="w-4 h-4" />
                <span>צפה בבלוק זה בוואטסאפ</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* WhatsApp Live Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md h-[90vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-700 animate-in zoom-in-95">
            <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>תצוגה מקדימה חיה - ממשק וואטסאפ ח. סבן</span>
              </div>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <WhatsAppChat onBack={() => setIsPreviewOpen(false)} isStandalone={false} />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
