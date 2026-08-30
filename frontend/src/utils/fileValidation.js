// Kiểm tra file phía client TRƯỚC khi upload — chặn sớm, thông báo rõ ràng,
// tránh phải chờ round-trip lên server rồi mới biết file sai.
//
// Đối chiếu giới hạn backend:
//   - ảnh  : 5MB  (thumbUpload trong routes/practice.js & routes/samples.js)
//   - audio: 50MB (audioUpload trong routes/practice.js, upload trong lib/adminUploads.js)
//
// Dựa vào file.type (MIME) chứ KHÔNG dựa đuôi tên. Một số trình duyệt để file.type
// rỗng cho .m4a/.aac → khi đó bỏ qua bước check type (không đủ dữ kiện), vẫn check
// size; backend còn 1 lớp lọc theo đuôi file nữa.

const MB = 1024 * 1024

export const IMAGE_MAX_BYTES = 5 * MB
export const AUDIO_MAX_BYTES = 50 * MB

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/x-m4a']

const sizeMB = (bytes) => (bytes / MB).toFixed(1)

function validateFile(file, { types, maxBytes, typeError, maxLabel }) {
  if (!file) return { ok: false, error: 'Chưa chọn file' }
  if (file.type && !types.includes(file.type)) {
    return { ok: false, error: typeError }
  }
  if (file.size > maxBytes) {
    return { ok: false, error: `${maxLabel} (file của bạn ${sizeMB(file.size)}MB)` }
  }
  return { ok: true, error: null }
}

export function validateImageFile(file) {
  return validateFile(file, {
    types: IMAGE_TYPES,
    maxBytes: IMAGE_MAX_BYTES,
    typeError: 'Ảnh phải là JPG, PNG hoặc WebP',
    maxLabel: 'Ảnh tối đa 5MB',
  })
}

export function validateAudioFile(file) {
  return validateFile(file, {
    types: AUDIO_TYPES,
    maxBytes: AUDIO_MAX_BYTES,
    typeError: 'File audio phải là MP3, WAV, OGG, M4A hoặc AAC',
    maxLabel: 'File audio tối đa 50MB',
  })
}
