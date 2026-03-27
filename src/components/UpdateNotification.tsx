import { useEffect, useState } from 'react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export function UpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if we're running in Electron
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Listen for update events
      const cleanupAvailable = window.electronAPI.onUpdateAvailable?.((info: UpdateInfo) => {
        console.log('Update available:', info);
        setUpdateAvailable(true);
        setUpdateInfo(info);
        setDismissed(false);
      });

      const cleanupNotAvailable = window.electronAPI.onUpdateNotAvailable?.((info: any) => {
        console.log('Update not available:', info);
      });

      const cleanupProgress = window.electronAPI.onUpdateDownloadProgress?.((progress: DownloadProgress) => {
        console.log('Download progress:', progress);
        setDownloadProgress(progress.percent);
      });

      const cleanupDownloaded = window.electronAPI.onUpdateDownloaded?.((info: any) => {
        console.log('Update downloaded:', info);
        setReady(true);
        setDownloading(false);
      });

      const cleanupError = window.electronAPI.onUpdateError?.((err: any) => {
        console.error('Update error:', err);
        setError(err.message);
        setDownloading(false);
      });

      return () => {
        cleanupAvailable?.();
        cleanupNotAvailable?.();
        cleanupProgress?.();
        cleanupDownloaded?.();
        cleanupError?.();
      };
    }
  }, []);

  const handleDownload = () => {
    setDownloading(true);
    setError(null);
    if (window.electronAPI?.checkForUpdates) {
      window.electronAPI.checkForUpdates();
    }
  };

  const handleInstall = () => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (dismissed || !updateAvailable) {
    return null;
  }

  // Ready to install
  if (ready) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg max-w-md z-50 animate-slide-up">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold">Update ready to install!</p>
            </div>
            <p className="text-sm opacity-90">
              Version {updateInfo?.version} has been downloaded. Restart to apply updates.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="ml-2 text-white/80 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <button
          onClick={handleInstall}
          className="mt-3 w-full bg-white text-green-600 px-4 py-2 rounded font-medium hover:bg-gray-100 transition-colors"
        >
          Restart and Install
        </button>
      </div>
    );
  }

  // Downloading
  if (downloading) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg max-w-md z-50 animate-slide-up">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="font-semibold mb-2">Downloading update...</p>
            <div className="w-full bg-white/30 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-xs mt-1 opacity-80">{Math.round(downloadProgress)}%</p>
          </div>
          <button
            onClick={handleDismiss}
            className="ml-2 text-white/80 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-md z-50 animate-slide-up">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="font-semibold mb-1">Update failed</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <button
            onClick={handleDismiss}
            className="ml-2 text-white/80 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Update available
  return (
    <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg max-w-md z-50 animate-slide-up">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="font-semibold">New version available!</p>
          </div>
          <p className="text-sm opacity-90">
            Version {updateInfo?.version} is ready to download.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="ml-2 text-white/80 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <button
        onClick={handleDownload}
        className="mt-3 w-full bg-white text-blue-600 px-4 py-2 rounded font-medium hover:bg-gray-100 transition-colors"
      >
        Download Update
      </button>
    </div>
  );
}
