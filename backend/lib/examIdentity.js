'use strict'

class ExamIdentityConflict extends Error {
  constructor() { super('Nội dung đề đã thay đổi hoặc ID nhóm/câu hỏi không còn khớp. Vui lòng tải lại đề trước khi lưu tiếp.') }
}

function matchExistingGroup(group, index, oldGroups, matched) {
  if (group.isNew) {
    if (group.id != null) throw new ExamIdentityConflict()
    return null
  }
  if (group.id != null) {
    const old = oldGroups.find(g => g.id === Number(group.id))
    if (!old || matched.has(old.id)) throw new ExamIdentityConflict()
    return old
  }
  // Compatibility for older clients that did not send IDs/new-object markers.
  const positional = oldGroups[index]
  return positional && !matched.has(positional.id) ? positional : oldGroups.find(g => !matched.has(g.id))
}

module.exports = { ExamIdentityConflict, matchExistingGroup }
