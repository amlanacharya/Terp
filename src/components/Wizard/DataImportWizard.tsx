import { useState } from 'react';

interface DataImportWizardProps {
  onComplete: () => void;
  onCancel: () => void;
}

interface ImportProgress {
  stage: 'uploading' | 'parsing' | 'validating' | 'importing' | 'completed' | 'failed';
  progress: number;
  message: string;
  imported: {
    customers: number;
    vehicles: number;
    drivers: number;
    owners: number;
    rateCharts: number;
  };
  errors: string[];
  warnings: string[];
}

type ImportStep = 'select-file' | 'validate' | 'progress' | 'complete';

export function DataImportWizard({ onComplete, onCancel }: DataImportWizardProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>('select-file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'excel' | 'csv' | 'json'>('excel');
  const [entityType, setEntityType] = useState<string>('customers');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);

      // Auto-detect file type
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext === 'xlsx' || ext === 'xls') {
        setFileType('excel');
      } else if (ext === 'csv') {
        setFileType('csv');
      } else if (ext === 'json') {
        setFileType('json');
      }
    }
  };

  const handleValidate = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('type', fileType);
    if (fileType === 'csv') {
      formData.append('entityType', entityType);
    }

    try {
      const response = await fetch('http://localhost:3001/api/import/validate', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setValidationResult(result);
        setCurrentStep('validate');
      } else {
        alert(`Validation failed:\n${result.errors.join('\n')}`);
      }
    } catch (error: any) {
      alert(`Validation failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setCurrentStep('progress');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('type', fileType);
    if (fileType === 'csv') {
      formData.append('entityType', entityType);
    }

    try {
      const response = await fetch('http://localhost:3001/api/import/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setImportProgress({
          stage: 'completed',
          progress: 100,
          message: result.message,
          imported: result.imported,
          errors: [],
          warnings: result.warnings || [],
        });
        setCurrentStep('complete');
      } else {
        setImportProgress({
          stage: 'failed',
          progress: 0,
          message: result.message,
          imported: { customers: 0, vehicles: 0, drivers: 0, owners: 0, rateCharts: 0 },
          errors: result.errors || [],
          warnings: result.warnings || [],
        });
        setCurrentStep('complete');
      }
    } catch (error: any) {
      setImportProgress({
        stage: 'failed',
        progress: 0,
        message: error.message,
        imported: { customers: 0, vehicles: 0, drivers: 0, owners: 0, rateCharts: 0 },
        errors: [error.message],
        warnings: [],
      });
      setCurrentStep('complete');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/import/template/${entityType}`);
      const result = await response.json();

      if (result.success) {
        // Create CSV blob
        const headers = Object.keys(result.template[0]);
        const csvContent = [
          headers.join(','),
          ...result.template.map((row: any) =>
            headers.map((header) => {
              const value = String(row[header] ?? '');
              // Escape quotes and wrap in quotes if contains comma
              if (value.includes(',') || value.includes('"')) {
                return `"${value.replace(/"/g, '""')}"`;
              }
              return value;
            }).join(',')
          ),
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entityType}-template.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      alert(`Failed to download template: ${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Import Data</h1>
              <p className="text-blue-100 mt-1">
                {currentStep === 'select-file' && 'Select a file to import'}
                {currentStep === 'validate' && 'Review validation results'}
                {currentStep === 'progress' && 'Importing data...'}
                {currentStep === 'complete' && 'Import complete'}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="text-white hover:text-blue-100 text-2xl leading-none"
              disabled={isProcessing}
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          {currentStep === 'select-file' && (
            <div className="space-y-6">
              {/* File Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Type
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {(['excel', 'csv', 'json'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFileType(type)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        fileType === type
                          ? 'border-blue-600 bg-blue-50 text-blue-600'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1">
                          {type === 'excel' && '📊'}
                          {type === 'csv' && '📄'}
                          {type === 'json' && '{ }'}
                        </div>
                        <div className="font-medium capitalize">{type}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {type === 'excel' && '.xlsx, .xls'}
                          {type === 'csv' && '.csv'}
                          {type === 'json' && '.json'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Entity Type (for CSV) */}
              {fileType === 'csv' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Entity Type (Required for CSV)
                  </label>
                  <select
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="customers">Customers</option>
                    <option value="vehicles">Vehicles</option>
                    <option value="drivers">Drivers</option>
                    <option value="owners">Owners</option>
                    <option value="ratecharts">Rate Charts</option>
                  </select>
                </div>
              )}

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    accept={
                      fileType === 'excel'
                        ? '.xlsx,.xls'
                        : fileType === 'csv'
                        ? '.csv'
                        : '.json'
                    }
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer block"
                  >
                    <div className="text-4xl mb-2">📁</div>
                    {selectedFile ? (
                      <div className="text-blue-600 font-medium">{selectedFile.name}</div>
                    ) : (
                      <>
                        <div className="text-gray-600">Click to browse or drag and drop</div>
                        <div className="text-sm text-gray-500 mt-1">
                          {fileType === 'excel' && 'Excel files (.xlsx, .xls)'}
                          {fileType === 'csv' && 'CSV files (.csv)'}
                          {fileType === 'json' && 'JSON files (.json)'}
                        </div>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Template Download */}
              <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">Need a template?</div>
                  <div className="text-sm text-gray-600">
                    Download a sample file to see the expected format
                  </div>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Download Template
                </button>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4">
                <button
                  onClick={onCancel}
                  className="px-6 py-2 text-gray-700 hover:text-gray-900"
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <button
                  onClick={handleValidate}
                  disabled={!selectedFile || isProcessing}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Validating...' : 'Validate & Continue →'}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'validate' && validationResult && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium text-green-900">Validation passed</span>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Data Summary</h3>
                <div className="grid grid-cols-2 gap-4">
                  {validationResult.data.customers && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">
                        {validationResult.data.customers.length}
                      </div>
                      <div className="text-sm text-gray-600">Customers</div>
                    </div>
                  )}
                  {validationResult.data.vehicles && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">
                        {validationResult.data.vehicles.length}
                      </div>
                      <div className="text-sm text-gray-600">Vehicles</div>
                    </div>
                  )}
                  {validationResult.data.drivers && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">
                        {validationResult.data.drivers.length}
                      </div>
                      <div className="text-sm text-gray-600">Drivers</div>
                    </div>
                  )}
                  {validationResult.data.owners && (
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">
                        {validationResult.data.owners.length}
                      </div>
                      <div className="text-sm text-gray-600">Owners</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep('select-file')}
                  className="px-6 py-2 text-gray-700 hover:text-gray-900"
                  disabled={isProcessing}
                >
                  ← Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? 'Starting import...' : 'Start Import →'}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'progress' && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Importing your data...</p>
              <p className="text-sm text-gray-500 mt-2">Please wait, this may take a few moments</p>
            </div>
          )}

          {currentStep === 'complete' && importProgress && (
            <div className="space-y-6">
              {importProgress.stage === 'completed' ? (
                <>
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Import Complete!</h3>
                    <p className="text-gray-600">{importProgress.message}</p>
                  </div>

                  {/* Import Summary */}
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Imported Records</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {importProgress.imported.customers > 0 && (
                        <div className="bg-green-50 rounded-lg p-3 flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <div className="text-xl font-bold text-green-600">
                              {importProgress.imported.customers}
                            </div>
                            <div className="text-sm text-gray-600">Customers</div>
                          </div>
                        </div>
                      )}
                      {importProgress.imported.vehicles > 0 && (
                        <div className="bg-green-50 rounded-lg p-3 flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <div className="text-xl font-bold text-green-600">
                              {importProgress.imported.vehicles}
                            </div>
                            <div className="text-sm text-gray-600">Vehicles</div>
                          </div>
                        </div>
                      )}
                      {importProgress.imported.drivers > 0 && (
                        <div className="bg-green-50 rounded-lg p-3 flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <div className="text-xl font-bold text-green-600">
                              {importProgress.imported.drivers}
                            </div>
                            <div className="text-sm text-gray-600">Drivers</div>
                          </div>
                        </div>
                      )}
                      {importProgress.imported.owners > 0 && (
                        <div className="bg-green-50 rounded-lg p-3 flex items-center">
                          <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <div>
                            <div className="text-xl font-bold text-green-600">
                              {importProgress.imported.owners}
                            </div>
                            <div className="text-sm text-gray-600">Owners</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Warnings */}
                  {importProgress.warnings.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h4 className="font-medium text-yellow-900 mb-2">Warnings</h4>
                      <ul className="text-sm text-yellow-800 space-y-1">
                        {importProgress.warnings.slice(0, 5).map((warning, i) => (
                          <li key={i}>• {warning}</li>
                        ))}
                        {importProgress.warnings.length > 5 && (
                          <li>...and {importProgress.warnings.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full mx-auto flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Import Failed</h3>
                    <p className="text-gray-600">{importProgress.message}</p>
                  </div>

                  {/* Errors */}
                  {importProgress.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-900 mb-2">Errors</h4>
                      <ul className="text-sm text-red-800 space-y-1">
                        {importProgress.errors.map((error, i) => (
                          <li key={i}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-4">
                {importProgress.stage === 'failed' && (
                  <button
                    onClick={() => setCurrentStep('select-file')}
                    className="px-6 py-2 text-gray-700 hover:text-gray-900"
                  >
                    ← Try Again
                  </button>
                )}
                <button
                  onClick={onComplete}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors"
                >
                  {importProgress.stage === 'completed' ? 'Done' : 'Close'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
