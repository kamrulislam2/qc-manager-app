'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';
import { Profile } from '@/types';
import { PROFILE_COLUMNS } from '@/utils/dbColumns';
import { mapProfilePasswordResetStatus } from '@/utils/profileHelpers';
import { getCacheData, setCacheData } from '@/utils/offlineSync';
import { useRealtimeHandler, RealtimePayload } from '@/contexts/RealtimeContext';

// ─── Types ───────────────────────────────────────────────────────────

interface ProfilesContextValue {
  /** The single shared profiles list (full table, username-ordered, password_reset_status mapped). */
  profilesList: Profile[];
  /** Direct setter — prefer refreshProfiles for post-mutation refreshes. */
  setProfilesList: React.Dispatch<React.SetStateAction<Profile[]>>;
  /** Refetch the full list from Supabase (throttle-free; use after mutations). */
  refreshProfiles: () => Promise<void>;
  /** True once the initial load (cache or network) has completed. */
  isLoaded: boolean;
}

// ─── Context ─────────────────────────────────────────────────────────

const ProfilesContext = createContext<ProfilesContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────

interface ProfilesProviderProps {
  children: React.ReactNode;
  sessionUser: SupabaseUser | null;
}

/**
 * Single owner of the shared profiles list (R1/R2 consolidation).
 *
 * Previously page.tsx, useDashboardData, useQuotesDashboardData and
 * UserManagementDashboard each fetched and realtime-patched their own copy
 * of the profiles table. This provider fetches ONCE, patches UPDATE events
 * inline, refetches on INSERT/DELETE, and mirrors to the `profiles_cache`
 * IndexedDB store so offline loads keep working for all consumers.
 *
 * Must be mounted inside RealtimeProvider.
 */
export function ProfilesProvider({ children, sessionUser }: ProfilesProviderProps) {
  const [profilesList, setProfilesList] = useState<Profile[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const fetchingRef = useRef(false);

  const refreshProfiles = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .order('username', { ascending: true });
      if (!error && data) {
        const mapped = data.map(
          (p) => mapProfilePasswordResetStatus(p as unknown as Profile) as Profile,
        );
        setProfilesList(mapped);
        // Mirror to IndexedDB so offline sessions still get the list
        try {
          await setCacheData('profiles_cache', mapped);
        } catch {
          // cache write failures are non-fatal
        }
      }
    } catch (err) {
      console.error('ProfilesProvider: failed to fetch profiles:', err);
    } finally {
      fetchingRef.current = false;
      setIsLoaded(true);
    }
  }, []);

  // Initial load: cache-first for instant paint/offline, then network
  useEffect(() => {
    if (!sessionUser) {
      setProfilesList([]);
      setIsLoaded(false);
      return;
    }
    let active = true;

    (async () => {
      try {
        const cached = (await getCacheData('profiles_cache')) as Profile[];
        if (active && cached.length > 0) {
          setProfilesList(cached.map((p) => mapProfilePasswordResetStatus(p) as Profile));
          setIsLoaded(true);
        }
      } catch {
        // no cache — network fetch below covers it
      }
      if (typeof window === 'undefined' || navigator.onLine) {
        await refreshProfiles();
      } else if (active) {
        setIsLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [sessionUser, refreshProfiles]);

  // Single realtime patcher for the whole app
  const handleProfilesRealtime = useCallback(
    (payload: RealtimePayload) => {
      if (payload.eventType === 'UPDATE') {
        const mapped = mapProfilePasswordResetStatus(
          payload.new as unknown as Profile,
        ) as Profile;
        setProfilesList((prev) => prev.map((p) => (p.id === mapped.id ? mapped : p)));
      } else {
        // INSERT / DELETE — membership changed, refetch the list once
        refreshProfiles();
      }
    },
    [refreshProfiles],
  );
  useRealtimeHandler('profiles', handleProfilesRealtime);

  const value = useMemo(
    () => ({ profilesList, setProfilesList, refreshProfiles, isLoaded }),
    [profilesList, refreshProfiles, isLoaded],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

// ─── Consumer hook ───────────────────────────────────────────────────

const noopSetter: React.Dispatch<React.SetStateAction<Profile[]>> = () => {};
const noopRefresh = async () => {};

/**
 * Access the shared profiles list. Safe without a provider (returns an
 * empty list and no-ops) so standalone routes (/chuti, /quotes) don't
 * crash during their redirect-to-/ flash.
 */
export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) {
    return {
      profilesList: [],
      setProfilesList: noopSetter,
      refreshProfiles: noopRefresh,
      isLoaded: false,
    };
  }
  return ctx;
}
