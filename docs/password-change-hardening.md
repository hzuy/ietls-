# Password change hardening — 2026-11-02

Implemented for learners, admins and teachers. The user endpoint keeps
`oldPassword` and the staff endpoint keeps `currentPassword`; both now use the
same server-side implementation.

## Behavior

- New passwords require at least 8 characters and at most 72 UTF-8 bytes. This
  policy also applies to registration, staff creation and staff password resets.
- The current password must match; the new password must differ from it.
- One conditional database update replaces the password hash, clears
  `requirePasswordChange` and increments `tokenVersion`. A simultaneous password
  change, reset, lock, deletion or role change prevents a stale update.
- Every authenticated request reads current account security state. There is no
  15-second security-state cache, so revocation also works across backend processes.
- JWTs from local login, email verification and Google login include
  `tokenVersion`. Existing JWTs without this claim are valid only at version zero.
- Server middleware enforces mandatory changes. Only exact GET profile and PUT
  password-change endpoints are allowed while the flag is set. The frontend
  handles `PASSWORD_CHANGE_REQUIRED` even if its local flag was removed.
- Both change endpoints share quotas: 5 attempts/account and 20 attempts/IP per
  15 minutes. Responses include HTTP 429, Retry-After and a retry interval. IPv6
  keys use the library's subnet normalization. Stores are process-local, matching
  existing project limiters; a multi-instance deployment needs a shared store.
- All three forms use browser alerts, disable pending submissions and fields,
  preserve input on recoverable failure, and clear input on success. Logout
  removes authentication and private TanStack Query data before returning home.
- Accounts without a local password receive Google guidance instead of a password
  form. A stale forced-change flag cannot trap a Google-only account.
- Staff creation and admin resets issue temporary passwords requiring a change.
  Resets revoke old sessions. Generated reset passwords use crypto.randomInt and
  have 12 characters. Passwords are never trimmed silently or added to audit data.
- Staff account editing and reset endpoints cannot reset the actor's own password;
  the actor must use the profile flow and supply the current password.

## Verification

- Backend: 6 suites, 86 passing tests. New endpoint tests exercise the real auth
  middleware with an in-memory Prisma mock; no real DB writes.
- Frontend: 9 suites, 53 passing tests, covering password forms, auth modal,
  logout/cache clearing, Axios error handling, route guards and staff layout.
- Headless Edge: user at 390x900; admin and teacher at 1366x900. Verified alert
  feedback, duplicate-submit protection, disabled fields, logout and no page errors.
  All API requests were intercepted and mocked.
- Frontend production build passed. Existing CSS `::highlight` warnings remain.
- Targeted ESLint has no errors; the two pre-existing AuthContext warnings remain.
- Prisma schema validation passed. Prisma Client 5.22 was generated successfully
  into an isolated ignored verification directory. Default generation encountered
  a DLL locked by the running backend; regenerate after stopping that backend.
- Changed-code review: no new dependencies, no embedded real credentials, no
  password hashes returned from either profile endpoint, no plaintext passwords
  logged by the new flow.

### Existing dependency audit findings

The registry-backed audit outside the sandbox reported 28 frontend findings
(1 critical, 14 high, 12 moderate, 1 low) and 31 backend findings (1 critical,
11 high, 18 moderate, 1 low). Critical packages were DOMPurify on the frontend
and transitive proxy-addr on the backend. Dependencies and lockfiles were not
changed by this task. These findings need a separate upgrade and regression
review; this change does not establish a clean dependency security baseline.
Sandbox audit output reported zero and was inconsistent with the registry-backed
result; use the latter for release decisions.

## Applying the database change

Prepared migration:
`backend/prisma/migrations/20261102000000_add_user_token_version/migration.sql`:

```sql
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
```

The configured DATABASE_URL and DIRECT_URL point to Supabase, not an isolated
local test DB. The user explicitly approved this migration after reviewing its
scope. It has now been applied successfully; all 12 migrations are up to date.

Application order used:

1. Inspect migration status. If unrelated migrations are pending, stop before
   deploying them and assess their scope separately.
2. Apply the additive tokenVersion migration to the confirmed database.
3. Stop the existing backend, run `npx prisma generate` from `backend`, and restart
   it. Apply the migration before serving the new backend code.
4. Verify an authenticated profile read, then use a confirmed test account to
   verify change/login/revocation. Do not change a real user's password for QA.

The previous backend and nodemon were stopped, default Prisma Client generation
completed, and the backend was restarted on localhost:3001. The frontend is on
localhost:5173. A read-only live check confirmed the new column, HTTP 200 from
both services, working protected middleware DB lookup using a nonexistent test
principal, and CORS for http://localhost:5173. No real user's password was changed
for verification. The earlier P2022 error for User.tokenVersion is resolved.

Reverting application code can leave the additive column in place; do not remove
it or roll back token versions, which could restore revoked tokens.

## Follow-up: form validation and password visibility

The requested long password guidance was removed from user, staff and mandatory
change forms. Password-change requests now validate their shape first, verify the
current password, then enforce the same new-password policy in the shared service.
An incorrect current password therefore takes precedence over the new password's
length. Presence and confirmation checks still run in the browser.

All five forms read live named FormData values and synchronize the whole form,
including browser autofill that did not emit React change events. Registration
clears outdated errors when editing. A shared PasswordInput supplies independent
accessible visibility toggles without submitting, clearing sibling inputs or
persisting the visibility choice.

Regression results: 92 backend tests and 62 frontend tests passed, including exact
eight-character passwords. Browser checks passed for user/admin/teacher changes
and mobile login/registration. Targeted lint is clean; build passed. Security
review confirmed that auth, rate limits, password byte limits, atomic writes and
session revocation still apply. Dependencies and DB schema were unchanged; the
existing dependency audit findings above remain outstanding.
