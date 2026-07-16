import React from 'react';
import { Award } from 'lucide-react';

interface RankingChipProps {
  rank: number;
}

/**
 * Glassmorphic rank badge (#01, #15, #126). Ranks 1-3 get metallic accents.
 */
export const RankingChip: React.FC<RankingChipProps> = ({ rank }) => {
  if (rank === 1) {
    return (
      <div className="inline-flex items-center justify-center gap-1 min-w-11 px-2 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/40 backdrop-blur-sm shadow-md shadow-yellow-500/10">
        <Award className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        <span className="text-[11px] font-extrabold text-yellow-400 tracking-wide">01</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="inline-flex items-center justify-center gap-1 min-w-11 px-2 py-1 rounded-full bg-slate-400/15 border border-slate-400/40 backdrop-blur-sm shadow-md shadow-slate-400/10">
        <Award className="h-3.5 w-3.5 text-slate-300 shrink-0" />
        <span className="text-[11px] font-extrabold text-slate-300 tracking-wide">02</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="inline-flex items-center justify-center gap-1 min-w-11 px-2 py-1 rounded-full bg-amber-700/15 border border-amber-700/40 backdrop-blur-sm shadow-md shadow-amber-700/10">
        <Award className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="text-[11px] font-extrabold text-amber-500 tracking-wide">03</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center justify-center min-w-11 px-2 py-1 rounded-full bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm">
      <span className="text-[11px] font-bold text-slate-400 tracking-wide">
        #{String(rank).padStart(2, '0')}
      </span>
    </div>
  );
};
