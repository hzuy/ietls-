# Password flow hardening

Scope: user, admin and teacher self-service password changes, mandatory changes,
Google-only accounts, staff password resets and all session validation paths.
Baseline checkpoint: b34298e. Existing unrelated changes must remain untouched.

## Accepted design

- Keep Express/Prisma/PostgreSQL and React/TanStack Query conventions.
- Use one password policy (8 characters minimum, 72 UTF-8 bytes maximum for bcrypt).
- Share password change logic across both existing API contracts.
- Add User.tokenVersion; include it in all issued JWTs. Legacy tokens represent
  version zero. Read security state fresh per authenticated request so revocation
  works across processes without a stale in-memory cache.
- Compare-and-swap the password hash and token version in one updateMany operation;
  a concurrent reset/change must prevent a stale request from overwriting it.
- Require server-side mandatory password changes, with an exact method/path
  allowlist for profile reads and password-change endpoints.
- Limit attempts by both user and IP across both change endpoints.
- Password resets increment tokenVersion and set requirePasswordChange. Staff
  account edits cannot change the actor's own password without the current one.
- All three UI entry points use alerts, block duplicate submissions, show precise
  validation errors, and clear auth/cache state after successful changes.
- Google-only accounts get explanatory text instead of an unusable password form.

## Execution and acceptance

1. Prepare additive SQL migration; generate Prisma client without applying SQL.
2. Implement and test shared backend policy, concurrency, rate limits, revocation,
   forced changes, role checks and reset behavior with mocked persistence only.
3. Implement and test user, admin/teacher and mandatory-change forms, including
   pending requests, failures, Google accounts and logout after success.
4. Run related suites, frontend build/lint, dependency audits, secret/diff review.
5. Document migration/application order and runtime verification. Do not apply a
   migration or mutate real data without explicit user confirmation (AGENTS.md).

Out of scope: password recovery by email, MFA, redesigning account management,
deployment, changes to unrelated working-tree files.

Risks reviewed: legacy JWT compatibility only at version zero; no hash in API
responses; byte count differs from character count; immediate revocation requires
a fresh DB read; timeout after successful write can require signing in again.

## Result

Implementation and verification complete: backend 86 tests; frontend 53 tests;
three-role browser verification; build, targeted lint, Prisma validation and
isolated client generation passed. Dependency audit findings are documented in
docs/password-change-hardening.md. The user subsequently approved the Supabase
migration and backend restart. Migration applied, default client regenerated,
backend restarted on 3001, frontend running on 5173. Read-only live schema/API/CORS
checks passed; no real user's password was changed for verification.
