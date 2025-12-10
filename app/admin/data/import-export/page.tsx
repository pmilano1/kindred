'use client';

import { Download, Upload } from 'lucide-react';
import { useState } from 'react';
import { Button, Checkbox, Label } from '@/components/ui';

async function graphqlFetch(
  query: string,
  variables?: Record<string, unknown>,
) {
  const res = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export default function ImportExportPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportIncludeLiving, setExportIncludeLiving] = useState(true);
  const [exportIncludeSources, setExportIncludeSources] = useState(true);
  const [importResult, setImportResult] = useState<{
    peopleImported: number;
    familiesImported: number;
    warnings: string[];
    errors: string[];
  } | null>(null);

  const handleExportGedcom = async () => {
    setExporting(true);
    try {
      const data = await graphqlFetch(
        `
        query ExportGedcom($includeLiving: Boolean, $includeSources: Boolean) {
          exportGedcom(includeLiving: $includeLiving, includeSources: $includeSources)
        }
      `,
        {
          includeLiving: exportIncludeLiving,
          includeSources: exportIncludeSources,
        },
      );

      const blob = new Blob([data.exportGedcom], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-tree-${new Date().toISOString().split('T')[0]}.ged`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${(err as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImportGedcom = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const data = await graphqlFetch(
        `
        mutation ImportGedcom($gedcomContent: String!) {
          importGedcom(gedcomContent: $gedcomContent) {
            peopleImported
            familiesImported
            warnings
            errors
          }
        }
      `,
        { gedcomContent: text },
      );
      setImportResult(data.importGedcom);
    } catch (err) {
      console.error('Import failed:', err);
      alert(`Import failed: ${(err as Error).message}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* GEDCOM Export Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-2">📤 Export Data</h2>
        <p className="text-gray-600 mb-4">
          Export your family tree data in GEDCOM format for backup or import
          into other genealogy software.
        </p>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="export-living"
              checked={exportIncludeLiving}
              onCheckedChange={(checked) =>
                setExportIncludeLiving(checked === true)
              }
            />
            <Label htmlFor="export-living" className="text-sm cursor-pointer">
              Include living people
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="export-sources"
              checked={exportIncludeSources}
              onCheckedChange={(checked) =>
                setExportIncludeSources(checked === true)
              }
            />
            <Label htmlFor="export-sources" className="text-sm cursor-pointer">
              Include sources
            </Label>
          </div>
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

      {/* GEDCOM Import Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-2">📥 Import Data</h2>
        <p className="text-gray-600 mb-4">
          Import family tree data from a GEDCOM file. Standard GEDCOM 5.5.1
          format is supported.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="file"
            id="gedcom-import"
            accept=".ged,.gedcom"
            onChange={handleImportGedcom}
            disabled={importing}
            className="hidden"
          />
          <Button
            onClick={() => document.getElementById('gedcom-import')?.click()}
            disabled={importing}
            loading={importing}
            variant="secondary"
            icon={<Upload className="w-4 h-4" />}
          >
            {importing ? 'Importing...' : 'Import GEDCOM'}
          </Button>
        </div>
        {importResult && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <p className="font-medium">Import Results:</p>
            <ul className="mt-2 text-sm space-y-1">
              <li>✅ People imported: {importResult.peopleImported}</li>
              <li>✅ Families imported: {importResult.familiesImported}</li>
              {importResult.warnings.length > 0 && (
                <li className="text-yellow-600">
                  ⚠️ Warnings: {importResult.warnings.length}
                </li>
              )}
              {importResult.errors.length > 0 && (
                <li className="text-red-600">
                  ❌ Errors: {importResult.errors.length}
                </li>
              )}
            </ul>
            {importResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="text-sm text-red-600 cursor-pointer">
                  View errors
                </summary>
                <ul className="mt-1 text-xs text-red-600 max-h-32 overflow-y-auto">
                  {importResult.errors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
