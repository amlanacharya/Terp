/**
 * Feedback API Routes
 *
 * Handles in-app feedback submission from beta testers
 */

import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';

const router = Router();

// Feedback storage location
const FEEDBACK_DIR = path.join(process.env.APPDATA || process.env.HOME || '', 'TravelERP-Lite', 'feedback');

// Ensure feedback directory exists
const ensureFeedbackDir = async () => {
  try {
    await fs.mkdir(FEEDBACK_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create feedback directory:', error);
  }
};

// Initialize
ensureFeedbackDir();

/**
 * POST /api/feedback/submit
 *
 * Submit feedback (bug report, feature request, general feedback, question)
 */
router.post('/submit', async (req, res) => {
  try {
    const {
      category,
      severity,
      title,
      description,
      steps,
      expected,
      actual,
      email,
      attachLogs,
      timestamp,
      appVersion,
      platform,
      arch,
    } = req.body;

    // Validate required fields
    if (!title || !description || !email) {
      return res.status(400).json({ error: 'Title, description, and email are required' });
    }

    // Validate category
    const validCategories = ['bug', 'feature', 'general', 'question'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid feedback category' });
    }

    // Bug-specific validation
    if (category === 'bug' && !steps) {
      return res.status(400).json({ error: 'Steps to reproduce are required for bug reports' });
    }

    // Validate severity for bugs
    if (category === 'bug') {
      const validSeverities = ['critical', 'high', 'medium', 'low'];
      if (!validSeverities.includes(severity)) {
        return res.status(400).json({ error: 'Invalid severity level' });
      }
    }

    // Create feedback object
    const feedback = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      category,
      severity: category === 'bug' ? severity : undefined,
      title: title.trim(),
      description: description.trim(),
      steps: category === 'bug' ? steps.trim() : undefined,
      expected: category === 'bug' ? expected.trim() : undefined,
      actual: category === 'bug' ? actual.trim() : undefined,
      email: email.trim(),
      attachLogs: attachLogs || false,
      timestamp: timestamp || new Date().toISOString(),
      appVersion: appVersion || '1.0.0-beta.1',
      platform: platform || process.platform,
      arch: arch || process.arch,
      status: 'new', // new, reviewing, resolved, deferred
    };

    // Save to file
    const filename = `feedback-${feedback.id}.json`;
    const filepath = path.join(FEEDBACK_DIR, filename);
    await fs.writeFile(filepath, JSON.stringify(feedback, null, 2), 'utf-8');

    // If logs requested, attach them
    let logContent = null;
    if (attachLogs) {
      try {
        const logPath = path.join(
          process.env.APPDATA || process.env.HOME || '',
          'TravelERP-Lite',
          'logs',
          'travelerp-lite.log'
        );
        logContent = await fs.readFile(logPath, 'utf-8');

        // Save logs separately
        const logFilename = `logs-${feedback.id}.txt`;
        const logFilepath = path.join(FEEDBACK_DIR, logFilename);
        await fs.writeFile(logFilepath, logContent, 'utf-8');
      } catch (error) {
        // Logs might not exist, that's okay
        console.warn('Could not attach logs:', error);
      }
    }

    // In production, would also send email or sync to remote server
    // For now, just store locally

    res.json({
      success: true,
      feedbackId: feedback.id,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({
      error: 'Failed to submit feedback',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/feedback/list
 *
 * List all feedback (admin only, for development/testing)
 */
router.get('/list', async (req, res) => {
  try {
    const files = await fs.readdir(FEEDBACK_DIR);
    const feedbackFiles = files.filter((f) => f.startsWith('feedback-') && f.endsWith('.json'));

    const feedbackList = [];
    for (const file of feedbackFiles) {
      const filepath = path.join(FEEDBACK_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      feedbackList.push(JSON.parse(content));
    }

    // Sort by timestamp, newest first
    feedbackList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json({ feedback: feedbackList });
  } catch (error) {
    console.error('List feedback error:', error);
    res.status(500).json({
      error: 'Failed to list feedback',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/feedback/stats
 *
 * Get feedback statistics (admin only)
 */
router.get('/stats', async (req, res) => {
  try {
    const files = await fs.readdir(FEEDBACK_DIR);
    const feedbackFiles = files.filter((f) => f.startsWith('feedback-') && f.endsWith('.json'));

    const stats = {
      total: feedbackFiles.length,
      byCategory: {
        bug: 0,
        feature: 0,
        general: 0,
        question: 0,
      },
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      byStatus: {
        new: 0,
        reviewing: 0,
        resolved: 0,
        deferred: 0,
      },
    };

    for (const file of feedbackFiles) {
      const filepath = path.join(FEEDBACK_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const feedback = JSON.parse(content);

      const category = feedback.category as keyof typeof stats.byCategory;
      if (category in stats.byCategory) {
        stats.byCategory[category]++;
      }
      if (feedback.severity) {
        const severity = feedback.severity as keyof typeof stats.bySeverity;
        if (severity in stats.bySeverity) {
          stats.bySeverity[severity]++;
        }
      }
      if (feedback.status) {
        const status = feedback.status as keyof typeof stats.byStatus;
        if (status in stats.byStatus) {
          stats.byStatus[status]++;
        }
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('Feedback stats error:', error);
    res.status(500).json({
      error: 'Failed to get feedback statistics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/feedback/:id/status
 *
 * Update feedback status (admin only)
 */
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'reviewing', 'resolved', 'deferred'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const filename = `feedback-${id}.json`;
    const filepath = path.join(FEEDBACK_DIR, filename);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      const feedback = JSON.parse(content);
      feedback.status = status;
      feedback.updatedAt = new Date().toISOString();

      await fs.writeFile(filepath, JSON.stringify(feedback, null, 2), 'utf-8');

      res.json({ success: true, message: 'Status updated' });
    } catch (error) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      error: 'Failed to update status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
