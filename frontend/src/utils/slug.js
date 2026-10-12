/**
 * Helper to convert series name to URL-friendly slug
 * e.g. "IELTS Mock Test" -> "ielts-mock-test"
 *      "IELTS Practice Plus" -> "ielts-practice-plus"
 */
export function toSeriesSlug(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
