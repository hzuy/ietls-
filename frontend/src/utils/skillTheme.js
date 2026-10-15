export const SKILL_THEME = {
  reading:   { bg: 'bg-skill-reading-bg',   text: 'text-skill-reading',   dot: 'bg-skill-reading',   border: 'border-skill-reading-border',   colorVar: '--skill-r-color' },
  listening: { bg: 'bg-skill-listening-bg', text: 'text-skill-listening', dot: 'bg-skill-listening', border: 'border-skill-listening-border', colorVar: '--skill-l-color' },
  writing:   { bg: 'bg-skill-writing-bg',   text: 'text-skill-writing',   dot: 'bg-skill-writing',   border: 'border-skill-writing-border',   colorVar: '--skill-w-color' },
  speaking:  { bg: 'bg-skill-speaking-bg',  text: 'text-skill-speaking',  dot: 'bg-skill-speaking',  border: 'border-skill-speaking-border',  colorVar: '--skill-s-color' },
}

export function skillTheme(skill) {
  const key = String(skill || '').replace(/^practice-/, '')
  return SKILL_THEME[key] || SKILL_THEME.reading
}
