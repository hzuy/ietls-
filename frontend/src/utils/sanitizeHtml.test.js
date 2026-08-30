import { describe, it, expect } from 'vitest'
import { sanitizeRichText } from './sanitizeHtml'

// Defense-in-depth render-time guard for sample rich-text content.
// Mirrors the backend suite (backend/lib/sanitizeHtml.test.js).

describe('sanitizeRichText — strips anything that can execute JavaScript', () => {
  const attacks = [
    ['<script> tag',        '<p>hi</p><script>alert(1)</script>'],
    ['<img onerror>',       '<img src=x onerror=alert(1)>'],
    ['<svg onload>',        '<svg onload=alert(1)></svg>'],
    ['<a href="javascript:">', '<a href="javascript:alert(1)">x</a>'],
    ['<iframe>',            '<iframe src="https://evil.example"></iframe>'],
    ['inline on* handler',  '<p onclick="alert(1)">click</p>'],
    ['CSS expression()',    '<p style="width: expression(alert(1)); color: red">x</p>'],
    ['clickjacking overlay','<div style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999">x</div>'],
    ['<a href="data:text/html">', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
    ['<object> / <embed>',  '<object data="evil.swf"></object><embed src="evil.swf">'],
  ]

  for (const [name, input] of attacks) {
    it(`neutralizes: ${name}`, () => {
      const out = sanitizeRichText(input)
      expect(out).not.toMatch(/<script/i)
      expect(out).not.toMatch(/<iframe/i)
      expect(out).not.toMatch(/<svg/i)
      expect(out).not.toMatch(/<object/i)
      expect(out).not.toMatch(/<embed/i)
      expect(out).not.toMatch(/\bon\w+\s*=/i)      // no event-handler attributes
      expect(out).not.toMatch(/javascript:/i)
      expect(out).not.toMatch(/expression\(/i)
      expect(out).not.toMatch(/position\s*:\s*fixed/i)
      expect(out).not.toMatch(/z-?index/i)
      expect(out).not.toMatch(/data:text\/html/i)
    })
  }

  it('keeps the surrounding text when it strips a dangerous tag', () => {
    expect(sanitizeRichText('<p>before</p><script>x</script><p>after</p>')).toBe('<p>before</p><p>after</p>')
  })
})

describe('sanitizeRichText — preserves the formatting the editor produces', () => {
  it('keeps bold / italic / underline', () => {
    const out = sanitizeRichText('<b>b</b><i>i</i><u>u</u>')
    expect(out).toContain('<b>b</b>')
    expect(out).toContain('<i>i</i>')
    expect(out).toContain('<u>u</u>')
  })

  it('keeps headings H1–H3 and lists', () => {
    const out = sanitizeRichText('<h1>H1</h1><h2>H2</h2><h3>H3</h3><ul><li>a</li></ul><ol><li>b</li></ol>')
    expect(out).toMatch(/<h1>H1<\/h1>/)
    expect(out).toMatch(/<h2>H2<\/h2>/)
    expect(out).toMatch(/<h3>H3<\/h3>/)
    expect(out).toMatch(/<ul><li>a<\/li><\/ul>/)
    expect(out).toMatch(/<ol><li>b<\/li><\/ol>/)
  })

  it('keeps text colour from the colour picker (<font color>)', () => {
    expect(sanitizeRichText('<font color="#040101">x</font>')).toMatch(/<font color="#040101">x<\/font>/)
  })

  it('keeps text-align from the justify buttons (block-level style)', () => {
    expect(sanitizeRichText('<p style="text-align: center;">x</p>')).toMatch(/text-align:\s*center/)
  })

  it('keeps both paragraphs when Enter produced <div> wrappers', () => {
    const out = sanitizeRichText('<div>line1</div><div>line2</div>')
    expect((out.match(/<div>/g) || []).length).toBe(2)
    expect(out).toContain('line1')
    expect(out).toContain('line2')
  })

  it('keeps pasted images — https URL and base64 data URI', () => {
    const https = sanitizeRichText('<img src="https://img.dolenglish.vn/x.png" alt="chart">')
    expect(https).toContain('https://img.dolenglish.vn/x.png')
    expect(https).toMatch(/alt="chart"/)

    const b64 = sanitizeRichText('<img src="data:image/png;base64,iVBORw0KGgo=" alt="m">')
    expect(b64).toContain('data:image/png;base64,iVBORw0KGgo=')
  })

  it('keeps whitelisted inline styles on <span>', () => {
    const out = sanitizeRichText('<span style="font-size:20px;font-weight:bolder;color:#242938">t</span>')
    expect(out).toMatch(/font-size:\s*20px/)
    expect(out).toMatch(/font-weight:\s*bolder/)
    expect(out).toMatch(/color:\s*#242938/)
  })
})

describe('sanitizeRichText — drops junk attributes but keeps content', () => {
  it('removes class / id / contenteditable / data-slate-* and keeps the text', () => {
    const out = sanitizeRichText('<div class="x y" id="z" data-slate-node="element" contenteditable="false">keep me</div>')
    expect(out).not.toMatch(/class=/)
    expect(out).not.toMatch(/\bid=/)
    expect(out).not.toMatch(/data-slate/)
    expect(out).not.toMatch(/contenteditable/)
    expect(out).toContain('keep me')
    expect(out).toContain('<div>')
  })
})

describe('sanitizeRichText — null / empty handling', () => {
  it('returns an empty string for null / undefined / empty input', () => {
    expect(sanitizeRichText(null)).toBe('')
    expect(sanitizeRichText(undefined)).toBe('')
    expect(sanitizeRichText('')).toBe('')
  })
})
