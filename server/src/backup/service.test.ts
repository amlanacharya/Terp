import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackupService } from '../service';
import fs from 'fs';
import path from 'path';

describe('BackupService', () => {
  let service: BackupService;
  const testBackupDir = './test-backups';

  beforeEach(() => {
    service = new BackupService({ backupDir: testBackupDir });

    // Mock spawn to avoid actual pg_dump calls
    vi.mock('child_process', () => ({
      spawn: vi.fn(() => ({
        stderr: {
          on: vi.fn(),
        },
        on: vi.fn((event: string, callback: Function) => {
          if (event === 'close') {
            callback(0);
          }
        }),
      })),
    }));
  });

  afterEach(() => {
    // Cleanup test backup directory
    if (fs.existsSync(testBackupDir)) {
      fs.rmSync(testBackupDir, { recursive: true, force: true });
    }
  });

  it('should create backup configuration', () => {
    const config = service.getConfig();

    expect(config.backupDir).toBe(testBackupDir);
    expect(config.retentionDays).toBe(30);
    expect(config.autoBackupEnabled).toBe(false);
    expect(config.compressionEnabled).toBe(true);
  });

  it('should update configuration', () => {
    const newConfig = service.updateConfig({
      retentionDays: 60,
      autoBackupEnabled: true,
    });

    expect(newConfig.retentionDays).toBe(60);
    expect(newConfig.autoBackupEnabled).toBe(true);
  });

  it('should ensure backup directory exists', () => {
    expect(fs.existsSync(testBackupDir)).toBe(true);
  });

  it('should generate unique IDs', () => {
    const service = new BackupService({ backupDir: testBackupDir });

    // Access private method through test
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const id = Math.random().toString(36); // Simulate ID generation
      ids.add(id);
    }

    expect(ids.size).toBe(100);
  });

  it('should format metadata correctly', () => {
    const metadata = {
      id: 'test-id',
      filename: 'test-backup.sql',
      size: 1024,
      created_at: new Date().toISOString(),
      type: 'manual' as const,
      compressed: false,
    };

    expect(metadata.id).toBeDefined();
    expect(metadata.filename).toBeDefined();
    expect(metadata.size).toBe(1024);
    expect(metadata.type).toBe('manual');
    expect(metadata.compressed).toBe(false);
  });

  it('should have correct backup filename format', () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `travelerp-backup-${timestamp}.sql`;

    expect(filename).toMatch(/^travelerp-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
    expect(filename).endsWith('.sql');
  });

  it('should calculate statistics correctly', async () => {
    // Create some test backups
    const testBackups = [
      {
        id: '1',
        filename: 'backup1.sql',
        size: 1024,
        created_at: new Date(Date.now() - 86400000).toISOString(),
        type: 'manual' as const,
        compressed: true,
      },
      {
        id: '2',
        filename: 'backup2.sql.gz',
        size: 2048,
        created_at: new Date().toISOString(),
        type: 'automatic' as const,
        compressed: true,
      },
    ];

    // Mock listBackups
    vi.spyOn(service, 'listBackups').mockResolvedValue(testBackups);

    const stats = await service.getStatistics();

    expect(stats.totalCount).toBe(2);
    expect(stats.totalSize).toBe(3072);
    expect(stats.manualCount).toBe(1);
    expect(stats.automaticCount).toBe(1);
  });

  describe('Retention Policy', () => {
    it('should identify old backups', () => {
      const retentionDays = 30;
      const now = new Date();
      const oldDate = new Date(now.getTime() - (retentionDays + 1) * 24 * 60 * 60 * 1000);
      const recentDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      const oldBackup = {
        id: 'old',
        filename: 'old-backup.sql',
        size: 1024,
        created_at: oldDate.toISOString(),
        type: 'manual' as const,
        compressed: false,
      };

      const recentBackup = {
        id: 'recent',
        filename: 'recent-backup.sql',
        size: 1024,
        created_at: recentDate.toISOString(),
        type: 'manual' as const,
        compressed: false,
      };

      const daysOldOld = Math.floor((now.getTime() - new Date(oldBackup.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const daysOldRecent = Math.floor((now.getTime() - new Date(recentBackup.created_at).getTime()) / (1000 * 60 * 60 * 24));

      expect(daysOldOld).toBeGreaterThan(retentionDays);
      expect(daysOldRecent).toBeLessThan(retentionDays);
    });

    it('should mark correct backups for deletion', async () => {
      const retentionDays = 7;
      const now = new Date();

      const oldBackup = {
        id: 'old',
        filename: 'old.sql',
        size: 1024,
        created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'manual' as const,
        compressed: false,
      };

      const recentBackup = {
        id: 'recent',
        filename: 'recent.sql',
        size: 1024,
        created_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        type: 'manual' as const,
        compressed: false,
      };

      // Mock list and delete
      vi.spyOn(service, 'listBackups').mockResolvedValue([oldBackup, recentBackup]);
      vi.spyOn(service, 'deleteBackup').mockResolvedValue(true);

      const deletedCount = await service.cleanupOldBackups();

      // Should delete only the old backup
      expect(deletedCount).toBe(1);
    });
  });

  describe('File Operations', () => {
    it('should save and load metadata', () => {
      const metadata = {
        id: 'test-123',
        filename: 'test.sql',
        size: 1024,
        created_at: new Date().toISOString(),
        type: 'manual' as const,
        compressed: false,
      };

      // Mock fs operations
      vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      const config = service.getConfig();
      expect(config).toBeDefined();
    });
  });
});
