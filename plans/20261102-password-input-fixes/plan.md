# Password input and validation fixes

Scope accepted by user: remove the long password guidance from all three change
forms, prioritize checking the current password, prevent stale form state from
reporting an outdated length error, and add independent visibility toggles to
login, registration and all self-service password-change fields.

Confirmed cause: client policy validation and API schema policy validation both
run before bcrypt checks the current password. Form submit handlers read React
state rather than live named form values, which can diverge during autofill.
Registration also retains its old error while the password is being edited.

Implementation:
1. Regression tests: wrong current + short new password, exact 8-character new
   password, and native autofill values without React change events.
2. Validate the change request shape before the handler; validate new password
   policy only after verifying the current password in the shared server service.
   Preserve auth, rate limits, byte limits, CAS updates and revocation.
3. Read FormData in the three change forms and login/registration. Keep presence
   and confirmation checks in the client; defer new password policy to the server
   for changes. Registration retains new-password policy checks.
4. Add a reusable accessible PasswordInput with a type=button eye toggle and use
   it in the five forms. Preserve value, autocomplete, disabled state and labels.
5. Remove the requested guidance, run focused tests/build/lint, security review,
   and browser checks with intercepted APIs. No real password changes for QA.

No DB migration or dependency changes required. Existing unrelated work stays
untouched. Reviewed risks: no separate current-password-verification endpoint,
rate limits still precede bcrypt, password visibility never persisted or logged,
and FormData is read before disabling inputs.

## Verification

- Before the fix: all three role tests reproduced policy errors masking incorrect
  current passwords; the autofill regression reproduced stale React values.
- After the fix: backend 92 tests passed; frontend 62 tests passed; targeted lint
  has no errors or warnings; production build passed with existing CSS warnings.
- Browser verification passed for user, admin, teacher, login and registration:
  old-password error first, short-password error only after a correct current
  password, successful correction to eight characters, independent eye toggles,
  preserved autofill, no unwanted submits, removed guidance and no page errors.
- Security review: password policy remains server-side after current-password
  verification. Existing auth, rate limits, CAS updates and session revocation
  remain intact; visibility is local UI state. No dependency or schema change,
  no real password changes for QA, no secrets added.
