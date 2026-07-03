'use client';

import { useEffect, useState } from 'react';
import { ArrowUpCircle, RefreshCw, X } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';

/**
 * Unified AppUpdater — works on macOS, Windows, and Linux.
 *
 * Bugs fixed vs previous versions:
 * 1. Uses __TAURI_INTERNALS__ (Tauri v2 API) instead of __TAURI__ (Tauri v1 — doesn't exist in v2).
 * 2. check() in Tauri v2 returns the Update object directly (truthy) or null — NOT { available: boolean }.
 * 3. Relaunch uses @tauri-apps/plugin-process instead of a non-existent custom_relaunch Rust command.
 * 4. Skipped in development mode to avoid noisy update checks during dev.
 * 5. 5-second startup delay so the main app finishes loading before the first check fires.
 */
export default function AppUpdater() {
  const [updateAvailable, setUpdateAvailable]   = useState(false);
  const [downloading, setDownloading]           = useState(false);
  const [readyToRestart, setReadyToRestart]     = useState(false);
  const [newVersion, setNewVersion]             = useState('');
  const [error, setError]                       = useState<string | null>(null);
  const [dismissed, setDismissed]               = useState(false);
  const [updateRef, setUpdateRef]               = useState<Update | null>(null);

  useEffect(() => {
    // Tauri v2 exposes __TAURI_INTERNALS__ (not __TAURI__ which was Tauri v1)
    const isTauri =
      typeof window !== 'undefined' &&
      ((window as any).__TAURI_INTERNALS__ !== undefined ||
        window.location.protocol === 'tauri:');

    // Never run update checks in the browser or during local development
    if (!isTauri || process.env.NODE_ENV === 'development') return;

    let running = false; // prevent overlapping check+download cycles

    const checkUpdates = async () => {
      if (running) return;
      running = true;

      try {
        const { check } = await import('@tauri-apps/plugin-updater');

        // Tauri v2: check() resolves to the Update object (truthy) when an update is
        // available, or null when the app is already up-to-date.
        const update = await check();

        if (update) {
          setUpdateRef(update);
          setNewVersion(update.version);
          setUpdateAvailable(true);
          setDownloading(true);

          // Download in the background — do NOT install until the user clicks the button
          await update.download();

          setDownloading(false);
          setReadyToRestart(true);
        }
      } catch (err) {
        console.warn('[AppUpdater] Update check failed (offline or signing error):', err);
        setDownloading(false);
      } finally {
        running = false;
      }
    };

    // Small startup delay so the UI loads before the first network check
    const startupTimer = setTimeout(checkUpdates, 5000);

    // Periodic re-check every 30 minutes
    const interval = setInterval(checkUpdates, 30 * 60 * 1000);

    return () => {
      clearTimeout(startupTimer);
      clearInterval(interval);
    };
  }, []);

  const handleRestart = async () => {
    try {
      if (updateRef) {
        // Apply the previously downloaded update package
        await updateRef.install();
      }
      // Relaunch using the official Tauri process plugin (macOS + Windows + Linux)
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      console.error('[AppUpdater] Failed to install and relaunch:', err);
      setError('Relaunch failed. Please close and reopen the app manually.');
    }
  };

  // Nothing to show if dismissed or no update activity
  if (dismissed || (!updateAvailable && !error)) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-slate-100">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg shrink-0">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white leading-snug">
              {error ? 'Update Error' : 'App Update Available'}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">
              {downloading    && `Downloading v${newVersion} in background…`}
              {readyToRestart && `v${newVersion} is ready — restart to apply.`}
              {error          && error}
            </p>
          </div>
        </div>

        {/* Dismiss button — only shown when not mid-download */}
        {!downloading && (
          <button
            onClick={() => setDismissed(true)}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss update notification"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Downloading pulse bar */}
      {downloading && (
        <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
        </div>
      )}

      {/* Restart button — shown only when download is complete */}
      {readyToRestart && (
        <button
          onClick={handleRestart}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-semibold text-xs py-2.5 px-3 rounded-xl shadow-md transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Restart to Update
        </button>
      )}
    </div>
  );
}
