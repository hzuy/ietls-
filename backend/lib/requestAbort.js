'use strict'

/**
 * Gắn một AbortController với vòng đời của HTTP request.
 *
 * Khi client ngắt kết nối (đóng tab, bấm "Hủy sinh", chuyển trang), Node sẽ phát
 * sự kiện `close` trên response. Lúc đó `signal` được abort để service dừng gọi
 * AI và không ghi thêm dữ liệu "ma" vào DB.
 *
 * Lưu ý: `res.writableEnded` = true nghĩa là response đã gửi xong bình thường,
 * không phải client bỏ ngang — khi đó KHÔNG abort.
 *
 * @returns {{ signal: AbortSignal, dispose: () => void }}
 */
function bindRequestAbort(req, res) {
  const controller = new AbortController()

  const onClose = () => {
    if (!res.writableEnded) {
      controller.abort()
    }
  }

  res.on('close', onClose)

  return {
    signal: controller.signal,
    dispose: () => {
      try {
        res.off('close', onClose)
      } catch {
        // ignore
      }
    },
  }
}

module.exports = { bindRequestAbort }
