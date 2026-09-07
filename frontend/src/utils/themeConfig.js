/**
 * Centralized Theme & Animation Config Manager
 * Enforces policy: No hardcoded animations, transitions, hover effects, or theme styles.
 * All dynamic UI configs, transition timings, theme tokens, and loading properties must be resolved via helper functions.
 */

// ─── ANIMATION & TRANSITION CONFIG ──────────────────────────────────────────
export const ANIMATION_PRESETS = {
  fast: 'transition-all duration-150 ease-in-out',
  normal: 'transition-all duration-300 ease-in-out',
  slow: 'transition-all duration-500 ease-in-out',
  pulse: 'animate-pulse',
  bounce: 'animate-bounce',
  spin: 'animate-spin linear infinite',
}

export function getAnimationConfig(presetKey = 'normal', customOptions = {}) {
  const base = ANIMATION_PRESETS[presetKey] || ANIMATION_PRESETS.normal
  const hoverScale = customOptions.hoverScale ? 'hover:scale-[1.02] active:scale-[0.98]' : ''
  const hoverOpacity = customOptions.hoverOpacity ? 'hover:opacity-90' : ''

  return {
    className: `${base} ${hoverScale} ${hoverOpacity}`.trim(),
    style: {
      animationDuration: customOptions.duration ? `${customOptions.duration}ms` : undefined,
      animationDelay: customOptions.delay ? `${customOptions.delay}ms` : undefined,
    },
  }
}

// ─── LOADING INDICATOR & SKELETON CONFIG ─────────────────────────────────────
export const LOADING_CONFIG = {
  progressBar: {
    height: 2,
    gradient: 'linear-gradient(90deg, #18181b, #71717a)',
    zIndex: 99999,
    boxShadow: '0 0 8px rgba(24,24,27,0.3)',
    initialPercent: 15,
    crawlPercent: 55,
    crawlDelayMs: 80,
    finishDelayMs: 300,
    routeMinDelayMs: 120,
  },
  skeleton: {
    bgClass: 'bg-zinc-200',
    animateClass: 'animate-pulse',
    roundedClass: 'rounded',
  },
}

export function getLoadingConfig(variant = 'progressBar') {
  return LOADING_CONFIG[variant] || LOADING_CONFIG.progressBar
}

// ─── SPEAKING PART THEMES ───────────────────────────────────────────────────
export const SPEAKING_PART_THEMES = {
  1: {
    cardBg: 'bg-zinc-50 border-zinc-300',
    badge: 'bg-zinc-900 text-white',
    subBoxBg: 'bg-zinc-100 border-zinc-200 text-zinc-900',
    headerBg: 'bg-zinc-100/80 border-zinc-200',
  },
  2: {
    cardBg: 'bg-zinc-50 border-zinc-300',
    badge: 'bg-zinc-800 text-white',
    subBoxBg: 'bg-zinc-100 border-zinc-200 text-zinc-900',
    headerBg: 'bg-zinc-100/80 border-zinc-200',
  },
  3: {
    cardBg: 'bg-zinc-50 border-zinc-300',
    badge: 'bg-zinc-700 text-white',
    subBoxBg: 'bg-zinc-100 border-zinc-200 text-zinc-900',
    headerBg: 'bg-zinc-100/80 border-zinc-200',
  },
}

export function getPartTheme(partNumber) {
  return SPEAKING_PART_THEMES[partNumber] || SPEAKING_PART_THEMES[1]
}
