import React, { useState, useEffect } from 'react';
import { X, Smartphone, Share2, Download, Copy, Check, ShieldAlert, Sparkles } from 'lucide-react';
import { sound } from '../utils/audio';
import { apiClient } from '../services/apiClient';
import { identityService } from '../services/identity';
import { syncService } from '../services/syncService';

interface DeviceTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTransferSuccess: () => void;
  addToast: (msg: string, type?: 'success' | 'info') => void;
}

export const DeviceTransferModal: React.FC<DeviceTransferModalProps> = ({
  isOpen,
  onClose,
  onTransferSuccess,
  addToast,
}) => {
  const [mode, setMode] = useState<'menu' | 'generate' | 'claim'>('menu');
  const [transferCode, setTransferCode] = useState<string>('');
  const [expiresIn, setExpiresIn] = useState<number>(15);
  const [inputCode, setInputCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setMode('menu');
      setTransferCode('');
      setInputCode('');
      setErrorMessage('');
      setCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    sound.playTap();
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await apiClient.generateTransferCode();
      setTransferCode(res.code);
      setExpiresIn(res.expiresInMinutes || 15);
      setMode('generate');
    } catch (err: any) {
      setErrorMessage(err.message || 'فشل توليد كود النقل. جرّب تاني.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    sound.playTap();
    navigator.clipboard.writeText(transferCode);
    setCopied(true);
    addToast('اتنسخ الكود بنجاح 👌', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      setErrorMessage('من فضلك ادخل كود النقل.');
      return;
    }

    sound.playTap();
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await apiClient.claimTransferCode(inputCode.trim());
      if (res.success && res.anonymous_user_id) {
        // Establish new device association
        identityService.setAnonymousUser(res.anonymous_user_id, res.installationCredential);

        // Download cloud data and populate IndexedDB
        await syncService.fullSync();

        sound.playPop();
        addToast('تم نقل بياناتك بنجاح وجاري فتح اليوم! 🚀', 'success');
        onTransferSuccess();
        onClose();
      } else {
        setErrorMessage('الكود غير صحيح أو انتهت صلاحيته.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'الكود غير صحيح أو انتهت صلاحيته.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full sm:max-w-md bg-[#F6F3EE] rounded-3xl border border-[#E4DED4] shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-5 border-b border-[#E4DED4]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#243B35] text-[#D8C3A5] flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-[#243B35]">
              نقل يومك لجهاز تاني
            </h2>
          </div>
          <button
            onClick={() => {
              sound.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#E4DED4]/60 text-[#77766F] hover:text-[#243B35] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-[#FDF3EE] border border-[#F0D5C7] text-[#A85832] text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {mode === 'menu' && (
          <div className="space-y-4">
            <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed">
              عايز تنقل يومك لجهاز تاني؟ تقدر تعمل كود نقل مؤقت وآمن، أو تستخدم كود نقل من جهازك القديم في ثواني بدون أي حساب أو كلمة مرور.
            </p>

            <div className="grid grid-cols-1 gap-3 pt-2">
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Share2 className="w-4 h-4 text-[#D8C3A5]" />
                <span>اعمل كود نقل مؤقت (من الجهاز الحالي)</span>
              </button>

              <button
                onClick={() => {
                  sound.playTap();
                  setMode('claim');
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-white border border-[#D5CEC3] text-[#243B35] hover:bg-[#E4DED4]/40 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Download className="w-4 h-4 text-[#C58B5C]" />
                <span>عندك كود نقل؟ (استعادة على هذا الجهاز)</span>
              </button>
            </div>
          </div>
        )}

        {mode === 'generate' && (
          <div className="space-y-5 text-center py-2">
            <div>
              <p className="text-xs text-[#77766F] mb-1">
                كود النقل الخاص بك (صالح لمدة {expiresIn} دقائق):
              </p>
              <div className="my-3 py-4 px-6 bg-white rounded-2xl border border-[#C58B5C]/30 text-2xl sm:text-3xl font-mono font-bold tracking-widest text-[#243B35] shadow-xs select-all">
                {transferCode}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyCode}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                {copied ? <Check className="w-4 h-4 text-[#C7E0D3]" /> : <Copy className="w-4 h-4 text-[#D8C3A5]" />}
                <span>{copied ? 'اتنسخ الكود!' : 'نسخ الكود'}</span>
              </button>
              <button
                onClick={() => setMode('menu')}
                className="py-3 px-4 rounded-2xl bg-white border border-[#E4DED4] text-[#77766F] hover:text-[#243B35] text-xs font-bold transition-all cursor-pointer"
              >
                رجوع
              </button>
            </div>

            <p className="text-[11px] text-[#A3A198] leading-relaxed">
              اكتب هذا الكود في الجهاز الثاني لاستعادة جميع مهامك ومواعيدك فوراً. الكود آمن ويُستخدم مرة واحدة فقط.
            </p>
          </div>
        )}

        {mode === 'claim' && (
          <form onSubmit={handleClaim} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#243B35] mb-1.5">
                ادخل كود النقل المكون من 6 رموز:
              </label>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                placeholder="مثال: A7K92M"
                maxLength={8}
                className="w-full px-4 py-3 bg-white border border-[#D5CEC3] rounded-2xl text-center font-mono font-bold text-lg tracking-widest text-[#243B35] focus:outline-none focus:ring-2 focus:ring-[#243B35]"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isLoading || !inputCode.trim()}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-[#243B35] text-[#F6F3EE] hover:bg-[#1b2d28] font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center gap-1.5">جاري استعادة البيانات...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#D8C3A5]" />
                    <span>استعادة البيانات</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setMode('menu')}
                className="py-3.5 px-4 rounded-2xl bg-white border border-[#E4DED4] text-[#77766F] hover:text-[#243B35] text-xs font-bold transition-all cursor-pointer"
              >
                رجوع
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
