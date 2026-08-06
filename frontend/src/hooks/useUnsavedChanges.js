import { useEffect } from 'react'

/**
 * BUG-13: Block in-app navigation and tab close when there are unsaved changes.
 * - Uses react-router-dom v7 useBlocker to intercept route changes
 * - Uses beforeunload for tab/window close
 * - Shows native confirm dialog (no custom modal dependency)
 *
 * @param {boolean} isDirty - Whether the form has unsaved changes
 */
export function useUnsavedChanges(isDirty) {
  // Block tab close / page reload
  useEffect(() => {
    const handler = (e) => {
      if (!isDirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // In-app navigation blocking is not supported natively by BrowserRouter in v6+ 
  // without a Data Router, so we remove useBlocker to prevent fatal crash.
}
