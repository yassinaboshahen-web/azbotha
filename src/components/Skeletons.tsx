import React from 'react';

export const TimeFlowSkeleton: React.FC = () => {
  return (
    <div className="py-4 px-2 sm:px-4 max-w-3xl mx-auto animate-pulse space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#E4DED4]" />
          <div className="h-5 w-36 bg-[#E4DED4] rounded-lg" />
        </div>
        <div className="h-4 w-20 bg-[#E4DED4] rounded-md" />
      </div>

      {/* Vertical Rail + Cards Skeleton */}
      <div className="relative pr-8 sm:pr-12 pl-2 space-y-5">
        <div className="absolute right-3.5 sm:right-5 top-2 bottom-4 w-[2px] bg-[#E4DED4]" />
        
        {[1, 2, 3].map((item) => (
          <div key={item} className="relative flex items-start gap-3">
            {/* Node circle */}
            <div className="absolute -right-8 sm:-right-12 top-3.5 w-7 h-7 rounded-full bg-[#E4DED4] border-2 border-[#F6F3EE]" />
            
            {/* Card surface */}
            <div className="w-full bg-white/60 border border-[#E4DED4] rounded-2xl p-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-[#E4DED4] rounded-md" />
                <div className="h-4 w-16 bg-[#E4DED4] rounded-md" />
              </div>
              <div className="h-5 w-48 bg-[#E4DED4] rounded-md" />
              <div className="h-3 w-32 bg-[#E4DED4]/70 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const WeekSkeleton: React.FC = () => {
  return (
    <div className="py-4 px-2 sm:px-4 max-w-3xl mx-auto animate-pulse space-y-6">
      <div className="flex justify-between items-center bg-white/60 p-4 rounded-2xl border border-[#E4DED4]">
        <div className="h-6 w-32 bg-[#E4DED4] rounded-lg" />
        <div className="h-5 w-24 bg-[#E4DED4] rounded-md" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="p-4 rounded-2xl bg-white/60 border border-[#E4DED4] space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-20 bg-[#E4DED4] rounded-md" />
              <div className="h-4 w-12 bg-[#E4DED4] rounded-md" />
            </div>
            <div className="h-8 w-full bg-[#E4DED4]/50 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const NotificationSkeleton: React.FC = () => {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-3.5 rounded-2xl bg-white/70 border border-[#E4DED4] space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-[#E4DED4] rounded-md" />
            <div className="h-3 w-14 bg-[#E4DED4] rounded-md" />
          </div>
          <div className="h-3 w-44 bg-[#E4DED4]/60 rounded-md" />
        </div>
      ))}
    </div>
  );
};
