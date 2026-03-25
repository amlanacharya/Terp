import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { getBackupService } from '../backup/service.js';

const router = Router();

/**
 * POST /api/backup/create
 * Create a new backup
 */
router.post('/create', async (req, res) => {
  try {
    const { description } = req.body;
    const backupService = getBackupService();
    const result = await backupService.createBackup(description);

    if (result.success) {
      res.json({
        success: true,
        backup: {
          filename: result.filename,
          size: result.size,
          path: result.backupPath,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('Create backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/backup/list
 * Get list of all backups
 */
router.get('/list', async (req, res) => {
  try {
    const backupService = getBackupService();
    const backups = await backupService.listBackups();

    res.json({
      success: true,
      backups,
    });
  } catch (error: any) {
    console.error('List backups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/backup/restore
 * Restore from a backup
 */
router.post('/restore', async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    const backupService = getBackupService();
    const result = await backupService.restoreBackup(filename);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: any) {
    console.error('Restore backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/backup/:filename
 * Delete a backup
 */
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const backupService = getBackupService();
    const success = await backupService.deleteBackup(filename);

    if (success) {
      res.json({
        success: true,
        message: 'Backup deleted successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to delete backup',
      });
    }
  } catch (error: any) {
    console.error('Delete backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/backup/cleanup
 * Clean up old backups
 */
router.post('/cleanup', async (req, res) => {
  try {
    const backupService = getBackupService();
    const deletedCount = await backupService.cleanupOldBackups();

    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} old backup(s)`,
    });
  } catch (error: any) {
    console.error('Cleanup backups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/backup/statistics
 * Get backup statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const backupService = getBackupService();
    const stats = await backupService.getStatistics();

    res.json({
      success: true,
      statistics: stats,
    });
  } catch (error: any) {
    console.error('Get backup statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/backup/config
 * Get backup configuration
 */
router.get('/config', async (req, res) => {
  try {
    const backupService = getBackupService();
    const config = backupService.getConfig();

    res.json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error('Get backup config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/backup/config
 * Update backup configuration
 */
router.put('/config', async (req, res) => {
  try {
    const backupService = getBackupService();
    const config = backupService.updateConfig(req.body);

    res.json({
      success: true,
      config,
    });
  } catch (error: any) {
    console.error('Update backup config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/backup/download/:filename
 * Get download URL for a backup
 */
router.get('/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const backupService = getBackupService();
    const backups = await backupService.listBackups();
    const backup = backups.find(b => b.filename === filename);

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    // In a real implementation, you would generate a signed URL
    // For now, return the backup metadata
    res.json({
      success: true,
      backup,
      downloadUrl: `/api/backup/file/${filename}`,
    });
  } catch (error: any) {
    console.error('Get download URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/backup/file/:filename
 * Download backup file
 */
router.get('/file/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const backupService = getBackupService();
    const backups = await backupService.listBackups();
    const backup = backups.find(b => b.filename === filename);

    if (!backup) {
      return res.status(404).json({ error: 'Backup not found' });
    }

    const backupPath = path.join(backupService.getConfig().backupDir, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }

    res.download(backupPath, filename);
  } catch (error: any) {
    console.error('Download backup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
