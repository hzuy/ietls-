# AI explanation runtime hotfix — 2026-11-14

## Confirmed failures

Production logs for Reading exam 23 recorded question 2 timing out after 33,680 ms and question 5 after 20,840 ms. Read-only metadata showed those questions still held explanations from the earlier run. Separate group requests failed with Prisma P2028, including an interactive transaction exceeding its default 5,000 ms timeout at 5,323 ms.

Source tracing found Gemini's 22-second network deadline was created before the rate-limit queue, shortening its actual network window. Explanation generation nested model retries inside provider retries, and the final transient attempt could wait unnecessarily. Forced Gemini mode could fall through to Groq after that branch.

## Repair

- Start Gemini's network timer inside the scheduled call. Explanation requests use a single model per attempt and no nested transport retries; the outer bounded retry/fallback policy remains. Forced Gemini and image constraints remain enforced.
- Save batches with explicit transaction options: at most 2 seconds to acquire and 10 seconds to execute, reduced to fit the remaining 48-second HTTP budget. Skip empty saves. Preserve existing teacher-protection and concurrent-edit checks; no schema changes or automatic regeneration of production questions.
- Surface rollback as `AI_SAVE_FAILED`, phase `saving`, with a safe cause code and failure timestamp. No raw SQL/credentials in that response. HTTP/client loops retain this metadata rather than converting it to a generic provider timeout.
- Question deadlines carry phase/provider/model/cause information scoped to that question. UI errors distinguish queue wait, provider processing and database save, including the actual deadline duration.
- Reports and question badges compare the saved explanation timestamp to the failure timestamp. Existing older explanations keep the warning; a demonstrably newer saved explanation supersedes it. The question modal identifies both timestamps and initializes from the saved explanation to avoid a false warning on its first frame.
- Keep the minimal disclosure UI; no extra toast/modal. Technical details remain collapsed and redacted.

Prisma's documented interactive transaction settings and rollback behavior: [transaction options](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions#transaction-options). The project uses Prisma 5.22, which supports these options.

## Verification

- Six new reproduction cases failed before the repair; the targeted backend set passed afterward.
- Full backend: 1,140 passed, 64 skipped integration cases requiring isolated development PostgreSQL. Local Docker engine was unavailable; no production data writes were substituted for integration testing.
- Full frontend: 958 passed. An existing dirty-form synchronization test failed under the initial concurrent full run, passed alone, then passed in the full run with four workers. No weakening of its assertions.
- Chromium: 12 scenarios across four editors verify old explanation/failure timestamps, queue timeout duration, database save labeling, and removal of a superseded warning. All requests use fixtures.
- Production build and source syntax checks passed. Scoped ESLint has no errors; existing modal hook/refresh warnings remain. Frontend production dependency audit: zero findings. Backend retains the two previously documented moderate `exceljs → uuid` dependency findings; no dependencies changed.

## Production rollout

### Individually saved explanation synchronization

Manual save/review callbacks previously updated editor form data without updating the per-question database snapshot, leaving a false `Chưa lưu` badge. Modal selection also retained the old `question.explanation`; Practice updated the group map while the question-level copy could still override it.

Successful API callbacks now acknowledge only that question in the parent snapshot, synchronize both explanation copies and the selected modal question, and patch only the saved field in the Practice pristine signature. Unrelated content and explanation edits remain dirty. Failed requests never invoke acknowledgement. Four editor integration cases verify manual save, the `Đã sửa` badge and reopening with the returned explanation. Baseline unit cases cover isolated updates, input immutability and preservation of unrelated drafts. No backend endpoints, authorization or production data were changed during verification.

### Saved confirmation alert

Successful current-visit generation and conflict confirmation now display one browser alert, `Đã lưu giải thích thành công.`, for Test and Practice Reading/Listening. The alert is emitted after the final persisted result, not per chunk. Reports with errors, cancellation, pending verification, unresolved answer conflicts or zero saved results do not trigger success. The change uses the existing shared alert utility; no backend/data changes. Unit tests cover suppression and successful notification; editor tests cover retry, confirmation and a single alert after multiple groups. Scoped lint, build, diff checks and frontend dependency audit passed (zero findings).

### Fresh editor visits

Reading/Listening Test and Practice no longer restore AI heartbeat, progress or failure reports from a previous visit. Opening an editor clears its legacy report/evidence keys, does not query or poll `explanation-status`, and starts with unlocked controls and no resume banner. Current-visit progress and retry details remain in memory. Leaving/changing the edited target aborts the owned request; pagehide also aborts it. Saved database explanations and content drafts are unaffected. Server-side generation locks and request-abort handling remain in place for actual simultaneous requests; a real HTTP 409 remains visible as a request failure, without resurrecting an old progress screen.

Verification: all 964 frontend tests passed, including four-editor fresh-visit checks and current-visit retry/unsaved-edit guards. Fourteen backend lock/cancellation regression tests passed. Build, scoped lint and diff checks passed; frontend production dependency audit returned zero findings. Security review confirmed the backend lock/auth/write guards remain intact and browser storage now contains no new run progress. Existing restore tests were updated to the requested fresh-visit behavior, while the unsaved-content retry test now creates its error during the active visit.

### Conflict confirmation follow-up

The confirmation button previously re-entered generation, so even accepting an already persisted AI preview called the provider again. Test editors also omitted the selected question-number scope. Confirmation now scopes server and client work to the selected numbers and adopts the persisted `conflict_pending` explanation for the AI choice. Missing, inconsistent or unsupported previews return a per-question error instead of generating an unseen replacement. Existing teacher-protection and concurrent-update save guards remain. Keeping a teacher answer still uses the existing independent-evidence checks.

Verification: 1,144 backend tests passed (64 isolated-database integration cases skipped); 958 frontend tests passed. New cases cover exact preview adoption without provider calls, excluding unrelated questions, and rejecting missing previews. Production build and scoped lint passed. Security review confirmed teacher-only routes, server-loaded previews, and existing protected/concurrent save guards. Dependency audit remains zero frontend findings and two existing moderate backend findings in exceljs/uuid; dependencies unchanged.

- Deployed source `82c11bd4a434b245c0ce6869c96709f63a55428d` to https://hzuy.net on 2026-11-14.
- Release: `/home/huuduy/releases/ai-runtime-82c11bd4-1794649619`; rollback backup: `/home/huuduy/backups/ai-runtime-82c11bd4-1794649619`.
- Backend image: `sha256:d7b5ea2c5b9cd8cfac02cdd1baa37464277a4902e67fef9cb5235fe64fa80c9c`.
- Candidate image passed a transaction explicitly set READ ONLY with `SELECT 1 AS ok FROM pg_sleep(5.4)`: total 7,542 ms. This validates the production connection with the new save limits without updating application data.
- Candidate Gemini client returned valid synthetic JSON using `gemini-3.5-flash-lite`.
- Backend API smoke passed. Staged frontend asset checksums and public HTML/main JavaScript checksums matched the local build after activation. Prisma reports all 14 migrations up to date; no migrations or real explanation generation were run.
- Initial candidate probe used Docker's raw env-file parsing, which preserved quotes that Compose normally strips. It failed before activation. The successful probe used the existing container's parsed environment; no environment values were changed.
