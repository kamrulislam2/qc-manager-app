import React from 'react';
import { BadgeInfo } from '@/utils/leaderboardHelper';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';

interface EmployeeRankBadgeProps {
  badge: BadgeInfo | null | undefined;
  tooltipPosition?: 'top' | 'bottom';
}

/**
 * Verified top-performer badge shown next to an employee's name.
 * Blue for last month's top 3, grey for ranks 4-5 (encoded in badge.badgeType).
 */
export const EmployeeRankBadge: React.FC<EmployeeRankBadgeProps> = ({
  badge,
  tooltipPosition = 'bottom',
}) => {
  if (!badge) return null;
  return <VerifiedBadge badge={badge} position={tooltipPosition} />;
};
