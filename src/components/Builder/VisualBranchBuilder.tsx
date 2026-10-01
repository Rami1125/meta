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
  Wand2,
  ListTree,
  Layers,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowRight,
  CornerDownLeft
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
      title: '📦 בחירת סוג פעולה למכולה',
      text: 'אנא בחר את סוג המבוקש:\n\n⚠️ דגש : נדרשת גישה פנויה ורחבה למשאית רמסע לצורך הנפה ופריקה.',
      options: [
        '📦 הצבה ',
        '📦 החלפה ',
        '📦 הוצאה '
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
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [builderMode, setBuilderMode] = useState<'canvas' | 'outline'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return 'outline';
    }
    return 'outline';
  });
  const [mobileExpandedNodeId, setMobileExpandedNodeId] = useState<string | null>('node_welcome');
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Helper: add a child branch linked directly to a parent option
  const handleAddChildBranch = (parentNodeId: string, optionIndex?: number) => {
    const parentNode = flow.nodes.find(n => n.id === parentNodeId);
    const newId = `node_${Date.now()}`;
    const newBlock: VisualBlock = {
      id: newId,
      type: 'message',
      title: `ענף המשך: ${parentNode?.title || 'סבן'}`,
      text: 'שלום! נשמח לתאם עבורך אספקה או מענה ישיר. ראמי מסארווה (050-886-0896) לשירותך 🏗️',
      position: {
        x: (parentNode?.position.x || 120) + 360,
        y: (parentNode?.position.y || 120) + 120
      }
    };

    const newConn: VisualConnection = {
      id: `c_${Date.now()}`,
      fromNodeId: parentNodeId,
      fromOptionIndex: optionIndex,
      toNodeId: newId
    };

    setFlow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newBlock],
      connections: [...prev.connections, newConn]
    }));
    setSelectedBlockId(newId);
    setMobileExpandedNodeId(newId);
  };

  // Helper: change connection target for a specific option
  const handleChangeConnection = (fromNodeId: string, optionIndex: number | undefined, toNodeId: string) => {
    setFlow(prev => {
      const filtered = prev.connections.filter(
        c => !(c.fromNodeId === fromNodeId && c.fromOptionIndex === optionIndex)
      );
      if (!toNodeId) {
        return { ...prev, connections: filtered };
      }
      return {
        ...prev,
        connections: [
          ...filtered,
          {
            id: `c_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            fromNodeId,
            fromOptionIndex: optionIndex,
            toNodeId
          }
        ]
      };
    });
  };

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
    setSaveMessage(null);
    try {
      const res = await api.saveChatFlow(flow);
      if (res && res.success) {
        setSaveSuccess(true);
        setSaveMessage('✅ עץ הענפים נשמר בהצלחה ב-Firebase RTDB ובשרת!');
        if (onSave) onSave();
        setTimeout(() => {
          setSaveSuccess(false);
          setSaveMessage(null);
        }, 4000);
      } else {
        setSaveMessage(`⚠️ שגיאה בשמירה: ${res?.message || 'אנא נסה שוב'}`);
        setTimeout(() => setSaveMessage(null), 5000);
      }
    } catch (e: any) {
      console.error('Failed to save visual flow:', e);
      setSaveMessage(`❌ שגיאה בשמירה: ${e.message || 'תקלת רשת'}`);
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
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
      <div className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-slate-950 font-bold shadow">
            <GitFork className="w-5 h-5 text-slate-950 stroke-[2.4]" />
          </div>
          <div>
            <h2 className="font-bold text-xs sm:text-sm text-slate-100 flex items-center gap-1.5">
              <span>בונה ענפים סבן</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                {builderMode === 'outline' ? 'מובייל Note 23' : 'Figma-Canvas'}
              </span>
            </h2>
            <p className="text-[10px] sm:text-[11px] text-slate-400 hidden xs:block">
              {builderMode === 'outline' ? 'ניהול ענפים ותפריטים מותאם ל-S-Pen ואגודל' : 'חבר ענפים, ערוך טקסטים בעברית ושמור'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 text-xs shadow-inner">
            <button
              onClick={() => setBuilderMode('outline')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                builderMode === 'outline'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="תצוגת ענפים מותאמת לסמסונג נוט ומובייל"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>ענפי מובייל</span>
            </button>
            <button
              onClick={() => setBuilderMode('canvas')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
                builderMode === 'canvas'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="תצוגת קנבס ויזואלי"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">קנבס ויזואלי</span>
            </button>
          </div>

          {/* Simulator Button */}
          {onOpenSimulator && (
            <button
              onClick={onOpenSimulator}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 active:scale-95 text-emerald-200 text-xs font-semibold rounded-xl border border-emerald-600/60 transition-all shadow-sm cursor-pointer"
              title="פתח סימולטור WhatsApp חי לבדיקת התפריט העדכני"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span>סימולטור חי</span>
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-orange-600/20 cursor-pointer"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">נשמר!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'שומר...' : 'שמור'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Floating Save Status Toast */}
      {saveMessage && (
        <div className={`fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 border animate-in fade-in slide-in-from-top-3 backdrop-blur-md ${
          saveSuccess 
            ? 'bg-emerald-950/95 text-emerald-200 border-emerald-500/50 shadow-emerald-500/20' 
            : 'bg-rose-950/95 text-rose-200 border-rose-500/50 shadow-rose-500/20'
        }`}>
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Main Workspace: Mobile Tree Outline View vs Desktop Figma Canvas */}
      {builderMode === 'outline' ? (
        <div className="flex-1 overflow-y-auto bg-slate-950 p-3 sm:p-5 pb-36 space-y-4 max-w-3xl mx-auto w-full">
          {/* Samsung Note 23 / Ultra Experience Banner */}
          <div className="p-3.5 bg-gradient-to-r from-slate-900 via-slate-900/90 to-amber-950/30 rounded-2xl border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-bold text-xs sm:text-sm text-white">חבילת עיצוב מובייל סמסונג נוט 23 / S23 Ultra</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                יחס מסך 20:9 · אזור אגודל תחתון (Thumb Zone) · תמיכה ב-S-Pen · ניגודיות שמש מלאה לאתרי בנייה
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20 font-bold">
                {flow.nodes.length} ענפים
              </span>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-lg border border-cyan-500/20 font-bold">
                {flow.connections.length} חיבורים
              </span>
            </div>
          </div>

          {/* Quick Search & Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="חיפוש ענף, מילה או אפשרות (למשל: מלט, מכולה, איסוף)..."
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-8 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              {mobileSearchQuery && (
                <button
                  onClick={() => setMobileSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                const welcomeTmpl = BLOCK_TEMPLATES.find(t => t.type === 'menu') || BLOCK_TEMPLATES[0];
                handleAddBlock(welcomeTmpl);
              }}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 active:scale-95 transition-all cursor-pointer min-h-[42px]"
            >
              <Plus className="w-4 h-4" />
              <span>הוסף ענף</span>
            </button>
          </div>

          {/* Noa AI Quick Creation Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-cyan-400 font-bold text-[11px] shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>נועה AI:</span>
            </span>
            <button
              onClick={() => handleNoaQuickAction('הוסף ענף מחירון חומרי בניין')}
              className="px-2.5 py-1 bg-slate-900 hover:bg-cyan-950/80 text-[11px] text-slate-300 hover:text-cyan-300 border border-slate-800 rounded-xl shrink-0 transition-all active:scale-95 cursor-pointer"
            >
              + מחירון קבלנים
            </button>
            <button
              onClick={() => handleNoaQuickAction('הוסף ענף מכולות פסולת 8 קוב')}
              className="px-2.5 py-1 bg-slate-900 hover:bg-cyan-950/80 text-[11px] text-slate-300 hover:text-cyan-300 border border-slate-800 rounded-xl shrink-0 transition-all active:scale-95 cursor-pointer"
            >
              + מכולה 8 קוב
            </button>
            <button
              onClick={() => handleNoaQuickAction('הוסף ענף שעות פתיחה כפר ברא')}
              className="px-2.5 py-1 bg-slate-900 hover:bg-cyan-950/80 text-[11px] text-slate-300 hover:text-cyan-300 border border-slate-800 rounded-xl shrink-0 transition-all active:scale-95 cursor-pointer"
            >
              + שעות פתיחה
            </button>
          </div>

          {/* Branch Cards List */}
          <div className="space-y-3">
            {flow.nodes
              .filter(n => {
                if (!mobileSearchQuery.trim()) return true;
                const q = mobileSearchQuery.toLowerCase();
                return (
                  n.title.toLowerCase().includes(q) ||
                  n.text.toLowerCase().includes(q) ||
                  (n.options && n.options.some(opt => opt.toLowerCase().includes(q)))
                );
              })
              .map((node) => {
                const tmpl = BLOCK_TEMPLATES.find(t => t.type === node.type) || BLOCK_TEMPLATES[0];
                const Icon = tmpl.icon;
                const isExpanded = mobileExpandedNodeId === node.id;
                const isRoot = node.id === 'node_welcome';

                return (
                  <div
                    key={node.id}
                    className={`bg-slate-900/90 border rounded-2xl overflow-hidden transition-all shadow-md ${
                      isExpanded 
                        ? 'border-amber-500/80 ring-1 ring-amber-500/20 shadow-amber-500/10' 
                        : 'border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      onClick={() => setMobileExpandedNodeId(isExpanded ? null : node.id)}
                      className="p-3.5 flex items-center justify-between cursor-pointer select-none min-h-[52px]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${tmpl.color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-white truncate">
                              {node.title}
                            </span>
                            {isRoot && (
                              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-bold shrink-0">
                                ענף ראשי 🌟
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate max-w-[240px] sm:max-w-md mt-0.5">
                            {node.text.split('\n')[0]}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 mr-2">
                        {node.options && node.options.length > 0 && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700 font-mono">
                            {node.options.length} אפשרויות
                          </span>
                        )}
                        <button
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title={isExpanded ? 'כווץ' : 'הרחב'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Card Expanded Content */}
                    {isExpanded && (
                      <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/60 space-y-3.5 text-xs">
                        {/* Title edit */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            שם הענף (זיהוי פנימי):
                          </label>
                          <input
                            type="text"
                            value={node.title}
                            onChange={(e) => {
                              const newTitle = e.target.value;
                              setFlow(prev => ({
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === node.id ? { ...n, title: newTitle } : n)
                              }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* Text edit */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            תוכן ההודעה שתישלח ללקוח בוואטסאפ:
                          </label>
                          <textarea
                            rows={3}
                            value={node.text}
                            onChange={(e) => {
                              const newText = e.target.value;
                              setFlow(prev => ({
                                ...prev,
                                nodes: prev.nodes.map(n => n.id === node.id ? { ...n, text: newText } : n)
                              }));
                            }}
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 font-['Assistant',sans-serif] leading-relaxed"
                            placeholder="כתוב הודעת וואטסאפ בעברית..."
                          />
                        </div>

                        {/* Options & branching connections */}
                        {node.options && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                                <ListOrdered className="w-3.5 h-3.5" />
                                <span>אפשרויות בתפריט (הלקוח יבחר במספר או בטקסט):</span>
                              </label>
                              <button
                                onClick={() => {
                                  const newOpts = [...(node.options || []), `אפשרות ${(node.options?.length || 0) + 1}`];
                                  setFlow(prev => ({
                                    ...prev,
                                    nodes: prev.nodes.map(n => n.id === node.id ? { ...n, options: newOpts } : n)
                                  }));
                                }}
                                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>הוסף אפשרות</span>
                              </button>
                            </div>

                            <div className="space-y-2">
                              {node.options.map((opt, optIdx) => {
                                const conn = flow.connections.find(
                                  c => c.fromNodeId === node.id && c.fromOptionIndex === optIdx
                                );
                                const targetNode = conn ? flow.nodes.find(n => n.id === conn.toNodeId) : null;

                                return (
                                  <div key={optIdx} className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-md bg-slate-800 text-amber-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                                        {optIdx + 1}
                                      </span>
                                      <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => {
                                          const newOpts = [...(node.options || [])];
                                          newOpts[optIdx] = e.target.value;
                                          setFlow(prev => ({
                                            ...prev,
                                            nodes: prev.nodes.map(n => n.id === node.id ? { ...n, options: newOpts } : n)
                                          }));
                                        }}
                                        className="flex-1 bg-slate-950 border border-slate-700/70 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                                      />
                                      <button
                                        onClick={() => {
                                          const newOpts = (node.options || []).filter((_, idx) => idx !== optIdx);
                                          setFlow(prev => ({
                                            ...prev,
                                            nodes: prev.nodes.map(n => n.id === node.id ? { ...n, options: newOpts } : n),
                                            connections: prev.connections.filter(c => !(c.fromNodeId === node.id && c.fromOptionIndex === optIdx))
                                          }));
                                        }}
                                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                                        title="הסר אפשרות"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Branch Target selector */}
                                    <div className="flex items-center gap-2 text-[11px] bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
                                      <CornerDownLeft className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      <span className="text-slate-400 shrink-0">מנווט אל:</span>
                                      <select
                                        value={targetNode ? targetNode.id : ''}
                                        onChange={(e) => handleChangeConnection(node.id, optIdx, e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-emerald-300 font-semibold focus:outline-none"
                                      >
                                        <option value="">-- בחר ענף יעד --</option>
                                        {flow.nodes
                                          .filter(n => n.id !== node.id)
                                          .map(n => (
                                            <option key={n.id} value={n.id}>
                                              {n.title} ({n.type})
                                            </option>
                                          ))}
                                      </select>

                                      <button
                                        onClick={() => handleAddChildBranch(node.id, optIdx)}
                                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] rounded-md border border-amber-500/40 shrink-0 active:scale-95 cursor-pointer"
                                        title="צור ענף חדש עבור אפשרות זו"
                                      >
                                        + ענף חדש
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Bottom card action buttons */}
                        <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAddChildBranch(node.id)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold rounded-xl text-[11px] flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                            >
                              <Plus className="w-3.5 h-3.5 text-emerald-400" />
                              <span>הוסף ענף המשך תחתיו</span>
                            </button>

                            <button
                              onClick={() => {
                                setSelectedBlockId(node.id);
                                setIsPreviewOpen(true);
                              }}
                              className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-600/40 font-semibold rounded-xl text-[11px] flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-400" />
                              <span>בדוק ב-WhatsApp</span>
                            </button>
                          </div>

                          {!isRoot && (
                            <button
                              onClick={() => handleDeleteBlock(node.id)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                              title="מחק ענף"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Floating Thumb Zone Action Sheet (Fixed at bottom for Samsung Note 23 / Ultra 20:9 screens) */}
          <div className="fixed bottom-4 inset-x-4 max-w-lg mx-auto z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-2.5 shadow-2xl flex items-center justify-between gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer min-h-[48px]"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>נשמר בהצלחה ב-Firebase!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'שומר ענפים...' : 'שמור שינויים (/chat_flows/main)'}</span>
                </>
              )}
            </button>

            {onOpenSimulator && (
              <button
                onClick={onOpenSimulator}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-300 font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 shadow transition-all cursor-pointer min-h-[48px]"
                title="סימולטור WhatsApp חי"
              >
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>סימולטור חי</span>
              </button>
            )}

            <button
              onClick={() => {
                const menuTmpl = BLOCK_TEMPLATES.find(t => t.type === 'menu') || BLOCK_TEMPLATES[0];
                handleAddBlock(menuTmpl);
              }}
              className="px-3.5 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shadow-md shadow-amber-500/20 transition-all cursor-pointer min-h-[48px]"
              title="הוסף ענף תפריט חדש"
            >
              <Plus className="w-4 h-4" />
              <span>ענף חדש</span>
            </button>
          </div>
        </div>
      ) : (
        /* Main Workspace: Figma Canvas */
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
      )}

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
