import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FirstRunWizard } from '../FirstRunWizard';
import { createMockFetch, mockApiResponses } from '../../../test/setup';

describe('FirstRunWizard Component', () => {
  const onCompleteMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock 404 to show wizard (no company settings)
    createMockFetch({ status: 404 }, 404);
  });

  it('should render welcome screen on first load', async () => {
    render(<FirstRunWizard onComplete={onCompleteMock} />);

    await waitFor(() => {
      expect(screen.getByText(/Welcome to TravelERP Lite!/i)).toBeInTheDocument();
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument();
    });
  });

  it('should show progress indicator', async () => {
    render(<FirstRunWizard onComplete={onCompleteMock} />);

    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
      expect(screen.getByText(/25%/i)).toBeInTheDocument();
    });
  });

  it('should have disabled Back button on first step', async () => {
    render(<FirstRunWizard onComplete={onCompleteMock} />);

    await waitFor(() => {
      const backButton = screen.getByRole('button', { name: /Back/i });
      expect(backButton).toBeDisabled();
    });
  });

  it('should have Skip button available', async () => {
    render(<FirstRunWizard onComplete={onCompleteMock} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Skip/i })).toBeInTheDocument();
    });
  });

  it('should navigate to company info step', async () => {
    const user = userEvent.setup();
    render(<FirstRunWizard onComplete={onCompleteMock} />);

    await waitFor(async () => {
      const nextButton = screen.getByRole('button', { name: /Get Started/i });
      await user.click(nextButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Company Information/i)).toBeInTheDocument();
    });
  });

  it('should call onComplete when wizard is skipped', async () => {
    const user = userEvent.setup();
    render(<FirstRunWizard onComplete={onCompleteMock} />);

    await waitFor(async () => {
      const skipButton = screen.getByRole('button', { name: /Skip/i });
      await user.click(skipButton);
    });

    await waitFor(() => {
      expect(onCompleteMock).toHaveBeenCalled();
    });
  });

  it('should not render when completed', async () => {
    const { rerender } = render(<FirstRunWizard onComplete={onCompleteMock} />);

    // Complete the wizard
    await waitFor(async () => {
      const skipButton = screen.getByRole('button', { name: /Skip/i });
      await userEvent.click(skipButton);
    });

    await waitFor(() => {
      expect(onCompleteMock).toHaveBeenCalled();
    });

    // Component should return null (unmounted)
    rerender(<FirstRunWizard onComplete={onCompleteMock} />);

    // Should not show anything
    expect(screen.queryByText(/Welcome to TravelERP Lite!/i)).not.toBeInTheDocument();
  });
});

describe('FirstRunWizard - Company Form', () => {
  const onCompleteMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    createMockFetch({ status: 404 }, 404);
  });

  it('should show company info form fields', async () => {
    const user = userEvent.setup();
    render(<FirstRunWizard onComplete={onCompleteMock} />);

    // Navigate to company step
    await waitFor(async () => {
      const nextButton = screen.getByRole('button', { name: /Get Started/i });
      await user.click(nextButton);
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Business Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/City/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/State/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/PIN Code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    });
  });

  it('should validate company name is required', async () => {
    const user = userEvent.setup();
    render(<FirstRunWizard onComplete={onCompleteMock} />);

    await waitFor(async () => {
      const nextButton = screen.getByRole('button', { name: /Get Started/i });
      await user.click(nextButton);
    });

    // Try to submit without filling
    const nextButton = screen.getByRole('button', { name: /Next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Company name is required/i)).toBeInTheDocument();
    });
  });
});
