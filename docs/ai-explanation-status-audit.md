# AI explanation status audit and repair plan

Scope: the four admin editors (Reading/Listening Test and Practice), question chips, question modal, conflict confirmation, quality list, run report, save callbacks and learner visibility. Reviewed before further UI changes, 2026-11-14. This is a scoped repair of the existing interface; retain its typography, compact layout and collapsed details.

## Findings

1. `needs_regeneration` covers unsupported teacher answers, unverified fallback results and invalid content. Its UI incorrectly claims every case came from an answer change and directs regeneration instead of explaining the actual reason.
2. `conflict_pending` is named three different ways. The question modal suggests approving a mismatched explanation, while the review API correctly rejects it. A saved conflict has no direct route back to the existing answer confirmation dialog.
3. The answer mismatch appears twice in the question modal. Warning cards, uppercase visibility copy and a second answer strip repeat information instead of identifying one next action.
4. Conflict choices are clickable divs without native radio semantics. The description assumes Reading even for Listening. Saving the AI choice already uses the persisted preview; preserve that behavior.
5. Current-run `retry` state and report entries can outlive a successful manual save/review, overriding the saved badge. Successful save acknowledgement must clear only that question's run issue.
6. Manual-save snapshots and modal question objects are stale (separate verified hotfix, 981 tests passed). Preserve unrelated drafts when acknowledging the saved question.
7. Backend status codes and learner visibility are already defined. No schema/status migration or weakening of answer checks is needed.

## Presentation and actions

| Actual state | Display | Meaning / next action |
| --- | --- | --- |
| conflict_pending | Chờ xác nhận | Show current answer and AI suggestion once; open existing scoped answer confirmation, without generating again to reach the dialog. |
| needs_regeneration | Cần kiểm tra | Show stored needsRegenerationReason; edit the explanation/source or retry when appropriate, without promising regeneration resolves it. |
| possibly_stale | Nội dung đã đổi | Show staleReason and ask to verify/edit against current content. |
| current-run retry | Cần kiểm tra | The attempted fallback was not verified; keep any older saved explanation and show actual reason. |
| generation/save error | Lỗi tạo AI / Lỗi lưu | Actual request failure with existing diagnostic details and retry controls. |
| teacher_edited / teacher_reviewed | Đã sửa / Đã duyệt | Persisted changes; clear superseded current-run issue for this question only. |

## Implementation order

1. Shared labels and reason selection used by badges, quality filter and question modal. Keep backend enum names unchanged.
2. Replace repeated quality banners with one compact reason/action block. Offer answer confirmation for conflicts and direct editing for quality issues; do not offer review for unresolved quality/answer states.
3. Route saved conflicts to the existing confirmation dialog through all four editors. Keep one dialog in focus. Use native radio inputs and compact comparison rows in the existing confirmation dialog.
4. Clear only acknowledged question entries from current-run statuses/report; retain errors and drafts elsewhere. Check single-question confirmation and no-provider-call backend regressions.
5. Test all status causes, failed saves, reopen, both confirmation choices, keyboard selection, actual mismatch suppression and mobile/desktop visuals. Run full frontend tests/build, relevant backend guards, lint and security review. Stage then swap frontend only after checks pass.

## Design risk review

- Renaming a label must not mark a question safe for learners. Preserve server visibility and status values.
- Confirmation must use the stored preview and selected question numbers; preserve the existing transaction/concurrency protections.
- A fallback attempt may preserve an older approved explanation, so avoid claiming that all fallback results hide the saved explanation.
- Quality findings are not transport failures. Amber for review; red for actual failures. Keep details collapsed and one primary action per state.
- Successful manual save must not clear other questions' failures or unsaved source edits.

Planning note: AgentKit CLI is unavailable in this environment; the scoped plan is recorded here rather than CLI-managed plan files.

## Verification results

- Full frontend: 995 tests passed across 124 files. Relevant backend confirmation/answer/visibility/cancellation regressions: 70 tests passed.
- Chromium: eight real-editor scenarios (four editors at 390 and 1440 px) passed with fixture-only APIs and no page errors. Verified one active dialog, no provider/generation request before confirmation, selected question scope, one save alert, actual quality reason, and saved manual-edit badge. Screenshots reviewed on mobile and desktop.
- Native keyboard radio navigation, Escape and focus restoration passed. Saved conflict choices retain existing default behavior and use the persisted preview in the unchanged backend.
- Production build passed. Scoped lint has zero errors and the four pre-existing modal hook/refresh warnings. Frontend production dependency audit: zero findings. Impeccable detector: no findings. Existing CSS highlight and chunk-size build warnings remain.
- Security review: all data remains React text, technical reasons are redacted, no credentials or raw SQL added, no authorization/learner visibility checks weakened, no real data generated/modified by tests. Manual acknowledgement clears only the saved question's run issue.
- The previously verified manual-save synchronization checkpoint is `202b2bfb5b1016363f1023f9820228fcd8f36a26`; deploy it together with this scoped presentation repair.

## Minimal quality-list follow-up

The collapsed summary keeps only its title and count. Expanding shows a wrapping row of numbered question buttons; removed the reason filters, explanatory paragraph and repeated status labels. Reasons remain in accessible button names/tooltips and the question modal. Existing question selection and all four editor integrations are unchanged. Chromium verified 11 items at 390/1440 px, keyboard disclosure, selected-question routing and no horizontal overflow. Scoped lint, build, dependency audit (zero findings) and detector passed; the change adds no API calls or data writes.

The existing fresh-visit integration test now waits for the storage-cleanup effect instead of assuming it has finished when the form input first appears. Its assertion is unchanged; the initial full run exposed that timing assumption under load.
