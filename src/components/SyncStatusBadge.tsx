import React, { useEffect, useState } from 'react';
import { SyncManager, SyncStatusInfo } from '../services/SyncManager';
import { Check, RefreshCw, HardDrive, WifiOff } from 'lucide-react';
import { apiClient } from '../services/apiClient';

export const SyncStatusBadge: React.FC = () => {
  const isCloudEnabled = apiClient.isCloudSyncEnabled();
  const [status, setStatus] = useState<SyncStatusInfo>(() => SyncManager.getCurrentStatus());

  useEffect(() => {
    if (!isCloudEnabled) return;
    const unsubscribe = SyncManager.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });
    return () => {
      unsubscribe();
    };
  }, [isCloudEnabled]);

  if (!isCloudEnabled) return null;

  const getIcon = () => {
    switch (status.state) {
      case 'syncing':
        return <RefreshCw className="w-3 h-3 animate-spin text-[#243B35]" />;
      case 'synced':
        return <Check className="w-3 h-3 text-[#2E6B56]" />;
      case 'offline_saved':
        return <HardDrive className="w-3 h-3 text-[#7C5528]" />;
      case 'offline_retry':
        return <WifiOff className="w-3 h-3 text-[#C58B5C]" />;
    }
  };

  const getStyle = () => {
    switch (status.state) {
      case 'syncing':
        return 'bg-[#E4DED4]/50 border-[#D5CEC3] text-[#243B35]';
      case 'synced':
        return 'bg-[#EAF3EE]/80 border-[#C7E0D3] text-[#2E6B56]';
      case 'offline_saved':
        return 'bg-[#FAF3EA]/80 border-[#E8D4B9] text-[#7C5528]';
      case 'offline_retry':
        return 'bg-[#FDF3EE]/80 border-[#F0D5C7] text-[#A85832]';
    }
  };

  return (
    <div
      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all duration-300 flex items-center gap-1.5 select-none font-medium ${getStyle()}`}
      title={status.label}
    >
      {getIcon()}
      <span className="hidden sm:inline">{status.label}</span>
    </div>
  );
};
