import { useState, useEffect } from 'react';

interface BackupMetadata {
  id: string;
  filename: string;
  size: number;
  created_at: string;
  description?: string;
  type: 'manual' | 'automatic';
  compressed: boolean;
}

interface BackupStatistics {
  totalCount: number;
  totalSize: number;
  automaticCount: number;
  manualCount: number;
  oldestBackup?: string;
  newestBackup?: string;
}

export function BackupRestore() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [statistics, setStatistics] = useState<BackupStatistics | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [backupDescription, setBackupDescription] = useState('');

  useEffect(() => {
    loadBackups();
    loadStatistics();
  }, []);

  const loadBackups = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/backup/list');
      const data = await response.json();
      if (data.success) {
        setBackups(data.backups);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/backup/statistics');
      const data = await response.json();
      if (data.success) {
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleCreateBackup = async () => {
    setError('');
    setSuccessMessage('');
    setIsCreating(true);

    try {
      const response = await fetch('http://localhost:3001/api/backup/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: backupDescription }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Backup created successfully');
        setBackupDescription('');
        setTimeout(() => setSuccessMessage(''), 3000);
        loadBackups();
        loadStatistics();
      } else {
        setError(data.error || 'Failed to create backup');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!confirm('This will replace the current database. Are you sure?')) {
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsRestoring(true);

    try {
      const response = await fetch('http://localhost:3001/api/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Database restored successfully. Please refresh the page.');
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setError(data.error || 'Failed to restore backup');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    setError('');
    setSuccessMessage('');
    setIsDeleting(true);

    try {
      const response = await fetch(`http://localhost:3001/api/backup/${filename}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Backup deleted successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        loadBackups();
        loadStatistics();
      } else {
        setError(data.error || 'Failed to delete backup');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadBackup = (filename: string) => {
    const downloadUrl = `http://localhost:3001/api/backup/file/${filename}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Backup & Restore</h2>
        <p className="text-gray-600 mt-1">
          Create and manage database backups
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
          <svg className="w-5 h-5 text-green-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-green-900">{successMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <svg className="w-5 h-5 text-red-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span className="text-red-900">{error}</span>
        </div>
      )}

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600">Total Backups</div>
            <div className="text-2xl font-bold text-blue-700">{statistics.totalCount}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600">Total Size</div>
            <div className="text-2xl font-bold text-green-700">{formatFileSize(statistics.totalSize)}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600">Manual</div>
            <div className="text-2xl font-bold text-purple-700">{statistics.manualCount}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600">Automatic</div>
            <div className="text-2xl font-bold text-orange-700">{statistics.automaticCount}</div>
          </div>
        </div>
      )}

      {/* Create Backup */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Backup</h3>

        <div className="flex gap-4">
          <input
            type="text"
            value={backupDescription}
            onChange={(e) => setBackupDescription(e.target.value)}
            placeholder="Description (optional)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleCreateBackup}
            disabled={isCreating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create Backup'}
          </button>
        </div>
      </div>

      {/* Backup List */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Backup History</h3>

        {backups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No backups yet. Create your first backup above.
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    <span className="font-medium text-gray-900">
                      {backup.description || 'Backup'}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({backup.type})
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {formatDate(backup.created_at)} · {formatFileSize(backup.size)}
                    {backup.compressed && (
                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Compressed
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadBackup(backup.filename)}
                    className="p-2 text-gray-600 hover:text-blue-600 transition-colors"
                    title="Download"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRestoreBackup(backup.filename)}
                    disabled={isRestoring}
                    className="p-2 text-gray-600 hover:text-green-600 transition-colors disabled:opacity-50"
                    title="Restore"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(backup.filename)}
                    disabled={isDeleting}
                    className="p-2 text-gray-600 hover:text-red-600 transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="text-sm text-yellow-800">
            <strong>Important:</strong> Restoring a backup will replace all current data. Make sure to create a backup before restoring.
          </div>
        </div>
      </div>
    </div>
  );
}
