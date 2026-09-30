import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Wand2, 
  X, 
  Volume2, 
  VolumeX, 
  MessageCircle, 
  Plus, 
  Zap, 
  Bot,
  Heart
} from 'lucide-react';
import { audioService } from '../../services/audioService';

export interface NoaFlightCommand {
  id?: string;
  targetNodeId: string;
  actionType: 'create_node' | 'update_node';
  targetPos?: { x: number; y: number };
  title?: string;
  message?: string;
}

export interface NoaCanvasCompanionProps {
  command: NoaFlightCommand | null;
  onCommandComplete?: (cmd: NoaFlightCommand) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  zoom?: number;
  getNodePosition?: (nodeId: string) => { x: number; y: number; width?: number; height?: number } | null;
  onQuickAction?: (prompt: string) => void;
}

type NoaState = 'idle' | 'flying' | 'casting' | 'returning';
type Expression = 'happy' | 'blink' | 'wink' | 'talking' | 'magic';

export const NoaCanvasCompanion: React.FC<NoaCanvasCompanionProps> = ({
  command,
  onCommandComplete,
  canvasRef,
  zoom = 1,
  getNodePosition,
  onQuickAction
}) => {
  const [noaState, setNoaState] = useState<NoaState>('idle');
  const [expression, setExpression] = useState<Expression>('happy');
  const [speechText, setSpeechText] = useState<string>('היי! אני נועה ✨ עוזרת ה-AI של ח. סבן');
  const [isDialogueOpen, setIsDialogueOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(audioService.isMuted);
  const [showMagicBurst, setShowMagicBurst] = useState(false);

  // Position relative to the canvas container (viewport)
  // Default resting idle dock position (top-right of canvas workspace)
  const defaultIdlePos = { x: 38, y: 76 };
  const [currentPos, setCurrentPos] = useState(defaultIdlePos);
  const [flightTargetPos, setFlightTargetPos] = useState<{ x: number; y: number } | null>(null);

  // Natural blinking and winking loop when idle
  useEffect(() => {
    if (noaState !== 'idle') return;

    const blinkInterval = setInterval(() => {
      const rand = Math.random();
      if (rand > 0.6) {
        setExpression('wink');
        setTimeout(() => setExpression('happy'), 500);
      } else {
        setExpression('blink');
        setTimeout(() => setExpression('happy'), 260);
      }
    }, 4200);

    return () => clearInterval(blinkInterval);
  }, [noaState]);

  // Execute Flight Command (Fly-to-Target Engine)
  const executeFlight = useCallback((cmd: NoaFlightCommand) => {
    let targetX = 300;
    let targetY = 200;

    // 1. Calculate target screen coordinates based on actual DOM card rect or canvas offsets
    const cardEl = document.getElementById(`node-card-${cmd.targetNodeId}`);
    if (cardEl && canvasRef.current) {
      try {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } catch {}

      const cardRect = cardEl.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      targetX = cardRect.left - canvasRect.left + (cardRect.width / 2) - 40;
      targetY = cardRect.top - canvasRect.top - 70;
    } else if (getNodePosition) {
      const nodePos = getNodePosition(cmd.targetNodeId);
      if (nodePos && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const scrollLeft = canvasRef.current.scrollLeft;
        const scrollTop = canvasRef.current.scrollTop;

        // Position Noa hovering right above the node card
        const cardWidth = (nodePos.width || 256) * zoom;
        targetX = (nodePos.x * zoom) - scrollLeft + (cardWidth / 2) - 40;
        targetY = (nodePos.y * zoom) - scrollTop - 75;

        // Clamp inside canvas bounds
        targetX = Math.max(20, Math.min(canvasRect.width - 90, targetX));
        targetY = Math.max(20, Math.min(canvasRect.height - 90, targetY));
      }
    } else if (cmd.targetPos) {
      targetX = cmd.targetPos.x;
      targetY = cmd.targetPos.y - 70;
    }

    // Step A: Launch flight
    setFlightTargetPos({ x: targetX, y: targetY });
    setNoaState('flying');
    setExpression('magic');
    setSpeechText(cmd.message || (cmd.actionType === 'create_node' ? 'יוצרת בלוק חדש... 🪄' : 'מעדכנת בלוק... ✨'));
    audioService.playFlySwoop();

    // Step B: Arrive at target & Cast Magic Sparkle
    setTimeout(() => {
      setNoaState('casting');
      setExpression('happy');
      setShowMagicBurst(true);
      audioService.playMagicChime();

      if (cmd.actionType === 'create_node') {
        setSpeechText(`בלוק נוצר בהצלחה! ✨`);
      } else {
        setSpeechText(`עודכן בהצלחה! 🪄`);
      }

      // Step C: Complete casting, trigger callback, and return to dock
      setTimeout(() => {
        setShowMagicBurst(false);
        setNoaState('returning');
        setExpression('happy');

        if (onCommandComplete) {
          onCommandComplete(cmd);
        }

        // Return to resting idle position
        setTimeout(() => {
          setNoaState('idle');
          setFlightTargetPos(null);
          setSpeechText('מוכנה לפקודה הבאה ✨');
        }, 850);

      }, 1000);

    }, 750);

  }, [canvasRef, getNodePosition, onCommandComplete, zoom]);

  // Trigger flight whenever a new command is passed
  useEffect(() => {
    if (command && command.targetNodeId) {
      executeFlight(command);
    }
  }, [command, executeFlight]);

  const handleNoaClick = () => {
    if (noaState === 'flying' || noaState === 'casting') return;
    audioService.playPop();
    setExpression('wink');
    setTimeout(() => setExpression('happy'), 600);
    setIsDialogueOpen(prev => !prev);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = audioService.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      audioService.playPop();
    }
  };

  // Determine current X/Y based on state
  const activeX = (noaState === 'flying' || noaState === 'casting') && flightTargetPos ? flightTargetPos.x : defaultIdlePos.x;
  const activeY = (noaState === 'flying' || noaState === 'casting') && flightTargetPos ? flightTargetPos.y : defaultIdlePos.y;

  return (
    <div 
      className={`absolute inset-0 pointer-events-none z-30 select-none overflow-hidden font-['Assistant',sans-serif]`}
      dir="rtl"
    >
      {/* Flight Motion Container */}
      <motion.div
        className={`absolute ${noaState === 'idle' ? 'pointer-events-auto' : 'pointer-events-none'}`}
        initial={false}
        animate={{
          x: activeX,
          y: activeY,
          rotate: noaState === 'flying' ? 12 : noaState === 'casting' ? [0, 18, -18, 0] : 0,
          scale: noaState === 'casting' ? 1.25 : 1
        }}
        transition={{
          type: 'spring',
          stiffness: noaState === 'flying' ? 110 : 80,
          damping: noaState === 'flying' ? 14 : 16,
          mass: 0.9
        }}
      >
        {/* Floating Idle Bobbing Animation (Layered Inside Spring) */}
        <motion.div
          animate={noaState === 'idle' ? {
            y: [0, -10, 0],
            rotate: [-2, 2, -2]
          } : {}}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className="relative group cursor-pointer"
          onClick={handleNoaClick}
        >
          {/* Magic Pulsing Ring during casting */}
          {showMagicBurst && (
            <>
              <div className="absolute -inset-4 rounded-full bg-cyan-400/40 animate-ping ring-4 ring-cyan-400 blur-sm pointer-events-none" />
              <div className="absolute -inset-8 rounded-full bg-purple-500/30 animate-pulse ring-2 ring-purple-400/60 pointer-events-none" />
              
              {/* Flying Magic Sparkle Stars */}
              <div className="absolute -top-6 -right-4 text-amber-300 text-lg animate-bounce">✦</div>
              <div className="absolute -bottom-4 -left-3 text-cyan-300 text-base animate-pulse">✨</div>
              <div className="absolute top-0 -left-6 text-purple-300 text-sm animate-ping">★</div>
            </>
          )}

          {/* Glowing Aura Drop Shadow */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-cyan-500/40 to-purple-600/40 blur-md opacity-80 group-hover:opacity-100 transition-opacity" />

          {/* SVG Character Model (Fluorescent Glass Cloud / Bubble Maia Style) */}
          <div className="relative w-20 h-20 rounded-full flex items-center justify-center filter drop-shadow-[0_0_18px_rgba(34,211,238,0.7)] transition-transform group-hover:scale-110 active:scale-95">
            <svg
              viewBox="0 0 100 100"
              className="w-full h-full overflow-visible"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Body Neon Gradient: Cyan to Purple */}
                <linearGradient id="noaBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="45%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>

                {/* Glass Highlight Arc Gradient */}
                <linearGradient id="noaGlassGloss" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                </linearGradient>

                {/* Cheeks Glow */}
                <radialGradient id="cheekGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#f472b6" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f472b6" stopOpacity="0.0" />
                </radialGradient>
              </defs>

              {/* Fluffy Cloud / Bubble Soft Body Outline */}
              <g className="transition-all duration-300">
                {/* Cloud Puffs */}
                <circle cx="50" cy="50" r="38" fill="url(#noaBodyGrad)" />
                <circle cx="28" cy="52" r="18" fill="url(#noaBodyGrad)" />
                <circle cx="72" cy="52" r="18" fill="url(#noaBodyGrad)" />
                <circle cx="36" cy="34" r="19" fill="url(#noaBodyGrad)" />
                <circle cx="64" cy="34" r="19" fill="url(#noaBodyGrad)" />
                <ellipse cx="50" cy="62" rx="34" ry="16" fill="url(#noaBodyGrad)" />

                {/* Glass Dome Inner Glow */}
                <ellipse cx="50" cy="48" rx="32" ry="28" fill="#ffffff" fillOpacity="0.12" />

                {/* Top Glass Gloss Reflection Arc */}
                <path
                  d="M 32 32 Q 50 20 68 32 Q 50 28 32 32 Z"
                  fill="url(#noaGlassGloss)"
                />
              </g>

              {/* Kawaii Face Expressions */}
              <g className="face select-none">
                {/* Glowing Cheeks */}
                <circle cx="30" cy="54" r="6.5" fill="url(#cheekGlow)" />
                <circle cx="70" cy="54" r="6.5" fill="url(#cheekGlow)" />

                {/* EYES */}
                {expression === 'happy' && (
                  <>
                    {/* Left Eye */}
                    <circle cx="38" cy="46" r="5" fill="#0f172a" />
                    <circle cx="36.5" cy="44.5" r="2" fill="#ffffff" />
                    <circle cx="40" cy="48" r="1" fill="#ffffff" />

                    {/* Right Eye */}
                    <circle cx="62" cy="46" r="5" fill="#0f172a" />
                    <circle cx="60.5" cy="44.5" r="2" fill="#ffffff" />
                    <circle cx="64" cy="48" r="1" fill="#ffffff" />
                  </>
                )}

                {expression === 'blink' && (
                  <>
                    {/* Left Eye Closed Arc */}
                    <path d="M 33 47 Q 38 41 43 47" stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                    {/* Right Eye Closed Arc */}
                    <path d="M 57 47 Q 62 41 67 47" stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                  </>
                )}

                {expression === 'wink' && (
                  <>
                    {/* Left Eye Closed Arc */}
                    <path d="M 33 47 Q 38 42 43 47" stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                    {/* Right Eye Big Open Star Highlight */}
                    <circle cx="62" cy="46" r="5.2" fill="#0f172a" />
                    <circle cx="60" cy="44" r="2.2" fill="#ffffff" />
                    <text x="70" y="40" fontSize="10" fill="#fef08a" fontWeight="bold">✦</text>
                  </>
                )}

                {expression === 'magic' && (
                  <>
                    {/* Starry Eyes */}
                    <circle cx="38" cy="46" r="5.2" fill="#0f172a" />
                    <circle cx="62" cy="46" r="5.2" fill="#0f172a" />
                    <path d="M 38 41 L 39.5 45 L 43 46 L 39.5 47 L 38 51 L 36.5 47 L 33 46 L 36.5 45 Z" fill="#fef08a" />
                    <path d="M 62 41 L 63.5 45 L 67 46 L 63.5 47 L 62 51 L 60.5 47 L 57 46 L 60.5 45 Z" fill="#fef08a" />
                  </>
                )}

                {expression === 'talking' && (
                  <>
                    <circle cx="38" cy="45" r="4.5" fill="#0f172a" />
                    <circle cx="62" cy="45" r="4.5" fill="#0f172a" />
                  </>
                )}

                {/* MOUTH */}
                {noaState === 'casting' || expression === 'magic' ? (
                  // Open excited mouth 'O'
                  <ellipse cx="50" cy="56" rx="4.5" ry="5.5" fill="#0f172a" />
                ) : (
                  // Sweet happy smile curve
                  <path
                    d="M 44 54 Q 50 61 56 54"
                    stroke="#0f172a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                )}
              </g>

              {/* Tiny Magic Sparkles Orbiting Around Noa */}
              <circle cx="82" cy="24" r="2.2" fill="#fef08a" className="animate-pulse" />
              <circle cx="16" cy="38" r="1.8" fill="#e0e7ff" className="animate-ping" />
              <circle cx="78" cy="74" r="2.5" fill="#67e8f9" className="animate-pulse" />
            </svg>

            {/* Status Pill Badge */}
            <div className="absolute -bottom-2 bg-slate-900/90 border border-cyan-400/60 shadow-lg text-[10px] text-cyan-200 font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>נועה AI</span>
            </div>
          </div>

          {/* Floating Speech Cloud Pill (Visible when Noa speaks or idle tip) */}
          <AnimatePresence>
            {(speechText || noaState === 'casting') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 5 }}
                className="absolute top-1/2 -translate-y-1/2 right-full mr-3 w-max max-w-[200px] bg-slate-900/95 border border-cyan-500/40 text-cyan-100 text-xs font-semibold px-3 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 pointer-events-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0 animate-spin" />
                <span className="leading-snug">{speechText}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Interactive Dialogue & Quick Action Drawer (Opens on clicking Noa) */}
      <AnimatePresence>
        {isDialogueOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute top-28 right-6 w-80 bg-slate-900/95 border border-cyan-500/50 rounded-3xl p-4 shadow-2xl backdrop-blur-xl z-50 pointer-events-auto text-right"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-400 to-purple-500 flex items-center justify-center text-slate-950 font-black text-xs shadow-md">
                  ✨
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">נועה - עוזרת הקנבס</h4>
                  <p className="text-[10px] text-cyan-300">בנייה ועריכה קולית / מהירה</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Audio Toggle */}
                <button
                  onClick={handleToggleMute}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isMuted 
                      ? 'bg-slate-800 text-slate-400 border-slate-700' 
                      : 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  }`}
                  title={isMuted ? 'הפעל צלילים' : 'השתק צלילים'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                {/* Close */}
                <button
                  onClick={() => setIsDialogueOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Actions List */}
            <div className="space-y-2">
              <div className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                <span>פקודות AI מהירות לקנבס:</span>
                <span className="text-[9px] text-amber-400">ריחוף מיידי 🪄</span>
              </div>

              <button
                onClick={() => {
                  setIsDialogueOpen(false);
                  onQuickAction?.('הוסף ענף מחירון חומרי בניין');
                }}
                className="w-full text-right p-2.5 rounded-xl bg-slate-950/80 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-200 hover:text-cyan-200 transition-all flex items-center justify-between group active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏗️</span>
                  <span>הוסף ענף חומרי בניין</span>
                </div>
                <Wand2 className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
              </button>

              <button
                onClick={() => {
                  setIsDialogueOpen(false);
                  onQuickAction?.('הוסף ענף מכולות פסולת 8 קוב');
                }}
                className="w-full text-right p-2.5 rounded-xl bg-slate-950/80 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-200 hover:text-cyan-200 transition-all flex items-center justify-between group active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🗑️</span>
                  <span>הוסף ענף שירות מכולה</span>
                </div>
                <Wand2 className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
              </button>

              <button
                onClick={() => {
                  setIsDialogueOpen(false);
                  onQuickAction?.('הוסף ענף שעות פתיחה כפר ברא');
                }}
                className="w-full text-right p-2.5 rounded-xl bg-slate-950/80 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-200 hover:text-cyan-200 transition-all flex items-center justify-between group active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏪</span>
                  <span>הוסף ענף איסוף עצמי ושעות</span>
                </div>
                <Wand2 className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
              </button>

              <button
                onClick={() => {
                  setIsDialogueOpen(false);
                  onQuickAction?.('עדכן הודעת פתיחה');
                }}
                className="w-full text-right p-2.5 rounded-xl bg-slate-950/80 hover:bg-cyan-950/60 border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-200 hover:text-cyan-200 transition-all flex items-center justify-between group active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">💬</span>
                  <span>עדכן הודעת פתיחה ראשית</span>
                </div>
                <Wand2 className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
              </button>
            </div>

            {/* Footer Tip */}
            <div className="mt-3 pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-1.5 justify-center">
              <span>💡</span>
              <span>בכל הוספה או עריכה נועה תרחף לקלף ותרעיף עליו קסם!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
