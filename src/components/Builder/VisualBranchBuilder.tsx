import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ZoomOut,
  Smartphone,
  Wand2
} from 'lucide-react';
import { WhatsAppChat } from '../WhatsAppChat';
import { NoaCanvasCompanion, NoaFlightCommand } from '../Companion/NoaCanvasCompanion';
import { audioService } from '../../services/audioService';
import { api } from '../../services/api';

export interface VisualBranchBuilderProps {
  onOpenSimulator?: () => void;
  onSave?: () => void;
}

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
      id: 'container_action_menu',
      type: 'menu',
      title: '🗑️ שירות מכולות פסולת - ח. סבן',
      text: 'איזה סוג פעולה למכולה נדרש באתר?',
      options: [
        '📍 הצבה חדשה (הבאת מכולה ריקה לאתר)',
        '🔄 החלפה (הוצאת מכולה מלאה והצבת ריקה)',
        '🚛 הוצאה ופינוי (פינוי סופי של המכולה וסגירת האתר)'
      ],
      position: { x: 440, y: 340 }
    },
    {
      id: 'container_size_menu',
      type: 'menu',
      title: '📦 בחירת נפח המכולה',
      text: 'אנא בחר את גודל המכולה המבוקש:\n\n⚠️ דגש תפעולי: נדרשת גישה פנויה ורחבה למשאית רמסע לצורך הנפה ופריקה.',
      options: [
        '📦 6 קוב (מתאים לשיפוץ קל ודירות)',
        '📦 8 קוב (מתאים לפסולת כבדה, בלוקים ובטון)',
        '📦 12 קוב (מתאים לפסולת עץ, גבס ונפח גדול)'
      ],
      position: { x: 800, y: 340 }
    },
    {
      id: 'container_site_details',
      type: 'question',
      title: '📍 איסוף פרטי אתר מכולה',
      text: 'מעולה! אנא רשום לי בהודעה: כתובת האספקה המדויקת (עיר ורחוב), איש קשר באתר, ותאריך/שעה מבוקשים.',
      position: { x: 1160, y: 340 }
    },
    {
      id: 'create_container_task',
      type: 'agent',
      title: 'יצירת משימת מכולה - ראמי',
      text: '✅ פרטי המכולה נקלטו בהצלחה וסונכרנו ל-Firebase RTDB (joni/incoming)! נוצרה משימת תיאום עבור רמי מסארווה (050-886-0896) לתיאום משאית רמסע.',
      position: { x: 1520, y: 340 }
    },
    {
      id: 'node_ai_free',
      type: 'ai',
      title: 'AI חופשי סבן',
      text: '🤖 מענה אוטומטי חופשי של בינה מלאכותית המתמחה בחומרי בניין וסבן',
      position: { x: 440, y: 540 }
    },
    {
      id: 'node_agent',
      type: 'agent',
      title: 'נציג אנושי - ראמי',
      text: '👷 פנייתך הועברה ישירות לראמי מסארווה (050-886-0896)',
      position: { x: 800, y: 80 }
    }
  ],
  connections: [
    { id: 'c1', fromNodeId: 'node_welcome', fromOptionIndex: 0, toNodeId: 'node_delivery' },
    { id: 'c2', fromNodeId: 'node_welcome', fromOptionIndex: 1, toNodeId: 'node_pickup' },
    { id: 'c3', fromNodeId: 'node_welcome', fromOptionIndex: 2, toNodeId: 'container_action_menu' },
    { id: 'c4', fromNodeId: 'node_welcome', fromOptionIndex: 3, toNodeId: 'node_ai_free' },
    { id: 'c5', fromNodeId: 'node_delivery', toNodeId: 'node_agent' },
    { id: 'c_action_1', fromNodeId: 'container_action_menu', fromOptionIndex: 0, toNodeId: 'container_size_menu' },
    { id: 'c_action_2', fromNodeId: 'container_action_menu', fromOptionIndex: 1, toNodeId: 'container_size_menu' },
    { id: 'c_action_3', fromNodeId: 'container_action_menu', fromOptionIndex: 2, toNodeId: 'container_size_menu' },
    { id: 'c_size_1', fromNodeId: 'container_size_menu', fromOptionIndex: 0, toNodeId: 'container_site_details' },
    { id: 'c_size_2', fromNodeId: 'container_size_menu', fromOptionIndex: 1, toNodeId: 'container_site_details' },
    { id: 'c_size_3', fromNodeId: 'container_size_menu', fromOptionIndex: 2, toNodeId: 'container_site_details' },
    { id: 'c_details_task', fromNodeId: 'container_site_details', toNodeId: 'create_container_task' }
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

export const VisualBranchBuilder: React.FC<VisualBranchBuilderProps> = ({
  onOpenSimulator,
  onSave
}) => {
  const [flow, setFlow] = useState<VisualFlow>(DEFAULT_VISUAL_FLOW);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('node_welcome');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Noa Companion Flight Engine State
  const [noaCommand, setNoaCommand] = useState<NoaFlightCommand | null>(null);
  const [activeMagicNodeId, setActiveMagicNodeId] = useState<string | null>(null);

  // Dragging state for nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connection state for Click-to-Connect and Drag-to-Connect
  const [connectingSource, setConnectingSource] = useState<{
    nodeId: string;
    optionIndex?: number;
  } | null>(null);
  const [livePointerPos, setLivePointerPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingWire, setIsDraggingWire] = useState(false);

  // Helper: Find position of any node for Noa's flight calculations
  const getNodePosition = useCallback((nodeId: string) => {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) return null;
    return {
      x: node.position.x,
      y: node.position.y,
      width: 256,
      height: 180
    };
  }, [flow.nodes]);

  const handleNoaCommandComplete = useCallback((_cmd: NoaFlightCommand) => {
    setActiveMagicNodeId(null);
    setNoaCommand(null);
  }, []);

  // Quick Action Handler for Noa's AI Assistant Commands
  const handleNoaQuickAction = useCallback((promptText: string) => {
    const newId = `node_ai_${Date.now()}`;
    let newBlock: VisualBlock;

    if (promptText.includes('מחירון') || promptText.includes('חומרי')) {
      newBlock = {
        id: newId,
        type: 'menu',
        title: '📋 מחירון חומרי בניין סבן',
        text: 'מחירי מבצע קבלנים לכפר ברא והסביבה 🏗️\n• מלט נשר 50 ק"ג: 29.90 ₪\n• בלוק 20 שחור: 4.80 ₪\n• חול/טיט באלות: 85 ₪',
        options: ['🚚 הזמן משאית עכשיו', '📞 שיחה עם ראמי'],
        position: { x: 460 + Math.random() * 40, y: 360 + Math.random() * 40 }
      };
    } else if (promptText.includes('מכול')) {
      newBlock = {
        id: newId,
        type: 'question',
        title: '🗑️ הזמנת מכולה 8 קוב',
        text: 'אישור מכולה 8 קוב (פסולת כבדה, בלוקים ובטון) 🚛\nאנא שלח כתובת מדויקת בכפר ברא / מרכז להצבה מיידית.',
        position: { x: 800 + Math.random() * 40, y: 460 + Math.random() * 40 }
      };
    } else if (promptText.includes('שעות') || promptText.includes('איסוף')) {
      newBlock = {
        id: newId,
        type: 'message',
        title: '🏪 שעות פתיחה מחסן כפר ברא',
        text: 'ח. סבן פתוח בימים א-ה 06:30-17:00, וביום שישי 06:30-13:00 🏗️\nכתובת: כפר ברא (נווט ב-Waze: ח. סבן חומרי בניין)',
        position: { x: 440 + Math.random() * 40, y: 200 + Math.random() * 40 }
      };
    } else if (promptText.includes('הודעת פתיחה')) {
      const welcome = flow.nodes.find(n => n.id === 'node_welcome');
      if (welcome) {
        setFlow(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => n.id === 'node_welcome' ? {
            ...n,
            text: 'שלום וברוכים הבאים לח. סבן חומרי בניין בע״מ (כפר ברא) 🏗️\nספק חומרי הבניין המוביל באזור! איזה שירות תרצו להזמין היום?'
          } : n)
        }));
        setSelectedBlockId('node_welcome');
        setActiveMagicNodeId('node_welcome');
        setNoaCommand({
          targetNodeId: 'node_welcome',
          actionType: 'update_node',
          title: 'תפריט ראשי סבן',
          message: 'נועה מעדכנת את הודעת הפתיחה 🪄'
        });
        return;
      }
      newBlock = {
        id: newId,
        type: 'menu',
        title: 'תפריט ראשי מעודכן',
        text: 'שלום לח. סבן חומרי בניין כפר ברא 🏗️\nאיך נוכל לעזור היום?',
        options: ['🚚 הזמנה והובלה', '🏪 איסוף עצמי', '🗑️ מכולות פסולת', '📍 מעקב משלוח'],
        position: { x: 80, y: 160 }
      };
    } else {
      newBlock = {
        id: newId,
        type: 'ai',
        title: `ענף AI: ${promptText.slice(0, 18)}`,
        text: `מענה חכם מותאם אישית עבור: ${promptText}`,
        position: { x: 480 + Math.random() * 50, y: 320 + Math.random() * 50 }
      };
    }

    setFlow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newBlock]
    }));
    setSelectedBlockId(newId);
    setActiveMagicNodeId(newId);

    // Launch Noa's Flight Animation
    setNoaCommand({
      targetNodeId: newId,
      actionType: 'create_node',
      title: newBlock.title,
      message: `נועה מייצרת: ${newBlock.title} ✨`
    });
  }, [flow.nodes]);

  // Load flow on mount directly from Firebase RTDB
  useEffect(() => {
    api.getChatFlow()
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
      const res = await api.saveChatFlow(flow);
      if (res && res.success) {
        setSaveSuccess(true);
        if (onSave) onSave();
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
      position: { x: 320 + Math.random() * 80, y: 160 + Math.random() * 80 }
    };

    setFlow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newBlock]
    }));
    setSelectedBlockId(newId);

    // Trigger Noa to fly directly to this new block card!
    setActiveMagicNodeId(newId);
    setNoaCommand({
      targetNodeId: newId,
      actionType: 'create_node',
      title: template.defaultTitle,
      message: `נועה מייצרת: ${template.defaultTitle} 🪄`
    });
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
    if (connectingSource?.nodeId === nodeId) {
      setConnectingSource(null);
      setIsDraggingWire(false);
      setLivePointerPos(null);
    }
  };

  const selectedBlock = flow.nodes.find(n => n.id === selectedBlockId);

  const updateSelectedBlock = (updates: Partial<VisualBlock>, triggerNoa = false) => {
    if (!selectedBlockId) return;
    setFlow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === selectedBlockId ? { ...n, ...updates } : n)
    }));

    if (triggerNoa) {
      setActiveMagicNodeId(selectedBlockId);
      setNoaCommand({
        targetNodeId: selectedBlockId,
        actionType: 'update_node',
        message: 'נועה מעדכנת את הכרטיס... 🪄'
      });
    }
  };

  // Node Dragging Handlers (Mouse & Touch)
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

  const handleTouchStart = (e: React.TouchEvent, nodeId: string) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDraggingNodeId(nodeId);
    setSelectedBlockId(nodeId);
    setDragOffset({
      x: touch.clientX - node.position.x * zoom,
      y: touch.clientY - node.position.y * zoom
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId) {
      const newX = Math.max(10, Math.round((e.clientX - dragOffset.x) / zoom));
      const newY = Math.max(10, Math.round((e.clientY - dragOffset.y) / zoom));

      setFlow(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n)
      }));
    } else if (isDraggingWire && connectingSource && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;
      setLivePointerPos({
        x: (e.clientX - rect.left + scrollLeft) / zoom,
        y: (e.clientY - rect.top + scrollTop) / zoom
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggingNodeId && e.touches.length === 1) {
      const touch = e.touches[0];
      const newX = Math.max(10, Math.round((touch.clientX - dragOffset.x) / zoom));
      const newY = Math.max(10, Math.round((touch.clientY - dragOffset.y) / zoom));

      setFlow(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n)
      }));
    } else if (isDraggingWire && connectingSource && canvasRef.current && e.touches[0]) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;
      setLivePointerPos({
        x: (e.touches[0].clientX - rect.left + scrollLeft) / zoom,
        y: (e.touches[0].clientY - rect.top + scrollTop) / zoom
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
    if (isDraggingWire) {
      setIsDraggingWire(false);
    }
  };

  const handleTouchEnd = () => {
    setDraggingNodeId(null);
    if (isDraggingWire) {
      setIsDraggingWire(false);
    }
  };

  // Connecting Logic: Start connecting from an output handle
  const handleStartConnect = (nodeId: string, optionIndex?: number) => {
    if (connectingSource && connectingSource.nodeId === nodeId && connectingSource.optionIndex === optionIndex) {
      // Toggle off if clicking the same handle
      setConnectingSource(null);
      setIsDraggingWire(false);
      setLivePointerPos(null);
    } else {
      setConnectingSource({ nodeId, optionIndex });
      setSelectedBlockId(nodeId);
    }
  };

  const handleStartDragWire = (nodeId: string, optionIndex?: number, clientX?: number, clientY?: number) => {
    setConnectingSource({ nodeId, optionIndex });
    setIsDraggingWire(true);
    setSelectedBlockId(nodeId);
    if (clientX !== undefined && clientY !== undefined && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const scrollLeft = canvasRef.current.scrollLeft;
      const scrollTop = canvasRef.current.scrollTop;
      setLivePointerPos({
        x: (clientX - rect.left + scrollLeft) / zoom,
        y: (clientY - rect.top + scrollTop) / zoom
      });
    }
  };

  // Complete connection to a target node (Click-to-Connect or Drag-to-Connect)
  const handleConnectToTarget = (targetNodeId: string) => {
    if (!connectingSource) return;
    if (connectingSource.nodeId === targetNodeId) {
      setConnectingSource(null);
      setIsDraggingWire(false);
      setLivePointerPos(null);
      return;
    }

    // Filter out duplicate connection from the same handle
    const filtered = flow.connections.filter(
      c => !(c.fromNodeId === connectingSource.nodeId && c.fromOptionIndex === connectingSource.optionIndex && c.toNodeId === targetNodeId)
    );

    const newConn: VisualConnection = {
      id: `c_${Date.now()}`,
      fromNodeId: connectingSource.nodeId,
      fromOptionIndex: connectingSource.optionIndex,
      toNodeId: targetNodeId
    };

    setFlow(prev => ({
      ...prev,
      connections: [...filtered, newConn]
    }));

    setConnectingSource(null);
    setIsDraggingWire(false);
    setLivePointerPos(null);
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

          {/* Noa AI Quick Generator Chips */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/80 border border-cyan-500/40 rounded-xl px-2.5 py-1 text-xs shadow-inner">
            <span className="text-cyan-400 font-bold flex items-center gap-1 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>נועה AI:</span>
            </span>
            <button
              onClick={() => handleNoaQuickAction('הוסף ענף מחירון חומרי בניין')}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-cyan-950/90 text-[11px] text-slate-200 hover:text-cyan-300 border border-slate-700/80 transition-all active:scale-95"
              title="פקודה לנועה: יצירת ענף מחירון סבן"
            >
              + מחירון
            </button>
            <button
              onClick={() => handleNoaQuickAction('הוסף ענף מכולות פסולת 8 קוב')}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-cyan-950/90 text-[11px] text-slate-200 hover:text-cyan-300 border border-slate-700/80 transition-all active:scale-95"
              title="פקודה לנועה: יצירת ענף מכולת פסולת"
            >
              + מכולה
            </button>
            <button
              onClick={() => handleNoaQuickAction('הוסף ענף שעות פתיחה כפר ברא')}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-cyan-950/90 text-[11px] text-slate-200 hover:text-cyan-300 border border-slate-700/80 transition-all active:scale-95"
              title="פקודה לנועה: שעות פתיחה ומחסן"
            >
              + שעות פתיחה
            </button>
          </div>

          {/* Simulator Button */}
          {onOpenSimulator && (
            <button
              onClick={onOpenSimulator}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-950/80 hover:bg-emerald-900 active:scale-95 text-emerald-200 text-xs font-semibold rounded-xl border border-emerald-600/60 transition-all shadow-sm"
              title="פתח סימולטור WhatsApp חי לבדיקת התפריט העדכני"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>סימולטור WhatsApp חי</span>
            </button>
          )}

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
          onPointerMove={handleMouseMove}
          onTouchMove={handleTouchMove}
          onPointerUp={handleMouseUp}
          onTouchEnd={handleTouchEnd}
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        >
          {/* Noa Canvas Companion (Mascot Maia style) */}
          <NoaCanvasCompanion
            command={noaCommand}
            onCommandComplete={handleNoaCommandComplete}
            canvasRef={canvasRef}
            zoom={zoom}
            getNodePosition={getNodePosition}
            onQuickAction={handleNoaQuickAction}
          />
          {/* Active Connecting Status Banner */}
          {connectingSource && (
            <div className="sticky top-3 mx-auto z-40 w-fit bg-slate-900/95 backdrop-blur-md border border-amber-500/70 shadow-[0_0_24px_rgba(245,158,11,0.35)] text-amber-200 px-4 py-2 rounded-2xl flex items-center gap-3 animate-pulse">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span className="text-base">🔌</span>
                <span>מצב חיבור ענף פעיל: לחץ על נקודת היעד הכתומה של הבלוק הבא</span>
              </div>
              <button
                onClick={() => {
                  setConnectingSource(null);
                  setIsDraggingWire(false);
                  setLivePointerPos(null);
                }}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-lg text-xs font-semibold border border-amber-500/40 active:scale-95 transition-all"
              >
                ביטול
              </button>
            </div>
          )}

          {/* SVG Connection Lines Layer (Bezier curves) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ minWidth: '1600px', minHeight: '1200px' }}>
            <defs>
              <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            {/* Established Connections */}
            {flow.connections.map((conn) => {
              const fromNode = flow.nodes.find(n => n.id === conn.fromNodeId);
              const toNode = flow.nodes.find(n => n.id === conn.toNodeId);
              if (!fromNode || !toNode) return null;

              // Compute anchor coordinates (Output port is on the right side of fromNode, input on left side of toNode)
              const x1 = (fromNode.position.x + 256) * zoom;
              const y1 = (fromNode.position.y + (conn.fromOptionIndex !== undefined ? (106 + conn.fromOptionIndex * 30) : 56)) * zoom;
              const x2 = toNode.position.x * zoom;
              const y2 = (toNode.position.y + 56) * zoom;

              const dx = Math.abs(x2 - x1) * 0.5;
              const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g 
                  key={conn.id}
                  className="group/conn cursor-pointer pointer-events-auto"
                >
                  {/* Invisible thicker hit-path for easy hover and clicking */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                    onClick={() => {
                      setFlow(prev => ({
                        ...prev,
                        connections: prev.connections.filter(c => c.id !== conn.id)
                      }));
                    }}
                  />
                  {/* Glowing shadow curve */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="4"
                    strokeOpacity="0.25"
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
                  <circle cx={x2} cy={y2} r="5" fill="#22c55e" className="shadow" />
                  
                  {/* Hover Delete Button on line center */}
                  <g 
                    className="opacity-0 group-hover/conn:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFlow(prev => ({
                        ...prev,
                        connections: prev.connections.filter(c => c.id !== conn.id)
                      }));
                    }}
                  >
                    <circle cx={midX} cy={midY} r="10" fill="#ef4444" className="shadow-md" />
                    <text 
                      x={midX} 
                      y={midY + 3.5} 
                      fill="white" 
                      fontSize="11" 
                      textAnchor="middle" 
                      fontWeight="bold"
                    >
                      ×
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Dynamic live dragged wire following pointer */}
            {connectingSource && livePointerPos && (() => {
              const fromNode = flow.nodes.find(n => n.id === connectingSource.nodeId);
              if (!fromNode) return null;
              const x1 = (fromNode.position.x + 256) * zoom;
              const y1 = (fromNode.position.y + (connectingSource.optionIndex !== undefined ? (106 + connectingSource.optionIndex * 30) : 56)) * zoom;
              const x2 = livePointerPos.x * zoom;
              const y2 = livePointerPos.y * zoom;
              const dx = Math.abs(x2 - x1) * 0.5;
              const liveD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

              return (
                <g className="pointer-events-none">
                  <path
                    d={liveD}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="6"
                    strokeOpacity="0.3"
                    className="animate-pulse"
                  />
                  <path
                    d={liveD}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="3"
                    strokeDasharray="6 3"
                  />
                  <circle cx={x2} cy={y2} r="6" fill="#f59e0b" className="animate-ping" />
                  <circle cx={x2} cy={y2} r="5" fill="#f59e0b" />
                </g>
              );
            })()}
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
              const isTargetCandidate = Boolean(connectingSource && connectingSource.nodeId !== node.id);
              const isNodeActive = Boolean(connectingSource && connectingSource.nodeId === node.id && connectingSource.optionIndex === undefined);
              const isNoaTarget = activeMagicNodeId === node.id;

              return (
                <div
                  key={node.id}
                  id={`node-card-${node.id}`}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onTouchStart={(e) => handleTouchStart(e, node.id)}
                  onClick={(e) => {
                    if (isTargetCandidate) {
                      e.stopPropagation();
                      handleConnectToTarget(node.id);
                    } else {
                      setSelectedBlockId(node.id);
                    }
                  }}
                  style={{
                    left: `${node.position.x}px`,
                    top: `${node.position.y}px`
                  }}
                  className={`absolute w-64 rounded-2xl bg-slate-900/95 border transition-all cursor-pointer shadow-lg ${
                    isNoaTarget
                      ? 'border-cyan-400 ring-4 ring-cyan-400 shadow-[0_0_35px_rgba(34,211,238,0.85)] scale-[1.04] z-20'
                      : isSelected 
                        ? 'border-amber-500 shadow-amber-500/20 shadow-xl ring-2 ring-amber-500/30 z-10' 
                        : isTargetCandidate
                          ? 'border-amber-400/80 shadow-[0_0_16px_rgba(245,158,11,0.25)] ring-2 ring-amber-400/40 z-10'
                          : 'border-slate-800 hover:border-slate-700 z-10'
                  }`}
                >
                  {/* Floating Magic Glow Banner when Noa is casting on this card */}
                  {isNoaTarget && (
                    <div className="absolute -top-7 right-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-purple-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-xl flex items-center gap-1.5 animate-bounce z-30 border border-cyan-300/60">
                      <Sparkles className="w-3 h-3 text-amber-300 animate-spin" />
                      <span>נועה AI מעדכנת ענף... ✨</span>
                    </div>
                  )}
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

                    {/* Options list if menu/condition with individual interactive ports */}
                    {node.options && node.options.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        {node.options.map((opt, i) => {
                          const isOptionActive = connectingSource?.nodeId === node.id && connectingSource?.optionIndex === i;
                          return (
                            <div 
                              key={i} 
                              className="relative group/opt bg-slate-950 px-2.5 py-1.5 rounded-xl text-[11px] text-slate-200 border border-slate-800 flex items-center justify-between font-medium hover:border-emerald-500/40 transition-colors"
                            >
                              <span className="truncate pr-1">{opt}</span>

                              {/* Option Output Port (32x32px hitbox, pulsing glow, hover emoji 🔌) */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartConnect(node.id, i);
                                }}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  handleStartConnect(node.id, i);
                                  handleStartDragWire(node.id, i, e.clientX, e.clientY);
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  handleStartConnect(node.id, i);
                                  if (e.touches[0]) {
                                    handleStartDragWire(node.id, i, e.touches[0].clientX, e.touches[0].clientY);
                                  }
                                }}
                                className="group/port relative -mr-1 w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center cursor-crosshair touch-none shrink-0"
                                title="לחץ או גרור לחיבור ענף"
                              >
                                <div 
                                  className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-200 select-none ${
                                    isOptionActive
                                      ? 'w-4 h-4 bg-emerald-400 ring-4 ring-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.9)] scale-125'
                                      : 'bg-emerald-500 ring-2 ring-emerald-400/60 shadow-[0_0_12px_rgba(52,211,153,0.5)] animate-pulse group-hover/port:scale-125 group-hover/port:ring-4 group-hover/port:ring-emerald-300'
                                  }`}
                                >
                                  <span className="text-[8px] leading-none opacity-0 group-hover/port:opacity-100 transition-opacity">
                                    🔌
                                  </span>
                                </div>

                                {/* Tooltip */}
                                <div className="pointer-events-none absolute right-full mr-2 px-2 py-0.5 bg-slate-900/95 text-emerald-300 text-[10px] font-semibold rounded-lg border border-emerald-500/40 shadow-xl opacity-0 group-hover/port:opacity-100 transition-all duration-200 whitespace-nowrap z-50 flex items-center gap-1">
                                  <span>🔌</span>
                                  <span>לחץ או גרור לחיבור ענף</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Target / Input Connection Handle on Left (Orange, pulsing when waiting for target) */}
                  <div 
                    onClick={(e) => {
                      if (isTargetCandidate) {
                        e.stopPropagation();
                        handleConnectToTarget(node.id);
                      }
                    }}
                    onPointerUp={(e) => {
                      if (isTargetCandidate) {
                        e.stopPropagation();
                        handleConnectToTarget(node.id);
                      }
                    }}
                    onTouchEnd={(e) => {
                      if (isTargetCandidate) {
                        e.stopPropagation();
                        handleConnectToTarget(node.id);
                      }
                    }}
                    className="group/target absolute -left-4 top-14 -translate-y-1/2 w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-crosshair z-30 touch-none"
                    title={isTargetCandidate ? "🎯 לחץ כאן לחיבור כיעד" : "נקודת יעד כניסה"}
                  >
                    <div 
                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 ${
                        isTargetCandidate
                          ? 'w-5 h-5 bg-amber-400 border-2 border-amber-200 ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(245,158,11,0.6)] animate-pulse scale-125'
                          : 'bg-amber-500 border-2 border-slate-900 shadow group-hover/target:scale-110'
                      }`}
                    >
                      <span className={`text-[9px] leading-none ${isTargetCandidate ? 'opacity-100' : 'opacity-0 group-hover/target:opacity-100'} transition-opacity`}>
                        🎯
                      </span>
                    </div>

                    {/* Tooltip */}
                    <div className="pointer-events-none absolute left-full ml-2 px-2.5 py-1 bg-slate-900/95 text-amber-300 text-[11px] font-semibold rounded-lg border border-amber-500/40 shadow-xl opacity-0 group-hover/target:opacity-100 transition-all duration-200 whitespace-nowrap z-50 flex items-center gap-1">
                      <span>🎯</span>
                      <span>{isTargetCandidate ? "לחץ כאן לחיבור כיעד" : "נקודת יעד כניסה"}</span>
                    </div>
                  </div>

                  {/* Output Connection Handle on Right (Green, pulsing with hover emoji 🔌 and tooltip) */}
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartConnect(node.id);
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      handleStartConnect(node.id);
                      handleStartDragWire(node.id, undefined, e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      handleStartConnect(node.id);
                      if (e.touches[0]) {
                        handleStartDragWire(node.id, undefined, e.touches[0].clientX, e.touches[0].clientY);
                      }
                    }}
                    className="group/port absolute -right-4 top-14 -translate-y-1/2 w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-crosshair z-30 touch-none"
                    title="לחץ או גרור לחיבור ענף"
                  >
                    <div 
                      className={`w-4 h-4 rounded-full flex items-center justify-center transition-all duration-200 select-none ${
                        isNodeActive
                          ? 'w-5 h-5 bg-emerald-400 ring-4 ring-emerald-300 shadow-[0_0_20px_rgba(52,211,153,0.9)] scale-125'
                          : 'bg-emerald-500 ring-2 ring-emerald-400/60 shadow-[0_0_12px_rgba(52,211,153,0.5)] animate-pulse group-hover/port:scale-125 group-hover/port:ring-4 group-hover/port:ring-emerald-300'
                      }`}
                    >
                      <span className="text-[9px] leading-none opacity-0 group-hover/port:opacity-100 transition-opacity">
                        🔌
                      </span>
                    </div>

                    {/* Tooltip Popup */}
                    <div className="pointer-events-none absolute right-full mr-2 px-2.5 py-1 bg-slate-900/95 text-emerald-300 text-[11px] font-semibold rounded-lg border border-emerald-500/40 shadow-xl opacity-0 group-hover/port:opacity-100 transition-all duration-200 whitespace-nowrap z-50 flex items-center gap-1">
                      <span>🔌</span>
                      <span>לחץ או גרור לחיבור ענף</span>
                    </div>
                  </div>
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

            {/* Quick Test / Trigger Preview & Noa Action */}
            <div className="mt-auto pt-4 border-t border-slate-800 space-y-2">
              <button
                onClick={() => {
                  if (selectedBlockId && selectedBlock) {
                    setActiveMagicNodeId(selectedBlockId);
                    setNoaCommand({
                      targetNodeId: selectedBlockId,
                      actionType: 'update_node',
                      title: selectedBlock.title,
                      message: `נועה מרחפת לעדכן את: ${selectedBlock.title} ✨`
                    });
                  }
                }}
                className="w-full py-2 bg-gradient-to-r from-cyan-600 via-sky-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 active:scale-95 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition-all border border-cyan-400/40"
                title="שגר את נועה לרחף אל קלף זה ולהרעיף עליו קסם"
              >
                <Wand2 className="w-4 h-4 text-cyan-200 animate-pulse" />
                <span>הפעל את נועה לרחף לקלף זה 🪄</span>
              </button>

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
