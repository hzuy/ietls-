// ─── Media / asset URL helpers ───────────────────────────────────────────────
// Nguồn chân lý duy nhất cho việc dựng URL ảnh/audio từ đường dẫn tương đối
// (`/uploads/...`) mà backend trả về. Trước đây logic này bị copy cục bộ ở ~15
// file với 3 biến thể parse env khác nhau — nay gom về đây.
//
// `practiceConfig.js` và `adminConstants.js` re-export lại từ file này, nên mọi
// import cũ (BACKEND_URL / resolveImg / toImgSrc / SERVER_BASE) vẫn chạy.

// VITE_API_URL luôn có dạng `<origin>/api` (vd https://hzuy.net/api). Fallback dev.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Origin của backend (bỏ hậu tố `/api`). Dùng anchor `$` để chỉ cắt phần đuôi,
// không đụng tới `/api` nằm giữa đường dẫn.
export const BACKEND_URL = API_BASE.replace(/\/api$/, '')

// Ảnh: null nếu rỗng; giữ nguyên URL tuyệt đối; prefix BACKEND_URL cho path tương đối.
export const resolveImg = (url) =>
  !url ? null : url.startsWith('http') ? url : BACKEND_URL + url

// Biến thể "an toàn cho <img src>": '' thay vì null, chỉ prefix khi path bắt đầu '/'.
export const toImgSrc = (url) =>
  (url || '').startsWith('/') ? `${BACKEND_URL}${url}` : (url || '')

// Ảnh thay thế khi cover/thumbnail lỗi (404, network...) — tránh icon "ảnh vỡ"
// mặc định của trình duyệt. Dùng qua onError={handleImgError} trên <img>.
export const IMG_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" fill="#f1f5f9"/>' +
  '<circle cx="37" cy="37" r="8" fill="#cbd5e1"/>' +
  '<path d="M20 72l18-20 13 13 15-18 18 25H20z" fill="#cbd5e1"/>' +
  '</svg>'
)

export const handleImgError = (e) => {
  e.currentTarget.onerror = null
  e.currentTarget.src = IMG_FALLBACK
}
