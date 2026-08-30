import DOMPurify from 'dompurify'

// Defense-in-depth layer for rich-text sample content (WritingSample /
// SpeakingSample) rendered via dangerouslySetInnerHTML in SampleDetailPage.
//
// The backend already sanitizes on write (backend/lib/sanitizeHtml.js), so in
// normal operation this is a no-op. It exists to neutralize:
//   - rows written before the backend guard existed
//   - anything that reaches the DB through a path that bypasses the route
//     (seed, Prisma Studio, a future import, direct SQL)
//
// Allowlist mirrors the backend config (Phương án A): keep the formatting
// teachers rely on — headings, lists, bold/italic/underline, text colour
// (<font color>), alignment, images (Task 1 charts), tables — and drop anything
// that can execute JavaScript. DOMPurify already removes <script>, every on*
// handler and javascript: URLs by default.

const CONFIG = {
  ALLOWED_TAGS: [
    // inline formatting
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'mark', 'small', 'span',
    // headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // block-level
    'p', 'div', 'br', 'hr', 'blockquote', 'pre', 'code', 'figure', 'figcaption',
    // lists
    'ul', 'ol', 'li',
    // legacy colour (toolbar colour picker emits <font color="#hex">)
    'font',
    // media & links from paste
    'img', 'a',
    // tables from paste
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  ],
  ALLOWED_ATTR: [
    'style', 'color',
    'href', 'title', 'target', 'rel',
    'src', 'alt', 'width', 'height',
    'colspan', 'rowspan', 'scope', 'span',
  ],
  // no class / id / contenteditable / data-* — not in the list above
  ALLOW_DATA_ATTR: false,
  // <img src="data:image/…"> stays allowed (an existing sample embeds a base64
  // PNG); DOMPurify permits data: URIs on img by default and they cannot run JS.
  ADD_ATTR: ['target'],
}

// DOMPurify does NOT filter CSS *property values* inside a kept `style`
// attribute, so on its own it would pass through `position: fixed` / `z-index`
// (invisible click-jacking overlay) and legacy `expression(...)`. The backend's
// sanitize-html filters styles via an allowlist; we mirror that here with a hook
// so the two layers behave the same. Only these properties survive, and only
// when the value has no function call / markup.
const ALLOWED_STYLE_PROPS = new Set([
  'color', 'background-color',
  'text-align', 'text-decoration',
  'font-weight', 'font-style', 'font-size', 'font-family', 'line-height',
  'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
  'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
])
const UNSAFE_VALUE = /[<>]|expression|javascript:|url\s*\(/i
// the only CSS functions allowed in a value (colour helpers); any other "(" is rejected
const SAFE_FUNC = /^(?:rgba?|hsla?)\([\d\s,.%]+\)$/i

function filterStyle(cssText) {
  return String(cssText)
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const i = decl.indexOf(':')
      if (i < 0) return null
      const prop = decl.slice(0, i).trim().toLowerCase()
      const value = decl.slice(i + 1).trim()
      if (!ALLOWED_STYLE_PROPS.has(prop)) return null
      if (!value || UNSAFE_VALUE.test(value)) return null
      if (value.includes('(') && !SAFE_FUNC.test(value)) return null
      return `${prop}: ${value}`
    })
    .filter(Boolean)
    .join('; ')
}

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'style') {
    data.attrValue = filterStyle(data.attrValue)
    if (!data.attrValue) data.keepAttr = false
  }
})

/**
 * @param {string|null|undefined} html
 * @returns {string} sanitized HTML ('' for empty input)
 */
export function sanitizeRichText(html) {
  if (html == null) return ''
  return DOMPurify.sanitize(String(html), CONFIG)
}
