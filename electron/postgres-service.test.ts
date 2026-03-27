import { PostgresService } from './postgres-service';
import { exec } from 'child_process';

// Mock child_process module
jest.mock('child_process', () => ({
  exec: jest.fn()
}));

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn()
}));

describe('PostgresService', () => {
  let service: PostgresService;
  let mockExec: jest.MockedFunction<typeof exec>;

  beforeEach(() => {
    service = new PostgresService();
    mockExec = exec as jest.MockedFunction<typeof exec>;
    jest.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return running status when PostgreSQL is accepting connections', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const status = await service.getStatus();
      expect(status).toBe('running');
      expect(mockExec).toHaveBeenCalled();
    });

    it('should return stopped status when PostgreSQL is not accepting connections', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(new Error('Connection refused'), { stdout: '', stderr: '' });
        return {} as any;
      });

      const status = await service.getStatus();
      expect(status).toBe('stopped');
    });
  });

  describe('start', () => {
    it('should start PostgreSQL service successfully', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        if (typeof cmd === 'string' && cmd.includes('net start')) {
          callback(null, { stdout: 'Service started', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('pg_isready')) {
          callback(null, { stdout: 'accepting connections', stderr: '' });
        }
        return {} as any;
      });

      await expect(service.start()).resolves.not.toThrow();
      expect(mockExec).toHaveBeenCalledTimes(2);
    });

    it('should handle already started service gracefully', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        if (typeof cmd === 'string' && cmd.includes('net start')) {
          const error: any = new Error('The service has already been started');
          error.message = 'already been started';
          callback(error, { stdout: '', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('pg_isready')) {
          callback(null, { stdout: 'accepting connections', stderr: '' });
        }
        return {} as any;
      });

      await expect(service.start()).resolves.not.toThrow();
    });

    it('should throw error when net start fails with real error', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(new Error('Access denied'), { stdout: '', stderr: 'Access denied' });
        return {} as any;
      });

      await expect(service.start()).rejects.toThrow('Failed to start PostgreSQL');
    });

    it('should wait for PostgreSQL to be ready', async () => {
      let attempts = 0;
      mockExec.mockImplementation((cmd, callback) => {
        if (typeof cmd === 'string' && cmd.includes('net start')) {
          callback(null, { stdout: 'Service started', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('pg_isready')) {
          attempts++;
          if (attempts <= 2) {
            callback(new Error('Not ready'), { stdout: '', stderr: '' });
          } else {
            callback(null, { stdout: 'accepting connections', stderr: '' });
          }
        }
        return {} as any;
      });

      await expect(service.start()).resolves.not.toThrow();
      expect(attempts).toBeGreaterThan(1);
    });
  });

  describe('stop', () => {
    it('should stop PostgreSQL service successfully', async () => {
      mockExec.mockImplementation((cmd, callback) => {
        callback(null, { stdout: 'Service stopped', stderr: '' });
        return {} as any;
      });

      await expect(service.stop()).resolves.not.toThrow();
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('net stop'),
        expect.any(Function)
      );
    });

    it('should log error but not throw when stop fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      mockExec.mockImplementation((cmd, callback) => {
        callback(new Error('Service not found'), { stdout: '', stderr: '' });
        return {} as any;
      });

      await expect(service.stop()).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('initializeDatabase', () => {
    const fs = require('fs');

    it('should initialize database when data directory does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      mockExec.mockImplementation((cmd, callback) => {
        if (typeof cmd === 'string' && cmd.includes('initdb')) {
          callback(null, { stdout: 'Database initialized', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('net start')) {
          callback(null, { stdout: 'Service started', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('pg_isready')) {
          callback(null, { stdout: 'accepting connections', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('psql')) {
          const error: any = new Error('Database already exists');
          error.message = 'already exists';
          callback(error, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      await expect(service.initializeDatabase()).resolves.not.toThrow();
    });

    it('should skip initialization when data directory exists', async () => {
      fs.existsSync.mockReturnValue(true);
      mockExec.mockImplementation((cmd, callback) => {
        if (typeof cmd === 'string' && cmd.includes('net start')) {
          callback(null, { stdout: 'Service started', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('pg_isready')) {
          callback(null, { stdout: 'accepting connections', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('psql')) {
          const error: any = new Error('Database already exists');
          error.message = 'already exists';
          callback(error, { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      await expect(service.initializeDatabase()).resolves.not.toThrow();
    });

    it('should create database after initialization', async () => {
      fs.existsSync.mockReturnValue(true);
      mockExec.mockImplementation((cmd, callback) => {
        if (typeof cmd === 'string' && cmd.includes('net start')) {
          callback(null, { stdout: 'Service started', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('pg_isready')) {
          callback(null, { stdout: 'accepting connections', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('psql')) {
          callback(null, { stdout: 'CREATE DATABASE', stderr: '' });
        }
        return {} as any;
      });

      await expect(service.initializeDatabase()).resolves.not.toThrow();
    });

    it('should handle database creation error', async () => {
      fs.existsSync.mockReturnValue(true);
      mockExec.mockImplementation((cmd, callback) => {
        if (typeof cmd === 'string' && cmd.includes('net start')) {
          callback(null, { stdout: 'Service started', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('pg_isready')) {
          callback(null, { stdout: 'accepting connections', stderr: '' });
        } else if (typeof cmd === 'string' && cmd.includes('psql')) {
          callback(new Error('Connection failed'), { stdout: '', stderr: '' });
        }
        return {} as any;
      });

      await expect(service.initializeDatabase()).rejects.toThrow();
    });
  });
});
