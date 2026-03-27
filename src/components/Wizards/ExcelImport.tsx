import { useState } from 'react';
import { validateFiles } from '../../lib/import-validation';
import { getTemplate, generateExampleData } from '../../lib/import-templates';
import * as XLSX from 'xlsx';

interface Props {
  onNext: () => void;
  onSkip: () => void;
}

interface ValidationResults {
  summary: {
    [entityType: string]: {
      count: number;
      valid: boolean;
      errors: any[];
    };
  };
  hasErrors: boolean;
}

export function ExcelImport({ onNext, onSkip }: Props) {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [validationResults, setValidationResults] = useState<ValidationResults | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const entityTypes = [
    { key: 'customers', label: 'Customers', required: false },
    { key: 'vehicles', label: 'Vehicles', required: false },
    { key: 'drivers', label: 'Drivers', required: false },
    { key: 'owners', label: 'Vehicle Owners', required: false },
    { key: 'rateCharts', label: 'Rate Charts', required: false }
  ];

  const handleFileChange = (entityType: string, file: File | null) => {
    if (file) {
      setFiles(prev => ({ ...prev, [entityType]: file }));
    } else {
      setFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[entityType];
        return newFiles;
      });
    }
    setValidationResults(null);
  };

  const handleValidate = async () => {
    setIsValidating(true);

    try {
      const results = await validateFiles(files);
      setValidationResults(results);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    setIsImporting(true);

    try {
      // Import validated data
      await importData(files);
      onNext();
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = (entityType: string) => {
    const template = getTemplate(entityType);
    if (!template) return;

    // Create worksheet with headers and example data
    const headers = template.fields.map(f => f.label);
    const examples = generateExampleData(entityType);

    const ws = XLSX.utils.json_to_sheet(examples, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    // Generate filename
    const filename = `${entityType}-import-template.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Import your data</h3>
        <p className="text-sm text-gray-600">
          Download templates, fill them with your data, and upload them here. You can also skip this step and add data manually later.
        </p>
      </div>

      {entityTypes.map(entity => (
        <div key={entity.key} className="border rounded-md p-4">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-900">{entity.label}</h4>
            <button
              onClick={() => downloadTemplate(entity.key)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Download Template
            </button>
          </div>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFileChange(entity.key, e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          {files[entity.key] && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {files[entity.key].name}
            </p>
          )}

          {validationResults && validationResults.summary[entity.key] && !validationResults.summary[entity.key].valid && validationResults.summary[entity.key].errors && validationResults.summary[entity.key].errors.length > 0 && (
            <div className="mt-2 text-sm text-red-600">
              {validationResults.summary[entity.key].errors.length} error(s) found
            </div>
          )}

          {validationResults && validationResults.summary[entity.key] && validationResults.summary[entity.key].valid && (
            <div className="mt-2 text-sm text-green-600">
              Valid: {validationResults.summary[entity.key].count} records
            </div>
          )}
        </div>
      ))}

      {!validationResults && Object.keys(files).length > 0 && (
        <button
          onClick={handleValidate}
          disabled={isValidating}
          className="w-full px-4 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 font-medium"
        >
          {isValidating ? 'Validating...' : 'Validate Files'}
        </button>
      )}

      {validationResults && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="font-medium mb-3 text-gray-900">Validation Results</h4>
          <div className="space-y-2 text-sm">
            {Object.entries(validationResults.summary).map(([key, value]: [string, any]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="capitalize text-gray-700">{key.replace('rateCharts', 'Rate Charts')}:</span>
                <div className="flex items-center gap-2">
                  <span className={value.valid ? 'text-green-600' : 'text-red-600'}>
                    {value.count} records
                  </span>
                  {!value.valid && (
                    <span className="text-red-600">
                      ({value.errors.length} errors)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {validationResults.hasErrors && (
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="mt-4 w-full px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:bg-gray-300 font-medium"
            >
              {isImporting ? 'Importing...' : 'Import Valid Records Only'}
            </button>
          )}

          {!validationResults.hasErrors && Object.keys(validationResults.summary).length > 0 && (
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="mt-4 w-full px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 font-medium"
            >
              {isImporting ? 'Importing...' : 'Import All Records'}
            </button>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={onSkip}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium"
        >
          Skip (I'll add data manually)
        </button>
      </div>
    </div>
  );
}

async function importData(files: Record<string, File>): Promise<void> {
  for (const [entityType, file] of Object.entries(files)) {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    // Import to backend
    try {
      const response = await fetch(`/api/import/${entityType}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });

      if (!response.ok) {
        console.error(`Failed to import ${entityType}`);
      }
    } catch (error) {
      console.error(`Error importing ${entityType}:`, error);
    }
  }
}
