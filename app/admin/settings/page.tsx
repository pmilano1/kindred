'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Sliders, Save, Play, Download } from 'lucide-react';
import { PageHeader, Button } from '@/components/ui';
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

  // GEDCOM export state
  const [exporting, setExporting] = useState(false);
  const [exportIncludeLiving, setExportIncludeLiving] = useState(false);
  const [exportIncludeSources, setExportIncludeSources] = useState(true);

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

  const handleExportGedcom = async () => {
    setExporting(true);
    try {
      const data = await graphqlFetch(`
        query ExportGedcom($includeLiving: Boolean, $includeSources: Boolean) {
          exportGedcom(includeLiving: $includeLiving, includeSources: $includeSources)
        }
      `, { includeLiving: exportIncludeLiving, includeSources: exportIncludeSources });

      // Create and download the file
      const blob = new Blob([data.exportGedcom], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tree-${new Date().toISOString().split('T')[0]}.ged`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'GEDCOM file exported successfully!' });
    } catch (err) {
      console.error('Failed to export GEDCOM:', err);
      setMessage({ type: 'error', text: 'Failed to export GEDCOM: ' + (err as Error).message });
    } finally {
      setExporting(false);
    }
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
          <Link href="/admin" className="nav-tab">Users</Link>
          <span className="nav-tab-active">Site Settings</span>
          <Link href="/admin/api-keys" className="nav-tab">API Keys</Link>
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
            <Button onClick={handleMigrate} disabled={migrating} loading={migrating} icon={<Play className="w-4 h-4" />}>
              Run Migration
            </Button>
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
              <Button
                onClick={handleSave}
                disabled={saving}
                loading={saving}
                icon={<Save className="w-4 h-4" />}
              >
                Save Settings
              </Button>
            </div>

            {/* GEDCOM Export Section */}
            <div className="bg-gray-50 rounded-lg p-6 mt-8">
              <h3 className="text-lg font-semibold mb-4">📤 Export Data</h3>
              <p className="text-gray-600 mb-4">
                Export your family tree data in GEDCOM format for backup or import into other genealogy software.
              </p>
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportIncludeLiving}
                    onChange={e => setExportIncludeLiving(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Include living people</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={exportIncludeSources}
                    onChange={e => setExportIncludeSources(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Include sources</span>
                </label>
              </div>
              <Button
                onClick={handleExportGedcom}
                disabled={exporting}
                loading={exporting}
                variant="secondary"
                icon={<Download className="w-4 h-4" />}
              >
                Export GEDCOM
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// Theme Preset Picker - condensed to 8 curated themes
function ThemePresetPicker({
  value,
  onSelectPreset
}: {
  value: string;
  onSelectPreset: (preset: ThemePreset) => void;
}) {
  const currentPreset = getPresetByPrimaryColor(value);

  return (
    <div className="grid grid-cols-4 gap-2">
      {themePresets.map(preset => {
        const isSelected = currentPreset?.id === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectPreset(preset)}
            className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all hover:border-blue-400 ${
              isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
            }`}
            title={preset.description}
          >
            <div
              className="w-6 h-6 rounded-full border border-gray-300"
              style={{ backgroundColor: preset.colors.primary }}
            />
            <span className="text-sm font-medium">{preset.name}</span>
          </button>
        );
      })}
    </div>
  );
}
