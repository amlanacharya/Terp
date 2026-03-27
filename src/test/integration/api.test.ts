import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';

// Import route handlers
import licenseRoutes from '../../../server/src/routes/license.routes';
import networkRoutes from '../../../server/src/routes/network.routes';
import backupRoutes from '../../../server/src/routes/backup.routes';

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Setup test express app
    app = express();
    app.use(cors());
    app.use(express.json());

    // Mount routes
    app.use('/api/license', licenseRoutes);
    app.use('/api/network', networkRoutes);
    app.use('/api/backup', backupRoutes);

    // Error handler
    app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });
  });

  afterAll(() => {
    // Cleanup
  });

  describe('License API', () => {
    describe('GET /api/license/status', () => {
      it('should return license status', async () => {
        const response = await request(app)
          .get('/api/license/status')
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('canUse');
        expect(response.body).toHaveProperty('subscriptionType');
      });
    });

    describe('POST /api/license/verify', () => {
      it('should verify license', async () => {
        const response = await request(app)
          .post('/api/license/verify')
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('valid');
      });
    });

    describe('GET /api/license/company', () => {
      it('should return company settings or 404', async () => {
        const response = await request(app)
          .get('/api/license/company')
          .expect('Content-Type', /json/);

        // In test environment, might return 404
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  describe('Network API', () => {
    describe('GET /api/network/config', () => {
      it('should return network configuration', async () => {
        const response = await request(app)
          .get('/api/network/config')
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('mode');
        expect(['standalone', 'server', 'client']).toContain(response.body.mode);
      });
    });

    describe('GET /api/network/local-ips', () => {
      it('should return local network info', async () => {
        const response = await request(app)
          .get('/api/network/local-ips')
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('hostname');
        expect(response.body).toHaveProperty('ips');
        expect(Array.isArray(response.body.ips)).toBe(true);
      });
    });

    describe('POST /api/network/test-connection', () => {
      it('should validate connection parameters', async () => {
        const response = await request(app)
          .post('/api/network/test-connection')
          .send({
            address: 'localhost',
            port: 5432,
          })
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('address');
        expect(response.body).toHaveProperty('port');
        expect(response.body).toHaveProperty('reachable');
        expect(typeof response.body.reachable).toBe('boolean');
      });

      it('should require address and port', async () => {
        const response = await request(app)
          .post('/api/network/test-connection')
          .send({})
          .expect('Content-Type', /json/);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Backup API', () => {
    describe('GET /api/backup/config', () => {
      it('should return backup configuration', async () => {
        const response = await request(app)
          .get('/api/backup/config')
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('config');
        expect(response.body.config).toHaveProperty('retentionDays');
        expect(response.body.config).toHaveProperty('compressionEnabled');
      });
    });

    describe('GET /api/backup/list', () => {
      it('should return list of backups', async () => {
        const response = await request(app)
          .get('/api/backup/list')
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('backups');
        expect(Array.isArray(response.body.backups)).toBe(true);
      });
    });

    describe('GET /api/backup/statistics', () => {
      it('should return backup statistics', async () => {
        const response = await request(app)
          .get('/api/backup/statistics')
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('statistics');
        expect(response.body.statistics).toHaveProperty('totalCount');
        expect(response.body.statistics).toHaveProperty('totalSize');
      });
    });

    describe('POST /api/backup/cleanup', () => {
      it('should cleanup old backups', async () => {
        const response = await request(app)
          .post('/api/backup/cleanup')
          .expect('Content-Type', /json/);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('deletedCount');
        expect(typeof response.body.deletedCount).toBe('number');
      });
    });
  });
});
