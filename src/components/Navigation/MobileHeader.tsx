import React from 'react';
import { Building2, Smartphone, Download, Check } from 'lucide-react';

interface MobileHeaderProps {
  onOpenSimulator: () => void;
  isInstallable: boolean;
  onInstall: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onOpenSimulator,
  isInstallable,
  onInstall,
}) => {
  return (
    <header className="md:hidden bg-slate-900/95 backdrop-blur-md border-b border-slate-800 safe-top px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-md">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-md">
          <Building2 className="w-5 h-5 stroke-[2.4]" />
        </div>
        <div>
          <div className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
            <span>ח. סבן סטודיו</span>
            <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></span>
          </div>
          <div className="text-[10px] text-emerald-400 font-mono dir-ltr text-right">
            +972 50-8860896
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isInstallable && (
          <button
            onClick={onInstall}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 text-xs font-semibold active:scale-95 transition-transform"
          >
            <Download className="w-3.5 h-3.5" />
            <span>התקן</span>
          </button>
        )}

        <button
          onClick={onOpenSimulator}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold shadow-md active:scale-95 transition-transform"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>סימולטור</span>
        </button>
      </div>
    </header>
  );
};
