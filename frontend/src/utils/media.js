// ─── Media / asset URL helpers ───────────────────────────────────────────────
// Nguồn chân lý duy nhất cho việc dựng URL ảnh/audio từ đường dẫn tương đối
// (`/uploads/...`) mà backend trả về.
// Hỗ trợ tự động tối ưu hóa ảnh Cloudinary và fallback bìa học thuật sắc nét.

// VITE_API_URL luôn có dạng `<origin>/api` (vd https://hzuy.net/api). Fallback dev.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Origin của backend (bỏ hậu tố `/api`). Dùng anchor `$` để chỉ cắt phần đuôi,
// không đụng tới `/api` nằm giữa đường dẫn.
export const BACKEND_URL = API_BASE.replace(/\/api$/, '')

/**
 * Kiểm tra xem URL có phải từ Cloudinary CDN hay không
 */
export const isCloudinaryUrl = (url) =>
  Boolean(url && typeof url === 'string' && url.includes('res.cloudinary.com') && url.includes('/upload/'))

/**
 * Tự động chèn parameters tối ưu Cloudinary (format auto, quality best, dpr 2.0, width)
 * để đảm bảo ảnh trên màn hình Retina / High-DPI luôn sắc nét nhất, không bị vỡ hạt.
 */
export const optimizeCloudinaryUrl = (url, { width = 600, quality = 'auto:best', dpr = '2.0' } = {}) => {
  if (!isCloudinaryUrl(url)) return url
  // Đã có transformation rồi thì giữ nguyên
  if (url.includes('/upload/f_auto') || url.includes('/upload/w_') || url.includes('/upload/c_')) {
    return url
  }
  const transform = `f_auto,q_${quality},dpr_${dpr}${width ? `,w_${width}` : ''}`
  return url.replace('/upload/', `/upload/${transform}/`)
}

/**
 * Resolve URL ảnh: null nếu rỗng; prefix BACKEND_URL cho path tương đối;
 * tự động tối ưu nếu là link Cloudinary.
 */
export const resolveImg = (url, options = {}) => {
  if (!url) return null
  const finalUrl = url.startsWith('http') ? url : `${BACKEND_URL}${url}`
  return isCloudinaryUrl(finalUrl) ? optimizeCloudinaryUrl(finalUrl, options) : finalUrl
}

// Biến thể "an toàn cho <img src>": '' thay vì null, chỉ prefix khi path bắt đầu '/'.
export const toImgSrc = (url, options = {}) => {
  if (!url) return ''
  const finalUrl = url.startsWith('/') ? `${BACKEND_URL}${url}` : url
  return isCloudinaryUrl(finalUrl) ? optimizeCloudinaryUrl(finalUrl, options) : finalUrl
}

/**
 * Ảnh thay thế SVG độ phân giải vector cực nét phong cách Zinc Monochrome
 * (thay thế placeholder xám cũ). Bìa sách học thuật với tỷ lệ chuẩn 3:4.
 */
export const IMG_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="100%" height="100%">' +
  '<defs>' +
  '<linearGradient id="zincGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
  '<stop offset="0%" stop-color="#27272a"/>' +
  '<stop offset="60%" stop-color="#18181b"/>' +
  '<stop offset="100%" stop-color="#09090b"/>' +
  '</linearGradient>' +
  '</defs>' +
  '<rect width="300" height="400" rx="12" fill="url(#zincGrad)"/>' +
  '<line x1="22" y1="0" x2="22" y2="400" stroke="#3f3f46" stroke-width="3"/>' +
  '<line x1="26" y1="0" x2="26" y2="400" stroke="#52525b" stroke-width="1" stroke-dasharray="4,4"/>' +
  '<text x="160" y="65" fill="#a1a1aa" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700" letter-spacing="3" text-anchor="middle">IELTS ACADEMIC</text>' +
  '<line x1="60" y1="85" x2="260" y2="85" stroke="#3f3f46" stroke-width="1"/>' +
  '<text x="160" y="195" fill="#ffffff" font-family="JetBrains Mono, monospace" font-size="34" font-weight="900" letter-spacing="-0.5" text-anchor="middle">IELTS PRO</text>' +
  '<text x="160" y="225" fill="#71717a" font-family="Inter, sans-serif" font-size="12" font-weight="600" letter-spacing="2" text-anchor="middle">OFFICIAL PRACTICE</text>' +
  '<line x1="60" y1="315" x2="260" y2="315" stroke="#3f3f46" stroke-width="1"/>' +
  '<text x="160" y="348" fill="#a1a1aa" font-family="JetBrains Mono, monospace" font-size="10" font-weight="600" letter-spacing="1.5" text-anchor="middle">STANDARD EXAM</text>' +
  '</svg>'
)

export const handleImgError = (e) => {
  e.currentTarget.onerror = null
  e.currentTarget.src = IMG_FALLBACK
}
