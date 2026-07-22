// Registry of superadmin-controllable feature flags.
//
// Flags gate FUNCTIONALITY inside pages (nav visibility is handled separately by
// Tab Access). Every flag DEFAULTS ON — absent or true = enabled — so behavior
// is unchanged until a superadmin explicitly turns one off. To add a flag: add
// one entry here, then guard the feature with isFeatureEnabled(key, settings).

export interface FeatureFlagDef {
  key: string;
  label: string;
  description: string;
}

export const FEATURE_FLAGS: FeatureFlagDef[] = [
  {
    key: 'break_time',
    label: 'Short-Leave Break Time',
    description: 'The break-time add-on toggle when signing in over an hour late.',
  },
  {
    key: 'jummah_adjustment',
    label: 'Jummah Prayer Adjustment',
    description: 'The Friday 20-minute short-leave adjustment toggle.',
  },
  {
    key: 'yearly_leaderboard',
    label: 'Yearly Leaderboard',
    description: 'The Monthly/Yearly period toggle on the leaderboard.',
  },
  {
    key: 'custom_entry',
    label: 'Custom Entry',
    description: 'The Custom Entry modal for adding quote records on a chosen date.',
  },
  {
    key: 'csv_export',
    label: 'Leaderboard CSV Export',
    description: 'The Export to Excel/CSV button on the leaderboard.',
  },
];
