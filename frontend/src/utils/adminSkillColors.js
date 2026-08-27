/**
 * Admin-only skill color palette.
 * One base color per skill, used consistently across:
 *   - chart fills (Area, Bar, progress bar)
 *   - dot indicators
 *   - skill badges (bg = base @ 10% opacity, text = darker shade)
 *
 * Do NOT modify --skill-* CSS custom properties in index.css —
 * those are shared with the user-facing UI and must remain untouched.
 */
export const ADMIN_SKILL_COLORS = {
  reading: {
    base: '#3B82F6',   // blue-500
    bg:   '#3B82F61A', // ~10% opacity
    text: '#1E40AF',   // blue-800
  },
  listening: {
    base: '#10B981',   // emerald-500
    bg:   '#10B9811A',
    text: '#047857',   // emerald-800
  },
  writing: {
    base: '#8B5CF6',   // violet-500
    bg:   '#8B5CF61A',
    text: '#6D28D9',   // violet-700
  },
  speaking: {
    base: '#F59E0B',   // amber-500
    bg:   '#F59E0B1A',
    text: '#B45309',   // amber-700
  },
}

export const SKILL_LABEL = {
  reading:  'Reading',
  listening:'Listening',
  writing:  'Writing',
  speaking: 'Speaking',
}

/** Ordered array used when iterating skills in a fixed sequence */
export const SKILL_ORDER = ['reading', 'listening', 'writing', 'speaking']
