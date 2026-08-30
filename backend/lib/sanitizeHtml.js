// Sanitize rich-text HTML from the WritingSample / SpeakingSample editor
// (frontend: components/RichTextEditor.jsx). The editor uses document.execCommand
// AND lets teachers paste rich HTML from external sites, so stored content is
// arbitrary web markup — not just what the toolbar buttons emit.
//
// Goal: strip anything that can execute JavaScript (stored XSS) while keeping the
// formatting teachers actually rely on (headings, lists, bold/italic/underline,
// text colour, alignment, and images — Writing Task 1 samples are meaningless
// without their charts/maps).
//
// sanitize-html already drops <script>, <style>, every on* handler and
// javascript: URLs by default; the config below only widens the tag/attr
// allowlist back to the safe formatting set and hard-limits inline styles.
//
// Shared by: routes/samples.js (on write) and scripts/sanitize-samples.js
// (one-off cleanup of rows created before this guard existed).

const sanitizeHtml = require('sanitize-html')

// Colour values accepted in `color` / `background-color` and the <font color> attr.
const COLOR = [
  /^#(0x)?[0-9a-f]{3,8}$/i,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/i,
  /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/i,
  /^[a-z]+$/i, // named colours: red, transparent, currentcolor…
]
const LENGTH = [/^-?\d+(\.\d+)?(px|em|rem|%|pt|ex|ch)?$/i]

const RICH_TEXT_CONFIG = {
  allowedTags: [
    // ── inline formatting ── (toolbar: Bold/Italic/Underline → <b>/<i>/<u>;
    //    <strong>/<em> from paste; <s>/<sub>/<sup>/<mark> from paste)
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'mark', 'small', 'span',
    // ── headings ── (toolbar: H1/H2/H3; h4–h6 from paste)
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // ── block-level ── (toolbar: P; <div> is what contentEditable emits on Enter
    //    in Chrome; blockquote/pre/code/hr/figure from paste)
    'p', 'div', 'br', 'hr', 'blockquote', 'pre', 'code', 'figure', 'figcaption',
    // ── lists ── (toolbar: ordered / unordered list)
    'ul', 'ol', 'li',
    // ── legacy colour ── (toolbar colour picker emits <font color="#hex">,
    //    because RichTextEditor never calls execCommand('styleWithCSS', true))
    'font',
    // ── media & links from paste ── (Task 1 charts/maps; reference links)
    'img', 'a',
    // ── tables from paste ──
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  ],
  allowedAttributes: {
    '*': ['style'],
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    font: ['color'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    col: ['span'],
  },
  // Everything else — class, id, contenteditable, data-slate-*, the deprecated
  // `color=` attr on <span>, `zindex=`, aria-* junk from paste — is dropped
  // because it is not listed above.
  allowedStyles: {
    '*': {
      color: COLOR,
      'background-color': COLOR,
      'text-align': [/^(left|right|center|justify|start|end)$/i], // toolbar: justify L/C/R
      'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
      'font-style': [/^(normal|italic|oblique)$/i],
      'font-size': LENGTH,
      'font-family': [/^[\w\s,.'"()-]+$/],
      'line-height': [/^\d+(\.\d+)?(px|em|rem|%)?$/i],
      'text-decoration': [/^(none|underline|overline|line-through)(\s+\w+)*$/i],
      'margin': LENGTH, 'margin-top': LENGTH, 'margin-bottom': LENGTH,
      'margin-left': LENGTH, 'margin-right': LENGTH,
      'padding': LENGTH, 'padding-left': LENGTH, 'padding-right': LENGTH,
      'padding-top': LENGTH, 'padding-bottom': LENGTH,
      // no position / z-index / transform / animation → no invisible click-jacking overlays
    },
  },
  // Links: http/https/mailto only (no javascript:, no data:). Images may also use
  // data: URIs — an existing sample embeds a base64 PNG, and <img src="data:…">
  // cannot execute script.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: true,
  // Force safe rel on links that open a new tab.
  transformTags: {
    a: (tagName, attribs) => {
      const out = { ...attribs }
      if (out.target === '_blank') out.rel = 'noopener noreferrer nofollow'
      return { tagName, attribs: out }
    },
  },
  // Default is 'discard' (strip the tag, keep its text) — keep that so removing a
  // stray <script> or <div> never eats the surrounding copy.
}

/**
 * @param {string|null|undefined} html
 * @returns {string|null} sanitized HTML, or null if input was null/undefined
 */
function sanitizeRichText(html) {
  if (html == null) return null
  return sanitizeHtml(String(html), RICH_TEXT_CONFIG)
}

module.exports = { sanitizeRichText, RICH_TEXT_CONFIG }
