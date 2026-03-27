import { Router } from 'express';
import { getNetworkConfigService } from '../network/config.js';
import { getNetworkManager } from '../network/manager.js';

const router = Router();

/**
 * GET /api/network/status
 * Get current network status
 */
router.get('/status', async (req, res) => {
  try {
    const networkManager = getNetworkManager();
    const status = await networkManager.getStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Get network status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/network/config
 * Get network configuration
 */
router.get('/config', async (req, res) => {
  try {
    const configService = getNetworkConfigService();
    const config = configService.getConfig();
    res.json(config);
  } catch (error: any) {
    console.error('Get network config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/network/config
 * Update network configuration
 */
router.put('/config', async (req, res) => {
  try {
    const configService = getNetworkConfigService();

    // Validate mode
    const { mode } = req.body;
    if (mode && !['standalone', 'server', 'client'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be standalone, server, or client' });
    }

    // Validate server address for client mode
    if (mode === 'client') {
      const { serverAddress } = req.body;
      if (!serverAddress) {
        return res.status(400).json({ error: 'serverAddress is required for client mode' });
      }
      if (!configService.validateServerAddress(serverAddress)) {
        return res.status(400).json({ error: 'Invalid server address' });
      }
    }

    // Validate port
    const { serverPort } = req.body;
    if (serverPort && !configService.validatePort(serverPort)) {
      return res.status(400).json({ error: 'Invalid port number' });
    }

    const updatedConfig = configService.updateConfig(req.body);
    res.json(updatedConfig);
  } catch (error: any) {
    console.error('Update network config error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/network/start-server
 * Start network server
 */
router.post('/start-server', async (req, res) => {
  try {
    const networkManager = getNetworkManager();
    const success = await networkManager.startServer();

    if (success) {
      const status = await networkManager.getStatus();
      res.json({ success: true, status });
    } else {
      res.status(500).json({ error: 'Failed to start server' });
    }
  } catch (error: any) {
    console.error('Start server error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/network/stop-server
 * Stop network server
 */
router.post('/stop-server', async (req, res) => {
  try {
    const networkManager = getNetworkManager();
    const success = await networkManager.stopServer();

    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to stop server' });
    }
  } catch (error: any) {
    console.error('Stop server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/network/connect
 * Connect to remote server (client mode)
 */
router.post('/connect', async (req, res) => {
  try {
    const networkManager = getNetworkManager();
    const success = await networkManager.connectToServer();

    if (success) {
      const status = await networkManager.getStatus();
      res.json({ success: true, status });
    } else {
      res.status(500).json({ error: 'Failed to connect to server' });
    }
  } catch (error: any) {
    console.error('Connect to server error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

/**
 * POST /api/network/disconnect
 * Disconnect from server
 */
router.post('/disconnect', async (req, res) => {
  try {
    const networkManager = getNetworkManager();
    const success = await networkManager.disconnectFromServer();

    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to disconnect from server' });
    }
  } catch (error: any) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/network/local-ips
 * Get local IP addresses
 */
router.get('/local-ips', async (req, res) => {
  try {
    const configService = getNetworkConfigService();
    const ips = configService.getLocalIPs();
    const hostname = configService.getHostname();

    res.json({
      hostname,
      ips,
    });
  } catch (error: any) {
    console.error('Get local IPs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/network/test-connection
 * Test connectivity to a server
 */
router.post('/test-connection', async (req, res) => {
  try {
    const { address, port } = req.body;

    if (!address || !port) {
      return res.status(400).json({ error: 'address and port are required' });
    }

    const networkManager = getNetworkManager();
    const reachable = await networkManager.testConnectivity(address, port);

    res.json({
      address,
      port,
      reachable,
    });
  } catch (error: any) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/network/discover
 * Discover servers on local network
 */
router.get('/discover', async (req, res) => {
  try {
    const networkManager = getNetworkManager();
    const servers = await networkManager.discoverServers();

    res.json({
      servers,
      count: servers.length,
    });
  } catch (error: any) {
    console.error('Discover servers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/network/reset
 * Reset to standalone mode
 */
router.post('/reset', async (req, res) => {
  try {
    const configService = getNetworkConfigService();
    const networkManager = getNetworkManager();

    // Stop server or disconnect
    const currentConfig = configService.getConfig();
    if (currentConfig.mode === 'server') {
      await networkManager.stopServer();
    } else if (currentConfig.mode === 'client') {
      await networkManager.disconnectFromServer();
    }

    // Reset to standalone
    const newConfig = configService.resetToStandalone();

    res.json({
      success: true,
      config: newConfig,
    });
  } catch (error: any) {
    console.error('Reset network error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
