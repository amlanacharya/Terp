import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { SystemSetting } from '../../lib/types';

export function Settings() {
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
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div> : null}
      <div className="space-y-4">
        {settings.map((setting) => (
          <article key={setting.id} className="rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">{setting.setting_key}</p>
                <p className="mt-1 text-sm text-slate-600">{setting.description ?? 'No description'}</p>
                <p className="mt-2 text-xs text-slate-400">Updated {formatDate(setting.updated_at)}</p>
              </div>
              <div className="flex w-full max-w-xl gap-3">
                <input
                  value={formValues[setting.setting_key] ?? setting.setting_value}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      [setting.setting_key]: event.target.value,
                    }))
                  }
                  className="flex-1 rounded-2xl border border-slate-300 px-4 py-3"
                />
                <button
                  type="button"
                  onClick={() => {
                    void saveSetting(setting);
                  }}
                  disabled={savingKey === setting.setting_key}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-white disabled:opacity-60"
                >
                  {savingKey === setting.setting_key ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
