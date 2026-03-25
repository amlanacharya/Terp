import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { SystemSetting } from '../../lib/types';
import { NetworkSettings } from './NetworkSettings';
import { BackupRestore } from './BackupRestore';

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
  const [activeTab, setActiveTab] = useState<'system' | 'network' | 'backup'>('system');
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

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
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-600">Settings</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">System configuration</h2>
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
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'network' ? (
        <NetworkSettings />
      ) : activeTab === 'backup' ? (
        <BackupRestore />
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
    </section>
  );
}
