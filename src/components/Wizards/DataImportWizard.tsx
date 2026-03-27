import { useState } from 'react';
import { ExcelImport } from './ExcelImport';
import { SetupComplete } from './SetupComplete';

export function DataImportWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [importData, setImportData] = useState<any>(null);

  const steps = [
    { component: ExcelImport, title: 'Import Data' },
    { component: SetupComplete, title: 'Setup Complete' }
  ];

  const CurrentStep = steps[currentStep].component;

  const handleNext = (data?: any) => {
    if (data) {
      setImportData(data);
    }
    setCurrentStep(prev => prev + 1);
  };

  const handleSkip = () => {
    // Skip import and go to completion
    handleNext({ skipped: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center px-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-semibold ${
                  index < currentStep
                    ? 'bg-green-500 text-white'
                    : index === currentStep
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {index < currentStep ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-2 ${
                    index < currentStep ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <h2 className="text-center mt-4 text-xl font-semibold text-gray-900">
            {steps[currentStep].title}
          </h2>
          <p className="text-center mt-1 text-sm text-gray-600">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>

        {/* Current step */}
        {currentStep === 0 ? (
          <ExcelImport onNext={handleNext} onSkip={handleSkip} />
        ) : (
          <SetupComplete data={importData} onNext={() => window.location.reload()} />
        )}
      </div>
    </div>
  );
}
