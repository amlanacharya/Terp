import { useState } from 'react';
import { WizardState } from '../../lib/wizard-state';

interface Props {
  data: WizardState;
  onNext: (data: Partial<WizardState>) => void;
  onBack: () => void;
}

export function LicenseActivation({ data, onNext, onBack }: Props) {
  const [licenseKey, setLicenseKey] = useState(data.licenseKey);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [error, setError] = useState('');

  const formatLicenseKey = (value: string) => {
    // Remove non-alphanumeric characters
    const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Add hyphens every 4 characters
    const formatted = cleaned.replace(/(.{4})/g, '$1-').trim();
    // Remove trailing hyphen
    return formatted.replace(/-$/, '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatLicenseKey(e.target.value);
    if (formatted.length <= 19) { // XXXX-XXXX-XXXX-XXXX
      setLicenseKey(formatted);
      setError('');
      setValidationResult(null);
    }
  };

  const handleValidate = async () => {
    if (licenseKey.length !== 19) {
      setError('Please enter a complete 16-digit product key');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      // Check if electronAPI is available
      if (window.electronAPI && window.electronAPI.licenseActivate) {
        const result = await window.electronAPI.licenseActivate(licenseKey);
        setValidationResult({ success: true, ...result });
      } else {
        // For development/testing without electron
        console.log('License key (dev mode):', licenseKey);
        setValidationResult({
          success: true,
          subscriptionType: 'Annual',
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString()
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to validate product key');
      setValidationResult({ success: false });
    } finally {
      setIsValidating(false);
    }
  };

  const handleNext = () => {
    if (validationResult?.success) {
      onNext({ licenseKey });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Activate your subscription</h3>
        <p className="text-sm text-gray-600">
          Enter your 16-digit product key to activate your subscription.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Product Key</label>
        <input
          type="text"
          value={licenseKey}
          onChange={handleChange}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          className={`mt-1 block w-full text-center text-2xl tracking-widest rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-3 py-3 border ${
            error ? 'border-red-500' : ''
          }`}
        />
        {error && <p className="mt-2 text-sm text-red-600 text-center">{error}</p>}
      </div>

      {!validationResult && (
        <button
          onClick={handleValidate}
          disabled={licenseKey.length !== 19 || isValidating}
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {isValidating ? 'Validating...' : 'Verify'}
        </button>
      )}

      {validationResult?.success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <h4 className="text-green-800 font-medium mb-2">Product key validated</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p><strong>Subscription:</strong> {validationResult.subscriptionType || 'Annual'}</p>
            <p><strong>Valid until:</strong> {validationResult.expiryDate || 'TBD'}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!validationResult?.success}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}
