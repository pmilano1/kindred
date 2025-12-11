/**
 * ResearchPanel Field Mapping Tests
 *
 * Tests the add note mutation field mapping to ensure correct GraphQL field names.
 * Issue #215: https://github.com/pmilano1/kindred/issues/215
 *
 * The bug was that ResearchPanel was sending:
 * - action_type instead of action
 * - source_checked instead of source_type
 * - external_url instead of source_url
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ResearchPanel Field Mapping (Issue #215)', () => {
  // Read the actual component source code to verify field names
  const componentPath = path.join(
    process.cwd(),
    'components',
    'ResearchPanel.tsx',
  );
  const componentSource = fs.readFileSync(componentPath, 'utf-8');

  describe('handleSubmit mutation variables', () => {
    it('uses "action" field name (not "action_type")', () => {
      // The component should use 'action:' not 'action_type:'
      expect(componentSource).toContain('action: actionType');
      expect(componentSource).not.toContain('action_type: actionType');
    });

    it('uses "source_type" field name (not "source_checked")', () => {
      // The component should use 'source_type:' not 'source_checked:'
      expect(componentSource).toContain('source_type: sourceChecked');
      expect(componentSource).not.toContain('source_checked: sourceChecked');
    });

    it('uses "source_url" field name (not "external_url")', () => {
      // The component should use 'source_url:' not 'external_url:'
      expect(componentSource).toContain('source_url: externalUrl');
      expect(componentSource).not.toContain('external_url: externalUrl');
    });

    it('includes all required GraphQL SourceInput fields', () => {
      // Verify the handleSubmit function includes the correct field structure
      expect(componentSource).toMatch(
        /input:\s*\{[^}]*action:\s*actionType[^}]*\}/s,
      );
      expect(componentSource).toMatch(/input:\s*\{[^}]*content[^}]*\}/s);
      expect(componentSource).toMatch(/input:\s*\{[^}]*confidence[^}]*\}/s);
    });
  });

  describe('GraphQL SourceInput schema alignment', () => {
    // Read the schema to verify field names match
    // SourceInput is now in the modular schema/types/source.ts file
    const schemaPath = path.join(
      process.cwd(),
      'lib',
      'graphql',
      'schema',
      'types',
      'source.ts',
    );
    const schemaSource = fs.readFileSync(schemaPath, 'utf-8');

    it('schema defines action as required field', () => {
      expect(schemaSource).toMatch(
        /input\s+SourceInput\s*\{[^}]*action:\s*String!/s,
      );
    });

    it('schema defines source_type as optional field', () => {
      expect(schemaSource).toMatch(
        /input\s+SourceInput\s*\{[^}]*source_type:\s*String[^!]/s,
      );
    });

    it('schema defines source_url as optional field', () => {
      expect(schemaSource).toMatch(
        /input\s+SourceInput\s*\{[^}]*source_url:\s*String[^!]/s,
      );
    });

    it('schema does NOT define action_type field', () => {
      // Ensure the wrong field names are not in schema
      expect(schemaSource).not.toMatch(
        /input\s+SourceInput\s*\{[^}]*action_type:/s,
      );
    });

    it('schema does NOT define source_checked field', () => {
      expect(schemaSource).not.toMatch(
        /input\s+SourceInput\s*\{[^}]*source_checked:/s,
      );
    });

    it('schema does NOT define external_url field', () => {
      expect(schemaSource).not.toMatch(
        /input\s+SourceInput\s*\{[^}]*external_url:/s,
      );
    });
  });
});
