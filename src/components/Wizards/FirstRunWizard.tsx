import { useState } from 'react';
import { WizardState, initialWizardState } from '../../lib/wizard-state';
import { CompanySetup } from './CompanySetup';
import { LicenseActivation } from './LicenseActivation';
import { AdminUserSetup } from './AdminUserSetup';
import { SetupComplete } from './SetupComplete';

export function FirstRunWizard() {
  const [wizardState, setWizardState] = useState<WizardState>(initialWizardState);

  const steps = [
    { component: CompanySetup, title: 'Company Information' },
    { component: LicenseActivation, title: 'License Activation' },
    { component: AdminUserSetup, title: 'Admin User' },
    { component: SetupComplete, title: 'Setup Complete' }
  ];

  const CurrentStep = steps[wizardState.currentStep].component;

  const handleNext = (data: Partial<WizardState>) => {
    setWizardState(prev => ({
      ...prev,
      ...data,
      currentStep: prev.currentStep + 1
    }));
  };

  const handleBack = () => {
    setWizardState(prev => ({
      ...prev,
      currentStep: prev.currentStep - 1
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center px-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold ${
                  index < wizardState.currentStep
                    ? 'bg-green-500 text-white'
                    : index === wizardState.currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {index < wizardState.currentStep ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    index < wizardState.currentStep ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-center mt-4 text-xl font-semibold text-gray-900">
            {steps[wizardState.currentStep].title}
          </h2>
          <p className="text-center mt-1 text-sm text-gray-600">
            Step {wizardState.currentStep + 1} of {steps.length}
          </p>
        </div>

        {/* Current step */}
        <CurrentStep
          data={wizardState}
          onNext={handleNext}
          onBack={handleBack}
        />
      </div>
    </div>
  );
}
