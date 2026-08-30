// Trạng thái hoàn thành của Writing task — dùng chung bởi WritingExam.jsx
// (isTaskDone, vòng lặp auto-submit, đếm task chưa nộp trong modal hết giờ).

// Một task coi là "xong" nếu đã có kết quả chấm HOẶC đã nằm trong danh sách đã
// nộp (kể cả phiên trước). Auto-submit khi hết giờ chỉ đụng task KHÔNG xong.
export function isTaskComplete(taskId, results, submittedTaskIds) {
  return !!results[taskId] || submittedTaskIds.includes(taskId)
}

// Số task chưa nộp — hiển thị trong modal hết giờ.
export function countUnsubmitted(tasks, results, submittedTaskIds) {
  return tasks.filter(t => !isTaskComplete(t.id, results, submittedTaskIds)).length
}
