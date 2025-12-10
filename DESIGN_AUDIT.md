# Design Audit - Issue #224

**Date**: 2025-12-10
**Auditor**: AI Assistant
**Scope**: All pages except `/tree`

## Audit Criteria
1. Layout consistency (spacing, padding, margins)
2. Typography (font sizes, weights, line heights)
3. Color scheme adherence (theme colors)
4. Component styling (buttons, forms, cards)
5. Responsive design (breakpoints)
6. Interactive states (hover, focus, active)
7. Accessibility (ARIA labels, roles, keyboard navigation)

---

## Page 1: `/` (Homepage/Dashboard)

### ✅ Strengths
- Clean layout with sidebar navigation
- Stats cards have consistent styling
- Good use of icons and visual hierarchy
- Search bar prominently placed

### ⚠️ Issues Found

#### Layout & Spacing
- [ ] Stats cards (👥 Total People, etc.) - inconsistent padding/spacing
- [ ] "Recently Born" section - cards have different heights
- [ ] Quick Actions buttons - spacing between buttons varies

#### Typography
- [ ] Page title "Dashboard" - check if h1 is consistent across all pages
- [ ] Stats numbers (855, 117, etc.) - font size/weight consistency
- [ ] Card titles - some use h2, check hierarchy

#### Colors
- [ ] Stats cards background - verify theme color usage
- [ ] Links in Research Suggestions - check hover states
- [ ] Progress bars (75% complete) - verify color consistency

#### Accessibility (ARIA)
- [ ] Search combobox - has label but check aria-expanded, aria-controls
- [ ] Stats cards - missing aria-labels for screen readers
- [ ] Quick Actions buttons - check aria-labels
- [ ] Tree view links - check aria-labels for icon-only buttons
- [ ] Sidebar navigation - check aria-current for active page
- [ ] Collapse sidebar button - check aria-expanded state

#### Interactive States
- [ ] Quick Actions buttons - verify hover/focus states
- [ ] Person cards - check hover states
- [ ] Navigation links - verify active state styling

---

## Page 2: `/people` (People List)

### ✅ Strengths
- Consistent layout with sidebar
- Filter/sort controls present

### ⚠️ Issues Found

#### Accessibility (ARIA)
- [ ] Filter comboboxes - missing aria-labels
- [ ] Loading status - has proper role="status"

---

## Page 3: `/search` (Search Results)

### ✅ Strengths
- Clean empty state with emoji
- Clear messaging

### ⚠️ Issues Found

#### Accessibility (ARIA)
- [ ] Empty state - could use aria-live for dynamic updates

---

## Page 4: `/research` (Research Queue)

### ✅ Strengths
- Consistent layout

### ⚠️ Issues Found

#### Accessibility (ARIA)
- [ ] Loading state - needs proper aria-live or role

---

## Page 5: `/timeline` (Timeline)

### ✅ Strengths
- Filter buttons for event types

### ⚠️ Issues Found

#### Accessibility (ARIA)
- [ ] Filter buttons - missing aria-pressed for toggle state
- [ ] Loading state - needs proper aria-live

---

## Page 6: `/coats-of-arms` (Coat of Arms Management)

### ✅ Strengths
- Clear description of functionality

### ⚠️ Issues Found

#### Accessibility (ARIA)
- [ ] Loading status - has proper role="status"

---

## Page 7: `/login` (Login Page)

### ✅ Strengths
- Clean centered layout
- Clear messaging about private access

### ⚠️ Issues Found

#### Accessibility (ARIA)
- [ ] Sign in buttons - check if they have proper labels
- [ ] Alert role present but empty - investigate

---

## Page 8: `/admin` (Admin Panel)

### ✅ Strengths
- Consistent layout

### ⚠️ Issues Found

#### Accessibility (ARIA)
- [ ] Loading status - has proper role="status"

---

## Page 9: `/relationship` (Relationship Calculator)

### ✅ Strengths
- Loading state present

### ⚠️ Issues Found

#### Accessibility (ARIA)
- [ ] Loading status - has proper role="status"
- [ ] Console errors - "Failed to fetch email config" (not design issue but should be fixed)

---

## CRITICAL ARIA ISSUES (All Pages)

### Sidebar Navigation
- [ ] **MISSING**: `aria-current="page"` on active navigation links
  - Currently uses CSS class `.active` but no ARIA attribute
  - Should add `aria-current="page"` to active link
  - Location: `components/Sidebar.tsx` lines 150-158, 181-189

- [x] **PRESENT**: `aria-label` on collapse button (line 218)

### Global Search
- [ ] **CHECK**: Search combobox aria-expanded, aria-controls, aria-activedescendant
  - Location: `components/GlobalSearch.tsx`

### Person Cards
- [ ] **MISSING**: aria-labels for icon-only tree view buttons
  - Ancestor tree button (🌳 icon)
  - Descendant tree button (🌳 icon)
  - Location: Dashboard "Recently Born" section

### Stats Cards
- [ ] **MISSING**: Semantic meaning for stats
  - Numbers like "855", "117" need context for screen readers
  - Should use aria-label or visually-hidden text

### Interactive Elements
- [ ] **CHECK**: All buttons have accessible names
- [ ] **CHECK**: All form inputs have associated labels
- [ ] **CHECK**: All images have alt text

---

## COLOR SCHEME ANALYSIS

### Current Theme Colors (from globals.css)
```css
--color-primary: #4F46E5 (Indigo-600)
--color-primary-dark: #4338CA (Indigo-700)
--color-secondary: #10B981 (Emerald-500)
--color-accent: #F59E0B (Amber-500)
```

### Inconsistencies Found
- [ ] **CHECK**: Verify all components use CSS variables, not hardcoded colors
- [ ] **CHECK**: Completeness indicators use green/amber/red - verify these match theme
- [ ] **CHECK**: Badge colors (male/female/living) - verify consistency

---

## TYPOGRAPHY ANALYSIS

### Heading Hierarchy
- [ ] **CHECK**: All pages use h1 for main title
- [ ] **CHECK**: Consistent h2 usage for section headings
- [ ] **CHECK**: Font sizes consistent across similar elements

### Font Weights
- [ ] **CHECK**: Consistent use of font-semibold, font-bold
- [ ] **CHECK**: Body text uses consistent weight

---

## LAYOUT & SPACING

### Padding/Margins
- [ ] **CHECK**: Card padding consistent
- [ ] **CHECK**: Section spacing consistent
- [ ] **CHECK**: Button spacing consistent

### Grid Layouts
- [ ] **CHECK**: Stats grid responsive breakpoints
- [ ] **CHECK**: Person card grid consistent

---

## NEXT STEPS

1. Fix critical ARIA issues (aria-current, aria-labels)
2. Verify color scheme consistency
3. Check typography hierarchy
4. Test responsive layouts
5. Verify all interactive states


