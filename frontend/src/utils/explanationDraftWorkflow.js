export function draftSaveMetadata(explanation) {
  return {
    expectedDraftVersion: explanation?.draftVersion ?? null,
    expectedSourceHash: explanation?.sourceHash ?? null,
    expectedPublishedVersion: explanation?.publishedVersion ?? null,
  }
}

export function explanationPublishMetadata(explanation) {
  return { draftVersion: explanation?.draftVersion ?? null, sourceHash: explanation?.sourceHash ?? null }
}

export function canUseExplanation(explanation) {
  if (!explanation || explanation.validationIssue) return false
  if (explanation.workflowVersion === 3) {
    return explanation.hasDraft && explanation.status === 'draft_ready'
      && Boolean(explanation.draftVersion && explanation.sourceHash)
  }
  return !['needs_regeneration', 'possibly_stale', 'conflict_pending', 'error'].includes(explanation.status)
}
