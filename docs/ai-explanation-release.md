# Admin AI explanation release — 2026-11-13

## Minimal feedback UI — 2026-11-14

Deployed frontend `afc2f846a3c8fc8eaefa789d5b9ff3f37d481775` to `https://hzuy.net`. A single progress panel replaces duplicated toolbar badges, sticky progress and outcome toasts/alerts. Errors remain collapsed until explicitly opened, including after completion; blocking validation stays visible inline. Both Practice panels sit above the two-column editor so mobile users can see progress immediately.

Question failures expose causes in the question modal while the task continues; editing and retry remain locked. Reports update with each chunk without double-counting the final group result, retain failures outside scoped retries, distinguish queued service failures from processed questions, and exclude protected questions from the planned workload. Saved explanation quality has its own collapsed reason filter.

Validation: full frontend **954 passed**; final panel placement **42 targeted tests passed**; backend **1130 passed, 64 skipped**; Chromium **12 scenarios passed** across all four editors and three widths. Production frontend dependency audit and source secret scan passed. Error messages, session reports and clipboard details redact credentials. Existing CSS highlight/bundle-size warnings remain.

Frontend deployment backed up and staged before swapping, verified checksums for all **96 files**, matched public HTML/main JS to the local build, checked the public API, and confirmed the backend image remained unchanged. Release: `/home/huuduy/releases/ai-feedback-afc2f846-1794634437`. Rollback: `/home/huuduy/backups/ai-feedback-afc2f846-1794634437/frontend.tar.gz`. Source was archived separately to preserve the historical server working tree. No DB writes, migration or live explanation generation were used for this UI release.

See [accepted design and verification](admin-ai-feedback-design.md).

## Update — 2026-11-14

Deployed source commit `02dae1062e5a291e21b9848756b13567acf21f1e` to `https://hzuy.net`.

- Reading/Listening Test and Practice share a native alert on completed generation failures, validation blocks and fallback-review warnings. The alert lists affected questions, causes and next actions once per completed report; successful generation remains quiet. The existing report retains details and scoped retries.
- Question deadlines now abort provider requests and return numbered `AI_QUESTION_TIMEOUT` errors. The deadline allows the provider request/retry window while reserving save time within the hard request budget.
- Full frontend: **943 passed**, 119 files. Full backend: **1130 passed**, 64 skipped (six isolated development DB integration suites). Targeted ESLint, diff whitespace check, staged secret scan and production build passed.
- Chromium fixture at 390/768/1440 px: one alert, scoped retry, no horizontal overflow or uncaught page errors. Four editor integration flows cover failure/retry behavior with mocked API responses.
- Production frontend dependency audit: zero vulnerabilities. Backend: two moderate dependency findings in the existing `exceljs → uuid` chain; no dependency changes in this release.
- Gemini environment was synchronized privately from local to the server: `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_MAX_RPM`. A synthetic JSON prompt directly to `gemini-3.5-flash-lite` passed in the running container. This provider check does not generate or modify real explanations.
- Backend image: `sha256:edf6e078a0f22f54ba17662f4721b10c65cce1c16039b94a3306dd16c2d30f94`. Built from a committed source archive under `/home/huuduy/releases/ai-02dae106-1794631248`, preserving the historical dirty server checkout. Frontend was built locally and staged before replacement; asset checksums, public HTML/API/main JS and SELinux label were verified.
- Backups: `/home/huuduy/backups/ai-02dae106-1794631248` contains frontend archive, private environment backup and old image ID. Previous image remains tagged `ielts-app-backend:previous`. Earlier deployment attempts rolled back after Cloudflare asset network failures; final verification passed with IPv4, bounded requests and local asset checksum comparison.
- `prisma migrate status`: schema up to date, 14 migrations. No migration or production explanation generation was run.

The sections below describe the preceding frontend-only release.

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
