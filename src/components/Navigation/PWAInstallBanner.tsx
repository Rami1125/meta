import React, { useState } from 'react';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';

interface PWAInstallBannerProps {
  isInstallable: boolean;
  onInstall: () => void;
  isIOS: boolean;
}

export const PWAInstallBanner: React.FC<PWAInstallBannerProps> = ({
  isInstallable,
  onInstall,
  isIOS,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || (!isInstallable && !isIOS)) return null;

  return (
    <div className="fixed top-14 left-3 right-3 md:left-auto md:right-4 md:w-96 z-50 bg-gradient-to-r from-slate-900 to-slate-950 border border-[#25D366]/40 rounded-2xl p-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#075E54] to-[#25D366] flex items-center justify-center text-white shadow-md shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="font-bold text-xs text-slate-100 flex items-center gap-1.5">
              <span>התקן את אפליקציית סבן</span>
              <span className="text-[10px] bg-[#25D366]/20 text-[#25D366] px-1.5 py-0.2 rounded font-mono">PWA</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
              {isIOS 
                ? 'לחץ על כפתור השיתוף בתחתית המסך ובחר "הוסף למסך הבית"' 
                : 'גישה מיידית, מסך מלא ללא דפדפן ומהירות 120Hz'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-500 hover:text-slate-300 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!isIOS && isInstallable && (
        <div className="mt-2.5 flex items-center justify-end gap-2">
          <button
            onClick={() => setIsDismissed(true)}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            אחר כך
          </button>
          <button
            onClick={onInstall}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-[#25D366]/20 active:scale-95 transition-transform"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>התקן עכשיו</span>
          </button>
        </div>
      )}
    </div>
  );
};
