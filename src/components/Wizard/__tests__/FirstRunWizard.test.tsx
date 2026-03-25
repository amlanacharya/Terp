import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FirstRunWizard } from '../Wizard/FirstRunWizard';
import { mockFetch, mockApiResponses } from '../../mocks/fetch';

describe('FirstRunWizard', () => {
  const onCompleteMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setupCommonMocks();
  });

  afterEach(() => {
    mockFetch.reset();
  });

  function setupCommonMocks() {
    // Mock company settings check (404 to show wizard)
    mockFetch.response({ status: 404 }, 404);
  }

  describe('Welcome Step', () => {
    it('should render welcome screen', async () => {
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to TravelERP Lite!')).toBeInTheDocument();
      });
    });

    it('should show feature overview', async () => {
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(() => {
        expect(screen.getByText(/Your company information/i)).toBeInTheDocument();
        expect(screen.getByText(/License activation/i)).toBeInTheDocument();
        expect(screen.getByText(/Optional data import/i)).toBeInTheDocument();
      });
    });

    it('should navigate to next step on Get Started button', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /Get Started/i });
      });

      const button = screen.getByRole('button', { name: /Get Started/i });
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Company Information/i)).toBeInTheDocument();
      });
    });

    it('should show correct step indicator', async () => {
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(() => {
        expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
        expect(screen.getByText(/25%/i)).toBeInTheDocument();
      });
    });
  });

  describe('Company Info Step', () => {
    it('should render company form', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      // Navigate to company step
      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
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

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      // Navigate to company step
      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
      });

      // Try to submit without filling form - click Next button
      const nextButton = screen.getByRole('button', { name: /Next/i });
      await user.click(nextButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/Company name is required/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
      });

      const emailInput = screen.getByLabelText(/Email/i);
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      const nextButton = screen.getByRole('button', { name: /Next/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/Invalid email format/i)).toBeInTheDocument();
      });
    });

    it('should submit company information', async () => {
      const user = userEvent.setup();
      mockFetch.response({ success: true });

      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
      });

      // Fill form
      await user.type(screen.getByLabelText(/Company Name/i), 'Test Company');
      await user.type(screen.getByLabelText(/Business Address/i), '123 Test Street');
      await user.type(screen.getByLabelText(/City/i), 'Test City');
      await user.type(screen.getByLabelText(/State/i), 'Test State');
      await user.type(screen.getByLabelText(/PIN Code/i), '123456');
      await user.type(screen.getByLabelText(/Phone/i), '+91 98765 43210');
      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');

      // Submit
      const nextButton = screen.getByRole('button', { name: /Next/i });
      await user.click(nextButton);

      // Should navigate to license step
      await waitFor(() => {
        expect(screen.getByText(/License Activation/i)).toBeInTheDocument();
      });
    });
  });

  describe('License Activation Step', () => {
    it('should render license activation form', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      // Navigate through first two steps
      await waitFor(async () => {
        let button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
      });

      // Skip company info step by filling required fields
      await waitFor(async () => {
        await user.type(screen.getByLabelText(/Company Name/i), 'Test Company');
        await user.type(screen.getByLabelText(/Business Address/i), '123 Test Street');
        await user.type(screen.getByLabelText(/City/i), 'Test City');
        await user.type(screen.getByLabelText(/State/i), 'Test State');
        await user.type(screen.getByLabelText(/PIN Code/i), '123456');
        await user.type(screen.getByLabelText(/Phone/i), '+91 98765 43210');
        await user.type(screen.getByLabelText(/Email/i), 'test@example.com');

        const nextButton = screen.getByRole('button', { name: /Next/i });
        await user.click(nextButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Enter Your Product Key/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/GT01-XXXX-XXXX-XXXX-XXXX/i)).toBeInTheDocument();
      });
    });

    it('should auto-format product key', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      // Navigate to license step (simplified)
      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
      });

      // Skip to license step
      // ...navigation code would go here...

      // Test auto-formatting
      const input = screen.getByPlaceholderText(/GT01-XXXX-XXXX-XXXX-XXXX/i);
      await user.type(input, 'GT0112345678901234');

      // Should be auto-formatted with dashes
      await waitFor(() => {
        expect(input).toHaveValue('GT01-1234-5678-9012-34');
      });
    });

    it('should show success on valid activation', async () => {
      const user = userEvent.setup();
      mockFetch.response({
        success: true,
        license: { product_key: 'GT01-1234-5678-9012-34' },
        message: 'License activated successfully',
      });

      // ...navigate to license step...

      const input = screen.getByPlaceholderText(/GT01-XXXX-XXXX-XXXX-XXXX/i);
      const activateButton = screen.getByRole('button', { name: /Activate License/i });

      await user.clear(input);
      await user.type(input, 'GT01-1234-5678-9012-34');
      await user.click(activateButton);

      await waitFor(() => {
        expect(screen.getByText(/License Activated/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Import Step', () => {
    it('should render import options', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      // Navigate to import step (would need to go through previous steps)

      await waitFor(() => {
        expect(screen.getByText(/Import Your Data/i)).toBeInTheDocument();
        expect(screen.getByText(/Yes, Import Data/i)).toBeInTheDocument();
        expect(screen.getByText(/Start Fresh/i)).toBeInTheDocument();
        expect(screen.getByText(/Do It Later/i)).toBeInTheDocument();
      });
    });

    it('should call onComplete when skipping import', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      // Navigate to import step

      await waitFor(async () => {
        const skipButton = screen.getByRole('button', { name: /Start Fresh/i });
        await user.click(skipButton);
      });

      await waitFor(() => {
        expect(onCompleteMock).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    it('should show Back button disabled on first step', async () => {
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /← Back/i });
        expect(backButton).toBeDisabled();
      });
    });

    it('should enable Back button on subsequent steps', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
      });

      await waitFor(() => {
        const backButton = screen.getByRole('button', { name: /← Back/i });
        expect(backButton).not.toBeDisabled();
      });
    });

    it('should navigate back to previous step', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
      });

      await waitFor(async () => {
        const backButton = screen.getByRole('button', { name: /← Back/i });
        await user.click(backButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Welcome to TravelERP Lite!/)).toBeInTheDocument();
      });
    });

    it('should have Skip button available', async () => {
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Skip/i })).toBeInTheDocument();
      });
    });
  });

  describe('Progress Bar', () => {
    it('should show correct progress for each step', async () => {
      const user = userEvent.setup();
      render(<FirstRunWizard onComplete={onCompleteMock} />);

      // Step 1
      await waitFor(() => {
        expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
        expect(screen.getByText(/25%/i)).toBeInTheDocument();
      });

      // Step 2
      await waitFor(async () => {
        const button = screen.getByRole('button', { name: /Get Started/i });
        await user.click(button);
      });

      await waitFor(() => {
        expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
        expect(screen.getByText(/50%/i)).toBeInTheDocument();
      });
    });
  });
});
