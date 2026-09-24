import React from 'react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { sound } from '../utils/audio';

interface OfflineBannerProps {
  isOffline: boolean;
  onRetry?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline, onRetry }) => {
  if (!isOffline) return null;

  return (
    <div className="bg-[#FAF3EA] border-b border-[#E8D4B9] text-[#7C5528] px-4 py-2.5 text-xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-[#C58B5C] shrink-0" />
          <p className="font-medium">
            أنت أوفلاين دلوقتي، بس نقدر نعرض آخر حاجة كانت متسجلة عندك. 🍃
          </p>
        </div>
        {onRetry && (
          <button
            onClick={() => {
              sound.playTap();
              onRetry();
            }}
            className="flex items-center gap-1 font-bold text-[#243B35] bg-[#E4DED4]/60 px-2.5 py-1 rounded-lg hover:bg-[#E4DED4] transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>تحديث</span>
          </button>
        )}
      </div>
    </div>
  );
};

interface ErrorStateBannerProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorStateBanner: React.FC<ErrorStateBannerProps> = ({
  message = 'حصلت مشكلة بسيطة في تحميل البيانات. جرّب تاني.',
  onRetry,
}) => {
  return (
    <div className="bg-[#FAF0EE] border border-[#E9C3BC] text-[#8F3E34] p-4 rounded-2xl my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-2.5">
        <AlertCircle className="w-5 h-5 text-[#B86B61] shrink-0" />
        <div>
          <p className="text-xs sm:text-sm font-bold">{message}</p>
          <p className="text-[11px] text-[#A65B52]">مش قادرين نعرض الحاجة دي دلوقتي، جرب تعمل إعادة محاولة.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
        {onRetry && (
          <button
            onClick={() => {
              sound.playTap();
              onRetry();
            }}
            className="px-3 py-1.5 rounded-xl bg-[#B86B61] text-white text-xs font-bold hover:bg-[#9e544b] transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>إعادة المحاولة</span>
          </button>
        )}
      </div>
    </div>
  );
};
