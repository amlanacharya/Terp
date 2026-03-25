import { useState } from 'react';

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

const STEPS: WizardStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to TravelERP Lite',
    description: 'Let\'s get your desktop ERP up and running in a few minutes.',
  },
  {
    id: 'company',
    title: 'Company Information',
    description: 'Tell us about your travel agency.',
  },
  {
    id: 'license',
    title: 'License Activation',
    description: 'Activate your product key to get started.',
  },
  {
    id: 'import',
    title: 'Data Import',
    description: 'Import existing data or start fresh.',
  },
];

interface FirstRunWizardProps {
  onComplete: () => void;
}

export function FirstRunWizard({ onComplete }: FirstRunWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const currentStep = STEPS[currentStepIndex];
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setIsCompleted(true);
    onComplete();
  };

  if (isCompleted) {
    return null; // Wizard will be unmounted
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <h1 className="text-2xl font-bold text-white">Setup Wizard</h1>
          <p className="text-blue-100 mt-1">{currentStep.title}</p>
        </div>

        {/* Progress Bar */}
        <div className="px-8 pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
            <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {currentStep.id === 'welcome' && (
            <WelcomeStep onNext={handleNext} />
          )}
          {currentStep.id === 'company' && (
            <CompanyInfoStep onNext={handleNext} onBack={handleBack} />
          )}
          {currentStep.id === 'license' && (
            <LicenseActivationStep onNext={handleNext} onBack={handleBack} />
          )}
          {currentStep.id === 'import' && (
            <DataImportChoiceStep
              onNext={handleNext}
              onBack={handleBack}
              onSkip={handleSkip}
            />
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStepIndex === 0}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Back
          </button>
          <button
            onClick={handleSkip}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full mx-auto flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-9l11 11V5h-4l-3 3h-4l3 3h-4l3-3z" />
          </svg>
        </div>
      </div>
      <h2 className="text-3xl font-bold text-gray-900 mb-4">
        Welcome to TravelERP Lite!
      </h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        The complete travel business management system for your desktop. We'll have you up and running in just a few minutes.
      </p>
      <div className="bg-blue-50 rounded-lg p-6 max-w-md mx-auto">
        <h3 className="font-semibold text-gray-900 mb-3">What we'll set up:</h3>
        <ul className="text-left text-gray-600 space-y-2">
          <li className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Your company information
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            License activation
          </li>
          <li className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Optional data import
          </li>
        </ul>
      </div>
      <button
        onClick={onNext}
        className="mt-8 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors font-semibold"
      >
        Get Started →
      </button>
    </div>
  );
}

function CompanyInfoStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [formData, setFormData] = useState({
    company_name: '',
    business_address: '',
    city: '',
    state: '',
    pin_code: '',
    gst_number: '',
    phone: '',
    email: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) newErrors.company_name = 'Company name is required';
    if (!formData.business_address.trim()) newErrors.business_address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pin_code.trim()) newErrors.pin_code = 'PIN code is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:3001/api/license/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onNext();
      } else {
        const error = await response.json();
        setErrors({ submit: error.error || 'Failed to save company information' });
      }
    } catch (error) {
      setErrors({ submit: 'Failed to connect to server. Please ensure the backend is running.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="py-4">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Company Name *
          </label>
          <input
            type="text"
            name="company_name"
            value={formData.company_name}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.company_name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g., Gayatri Travels"
          />
          {errors.company_name && (
            <p className="text-red-600 text-sm mt-1">{errors.company_name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Business Address *
          </label>
          <textarea
            name="business_address"
            value={formData.business_address}
            onChange={(e) => handleChange(e as any)}
            rows={2}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.business_address ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Street address"
          />
          {errors.business_address && (
            <p className="text-red-600 text-sm mt-1">{errors.business_address}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
            <input
              type="text"
              name="city"
              value={formData.city}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.city ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Bhubaneswar"
            />
            {errors.city && <p className="text-red-600 text-sm mt-1">{errors.city}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
            <input
              type="text"
              name="state"
              value={formData.state}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.state ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="e.g., Odisha"
            />
            {errors.state && <p className="text-red-600 text-sm mt-1">{errors.state}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN Code *</label>
            <input
              type="text"
              name="pin_code"
              value={formData.pin_code}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.pin_code ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="751001"
            />
            {errors.pin_code && <p className="text-red-600 text-sm mt-1">{errors.pin_code}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
            <input
              type="text"
              name="gst_number"
              value={formData.gst_number}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.phone ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="+91 98765 43210"
            />
            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="contact@company.com"
          />
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
        </div>

        {errors.submit && <p className="text-red-600 text-sm">{errors.submit}</p>}

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Next →'}
          </button>
        </div>
      </div>
    </form>
  );
}

function LicenseActivationStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [productKey, setProductKey] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const formatKey = (value: string) => {
    // Remove all non-alphanumeric chars
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    // Add dashes every 4 chars
    return cleaned.replace(/(.{4})/g, '$1-').replace(/-$/, '').substring(0, 19);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatKey(e.target.value);
    setProductKey(formatted);
    setError('');
  };

  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();

    if (productKey.length !== 19) {
      setError('Please enter a valid 16-digit product key');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productKey }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        setTimeout(() => onNext(), 1500);
      } else {
        setError(data.error || 'License activation failed');
      }
    } catch (err) {
      setError('Failed to connect to server. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-4">
      {success ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">License Activated!</h3>
          <p className="text-gray-600">Your product key has been successfully activated.</p>
        </div>
      ) : (
        <>
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.943 11.967 11.967 11.967 11.967 5.943 11.967 11.967 11.967 2-9.535 13.535-13.535 13.535A2 2 0 0115 7z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Enter Your Product Key</h3>
            <p className="text-gray-600">
              Your product key should be in the format: GT01-XXXX-XXXX-XXXX-XXXX
            </p>
          </div>

          <form onSubmit={handleActivation}>
            <div className="mb-4">
              <input
                type="text"
                value={productKey}
                onChange={handleChange}
                placeholder="GT01-XXXX-XXXX-XXXX-XXXX"
                className={`w-full px-4 py-3 border rounded-lg text-center text-lg font-mono tracking-wider focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  error ? 'border-red-500' : 'border-gray-300'
                }`}
                style={{ letterSpacing: '2px' }}
              />
              {error && (
                <p className="text-red-600 text-sm mt-2">{error}</p>
              )}
            </div>

            {isLoading ? (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 mt-2">Activating...</p>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={productKey.length !== 19}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Activate License →
                </button>
              </div>
            )}
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Need a product key?</strong> Contact Intelligrip support or check your purchase confirmation email.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function DataImportChoiceStep({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="py-4">
      <div className="text-center mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-2">Import Your Data</h3>
        <p className="text-gray-600">
          You can import existing data now, start fresh, or do it later from Settings.
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={onNext}
          className="w-full p-6 border-2 border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-left"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M1 9h6M11 9h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2zm2-10h7.5" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Yes, Import Data</h4>
              <p className="text-sm text-gray-600">
                Import customers, vehicles, rate charts, and more from Excel, CSV, or JSON
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={onSkip}
          className="w-full p-6 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m5.5-4.5L8 8 8.5 8.5" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Start Fresh</h4>
              <p className="text-sm text-gray-600">
                Begin with an empty database and add data manually
              </p>
            </div>
          </div>
        </button>

        <button
          onClick={onSkip}
          className="w-full p-6 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-start">
            <div className="flex-shrink-0 mr-4">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-1">Do It Later</h4>
              <p className="text-sm text-gray-600">
                Skip for now and import data later from Settings
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
