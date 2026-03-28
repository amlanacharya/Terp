import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { SystemSetting } from '../../lib/types';
import { NetworkSettings } from './NetworkSettings';
import { BackupRestore } from './BackupRestore';
import FeedbackForm from './FeedbackForm';

interface SettingsSection {
  title: string;
  keys: string[];
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: 'Company Information',
    keys: ['company_name', 'company_address', 'company_gstin', 'company_pan'],
  },
  {
    title: 'Bank Details',
    keys: ['bank_name', 'bank_account_number', 'bank_ifsc_code'],
  },
  {
    title: 'Numbering Prefixes',
    keys: ['lead_prefix', 'booking_prefix', 'invoice_prefix', 'trip_prefix'],
  },
  {
    title: 'Financial',
    keys: ['fy_start_month'],
  },
];

export function Settings() {
  const [activeTab, setActiveTab] = useState<'system' | 'network' | 'backup' | 'license'>('system');
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  // License state
  const [licenseStatus, setLicenseStatus] = useState<any>(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseMsg, setLicenseMsg] = useState('');
  const [licenseLoading, setLicenseLoading] = useState(false);

  async function loadLicenseStatus() {
    try {
      const res = await fetch('http://localhost:3001/api/license/status');
      if (res.ok) setLicenseStatus(await res.json());
    } catch {}
  }

  async function activateLicense() {
    if (!licenseKey.trim()) return;
    setLicenseLoading(true);
    setLicenseMsg('');
    try {
      const res = await fetch('http://localhost:3001/api/license/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productKey: licenseKey.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLicenseMsg('License activated successfully.');
        setLicenseKey('');
        await loadLicenseStatus();
      } else {
        setLicenseMsg(data.error || 'Activation failed.');
      }
    } catch {
      setLicenseMsg('Could not connect to server.');
    } finally {
      setLicenseLoading(false);
    }
  }

  async function resetLicense() {
    if (!confirm('This will deactivate the current license. You will need a new key to continue. Proceed?')) return;
    setLicenseLoading(true);
    setLicenseMsg('');
    try {
      const res = await fetch('http://localhost:3001/api/license/reset', { method: 'POST' });
      const data = await res.json();
      setLicenseMsg(data.message || 'License reset.');
      await loadLicenseStatus();
    } catch {
      setLicenseMsg('Reset failed.');
    } finally {
      setLicenseLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'license') void loadLicenseStatus();
  }, [activeTab]);

  async function loadSettings() {
    try {
      const rows = await api.get<SystemSetting[]>('/settings');
      setSettings(rows);
      setFormValues(
        rows.reduce<Record<string, string>>((accumulator, setting) => {
          accumulator[setting.setting_key] = setting.setting_value;
          return accumulator;
        }, {})
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load settings.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  async function saveSetting(setting: SystemSetting) {
    setSavingKey(setting.setting_key);
    setError('');

    try {
      await api.put(`/settings/${encodeURIComponent(setting.setting_key)}`, {
        setting_value: formValues[setting.setting_key],
      });
      await loadSettings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save setting.');
    } finally {
      setSavingKey('');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading settings...</p>;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Settings</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">System configuration</h2>
        </div>
        <button
          onClick={() => setShowFeedback(true)}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          Send Feedback
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-8">
          <button
            onClick={() => setActiveTab('system')}
            className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'system'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            System Settings
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'network'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            Network Settings
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'backup'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            Backup & Restore
          </button>
          <button
            onClick={() => setActiveTab('license')}
            className={`border-b-2 py-4 px-1 text-sm font-medium transition-colors ${
              activeTab === 'license'
                ? 'border-sky-600 text-sky-600'
                : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            License
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'network' ? (
        <NetworkSettings />
      ) : activeTab === 'backup' ? (
        <BackupRestore />
      ) : activeTab === 'license' ? (
        <div className="space-y-6">
          {/* Current status */}
          <div className="rounded-3xl border border-slate-200 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">License Status</h3>
            {licenseStatus ? (
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex gap-2">
                  <span className="font-medium w-36">Status:</span>
                  <span className={
                    licenseStatus.status === 'active' ? 'text-green-600 font-semibold' :
                    licenseStatus.status === 'grace' ? 'text-amber-600 font-semibold' :
                    'text-rose-600 font-semibold'
                  }>{licenseStatus.status?.toUpperCase()}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium w-36">Expiry:</span>
                  <span>{licenseStatus.expiryDate ? new Date(licenseStatus.expiryDate).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium w-36">Days remaining:</span>
                  <span>{licenseStatus.daysRemaining ?? '—'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-medium w-36">Type:</span>
                  <span className="capitalize">{licenseStatus.subscriptionType || '—'}</span>
                </div>
                {licenseStatus.warningMessage && (
                  <p className="mt-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{licenseStatus.warningMessage}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Loading status...</p>
            )}
          </div>

          {/* Activate new key */}
          <div className="rounded-3xl border border-slate-200 p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">Activate License Key</h3>
            <div className="flex gap-2">
              <input
                value={licenseKey}
                onChange={e => setLicenseKey(e.target.value)}
                placeholder="GT01-XXXX-XXXX-XXXX-XXXX"
                className="flex-1 rounded-2xl border border-slate-300 px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={activateLicense}
                disabled={licenseLoading || !licenseKey.trim()}
                className="rounded-2xl bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {licenseLoading ? 'Activating...' : 'Activate'}
              </button>
            </div>
            {licenseMsg && (
              <p className={`mt-3 text-sm ${licenseMsg.includes('success') ? 'text-green-600' : 'text-rose-600'}`}>{licenseMsg}</p>
            )}
          </div>

          {/* Reset license */}
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
            <h3 className="mb-2 text-lg font-semibold text-rose-900">Reset License</h3>
            <p className="mb-4 text-sm text-rose-700">Deactivates the current license so you can activate a new key. Use this if your license is expired or you are reinstalling on the same machine.</p>
            <button
              onClick={resetLicense}
              disabled={licenseLoading}
              className="rounded-2xl bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Reset License
            </button>
          </div>
        </div>
      ) : (
        <>
          {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
          <div className="space-y-6">
            {SETTINGS_SECTIONS.map((section) => {
              const sectionSettings = settings.filter((s) => section.keys.includes(s.setting_key));
              if (sectionSettings.length === 0) return null;

              return (
                <div key={section.title} className="rounded-3xl border border-slate-200 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-slate-900">{section.title}</h3>
                  <div className="space-y-4">
                    {sectionSettings.map((setting) => (
                      <div key={setting.id} className="flex flex-col gap-3 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0 lg:flex-row lg:items-end lg:justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{setting.description ?? setting.setting_key}</p>
                          {setting.description && setting.description !== setting.setting_key ? (
                            <p className="mt-0.5 text-xs text-slate-500">{setting.setting_key}</p>
                          ) : null}
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={formValues[setting.setting_key] ?? setting.setting_value}
                            onChange={(event) =>
                              setFormValues((current) => ({
                                ...current,
                                [setting.setting_key]: event.target.value,
                              }))
                            }
                            placeholder={setting.description ?? `Enter ${setting.setting_key}`}
                            className="flex-1 rounded-2xl border border-slate-300 px-3 py-2 text-sm font-normal lg:max-w-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void saveSetting(setting);
                            }}
                            disabled={savingKey === setting.setting_key}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                          >
                            {savingKey === setting.setting_key ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Feedback Form Modal */}
      {showFeedback && <FeedbackForm onClose={() => setShowFeedback(false)} />}
    </section>
  );
}
