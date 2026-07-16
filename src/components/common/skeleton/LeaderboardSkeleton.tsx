import React from 'react';

interface LeaderboardSkeletonProps {
  className?: string;
}

export const LeaderboardSkeleton: React.FC<LeaderboardSkeletonProps> = ({ className = '' }) => {
  const card = 'bg-slate-900/20 border border-slate-800/40 rounded-2xl backdrop-blur-md animate-pulse';
  const bar = 'bg-slate-800/40 rounded-lg';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header: Title + Switch + Filters */}
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 ${card} p-4`}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded ${bar}`} />
            <div className={`h-5 w-56 ${bar}`} />
          </div>
          <div className={`h-3 w-72 bg-slate-800/30 rounded`} />
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          {/* Yearly/Monthly toggle */}
          <div className="flex items-center bg-slate-950/40 border border-slate-850 p-1 rounded-xl gap-1">
            <div className={`h-7 w-16 ${bar} rounded-lg`} />
            <div className="h-7 w-20 bg-blue-600/20 rounded-lg" />
          </div>
          {/* Month selector */}
          <div className={`h-9 w-28 ${bar} rounded-xl`} />
          {/* Year selector */}
          <div className={`h-9 w-28 ${bar} rounded-xl`} />
        </div>
      </div>

      {/* Filter inputs row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`h-11 w-full ${bar} rounded-xl`} />
        <div className={`h-11 w-full ${bar} rounded-xl`} />
        <div className={`h-11 w-full ${bar} rounded-xl`} />
      </div>

      {/* Table Skeleton */}
      <div className="bg-slate-955 border border-slate-850/40 rounded-2xl overflow-hidden animate-pulse">
        <div className="p-5 border-b border-slate-850/30 flex justify-between items-center">
          <div className="h-4 w-48 bg-slate-800 rounded-md" />
          <div className="h-8 w-24 bg-slate-800/60 rounded-lg" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850/30 bg-slate-900/10">
                <th className="p-4"><div className="h-3 w-10 bg-slate-800 rounded" /></th>
                <th className="p-4"><div className="h-3 w-32 bg-slate-800 rounded" /></th>
                <th className="p-4"><div className="h-3 w-16 bg-slate-800 rounded" /></th>
                <th className="p-4"><div className="h-3 w-20 bg-slate-800 rounded" /></th>
                <th className="p-4"><div className="h-3 w-24 bg-slate-800 rounded" /></th>
                <th className="p-4"><div className="h-3 w-16 bg-slate-800 rounded" /></th>
                <th className="p-4"><div className="h-3 w-20 bg-slate-800 rounded" /></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="border-b border-slate-850/20">
                  <td className="p-4"><div className="h-4 w-6 bg-slate-800/60 rounded" /></td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800" />
                      <div className="h-4 w-28 bg-slate-800/80 rounded" />
                    </div>
                  </td>
                  <td className="p-4"><div className="h-4 w-12 bg-slate-800/50 rounded" /></td>
                  <td className="p-4"><div className="h-4 w-8 bg-slate-800/50 rounded" /></td>
                  <td className="p-4"><div className="h-4 w-10 bg-slate-800/50 rounded" /></td>
                  <td className="p-4"><div className="h-4 w-16 bg-slate-800/50 rounded" /></td>
                  <td className="p-4"><div className="h-4 w-20 bg-slate-800/50 rounded" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
