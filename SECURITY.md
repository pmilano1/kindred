# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Kindred, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainer directly at [peterm@milanese.life](mailto:peterm@milanese.life)
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Regular updates on progress
- Credit in release notes (unless you prefer anonymity)

### Scope

This policy applies to:
- The Kindred application code
- Default configurations
- Documentation that could lead to insecure setups

### Out of Scope

- Issues in third-party dependencies (report to upstream)
- Self-hosted instances with custom modifications
- Social engineering attacks

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices

When self-hosting Kindred:

1. **Use HTTPS** - Always deploy behind TLS
2. **Strong secrets** - Generate unique `NEXTAUTH_SECRET` values
3. **Database security** - Use strong passwords, limit network access
4. **Keep updated** - Pull latest images regularly
5. **Limit access** - Use invite-only mode for private trees

