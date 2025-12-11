import { gql } from '@apollo/client';

// =====================================================
// SITE SETTINGS QUERIES
// =====================================================

export const GET_SITE_SETTINGS = gql`
  query GetSiteSettings {
    siteSettings {
      site_name
      family_name
      site_tagline
      theme_color
      logo_url
      require_login
      show_living_details
      living_cutoff_years
      date_format
      default_tree_generations
      show_coats_of_arms
      admin_email
      footer_text
    }
  }
`;

// =====================================================
// GEDCOM EXPORT/IMPORT
// =====================================================

export const EXPORT_GEDCOM = gql`
  query ExportGedcom($includeLiving: Boolean, $includeSources: Boolean) {
    exportGedcom(includeLiving: $includeLiving, includeSources: $includeSources)
  }
`;

export const IMPORT_GEDCOM = gql`
  mutation ImportGedcom($content: String!) {
    importGedcom(content: $content) {
      peopleImported
      familiesImported
      errors
      warnings
    }
  }
`;
