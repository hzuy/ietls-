import { useState } from 'react'
import { IMG_FALLBACK, handleImgError } from '../../utils/media'

/**
 * ImageWithFallback — reusable image component that gracefully falls back
 * to a soft gray SVG placeholder when src is missing or image fails to load.
 *
 * Props:
 *   src        {string}  Image URL
 *   alt        {string}  Descriptive alt text for accessibility
 *   className  {string}  CSS classes
 *   style      {object}  Inline style
 */
export default function ImageWithFallback({
  src,
  alt = '',
  className = '',
  style = {},
  fallback = IMG_FALLBACK,
  ...rest
}) {
  const [hasError, setHasError] = useState(false)

  const imgSrc = hasError || !src ? fallback : src

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      onError={(e) => {
        setHasError(true)
        handleImgError(e)
      }}
      loading="lazy"
      decoding="async"
      {...rest}
    />
  )
}
