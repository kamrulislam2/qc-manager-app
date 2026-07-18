// Single source of truth for the Working Hours dropdown options.
// Consumed by ProfileFields (user Profile Settings + first-login setup modal)
// and StaffSettingsForm (admin User Management edit + Create User).
//
// Range: 4h → 10h in 30-minute increments. Values are the string form stored
// in profiles.working_hours (numeric) — one decimal place, matching the
// historical '7.5' / '8.0' format so existing rows keep matching options.

export interface WorkingHoursOption {
  value: string;
  label: string;
}

const formatLabel = (hours: number): string => {
  const whole = Math.floor(hours);
  const hasHalf = hours % 1 !== 0;
  return hasHalf ? `${whole} Hours 30 Mins` : `${whole} Hours`;
};

export const WORKING_HOURS_MIN = 4;
export const WORKING_HOURS_MAX = 10;

export const WORKING_HOURS_OPTIONS: WorkingHoursOption[] = Array.from(
  { length: (WORKING_HOURS_MAX - WORKING_HOURS_MIN) * 2 + 1 },
  (_, i) => {
    const hours = WORKING_HOURS_MIN + i * 0.5;
    return { value: hours.toFixed(1), label: formatLabel(hours) };
  },
);
