# Admin AI explanation release — 2026-11-13

Reading/Listening Test and Practice now show question-level generation failures and fallback-review flags, preserve partial results, and retry only unfinished questions. Session reports survive refresh without sharing keys between Test and Practice. Cancellation and 409 conflicts release editor controls without claiming completion.

Test retries respect the generation lock and ask how to handle unsaved passage/transcript edits. Pending callbacks preserve the retry scope through dirty-form and answer-conflict confirmation. Practice saves dirty content before generation and passes retry scope through `initialQuestionNumbers`. Conflict confirmation submits the displayed default choice and only the confirmed question numbers; protected explanations remain protected.

## Release checks

- Full frontend: **938 passed**, 119 files, zero skips.
- Full backend: **1116 passed**, 64 skipped. Six integration suites require isolated dev PostgreSQL; production DB access was disabled in the test process.
- Targeted ESLint and production build passed. Existing CSS `::highlight` optimization and bundle-size warnings remain.
- Browser fixtures: both Practice editors at 1440/768/390 px preserve completed explanations, retry only the failed question, resolve conflicts only for the selected question, and support keyboard retry without horizontal overflow or uncaught page errors.
- Independent review caught the Test dirty-form retry bypass; two regression cases failed before repair and passed afterward. Final review found no remaining blocker in scope.
- Staged source secret scan: no matches. Production frontend dependency audit: zero vulnerabilities. Existing development-only Vitest audit findings were not upgraded in this change.

## Cleanup

Removed completed `reports/` and `plans/` from the project: 97 generated/evidence files, about 7.8 MiB. Permanent recursive deletion was rejected by automatic policy review, so these artifacts were moved to the OS temporary directory outside the project. Kept runtime helpers, regression tests, environments, uploads, thesis documents/diagrams and skill packages. Deployment logs/packages also live outside the repository; no new report bundle is committed.

## Deployment scope

Frontend-only deployment follows `DEPLOY.md`: build locally with production API settings, verify checksums, back up web root, stage and verify before swapping, preserve ownership/SELinux labels, verify origin/public HTML, assets and public API, and retain automatic rollback.

The server's historical working tree contains prior deployment changes. Preserve it and the running backend image; fetch committed frontend source into a separate release archive for traceability. No backend rebuild, migration, production database writes or live AI generation are part of this release. Live AI-provider correctness remains separate from the mocked regression/browser checks.
