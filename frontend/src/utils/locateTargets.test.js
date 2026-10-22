import { describe, it, expect } from 'vitest'
import { buildLocateSpec, resolveTargets } from './locateTargets'

const texts = [
  'Ekman became interested in lies while working with patients.',
  'He tested the ability to detect a lie and the ability to lie successfully.',
  'Rhys Davies made his fortune in the timber and shipping trades.',
]

const explanation = {
  v: 2,
  locate: { paragraph: 1, keywords: ['detect a lie', 'lie successfully'] },
  evidence: {
    paragraph: 2,
    parts: [
      { text: 'Rhys Davies made his fortune in the timber and shipping trades.', paragraph: 2 },
    ],
    chunks: [{ text: 'made his fortune', label: 'gây dựng cơ nghiệp', part: 0 }],
  },
}

describe('buildLocateSpec', () => {
  it('giữ đoạn được chỉ định của từng evidence part và của locate', () => {
    expect(buildLocateSpec(explanation)).toEqual({
      parts: [
        {
          text: 'Rhys Davies made his fortune in the timber and shipping trades.',
          paragraph: 2,
          chunks: ['made his fortune'],
        },
      ],
      keywords: ['detect a lie', 'lie successfully'],
      locateParagraph: 1,
    })
  })

  it('trả null khi không phải explanation v2 hoặc không có dữ liệu định vị', () => {
    expect(buildLocateSpec(null)).toBeNull()
    expect(buildLocateSpec({ v: 1, evidence: 'plain string' })).toBeNull()
    expect(buildLocateSpec({ v: 2 })).toBeNull()
  })
})

describe('resolveTargets', () => {
  it('gạch chân từ khóa ở đoạn locate dù evidence nằm ở đoạn khác', () => {
    const marks = resolveTargets(buildLocateSpec(explanation), texts)
    expect(marks[2]).toEqual([
      { text: 'Rhys Davies made his fortune in the timber and shipping trades.', kind: 'evidence' },
    ])
    expect(marks[1]).toEqual([
      { text: 'detect a lie', kind: 'keyword' },
      { text: 'lie successfully', kind: 'keyword' },
    ])
  })

  it('ưu tiên đúng đoạn được chỉ định khi câu chữ xuất hiện ở nhiều đoạn', () => {
    const dup = ['A cat sat.', 'A cat sat on the mat.']
    const marks = resolveTargets({ parts: [{ text: 'A cat sat', paragraph: 1, chunks: [] }], keywords: [] }, dup)
    expect(marks).toEqual({ 1: [{ text: 'A cat sat', kind: 'evidence' }] })
  })

  it('vẫn gạch chân từ khóa khi evidence không khớp nguyên văn', () => {
    const paraphrased = {
      v: 2,
      locate: { paragraph: 0, keywords: ['shipping trades'] },
      evidence: { parts: [{ text: 'Sentence that does not exist in the passage.', paragraph: 0 }], chunks: [] },
    }
    const marks = resolveTargets(buildLocateSpec(paraphrased), texts)
    expect(marks[2]).toEqual([{ text: 'shipping trades', kind: 'keyword' }])
  })

  it('dùng chunk khi evidence part không khớp nguyên văn', () => {
    const chunked = {
      v: 2,
      locate: {},
      evidence: {
        parts: [{ text: 'Paraphrased sentence about wealth.', paragraph: 2 }],
        chunks: [{ text: 'timber and shipping trades', label: 'ngành gỗ và vận tải biển', part: 0 }],
      },
    }
    const marks = resolveTargets(buildLocateSpec(chunked), texts)
    expect(marks[2]).toEqual([{ text: 'timber and shipping trades', kind: 'evidence' }])
  })

  it('trả null khi không tìm thấy gì', () => {
    const spec = { parts: [{ text: 'nothing here', paragraph: 0, chunks: [] }], keywords: ['missing'] }
    expect(resolveTargets(spec, texts)).toBeNull()
    expect(resolveTargets(spec, [])).toBeNull()
    expect(resolveTargets(null, texts)).toBeNull()
  })
})
