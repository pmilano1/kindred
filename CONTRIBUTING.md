# Contributing to Kindred

## Git Workflow

This project uses **trunk-based development** with short-lived feature branches.

### Branch Structure

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production-ready code, deployed automatically | ✅ Yes |
| `feat/*` | New features | ❌ No |
| `fix/*` | Bug fixes | ❌ No |
| `refactor/*` | Code refactoring | ❌ No |
| `docs/*` | Documentation only | ❌ No |

### Development Workflow

1. **Start from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Write code
   - Add/update tests
   - Run checks locally:
     ```bash
     npm run lint      # Biome linter - must pass with zero warnings
     npm run test:fast # Vitest - quick test run
     npm run build     # TypeScript compilation check
     ```

3. **Push and create PR**
   ```bash
   git push origin feat/your-feature-name
   gh pr create --base main --title "feat: your feature name"
   ```

4. **PR Review & Merge**
   - CI checks must pass (lint, test, build)
   - Docker build validation runs for PRs to main
   - Squash merge to main, delete branch

## CI/CD Pipeline

### Pull Request Checks (`ci.yml`)
- ✅ Lint check (Biome)
- ✅ Unit tests with coverage (Vitest)
- ✅ Build verification (Next.js)
- ✅ Docker build validation (for PRs to main)
- ⏭️ Skips expensive jobs for docs-only changes

### Production Deploy (`deploy.yml`)
Triggered on merge to `main`:
- Build Docker image
- Validate container health
- Push to ECR
- Deploy to AWS App Runner

## Code Standards

- **TypeScript**: Strict mode enabled
- **Linting**: Biome (replaces ESLint + Prettier)
- **Testing**: Vitest with React Testing Library
- **Formatting**: Biome handles formatting

## Commit Messages

Use clear, descriptive commit messages:

```
feat: Add person search functionality
fix: Resolve accent-insensitive search issue
docs: Update README with setup instructions
refactor: Consolidate database helpers to pool.ts
test: Add unit tests for tree data structure
chore: Update dependencies
```

## Testing

### Test Commands

| Command | Purpose |
|---------|---------|
| `npm run test` | Run all tests with coverage |
| `npm run test:fast` | Run tests without coverage (faster) |
| `npm run test:watch` | Watch mode for development |
| `npm run test:ci` | CI mode with verbose output |
| `npm run check` | Run lint + fast tests together |

### Writing Tests

Tests are located next to their source files or in `__tests__` directories:
- Component tests: `components/__tests__/ComponentName.test.tsx`
- Utility tests: `lib/__tests__/utilityName.test.ts`

Use React Testing Library for component tests:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Getting Started

```bash
# Clone and install
git clone git@github.com:pmilano1/kindred.git
cd kindred
npm install

# Run development server
npm run dev

# Run all checks before committing
npm run check

# Build for production
npm run build
```

## Branch Protection (Enable When Public)

Branch protection requires GitHub Pro or a public repository. Once this repo is public, enable protection on `main`:

```bash
# Run this after making the repo public
gh api repos/pmilano1/kindred/branches/main/protection \
  -X PUT \
  -F required_status_checks='{"strict":true,"contexts":["Lint","Test","Build Check"]}' \
  -F enforce_admins=false \
  -F required_pull_request_reviews='{"required_approving_review_count":0}' \
  -F restrictions=null \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

This will:
- Require PRs for all changes to `main`
- Require CI checks to pass before merge
- Prevent force pushes and branch deletion

## Questions?

Open an issue or reach out to the maintainers.

