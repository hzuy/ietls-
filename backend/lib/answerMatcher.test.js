import { describe, it, expect } from 'vitest'
const { isAnswerMatch, normalizeBasic } = require('./answerMatcher')

describe('answerMatcher', () => {
  it('so khớp cơ bản không phân biệt hoa thường và khoảng trắng thừa', () => {
    expect(isAnswerMatch('  Library  ', 'library')).toBe(true)
    expect(isAnswerMatch('green   house', 'green house')).toBe(true)
    expect(isAnswerMatch('', 'library')).toBe(false)
    expect(isAnswerMatch('   ', 'library')).toBe(false)
  })

  it('bỏ qua dấu câu thừa ở đầu hoặc cuối như ?, ., ,, !', () => {
    expect(isAnswerMatch('library?', 'library')).toBe(true)
    expect(isAnswerMatch('library.', 'library')).toBe(true)
    expect(isAnswerMatch('11?', '11.00')).toBe(true)
    expect(isAnswerMatch('11:00?', '11.00')).toBe(true)
    expect(isAnswerMatch('?library!', 'library')).toBe(true)
  })

  it('chấp nhận các biến thể định dạng giờ 11.00 / 11:00 / 11', () => {
    expect(isAnswerMatch('11', '11.00')).toBe(true)
    expect(isAnswerMatch('11:00', '11.00')).toBe(true)
    expect(isAnswerMatch('11.00', '11.00')).toBe(true)
    expect(isAnswerMatch('11', '11:00')).toBe(true)
    expect(isAnswerMatch('11.00', '11:00')).toBe(true)
    expect(isAnswerMatch('9:30', '9.30')).toBe(true)
    expect(isAnswerMatch('09:30', '9.30')).toBe(true)
    expect(isAnswerMatch('9.30', '9:30')).toBe(true)
  })

  it('KHÔNG khớp sai giờ khác phút (11 không khớp 11.30, 11.00 không khớp số nguyên 11)', () => {
    expect(isAnswerMatch('11', '11.30')).toBe(false)
    expect(isAnswerMatch('11', '11:30')).toBe(false)
    expect(isAnswerMatch('11:00', '11')).toBe(false)
    expect(isAnswerMatch('11.00', '11')).toBe(false)
  })

  it('hỗ trợ am/pm và a.m./p.m. linh hoạt khoảng trắng', () => {
    expect(isAnswerMatch('11am', '11.00 am')).toBe(true)
    expect(isAnswerMatch('11 am', '11:00am')).toBe(true)
    expect(isAnswerMatch('11:00 a.m.', '11.00 am')).toBe(true)
    expect(isAnswerMatch('11.00pm', '11 pm')).toBe(true)
    expect(isAnswerMatch('11 am', '11 pm')).toBe(false)
  })

  it('hỗ trợ biến thể cách nhau bởi / và từ tùy chọn trong ngoặc đơn', () => {
    expect(isAnswerMatch('discs', 'discs/disks')).toBe(true)
    expect(isAnswerMatch('disks', 'discs/disks')).toBe(true)
    expect(isAnswerMatch('library', '(the) library')).toBe(true)
    expect(isAnswerMatch('the library', '(the) library')).toBe(true)
    expect(isAnswerMatch('11', '11(.00)')).toBe(true)
    expect(isAnswerMatch('11.00', '11(.00)')).toBe(true)
  })

  it('tôn trọng cờ allowSlash = false khi cần', () => {
    expect(isAnswerMatch('A', 'A/B', { allowSlash: false })).toBe(false)
    expect(isAnswerMatch('A/B', 'A/B', { allowSlash: false })).toBe(true)
  })

  it('normalizeBasic chuẩn hóa dấu nháy cong và gạch ngang', () => {
    expect(normalizeBasic('don’t?')).toBe("don't")
    expect(normalizeBasic('well–known.')).toBe('well-known')
  })
})
