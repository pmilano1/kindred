# Admin Interface Reorganization Plan

## Current State
- Single-level navigation with tabs (Users, Site Settings, API Keys)
- All admin functions on 3 pages
- Settings page is becoming cluttered (branding, privacy, display, email, storage, GEDCOM export)
- No admin dashboard or overview

## Target State
- Proper admin section with sidebar navigation
- Admin dashboard at `/admin` with overview and quick stats
- Logical grouping: Users & Access, Site Settings, Integrations, Data Management, System
- Each section has dedicated pages with focused functionality

## Implementation Phases

### Phase 1: Create Admin Layout & Structure (CURRENT)
**Files to create:**
- `app/admin/layout.tsx` - Admin layout with sidebar
- `components/admin/AdminSidebar.tsx` - Sidebar navigation component
- `components/admin/AdminBreadcrumbs.tsx` - Breadcrumb navigation

**Changes:**
- Move current `/admin/page.tsx` to `/admin/users/page.tsx`
- Create new `/admin/page.tsx` as dashboard
- Update routes to use new structure

### Phase 2: Migrate Existing Pages
**Users & Access:**
- `/admin/users` - User management (current /admin)
- `/admin/users/invitations` - Split from users page
- `/admin/users/api-keys` - Move from /admin/api-keys

**Site Settings:**
- `/admin/settings/branding` - Site name, logo, theme
- `/admin/settings/privacy` - Login requirements, living people
- `/admin/settings/display` - Date format, tree settings

### Phase 3: New Pages
**Integrations:**
- `/admin/integrations/email` - Email provider config (from settings)
- `/admin/integrations/storage` - Storage config (from settings)

**Data Management:**
- `/admin/data/import-export` - GEDCOM tools (from settings)
- `/admin/data/database` - Migrations

**System:**
- `/admin/system/logs` - Email logs, audit logs

### Phase 4: Dashboard
- Quick stats (users, database size, activity)
- Health indicators (email config, storage config, pending migrations)
- Recent activity from audit log
- Quick action buttons

## Navigation Structure
```
/admin (Dashboard)
├── Users & Access
│   ├── /admin/users
│   ├── /admin/users/invitations
│   └── /admin/users/api-keys
├── Site Settings
│   ├── /admin/settings/branding
│   ├── /admin/settings/privacy
│   └── /admin/settings/display
├── Integrations
│   ├── /admin/integrations/email
│   └── /admin/integrations/storage
├── Data Management
│   ├── /admin/data/import-export
│   └── /admin/data/database
└── System
    └── /admin/system/logs
```

## Design Principles
- Sidebar always visible on desktop, collapsible on mobile
- Breadcrumbs show current location
- Card-based layout for content sections
- Consistent spacing and typography
- Loading states and error boundaries
- Mobile-responsive

## Testing Checklist
- [ ] All admin pages accessible via sidebar
- [ ] Breadcrumbs update correctly
- [ ] Mobile navigation works (hamburger menu)
- [ ] All existing functionality preserved
- [ ] No broken links
- [ ] Proper loading states
- [ ] Admin-only access enforced

## Related Issues
- Closes #292
- Related to #180 (activity feed will go in System > Logs)

