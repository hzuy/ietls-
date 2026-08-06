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
    gradient: 'linear-gradient(90deg, #2563EB, #60A5FA)',
    zIndex: 99999,
    boxShadow: '0 0 8px rgba(37,99,235,0.5)',
    initialPercent: 15,
    crawlPercent: 55,
    crawlDelayMs: 80,
    finishDelayMs: 300,
    routeMinDelayMs: 120,
  },
  skeleton: {
    bgClass: 'bg-gray-200',
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
    cardBg: 'bg-sky-50/70 border-sky-300',
    badge: 'bg-sky-500 text-white',
    subBoxBg: 'bg-sky-100/50 border-sky-200 text-sky-900',
    headerBg: 'bg-sky-100/60 border-sky-200',
  },
  2: {
    cardBg: 'bg-purple-50/70 border-purple-300',
    badge: 'bg-purple-500 text-white',
    subBoxBg: 'bg-purple-100/50 border-purple-200 text-purple-900',
    headerBg: 'bg-purple-100/60 border-purple-200',
  },
  3: {
    cardBg: 'bg-amber-50/70 border-amber-300',
    badge: 'bg-amber-500 text-white',
    subBoxBg: 'bg-amber-100/50 border-amber-200 text-amber-900',
    headerBg: 'bg-amber-100/60 border-amber-200',
  },
}

export function getPartTheme(partNumber) {
  return SPEAKING_PART_THEMES[partNumber] || SPEAKING_PART_THEMES[1]
}
