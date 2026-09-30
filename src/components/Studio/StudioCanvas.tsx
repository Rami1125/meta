import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import { 
  Plus, 
  Save, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Smartphone, 
  Check, 
  Sparkles,
  Link,
  Workflow
} from 'lucide-react';
import { FlowTree, StudioNode, BlockType, StudioEdge, ListMenuData } from '../../types/studio';
import { NodeCard } from './NodeCard';
import { InspectorDrawer } from './InspectorDrawer';
import { AddBlockModal } from './AddBlockModal';

interface StudioCanvasProps {
  flow: FlowTree;
  onSaveFlow: (updatedFlow: FlowTree) => Promise<void>;
  onResetFlow: () => Promise<void>;
  onOpenSimulator: () => void;
}

export const StudioCanvas: React.FC<StudioCanvasProps> = ({
  flow,
  onSaveFlow,
  onResetFlow,
  onOpenSimulator
}) => {
  const [currentFlow, setCurrentFlow] = useState<FlowTree>(flow);
  const [selectedNode, setSelectedNode] = useState<StudioNode | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Pan and Zoom
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Node Dragging
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Connecting mode (clicking handle then clicking target)
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string; handleId?: string } | null>(null);

  // Touch & Pinch-to-zoom state for mobile / Samsung Note 23 Ultra
  const [initialPinchDist, setInitialPinchDist] = useState<number | null>(null);
  const [initialPinchScale, setInitialPinchScale] = useState<number>(1);
  const [lastTouchPos, setLastTouchPos] = useState<{ x: number; y: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentFlow(flow);
  }, [flow]);

  // Handle Pan canvas (Mouse)
  const handleMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.cursor-pointer')) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (draggingNodeId) {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const newX = Math.round((e.clientX - containerRect.left - pan.x) / scale - dragOffset.x);
      const newY = Math.round((e.clientY - containerRect.top - pan.y) / scale - dragOffset.y);

      setCurrentFlow(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n)
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Touch Handlers for Mobile: Pinch-to-Zoom, 2-Finger Drag, Double-Tap to Add
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers: Pinch to Zoom and 2-finger pan
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDist(dist);
      setInitialPinchScale(scale);
      setLastTouchPos({
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      });
      setIsPanning(false);
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const isCard = Boolean((e.target as HTMLElement).closest('.cursor-pointer'));

      // Double-tap on canvas (not on a card) to add block
      if (!isCard && now - lastTapTime < 320) {
        setIsAddModalOpen(true);
        setLastTapTime(0);
        return;
      }
      setLastTapTime(now);

      if (!isCard) {
        setIsPanning(true);
        setPanStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // 2-Finger gesture: Pinch to Zoom & Pan
    if (e.touches.length === 2 && initialPinchDist) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / initialPinchDist;
      const newScale = Math.min(Math.max(initialPinchScale * ratio, 0.4), 1.8);
      setScale(Number(newScale.toFixed(2)));

      // 2-finger pan
      const currentCenter = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
      if (lastTouchPos) {
        const dx = currentCenter.x - lastTouchPos.x;
        const dy = currentCenter.y - lastTouchPos.y;
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      }
      setLastTouchPos(currentCenter);
      return;
    }

    // 1-Finger canvas pan
    if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - panStart.x,
        y: touch.clientY - panStart.y,
      });
      return;
    }

    // 1-Finger node dragging on mobile
    if (e.touches.length === 1 && draggingNodeId) {
      const touch = e.touches[0];
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const newX = Math.round((touch.clientX - containerRect.left - pan.x) / scale - dragOffset.x);
      const newY = Math.round((touch.clientY - containerRect.top - pan.y) / scale - dragOffset.y);

      setCurrentFlow(prev => ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n)
      }));
    }
  };

  const handleTouchEnd = () => {
    setInitialPinchDist(null);
    setLastTouchPos(null);
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Node Selection
  const handleSelectNode = (node: StudioNode) => {
    // If in connecting mode, connect to this target node!
    if (connectingSource) {
      if (connectingSource.nodeId !== node.id) {
        completeConnection(node.id);
        return;
      }
    }
    setSelectedNode(node);
    setIsInspectorOpen(true);
  };

  // Start connecting from an output handle
  const handleStartConnect = (nodeId: string, handleId?: string) => {
    setConnectingSource({ nodeId, handleId });
  };

  const completeConnection = (targetNodeId: string) => {
    if (!connectingSource) return;

    const { nodeId, handleId } = connectingSource;

    setCurrentFlow(prev => {
      const newNodes: StudioNode[] = prev.nodes.map(n => {
        if (n.id === nodeId) {
          if (n.data.type === 'list_menu' && handleId) {
            const listData = n.data;
            return {
              ...n,
              data: {
                ...listData,
                type: 'list_menu' as const,
                rows: listData.rows.map(r => r.id === handleId ? { ...r, targetBlockId: targetNodeId } : r)
              }
            };
          } else {
            return {
              ...n,
              data: {
                ...n.data,
                targetBlockId: targetNodeId
              }
            };
          }
        }
        return n;
      });

      // Update edges array
      const edgeId = `edge_${nodeId}_${handleId || 'def'}_${targetNodeId}`;
      const filteredEdges = prev.edges.filter(e => !(e.source === nodeId && e.sourceHandle === handleId));
      const newEdges: StudioEdge[] = [
        ...filteredEdges,
        {
          id: edgeId,
          source: nodeId,
          sourceHandle: handleId,
          target: targetNodeId
        }
      ];

      return {
        ...prev,
        nodes: newNodes,
        edges: newEdges
      };
    });

    setConnectingSource(null);
  };

  // Node Deletion
  const handleDeleteNode = (id: string) => {
    if (id === currentFlow.rootBlockId) {
      alert('לא ניתן למחוק את בלוק השורש (Root Block)');
      return;
    }

    setCurrentFlow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.source !== id && e.target !== id)
    }));

    if (selectedNode?.id === id) {
      setIsInspectorOpen(false);
      setSelectedNode(null);
    }
  };

  // Node Update from Inspector
  const handleUpdateNode = (updatedNode: StudioNode) => {
    setCurrentFlow(prev => {
      const oldId = selectedNode?.id;
      const newId = updatedNode.id;

      let newNodes = prev.nodes.map(n => n.id === oldId ? updatedNode : n);
      let newEdges = prev.edges.map(e => {
        let s = e.source === oldId ? newId : e.source;
        let t = e.target === oldId ? newId : e.target;
        return { ...e, source: s, target: t };
      });

      return {
        ...prev,
        nodes: newNodes,
        edges: newEdges
      };
    });
    setSelectedNode(updatedNode);
  };

  // Add New Block
  const handleAddBlock = (type: BlockType) => {
    const id = `block_${type}_${Date.now().toString().slice(-4)}`;
    const posX = Math.round(500 - pan.x / scale);
    const posY = Math.round(250 - pan.y / scale);

    let initialData: any = { type };
    let initialTitle = 'בלוק חדש';

    switch (type) {
      case 'list_menu':
        initialTitle = 'תפריט משני סבן';
        initialData = {
          type: 'list_menu',
          header: 'ח. סבן - שירות נוסף',
          body: 'אנא בחר את הפריט המבוקש:',
          footer: 'ח. סבן חומרי בניין',
          buttonText: 'בחר אפשרות',
          sectionTitle: 'אפשרויות',
          rows: [
            { id: 'opt_1', title: 'אפשרות 1', description: 'תיאור שירות' },
            { id: 'opt_2', title: 'אפשרות 2', description: 'תיאור שירות' }
          ]
        };
        break;
      case 'text':
        initialTitle = 'הודעת מידע';
        initialData = {
          type: 'text',
          text: 'תודה שפנית לח. סבן! ההודעה נמסרה לנציג.',
        };
        break;
      case 'image':
        initialTitle = 'תמונת מחירון/סניף';
        initialData = {
          type: 'image',
          imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80',
          caption: 'מחסן סבן סניף החרש 10',
        };
        break;
      case 'ai_question':
        initialTitle = 'שאלת AI סבן';
        initialData = {
          type: 'ai_question',
          systemPrompt: 'ענה ללקוח אודות זמינות חומרי בניין, מחירי מלט ומשאיות מנוף.',
          contextInfo: 'ח. סבן חומרי בניין, שעות 06:30-17:00, סניפים החרש 10 והתלמיד 6.',
          fallbackText: 'נציג סבן יחזור אליך בהקדם.',
          model: 'gemini-3.8-flash'
        };
        break;
      case 'task':
        initialTitle = 'יצירת משימה';
        initialData = {
          type: 'task',
          taskTitleTemplate: 'פנייה מוואטסאפ - {{from}}',
          category: 'general',
          urgency: 'normal',
          assignedTo: 'צוות סבן',
          confirmationMessage: '✅ פנייתך נרשמה בהצלחה, ניצור קשר בהקדם!'
        };
        break;
      case 'webhook':
        initialTitle = 'JONI Firebase Webhook';
        initialData = {
          type: 'webhook',
          endpointUrl: 'https://saban-ai-drive-default-rtdb.europe-west1.firebasedatabase.app/joni/send.json',
          method: 'POST',
          bodyTemplate: '{"action": "custom_event", "from": "{{from}}"}'
        };
        break;
    }

    const newNode: StudioNode = {
      id,
      type,
      title: initialTitle,
      description: `נוצר בסטודיו סבן`,
      position: { x: posX, y: posY },
      data: initialData
    };

    setCurrentFlow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));

    setSelectedNode(newNode);
    setIsInspectorOpen(true);
  };

  // Save Flow
  const handleSave = async () => {
    setIsSaving(true);
    await onSaveFlow(currentFlow);
    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Collect All Visual Connections (from edges and node targetBlockIds)
  const renderConnections = () => {
    const connections: Array<{
      id: string;
      fromNode: StudioNode;
      toNode: StudioNode;
      label?: string;
    }> = [];

    currentFlow.nodes.forEach(node => {
      if (node.type === 'list_menu') {
        const rows = (node.data as ListMenuData).rows || [];
        rows.forEach(r => {
          if (r.targetBlockId) {
            const target = currentFlow.nodes.find(n => n.id === r.targetBlockId);
            if (target) {
              connections.push({
                id: `conn_${node.id}_${r.id}_${target.id}`,
                fromNode: node,
                toNode: target,
                label: r.title.slice(0, 14)
              });
            }
          }
        });
      } else {
        const targetId = node.data.targetBlockId;
        if (targetId) {
          const target = currentFlow.nodes.find(n => n.id === targetId);
          if (target) {
            connections.push({
              id: `conn_${node.id}_${target.id}`,
              fromNode: node,
              toNode: target
            });
          }
        }
      }
    });

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {connections.map(c => {
          // In RTL layout:
          // NodeCard width is 320px (w-80)
          // Source card starts at c.fromNode.position.x, outputs from left or center
          // Target card starts at c.toNode.position.x, inputs on right handle
          const startX = c.fromNode.position.x;
          const startY = c.fromNode.position.y + 120;
          const endX = c.toNode.position.x + 320;
          const endY = c.toNode.position.y + 100;

          // Smooth Bezier Curve
          const dx = Math.abs(endX - startX) * 0.5;
          const pathD = `M ${startX} ${startY} C ${startX - dx} ${startY}, ${endX + dx} ${endY}, ${endX} ${endY}`;

          return (
            <g key={c.id}>
              {/* Outer Glow */}
              <path
                d={pathD}
                fill="none"
                stroke="#f97316"
                strokeWidth="4"
                strokeOpacity="0.2"
                filter="url(#glow)"
              />
              {/* Core Line */}
              <path
                d={pathD}
                fill="none"
                stroke="url(#lineGrad)"
                strokeWidth="2.5"
                strokeDasharray="6 3"
                className="animate-[dash_20s_linear_infinite]"
              />
              {/* Direction Indicator Bubble in Middle */}
              <circle
                cx={(startX + endX) / 2}
                cy={(startY + endY) / 2}
                r="4.5"
                fill="#10b981"
                className="shadow-sm"
              />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="relative flex-1 h-full flex flex-col bg-slate-950 overflow-hidden select-none pb-16 md:pb-0">
      
      {/* Top Floating Control Bar */}
      <div className="absolute top-2.5 md:top-4 right-2.5 left-2.5 md:right-4 md:left-4 z-20 flex flex-col md:flex-row md:items-center justify-between gap-2 pointer-events-none">
        
        {/* Left: Flow Name and Status */}
        <div className="bg-slate-900/95 backdrop-blur-md px-3 py-1.5 md:px-4 md:py-2 rounded-2xl border border-slate-700/80 shadow-lg flex items-center justify-between md:justify-start gap-2.5 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <Workflow className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-xs flex items-center gap-1.5">
                <span className="truncate max-w-[140px] md:max-w-none">{currentFlow.name}</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full font-mono">
                  {currentFlow.nodes.length}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 hidden sm:block">
                מספר: <span className="text-emerald-400 font-mono">+972 50-8860896</span>
              </div>
            </div>
          </div>

          {/* Quick Double-Tap Badge Tip for Mobile */}
          <div className="md:hidden text-[10px] text-orange-300/80 bg-orange-950/40 px-2 py-0.5 rounded-lg border border-orange-800/40 flex items-center gap-1">
            <span>לחיצה כפולה להוספה ✨</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto py-1">
          {connectingSource && (
            <div className="flex items-center gap-1.5 bg-orange-600 text-white px-2.5 py-1.5 rounded-xl text-xs shadow-lg animate-pulse min-h-[44px]">
              <Link className="w-3.5 h-3.5" />
              <span className="text-[11px]">בחר בלוק יעד...</span>
              <button
                onClick={() => setConnectingSource(null)}
                className="bg-black/30 hover:bg-black/50 px-2 py-1 rounded text-[10px]"
              >
                בטל
              </button>
            </div>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1 px-3 py-2 min-h-[44px] bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-orange-600/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>בלוק</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-1 px-3 py-2 min-h-[44px] rounded-xl text-xs font-semibold shadow-md active:scale-95 transition-all ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {saveSuccess ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Save className="w-4 h-4 text-orange-400" />}
            <span>{isSaving ? 'שומר' : saveSuccess ? 'נשמר!' : 'שמור'}</span>
          </button>

          <button
            onClick={onResetFlow}
            title="איפוס לעץ ברירת המחדל של סבן"
            className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center bg-slate-900/90 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-800 shadow-md active:scale-95 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1 px-3 py-2 min-h-[44px] bg-[#25D366] hover:bg-[#20ba5a] text-slate-950 rounded-xl text-xs font-bold shadow-md shadow-emerald-700/20 active:scale-95 transition-all"
          >
            <Smartphone className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden sm:inline">סימולטור WhatsApp</span>
            <span className="sm:hidden">בדיקה</span>
          </button>
        </div>
      </div>

      {/* Zoom / Viewport Controls Bottom Left */}
      <div className="absolute bottom-20 md:bottom-6 left-3 md:left-6 z-20 flex items-center gap-1 bg-slate-900/95 backdrop-blur-md p-1 rounded-2xl border border-slate-800 shadow-xl text-slate-300">
        <button
          onClick={() => setScale(s => Math.min(s + 0.15, 1.8))}
          className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
          title="זום פנימה"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-mono px-1 text-slate-400">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(s => Math.max(s - 0.15, 0.4))}
          className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
          title="זום החוצה"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setScale(1); setPan({ x: 20, y: 40 }); }}
          className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-slate-800 rounded-xl transition-colors active:scale-95"
          title="איפוס מיקום"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Graph Canvas */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full h-full relative cursor-grab active:cursor-grabbing overflow-hidden touch-none"
        style={{
          backgroundImage: `
            radial-gradient(circle at 1px 1px, #334155 1px, transparent 0),
            radial-gradient(circle at 1px 1px, #1e293b 1px, transparent 0)
          `,
          backgroundSize: '28px 28px',
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: '3200px',
            height: '2400px',
            position: 'absolute'
          }}
        >
          {/* SVG Connector Lines */}
          {renderConnections()}

          {/* Render Nodes */}
          {currentFlow.nodes.map(node => (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${node.position.x}px`,
                top: `${node.position.y}px`,
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDraggingNodeId(node.id);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  setDragOffset({
                    x: Math.round((e.clientX - rect.left - pan.x) / scale - node.position.x),
                    y: Math.round((e.clientY - rect.top - pan.y) / scale - node.position.y)
                  });
                }
              }}
              onTouchStart={(e) => {
                if (e.touches.length === 1) {
                  e.stopPropagation();
                  setDraggingNodeId(node.id);
                  const touch = e.touches[0];
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    setDragOffset({
                      x: Math.round((touch.clientX - rect.left - pan.x) / scale - node.position.x),
                      y: Math.round((touch.clientY - rect.top - pan.y) / scale - node.position.y)
                    });
                  }
                }
              }}
            >
              <NodeCard
                node={node}
                isSelected={selectedNode?.id === node.id}
                onSelect={handleSelectNode}
                onDelete={handleDeleteNode}
                onStartConnect={handleStartConnect}
                connectingSource={connectingSource}
                onSelectTarget={completeConnection}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Inspector Drawer for Editing Nodes */}
      <InspectorDrawer
        node={selectedNode}
        flow={currentFlow}
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        onUpdateNode={handleUpdateNode}
      />

      {/* Add Block Modal */}
      <AddBlockModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddBlock={handleAddBlock}
      />
    </div>
  );
};
