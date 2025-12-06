# Contributing to Genealogy Frontend

## Git Workflow

This project uses a **Git Flow-lite** branching strategy to ensure code quality and stable releases.

### Branch Structure

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production-ready code, deployed automatically | ✅ Yes |
| `develop` | Integration branch for features | ❌ No |
| `feature/*` | New features | ❌ No |
| `fix/*` | Bug fixes | ❌ No |
| `hotfix/*` | Urgent production fixes | ❌ No |

### Development Workflow

1. **Start from develop**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code
   - Add tests
   - Run `npm run lint` and `npm test`

3. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   gh pr create --base develop --title "Feature: Your feature name"
   ```

4. **PR Review & Merge**
   - CI checks must pass (lint, tests, build)
   - Merge to `develop` when ready

5. **Release to Production**
   - Create PR from `develop` → `main`
   - All CI checks must pass
   - Docker build validation runs
   - Merge triggers automatic deployment

### Hotfix Workflow (Urgent Production Fixes)

1. **Branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-bug-fix
   ```

2. **Fix, test, and push**
   ```bash
   git push origin hotfix/critical-bug-fix
   gh pr create --base main --title "Hotfix: Critical bug fix"
   ```

3. **After merging to main, sync to develop**
   ```bash
   git checkout develop
   git merge main
   git push origin develop
   ```

## CI/CD Pipeline

### Pull Request Checks (`ci.yml`)
- ✅ Lint check
- ✅ Unit tests with coverage
- ✅ Build verification
- ✅ Docker build validation (for PRs to main)

### Production Deploy (`deploy.yml`)
Triggered on merge to `main`:
- Run tests
- Build Docker image
- Validate container health
- Push to ECR
- Deploy to AWS App Runner
- Cleanup old images

## Code Standards

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint with Next.js config
- **Testing**: Jest with React Testing Library
- **Formatting**: Follow existing code style

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

## Getting Started

```bash
# Clone and install
git clone git@github.com:pmilano1/genealogy-frontend.git
cd genealogy-frontend
npm install

# Run development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Questions?

Open an issue or reach out to the maintainers.

