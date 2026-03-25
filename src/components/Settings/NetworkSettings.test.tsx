import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetworkSettings } from '../NetworkSettings';
import { createMockFetch, mockApiResponses } from '../../../test/setup';

describe('NetworkSettings Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render network status display', async () => {
    createMockFetch(mockApiResponses.networkStatus);
    createMockFetch(mockApiResponses.networkConfig);
    createMockFetch(mockApiResponses.localIPs);

    render(<NetworkSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Network Settings/i)).toBeInTheDocument();
      expect(screen.getByText(/Current Mode/i)).toBeInTheDocument();
    });
  });

  it('should display mode selection buttons', async () => {
    createMockFetch(mockApiResponses.networkStatus);
    createMockFetch(mockApiResponses.networkConfig);
    createMockFetch(mockApiResponses.localIPs);

    render(<NetworkSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Standalone/i)).toBeInTheDocument();
      expect(screen.getByText(/Server/i)).toBeInTheDocument();
      expect(screen.getByText(/Client/i)).toBeInTheDocument();
    });
  });

  it('should show server configuration in server mode', async () => {
    const user = userEvent.setup();

    // Mock initial config load
    createMockFetch(mockApiResponses.networkStatus);
    createMockFetch(mockApiResponses.networkConfig);
    createMockFetch(mockApiResponses.localIPs);

    render(<NetworkSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Current Mode/i)).toBeInTheDocument();
    });

    // Mock mode change response
    createMockFetch({ mode: 'server' });

    await waitFor(async () => {
      const serverButton = screen.getByText(/Server/);
      await user.click(serverButton);
    });

    // Should show server configuration
    await waitFor(() => {
      expect(screen.getByText(/Server Configuration/i)).toBeInTheDocument();
    });
  });

  it('should display local IPs', async () => {
    createMockFetch(mockApiResponses.networkStatus);
    createMockFetch(mockApiResponses.networkConfig);
    createMockFetch(mockApiResponses.localIPs);

    render(<NetworkSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Hostname/i)).toBeInTheDocument();
      expect(screen.getByText(/IP Address/i)).toBeInTheDocument();
    });
  });

  it('should handle mode switching', async () => {
    const user = userEvent.setup();

    createMockFetch(mockApiResponses.networkStatus);
    createMockFetch(mockApiResponses.networkConfig);
    createMockFetch(mockApiResponses.localIPs);

    render(<NetworkSettings />);

    await waitFor(async () => {
      const serverButton = screen.getByText(/Server/);
      await user.click(serverButton);
    });
  });
});
