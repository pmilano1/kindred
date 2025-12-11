// Settings-related GraphQL type definitions

export const settingsTypes = `
  # ===========================================
  # SETTINGS
  # ===========================================

  type Setting {
    key: String!
    value: String
    description: String
    category: String!
    updated_at: String
  }

  type SiteSettings {
    site_name: String!
    family_name: String!
    site_tagline: String!
    theme_color: String!
    logo_url: String
    require_login: Boolean!
    show_living_details: Boolean!
    living_cutoff_years: Int!
    date_format: String!
    default_tree_generations: Int!
    show_coats_of_arms: Boolean!
    admin_email: String
    footer_text: String
  }

  type MigrationResult {
    success: Boolean!
    results: [String!]!
    message: String
  }

  type AppliedMigration {
    version: Int!
    name: String!
    applied_at: String!
  }

  type MigrationStatus {
    tables: [String!]!
    missingTables: [String!]!
    migrationNeeded: Boolean!
    currentVersion: Int!
    latestVersion: Int!
    pendingMigrations: Int!
    appliedMigrations: [AppliedMigration!]!
  }

  input SettingsInput {
    site_name: String
    family_name: String
    site_tagline: String
    theme_color: String
    logo_url: String
    require_login: String
    show_living_details: String
    living_cutoff_years: String
    date_format: String
    default_tree_generations: String
    show_coats_of_arms: String
    admin_email: String
    footer_text: String
    # Research queue scoring weights (Issue #195)
    research_weight_missing_core_dates: String
    research_weight_missing_places: String
    research_weight_estimated_dates: String
    research_weight_placeholder_parent: String
    research_weight_low_sources: String
    research_weight_manual_priority: String
  }

  # ===========================================
  # GEDCOM IMPORT/EXPORT
  # ===========================================

  type GedcomImportResult {
    peopleImported: Int!
    familiesImported: Int!
    errors: [String!]!
    warnings: [String!]!
  }
`;
