import { getLoadingConfig } from '../../utils/themeConfig'

/**
 * SkeletonBase — the atom.
 * Uses centralized skeleton configuration from getLoadingConfig.
 */
export default function SkeletonBase({ className = '', style = {} }) {
  const cfg = getLoadingConfig('skeleton')
  return (
    <div
      className={`${cfg.bgClass} ${cfg.animateClass} ${cfg.roundedClass} ${className}`.trim()}
      style={style}
    />
  )
}
