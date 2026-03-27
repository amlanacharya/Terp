/**
 * Feedback Form Component
 *
 * In-app feedback collection for beta testers
 * Categorizes feedback: Bug Report, Feature Request, General Feedback, Question
 */

import { useState, useEffect } from 'react';

interface FeedbackFormProps {
  onClose: () => void;
}

interface FeedbackData {
  category: 'bug' | 'feature' | 'general' | 'question';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  email: string;
  attachLogs: boolean;
}

const FeedbackForm = ({ onClose }: FeedbackFormProps) => {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FeedbackData>({
    category: 'bug',
    severity: 'medium',
    title: '',
    description: '',
    steps: '',
    expected: '',
    actual: '',
    email: '',
    attachLogs: false,
  });

  // Load company email from settings
  useEffect(() => {
    const loadCompanyEmail = async () => {
      try {
        const response = await fetch('/api/license/company');
        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({ ...prev, email: data.email || '' }));
        }
      } catch (err) {
        // Silent fail - user can enter email manually
      }
    };
    loadCompanyEmail();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.title.trim() || !formData.description.trim()) {
        throw new Error('Title and description are required');
      }

      // Bug-specific validation
      if (formData.category === 'bug' && !formData.steps.trim()) {
        throw new Error('Please provide steps to reproduce for bug reports');
      }

      // Prepare feedback payload
      const payload = {
        ...formData,
        timestamp: new Date().toISOString(),
        appVersion: await window.electronAPI?.getAppVersion?.() || '1.0.0-beta.1',
        platform: process.platform,
        arch: process.arch,
      };

      // Send feedback to server
      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit feedback');
      }

      // Success
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof FeedbackData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Feedback Submitted!</h3>
            <p className="text-sm text-gray-600 mb-4">
              Thank you for your feedback. Our team will review it and respond within 24 hours.
            </p>
            <p className="text-xs text-gray-500 mb-6">
              A confirmation has been sent to: {formData.email || 'your email'}
            </p>
            <button
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Send Feedback</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Help us improve TravelERP Lite by sharing your feedback
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Feedback Category <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              required
            >
              <option value="bug">🐛 Bug Report</option>
              <option value="feature">💡 Feature Request</option>
              <option value="general">💬 General Feedback</option>
              <option value="question">❓ Question</option>
            </select>
          </div>

          {/* Severity (for bugs) */}
          {formData.category === 'bug' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity Level <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.severity}
                onChange={(e) => handleInputChange('severity', e.target.value as any)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              >
                <option value="critical">🔴 Critical - Blocking business operations</option>
                <option value="high">🟠 High - Major feature broken</option>
                <option value="medium">🟡 Medium - Minor issues</option>
                <option value="low">🟢 Low - Cosmetic/small issues</option>
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {formData.category === 'bug' ? 'Bug Summary' : 'Title'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder={formData.category === 'bug' ? 'e.g., Invoice total incorrect for multi-day trips' : 'Brief summary'}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder={
                formData.category === 'bug'
                  ? 'Describe what happened and the impact on your work'
                  : formData.category === 'feature'
                  ? 'Describe the feature you would like and why it would help'
                  : 'Please provide your feedback'
              }
              rows={4}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              required
            />
          </div>

          {/* Steps to Reproduce (for bugs) */}
          {formData.category === 'bug' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Steps to Reproduce <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.steps}
                  onChange={(e) => handleInputChange('steps', e.target.value)}
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. Enter...&#10;4. See error..."
                  rows={4}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 font-mono text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Behavior
                  </label>
                  <textarea
                    value={formData.expected}
                    onChange={(e) => handleInputChange('expected', e.target.value)}
                    placeholder="What should have happened?"
                    rows={2}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Actual Behavior
                  </label>
                  <textarea
                    value={formData.actual}
                    onChange={(e) => handleInputChange('actual', e.target.value)}
                    placeholder="What actually happened?"
                    rows={2}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="For follow-up communication"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
              required
            />
          </div>

          {/* Attach Logs */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="attachLogs"
              checked={formData.attachLogs}
              onChange={(e) => handleInputChange('attachLogs', e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="attachLogs" className="ml-2 block text-sm text-gray-700">
              Attach application logs (helpful for debugging bugs)
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackForm;
