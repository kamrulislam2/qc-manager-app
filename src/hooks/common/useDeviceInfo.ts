import { useState, useEffect, useMemo } from 'react';
import { detectDevice, getAsyncArchitecture, DeviceInfo } from '@/utils/deviceDetection';
import { DOWNLOADS, DownloadInfo, MANIFEST_URL } from '@/config/downloads';

let hasLoggedFallbackWarning = false;

export interface UseDeviceInfoResult {
  deviceInfo: DeviceInfo;
  recommendation: DownloadInfo | null;
  loading: boolean;
  downloads: typeof DOWNLOADS;
}

export function useDeviceInfo(): UseDeviceInfoResult {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    os: 'Unknown',
    architecture: 'Unknown',
    deviceType: 'Desktop',
    touchCapable: false,
    browser: 'Unknown',
  });
  const [downloads, setDownloads] = useState<typeof DOWNLOADS>(DOWNLOADS);
  const [loading, setLoading] = useState(true);

  // Compute recommendation dynamically from state
  const recommendation = useMemo(() => {
    return getRecommendation(deviceInfo, downloads);
  }, [deviceInfo, downloads]);

  useEffect(() => {
    // 1. Detect core device properties synchronously
    const info = detectDevice();
    setDeviceInfo(info);
    setLoading(false);

    // If in development mode (localhost), use local downloads config only and skip remote manifest fetching
    if (process.env.NODE_ENV === 'development') {
      return;
    }

    const controller = new AbortController();
    let active = true;

    // 2. Fetch latest release manifest asynchronously to override URLs, sizes, and hashes
    const fetchManifest = async () => {
      try {
        const res = await fetch(MANIFEST_URL, { 
          cache: 'no-store',
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        if (active && data && data.version && data.downloads) {
          const notesText = data.notes || data.body || "";
          const dateStr = data.releaseDate || data.pub_date 
            ? new Date(data.releaseDate || data.pub_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
            : DOWNLOADS.windows.x64.releaseDate;

          // Merge remote values with local fallback descriptors
          const mergedDownloads = {
            windows: {
              x64: { 
                ...DOWNLOADS.windows.x64, 
                ...data.downloads.windows?.x64, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              },
              arm64: { 
                ...DOWNLOADS.windows.arm64, 
                ...data.downloads.windows?.arm64, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              }
            },
            macos: {
              universal: { 
                ...DOWNLOADS.macos.universal, 
                ...data.downloads.macos?.universal, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              },
              appleSilicon: { 
                ...DOWNLOADS.macos.appleSilicon, 
                ...data.downloads.macos?.appleSilicon, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              },
              intel: { 
                ...DOWNLOADS.macos.intel, 
                ...data.downloads.macos?.intel, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              }
            },
            linux: {
              deb: { 
                ...DOWNLOADS.linux.deb, 
                ...data.downloads.linux?.deb, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              },
              appimage: { 
                ...DOWNLOADS.linux.appimage, 
                ...data.downloads.linux?.appimage, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              },
              rpm: { 
                ...DOWNLOADS.linux.rpm, 
                ...data.downloads.linux?.rpm, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              }
            },
            android: {
              apk: { 
                ...DOWNLOADS.android.apk, 
                ...data.downloads.android?.apk, 
                version: data.version, 
                releaseDate: dateStr,
                releaseNotes: notesText
              }
            }
          };
          setDownloads(mergedDownloads);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // Ignore aborted requests
        
        // Log fallback warning at most once in non-production environments
        if (process.env.NODE_ENV !== 'production') {
          if (!hasLoggedFallbackWarning) {
            console.warn('[useDeviceInfo] Failed to fetch latest.json, using local fallback downloads config:', err.message || err);
            hasLoggedFallbackWarning = true;
          }
        }
      }
    };

    fetchManifest();

    // 3. Query async high entropy values (for Windows/Chromium architecture refinements)
    getAsyncArchitecture(info).then((refinedArch) => {
      if (active && refinedArch !== info.architecture) {
        setDeviceInfo(prev => ({ ...prev, architecture: refinedArch }));
      }
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return {
    deviceInfo,
    recommendation,
    loading,
    downloads,
  };
}

/**
 * Maps DeviceInfo parameters to the appropriate download payload from downloads config
 */
function getRecommendation(info: DeviceInfo, currentDownloads: typeof DOWNLOADS): DownloadInfo | null {
  switch (info.os) {
    case 'Windows':
      if (info.architecture === 'ARM64') {
        return currentDownloads.windows.arm64;
      }
      return currentDownloads.windows.x64; // Default recommended Windows build
      
    case 'macOS':
      if (info.architecture === 'Apple Silicon' || info.architecture === 'ARM64') {
        return currentDownloads.macos.appleSilicon;
      }
      if (info.architecture === 'x64') {
        return currentDownloads.macos.intel;
      }
      return currentDownloads.macos.universal;
      
    case 'Linux':
      // Recommend deb for Ubuntu/Debian/Mint/Pop!_OS/Kali
      if (info.linuxDistro === 'Ubuntu' || info.linuxDistro === 'Debian') {
        return currentDownloads.linux.deb;
      }
      // Recommend rpm for Fedora/RedHat/openSUSE
      if (info.linuxDistro === 'Fedora' || info.linuxDistro === 'RedHat' || info.linuxDistro === 'openSUSE') {
        return currentDownloads.linux.rpm;
      }
      // Default to AppImage for unknown Linux
      return currentDownloads.linux.appimage;
      
    case 'Android':
      return currentDownloads.android.apk;
      
    default:
      return null; // Fallback handled by parent UI
  }
}
