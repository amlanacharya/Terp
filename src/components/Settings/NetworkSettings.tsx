import { useState, useEffect } from 'react';

type NetworkMode = 'standalone' | 'server' | 'client';

interface NetworkConfig {
  mode: NetworkMode;
  serverAddress?: string;
  serverPort?: number;
  allowRemoteConnections?: boolean;
  maxConnections?: number;
}

interface NetworkStatus {
  mode: NetworkMode;
  isRunning: boolean;
  serverAddress?: string;
  connectedClients?: number;
  uptime?: number;
  error?: string;
}

interface ServerInfo {
  address: string;
  port: number;
  reachable: boolean;
}

export function NetworkSettings() {
  const [config, setConfig] = useState<NetworkConfig>({ mode: 'standalone' });
  const [status, setStatus] = useState<NetworkStatus>({ mode: 'standalone', isRunning: true });
  const [localIPs, setLocalIPs] = useState<string[]>([]);
  const [hostname, setHostname] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<ServerInfo | null>(null);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Form state for client mode
  const [clientAddress, setClientAddress] = useState('');
  const [clientPort, setClientPort] = useState(5433);

  // Form state for server mode
  const [allowRemote, setAllowRemote] = useState(false);
  const [maxConnections, setMaxConnections] = useState(10);

  useEffect(() => {
    loadConfig();
    loadStatus();
    loadLocalNetworkInfo();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/network/config');
      const data = await response.json();
      setConfig(data);
      setClientAddress(data.serverAddress || '');
      setClientPort(data.serverPort || 5433);
      setAllowRemote(data.allowRemoteConnections || false);
      setMaxConnections(data.maxConnections || 10);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/network/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const loadLocalNetworkInfo = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/network/local-ips');
      const data = await response.json();
      setLocalIPs(data.ips);
      setHostname(data.hostname);
    } catch (error) {
      console.error('Failed to load local network info:', error);
    }
  };

  const handleModeChange = async (mode: NetworkMode) => {
    setError('');
    setSuccessMessage('');

    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:3001/api/network/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });

      if (response.ok) {
        const newConfig = await response.json();
        setConfig(newConfig);
        setSuccessMessage(`Switched to ${mode} mode`);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to change mode');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsSaving(false);
      loadStatus();
    }
  };

  const handleStartServer = async () => {
    setError('');
    setSuccessMessage('');
    setIsStarting(true);

    try {
      const response = await fetch('http://localhost:3001/api/network/start-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowRemoteConnections: allowRemote,
          maxConnections: maxConnections,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus(data.status);
        setSuccessMessage('Server started successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to start server');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsStarting(false);
      loadStatus();
    }
  };

  const handleStopServer = async () => {
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('http://localhost:3001/api/network/stop-server', {
        method: 'POST',
      });

      if (response.ok) {
        setSuccessMessage('Server stopped successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
        loadStatus();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to stop server');
      }
    } catch (error) {
      setError('Failed to connect to server');
    }
  };

  const handleConnectToServer = async () => {
    setError('');
    setSuccessMessage('');
    setIsStarting(true);

    try {
      const response = await fetch('http://localhost:3001/api/network/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverAddress: clientAddress,
          serverPort: clientPort,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setError(error.error || 'Failed to update config');
        setIsStarting(false);
        return;
      }

      const connectResponse = await fetch('http://localhost:3001/api/network/connect', {
        method: 'POST',
      });

      if (connectResponse.ok) {
        const data = await connectResponse.json();
        setStatus(data.status);
        setSuccessMessage('Connected to server successfully');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const error = await connectResponse.json();
        setError(error.error || 'Failed to connect to server');
      }
    } catch (error) {
      setError('Failed to connect to server');
    } finally {
      setIsStarting(false);
      loadStatus();
    }
  };

  const handleDisconnect = async () => {
    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('http://localhost:3001/api/network/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setSuccessMessage('Disconnected from server');
        setTimeout(() => setSuccessMessage(''), 3000);
        loadStatus();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to disconnect');
      }
    } catch (error) {
      setError('Failed to connect to server');
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/network/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: clientAddress,
          port: clientPort,
        }),
      });

      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setError('Failed to test connection');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleResetToStandalone = async () => {
    if (!confirm('This will stop the server or disconnect from remote server. Continue?')) {
      return;
    }

    setError('');
    setSuccessMessage('');

    try {
      const response = await fetch('http://localhost:3001/api/network/reset', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setSuccessMessage('Reset to standalone mode');
        setTimeout(() => setSuccessMessage(''), 3000);
        loadStatus();
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to reset');
      }
    } catch (error) {
      setError('Failed to connect to server');
    }
  };

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Network Settings</h2>
        <p className="text-gray-600 mt-1">
          Configure multi-user mode for network access
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

      {/* Current Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-blue-900">Current Mode</div>
            <div className="text-2xl font-bold text-blue-600 capitalize mt-1">
              {status.mode}
            </div>
            {status.mode === 'server' && status.isRunning && (
              <div className="text-sm text-blue-700 mt-2">
                {status.connectedClients} clients connected · Up {status.uptime ? formatUptime(status.uptime) : '0s'}
              </div>
            )}
            {status.mode === 'client' && status.isRunning && (
              <div className="text-sm text-blue-700 mt-2">
                Connected to {status.serverAddress}
              </div>
            )}
          </div>
          <div className="flex items-center">
            {status.isRunning ? (
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                <span className="text-green-700 font-medium">Running</span>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                <span className="text-gray-600 font-medium">Stopped</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mode Selection */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Network Mode</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Standalone */}
          <button
            onClick={() => handleModeChange('standalone')}
            disabled={isSaving}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              config.mode === 'standalone'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="font-semibold text-gray-900">Standalone</span>
            </div>
            <p className="text-sm text-gray-600">
              Single-user mode with local database
            </p>
          </button>

          {/* Server */}
          <button
            onClick={() => handleModeChange('server')}
            disabled={isSaving}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              config.mode === 'server'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <span className="font-semibold text-gray-900">Server</span>
            </div>
            <p className="text-sm text-gray-600">
              Host database for multiple clients
            </p>
          </button>

          {/* Client */}
          <button
            onClick={() => handleModeChange('client')}
            disabled={isSaving}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              config.mode === 'client'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center mb-2">
              <svg className="w-6 h-6 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
              <span className="font-semibold text-gray-900">Client</span>
            </div>
            <p className="text-sm text-gray-600">
              Connect to remote server database
            </p>
          </button>
        </div>
      </div>

      {/* Server Mode Configuration */}
      {config.mode === 'server' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Server Configuration</h3>

          <div className="space-y-4">
            {/* Allow Remote Connections */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Allow Remote Connections</div>
                <div className="text-sm text-gray-600">
                  Enable access from other computers on the network
                </div>
              </div>
              <button
                onClick={() => setAllowRemote(!allowRemote)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  allowRemote ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    allowRemote ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Max Connections */}
            <div>
              <label className="block font-medium text-gray-900 mb-1">
                Maximum Connections
              </label>
              <input
                type="number"
                value={maxConnections}
                onChange={(e) => setMaxConnections(parseInt(e.target.value))}
                min={1}
                max={100}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Server Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="font-medium text-gray-900 mb-2">Server Information</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Hostname:</span>
                  <span className="font-mono text-gray-900">{hostname}</span>
                </div>
                {localIPs.map((ip) => (
                  <div key={ip} className="flex justify-between">
                    <span className="text-gray-600">IP Address:</span>
                    <span className="font-mono text-gray-900">{ip}</span>
                  </div>
                ))}
                <div className="flex justify-between">
                  <span className="text-gray-600">Port:</span>
                  <span className="font-mono text-gray-900">5433</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              {status.isRunning ? (
                <button
                  onClick={handleStopServer}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Stop Server
                </button>
              ) : (
                <button
                  onClick={handleStartServer}
                  disabled={isStarting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isStarting ? 'Starting...' : 'Start Server'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Client Mode Configuration */}
      {config.mode === 'client' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Server Connection</h3>

          <div className="space-y-4">
            {/* Server Address */}
            <div>
              <label className="block font-medium text-gray-900 mb-1">
                Server Address
              </label>
              <input
                type="text"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="e.g., 192.168.1.100 or server-name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Server Port */}
            <div>
              <label className="block font-medium text-gray-900 mb-1">
                Server Port
              </label>
              <input
                type="number"
                value={clientPort}
                onChange={(e) => setClientPort(parseInt(e.target.value))}
                min={1}
                max={65535}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Test Connection */}
            <button
              onClick={handleTestConnection}
              disabled={isTestingConnection || !clientAddress}
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {isTestingConnection ? 'Testing...' : 'Test Connection'}
            </button>

            {/* Test Result */}
            {testResult && (
              <div className={`p-4 rounded-lg ${
                testResult.reachable ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center">
                  {testResult.reachable ? (
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  <span className={testResult.reachable ? 'text-green-900' : 'text-red-900'}>
                    {testResult.reachable ? 'Connection successful!' : 'Connection failed'}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              {status.isRunning ? (
                <button
                  onClick={handleDisconnect}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectToServer}
                  disabled={isStarting || !clientAddress}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isStarting ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      {(config.mode === 'server' || config.mode === 'client') && (
        <div className="flex justify-end">
          <button
            onClick={handleResetToStandalone}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset to Standalone
          </button>
        </div>
      )}
    </div>
  );
}
