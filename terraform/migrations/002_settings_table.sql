-- Settings table for site configuration
-- Stores branding and other customizable settings

CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  description VARCHAR(500),
  category VARCHAR(50) DEFAULT 'general',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default settings
INSERT INTO settings (key, value, description, category) VALUES
  -- Branding
  ('site_name', 'Family Tree', 'Name displayed in browser title and header', 'branding'),
  ('family_name', 'Family', 'Primary family name (e.g., "Milanese")', 'branding'),
  ('site_tagline', 'Preserving our heritage', 'Tagline shown on homepage', 'branding'),
  ('theme_color', '#4F46E5', 'Primary UI color (hex)', 'branding'),
  ('logo_url', NULL, 'Custom logo image URL', 'branding'),

  -- Privacy
  ('require_login', 'true', 'Require authentication to view any data', 'privacy'),
  ('show_living_details', 'false', 'Show birth dates and places for living people', 'privacy'),
  ('living_cutoff_years', '100', 'Assume deceased if born more than X years ago', 'privacy'),

  -- Display
  ('date_format', 'MDY', 'Date format: MDY, DMY, or ISO', 'display'),
  ('default_tree_generations', '4', 'Number of generations shown in tree view', 'display'),
  ('show_coats_of_arms', 'true', 'Display family crests on person pages', 'display'),

  -- Contact
  ('admin_email', NULL, 'Contact email shown in footer', 'contact'),
  ('footer_text', NULL, 'Custom footer message', 'contact')
ON CONFLICT (key) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

-- Grant permissions
GRANT ALL ON settings TO genealogy;

