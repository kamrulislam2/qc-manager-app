import React from 'react';
import { LeaderboardUser } from '@/hooks/quotes-tracker/useLeaderboardData';
import { UserDisplayName } from '@/components/common/UserDisplayName';

interface LeaderboardRowProps {
  user: LeaderboardUser;
  isCurrentUser: boolean;
}

export const LeaderboardRow: React.FC<LeaderboardRowProps> = ({ user, isCurrentUser }) => {
  // Construct a temp profile object for UserDisplayName compatibility
  const tempProfile = React.useMemo(() => ({
    id: user.user_id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    job_role: user.job_role,
    global_settings: {
      top_performer_badge: user.badge
    }
  }), [user]);

  return (
    <tr
      className={`border-b border-slate-850/20 hover:bg-slate-900/10 text-xs transition-colors ${
        isCurrentUser ? 'bg-blue-950/10 border-l-2 border-l-blue-600' : ''
      }`}
    >
      {/* 1. Employee Name (uses UserDisplayName for consistent spacing, visual badge checkmark, and rank #) */}
      <td className="p-4 pl-6 font-semibold text-slate-200 text-left">
        <div className="flex flex-col min-w-0">
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <UserDisplayName
              profile={tempProfile as any}
              badge={user.badge}
              rank={user.rank}
              showRank={false}
              showBadge={true}
              tooltipPosition="bottom"
              nameClassName="text-sm font-bold text-white hover:text-blue-400 transition-colors"
            />
          </div>
          <span className="text-[9px] text-slate-500 font-bold tracking-wider mt-0.5">
            {user.username.toUpperCase()}
          </span>
        </div>
      </td>

      {/* 2. Current Rank (placeholder column, but rank is already displayed next to name. We render the rank badge/bubble or rank text) */}
      <td className="p-4 text-center font-bold text-slate-400 text-sm">
        #{String(user.rank).padStart(2, '0')}
      </td>

      {/* 3. Today's Submissions */}
      <td className="p-4 text-center font-bold text-slate-350 text-sm">
        {user.todays_count}
      </td>

      {/* 4. Current Month Submissions (Selected Month) */}
      <td className="p-4 text-center font-bold text-slate-300 text-sm">
        {user.months_count}
      </td>

      {/* 5. Selected Year Submissions (Yearly) */}
      <td className="p-4 text-center font-bold text-slate-300 text-sm pr-6">
        {user.overall_score}
      </td>
    </tr>
  );
};
