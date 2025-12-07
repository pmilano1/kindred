'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sliders } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';
import { useSettingsRefetch } from '@/components/SettingsProvider';
import { themePresets, applyThemePreset, getPresetByPrimaryColor, type ThemePreset } from '@/lib/theme-presets';

interface SettingRow {
  key: string;
  value: string | null;
  description: string;
  category: string;
}

const SETTING_LABELS: Record<string, string> = {
  site_name: 'Site Name',
  family_name: 'Family Name',
  site_tagline: 'Tagline',
  theme_color: 'Theme Color',
  logo_url: 'Logo URL',
  require_login: 'Require Login',
  show_living_details: 'Show Living Details',
  living_cutoff_years: 'Living Cutoff (Years)',
  date_format: 'Date Format',
  default_tree_generations: 'Default Tree Generations',
  show_coats_of_arms: 'Show Coats of Arms',
  admin_email: 'Admin Email',
  footer_text: 'Footer Text',
};

const CATEGORY_LABELS: Record<string, string> = {
  branding: '🎨 Branding',
  privacy: '🔒 Privacy',
  display: '📊 Display',
  contact: '📧 Contact',
};

const graphqlFetch = async (query: string, variables?: Record<string, unknown>) => {
  const res = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const refetchGlobalSettings = useSettingsRefetch();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      // Check migration status first
      const statusData = await graphqlFetch(`query { migrationStatus { migrationNeeded } }`);
      if (statusData.migrationStatus.migrationNeeded) {
        setNeedsMigration(true);
        setLoading(false);
        return;
      }

      // Load settings
      const data = await graphqlFetch(`
        query { settings { key value description category } }
      `);
      const settingsMap: Record<string, string> = {};
      for (const row of data.settings) {
        settingsMap[row.key] = row.value || '';
      }
      setSettings(settingsMap);
      setRows(data.settings);
      setNeedsMigration(false);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'admin') {
      router.push('/');
      return;
    }
    loadSettings();
  }, [session, status, router, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await graphqlFetch(`
        mutation UpdateSettings($input: SettingsInput!) {
          updateSettings(input: $input) { site_name }
        }
      `, { input: settings });
      // Refetch global settings to update UI immediately
      refetchGlobalSettings();
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const data = await graphqlFetch(`mutation { runMigrations { success results message } }`);
      setMessage({ type: 'success', text: 'Migration completed: ' + data.runMigrations.results.join(', ') });
      loadSettings();
    } catch (err) {
      setMessage({ type: 'error', text: 'Migration failed: ' + (err as Error).message });
    } finally {
      setMigrating(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const groupedSettings = rows.reduce((acc, row) => {
    const cat = row.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(row);
    return acc;
  }, {} as Record<string, SettingRow[]>);

  if (loading) {
    return (
      <>
        <PageHeader title="Site Settings" subtitle="Configure your genealogy site" icon={Sliders} />
        <div className="content-wrapper flex justify-center py-12">
          <LoadingSpinner size="lg" message="Loading settings..." />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Site Settings" subtitle="Configure your genealogy site" icon={Sliders} />
      <div className="content-wrapper">
        {/* Navigation */}
        <div className="flex gap-4 mb-8">
          <Link href="/admin" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
            Users
          </Link>
          <span className="bg-blue-600 text-white px-4 py-2 rounded-lg">Site Settings</span>
          <Link href="/admin/api-keys" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300">
            API Keys
          </Link>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {message.text}
          </div>
        )}

        {/* Migration needed */}
        {needsMigration && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 mb-3">Settings table needs to be created.</p>
            <button onClick={handleMigrate} disabled={migrating}
              className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50">
              {migrating ? 'Running...' : 'Run Migration'}
            </button>
          </div>
        )}

        {/* Settings Form */}
        {!needsMigration && Object.keys(groupedSettings).length > 0 && (
          <div className="space-y-8">
            {Object.entries(groupedSettings).map(([category, categoryRows]) => (
              <div key={category} className="bg-white rounded-xl shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <div className="space-y-4">
                  {categoryRows.map(row => (
                    <div key={row.key} className="grid grid-cols-3 gap-4 items-start">
                      <div>
                        <label className="block font-medium text-gray-700">
                          {SETTING_LABELS[row.key] || row.key}
                        </label>
                        <p className="text-sm text-gray-500">{row.description}</p>
                      </div>
                      <div className="col-span-2">
                        {row.key === 'theme_color' ? (
                          <ThemePresetPicker
                            value={settings[row.key] || '#37b24d'}
                            onSelectPreset={(preset) => {
                              updateSetting('theme_color', preset.colors.primary);
                              // Apply theme immediately for preview
                              applyThemePreset(preset);
                            }}
                          />
                        ) : row.key === 'date_format' ? (
                          <select
                            value={settings[row.key] || 'MDY'}
                            onChange={e => updateSetting(row.key, e.target.value)}
                            className="border rounded-lg px-3 py-2"
                          >
                            <option value="MDY">MM/DD/YYYY (US)</option>
                            <option value="DMY">DD/MM/YYYY (EU)</option>
                            <option value="ISO">YYYY-MM-DD (ISO)</option>
                          </select>
                        ) : ['require_login', 'show_living_details', 'show_coats_of_arms'].includes(row.key) ? (
                          <select
                            value={settings[row.key] || 'false'}
                            onChange={e => updateSetting(row.key, e.target.value)}
                            className="border rounded-lg px-3 py-2"
                          >
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : row.key === 'footer_text' ? (
                          <textarea
                            value={settings[row.key] || ''}
                            onChange={e => updateSetting(row.key, e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                            rows={2}
                            placeholder="Optional footer message"
                          />
                        ) : (
                          <input
                            type={['living_cutoff_years', 'default_tree_generations'].includes(row.key) ? 'number' : 'text'}
                            value={settings[row.key] || ''}
                            onChange={e => updateSetting(row.key, e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                            placeholder={row.key.includes('url') ? 'https://...' : ''}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Theme Preset Picker (no custom colors - presets only)
function ThemePresetPicker({
  value,
  onSelectPreset
}: {
  value: string;
  onSelectPreset: (preset: ThemePreset) => void;
}) {
  const currentPreset = getPresetByPrimaryColor(value);

  return (
    <div className="space-y-3">
      {/* Current theme indicator */}
      {currentPreset && (
        <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
          <div className="flex gap-1">
            {currentPreset.preview.map((color, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border border-gray-200"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <span className="text-sm font-medium">{currentPreset.name}</span>
          <span className="text-xs text-gray-500">Current theme</span>
        </div>
      )}

      {/* Theme Presets Grid */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <p className="text-sm text-gray-600 mb-3">
          Colors from <a href="https://yeun.github.io/open-color/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Open Color</a> - MIT Licensed
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {themePresets.map(preset => {
            const isSelected = currentPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`p-3 bg-white border-2 rounded-lg hover:border-blue-400 hover:shadow-md transition-all text-left ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
                }`}
              >
                <div className="flex gap-1 mb-2">
                  {preset.preview.map((color, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border border-gray-200"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="font-medium text-sm">{preset.name}</div>
                <div className="text-xs text-gray-500">{preset.description}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
