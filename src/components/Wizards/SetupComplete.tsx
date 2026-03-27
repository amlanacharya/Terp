import { useState } from 'react';
import { WizardState } from '../../lib/wizard-state';

interface Props {
  data: WizardState;
  onNext: () => void;
}

export function SetupComplete({ data }: Props) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const handleCompleteSetup = async () => {
    setIsCompleting(true);
    setError('');

    try {
      // Call the setup API endpoint
      const response = await fetch('/api/settings/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyInfo: data.companyInfo,
          licenseKey: data.licenseKey,
          adminUser: data.adminUser
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Setup failed');
      }

      const result = await response.json();
      console.log('Setup completed:', result);
      setCompleted(true);

      // Redirect to dashboard after a delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'Failed to complete setup. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Setup Complete!</h3>
        <p className="text-sm text-gray-600">
          Your TravelERP Lite system is ready to use.
        </p>
      </div>

      <div className="bg-gray-50 rounded-md p-4 space-y-3">
        <h4 className="font-medium text-gray-900 text-sm">Configuration Summary</h4>
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Company:</span>
            <span className="font-medium">{data.companyInfo.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Email:</span>
            <span className="font-medium">{data.companyInfo.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Phone:</span>
            <span className="font-medium">{data.companyInfo.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Admin User:</span>
            <span className="font-medium">{data.adminUser.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Admin Email:</span>
            <span className="font-medium">{data.adminUser.email}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {completed && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-600 text-center">
            Setup completed successfully! Redirecting to dashboard...
          </p>
        </div>
      )}

      <div className="pt-4">
        <button
          onClick={handleCompleteSetup}
          disabled={isCompleting || completed}
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {isCompleting ? 'Completing Setup...' : completed ? 'Setup Complete!' : 'Start Using TravelERP Lite'}
        </button>
      </div>

      <div className="text-center text-xs text-gray-500">
        <p>You can always update these settings later from the Settings page.</p>
      </div>
    </div>
  );
}
