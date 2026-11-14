# Đề xuất thống nhất tiến trình và lỗi sinh giải thích AI

Ngày: 2026-11-14. Trạng thái: đã được duyệt, đang triển khai và xác minh.

## Mục tiêu và phạm vi

Admin ở Test/Practice Reading/Listening phải biết AI đang làm gì, câu nào lỗi, nguyên nhân và thao tác tiếp theo. Dùng một ngôn ngữ trạng thái và một cách tương tác cho cả bốn màn hình. Giữ nhận diện giao diện admin hiện có; không thay provider, schema, nội dung lời giải hoặc quy tắc bảo vệ lời giải giáo viên.

## Vấn đề xác nhận trong code

- `ExamExplanationOverviewBadge.jsx`: “cần chú ý” là chất lượng lời giải lưu trong DB; “câu lỗi” là kết quả lượt chạy trong session. Hai tập có thể giao nhau và không được cộng.
- `AIGenerationStickyProgress.jsx`: số lỗi/cần kiểm tra là `span`, không có thao tác. Thanh loading dùng nền tối, nhiều badge và lặp thông tin từ toolbar.
- `ReadingTab.jsx`, `ListeningTab.jsx`: report bị truyền `null` khi đang sinh. Nút xem lỗi trên toolbar chỉ cuộn đến vùng report lúc này đang trống.
- Các Test editor cập nhật trạng thái câu từ chunk nhưng chỉ gộp lỗi vào report khi vòng xử lý nhóm kết thúc. Trạng thái câu và nguyên nhân lỗi có thể xuất hiện lệch thời điểm.
- `QuestionExplanationModal.jsx`: nhận run status/error, nhưng badge trong header chỉ nhận explanation; không có khối riêng trình bày lỗi sinh AI và hướng xử lý. Có lời giải cũ không đồng nghĩa lần sinh mới thành công.
- Native alert ở cuối lượt không giải quyết được nhu cầu xem lỗi trong lúc chạy, và ngắt thao tác đọc/sửa khi xuất hiện.

## Các hướng cân nhắc

1. Chỉ làm badge bấm được: sửa ít nhưng vẫn giữ tiến trình và báo cáo trùng nhau, chưa giải quyết trạng thái thiếu nhất quán.
2. Một thanh tiến trình, mở chi tiết ngay bên dưới: đề xuất. Ít thay đổi cấu trúc editor, có ngữ cảnh và hoạt động tốt trên mobile.
3. Bảng tác vụ AI trong drawer riêng: phù hợp nhiều tác vụ đồng thời; quá nặng cho một lượt sinh trong một editor.

## Bố cục đề xuất

Toolbar chỉ giữ tên đề, Preview và Đóng chỉnh sửa. Khi rảnh có nút “Tạo giải thích AI”; khi chạy, thao tác nằm ở thanh tiến trình, không thêm badge spinner trên toolbar.

Ví dụ minh họa, không phải số liệu production:

```text
GIẢI THÍCH AI                              [Dừng tạo]
Đang xử lý nhóm câu 18–22
──────────────────── tiến trình ────────────────────
Đã xử lý 19/38 câu · 50%
Đã lưu 17 câu · [2 câu lỗi — xem chi tiết] · Còn 19 câu
```

“Còn” bao gồm câu đang xử lý và câu chờ. Phần trăm đo số câu đã có kết quả xử lý (thành công hoặc lỗi) trên phạm vi lượt chạy; số đã lưu được ghi riêng. Không dùng số đã sinh thành công rồi gọi đó là phần trăm đã xử lý. Chưa xác định được tổng thì hiện “Đang chuẩn bị”, không giả lập phần trăm hay thời gian còn lại.

Khi mở chi tiết:

```text
LỖI TRONG LƯỢT NÀY                       [Thu gọn]
Câu 8 · AI phản hồi quá lâu               [Xem câu]
Thử lại sau khi lượt hiện tại kết thúc.

Câu 12 · Chưa có đáp án đúng              [Xem câu]
Bổ sung đáp án trước khi tạo lại.

[Thử lại 1 câu lỗi]  (chỉ bật khi lượt chạy đã dừng)
```

Mỗi câu phải có nguyên nhân cụ thể. Chi tiết kỹ thuật mặc định thu gọn, có sao chép và che dữ liệu nhạy cảm. Lỗi toàn dịch vụ thể hiện một thông báo nhóm cùng danh sách câu bị ảnh hưởng, không lặp cùng một đoạn kỹ thuật hàng chục lần.

## Trạng thái và tương tác

- Câu: Chờ → Đang tạo → Đã lưu / Lỗi / Cần kiểm tra. “Cần kiểm tra” là đã có kết quả được lưu nhưng cần giáo viên xem, không tính thêm như một câu độc lập.
- Tách trạng thái lượt chạy khỏi trạng thái lời giải đã lưu. Ví dụ: “Lần tạo mới bị lỗi; lời giải cũ vẫn được giữ”.
- Bấm số lỗi luôn mở danh sách thực, có focus đúng và dùng được bằng bàn phím. Bấm câu lỗi trong lưới mở hộp xem câu với khối lỗi ở đầu, không phụ thuộc tooltip.
- Đang chạy: cho xem lỗi/lời giải; giữ khóa sửa và retry để tránh ghi đè/race. Lỗi mới cập nhật ngay trong danh sách nhưng không tự cuộn, không tự mở modal và không cướp focus.
- Lỗi riêng câu: ghi nhận rồi tiếp tục câu đủ điều kiện. Lỗi toàn hệ thống/quota/khóa tác vụ: dừng hoặc chờ theo phản hồi thực, ghi rõ lý do; không tạo hàng loạt request vô ích.
- Dừng tạo: “Đang dừng…” → “Đã dừng · 17 câu đã lưu · 2 câu lỗi · 19 câu chưa xử lý”. Không gọi câu chưa xử lý là lỗi hay đã xong.
- Kết thúc có lỗi: giữ cùng khối và mặc định thu gọn danh sách theo yêu cầu tối giản được bổ sung; người dùng bấm số lỗi để xem. Retry đúng câu retryable, giữ lời giải đã lưu và bảo vệ câu giáo viên duyệt/sửa.
- Retry chỉ cập nhật kết quả các câu được chọn; lỗi khác không biến mất khi bắt đầu một lượt retry phạm vi hẹp. Ghi rõ phạm vi của lượt retry và trạng thái “Đang thử lại”.
- Thành công: một dòng kết quả trong khối; không thêm đồng thời toast, alert và report lặp lại.
- F5: “Lượt trước bị gián đoạn”, giữ báo cáo gần nhất; đối chiếu trạng thái lưu trên server trước khi đánh dấu thành công hoặc tiếp tục. Không tự khởi động lại tác vụ chỉ vì tải trang.

## Cảnh báo và bộ lọc chất lượng

Không giữ nhãn mơ hồ “14 câu cần chú ý” cạnh lỗi lượt chạy. Đặt bộ lọc “Cần kiểm tra lời giải (14)” cạnh danh sách câu, có phân loại nguyên nhân và mở đúng tập câu. Không cộng số này với lỗi lượt chạy vì một câu có thể thuộc cả hai.

Dùng alert trong trang (`role=alert`) cho lỗi ngăn bắt đầu, gắn cạnh thao tác liên quan. Lỗi riêng câu và gián đoạn dịch vụ nằm trong danh sách có thể mở. Theo yêu cầu tối giản được xác nhận, không dùng native alert hoặc toast tổng kết trùng với báo cáo. Chi tiết kỹ thuật và bộ lọc chất lượng mặc định thu gọn.

## Hình thức

Nền trắng, viền xám nhẹ, chữ nội dung dễ đọc; một progress bar mảnh, một spinner nhỏ ở tiêu đề. Đỏ cho lỗi, hổ phách cho cần kiểm tra; luôn kèm nhãn chữ. Không pulse/ping đồng thời trên toàn bộ câu đang chờ. Chỉ animation ở câu thực sự đang xử lý; tôn trọng reduced motion. Mobile xếp hành động xuống dòng, chi tiết mở dưới thanh thay vì ép một hàng hoặc thêm modal lồng nhau.

## Kế hoạch triển khai và tiêu chí nghiệm thu

1. Checkpoint trước thay đổi lớn; thống nhất mô hình dữ liệu theo câu, phạm vi chạy, mã lỗi và trạng thái đã lưu. Tính mọi số đếm từ cùng snapshot; deduplicate theo câu/phạm vi.
2. Gộp loading/report thành một component dùng chung; toolbar và bộ lọc chỉ tham chiếu đúng dữ liệu, không tự tạo bộ đếm thứ hai.
3. Cập nhật lỗi từ từng chunk vào snapshot ngay; nối click số lỗi, xem câu và nội dung lỗi trong modal cho cả bốn editor.
4. Kiểm thử số đếm không trùng; timeout/quota/thiếu đáp án/conflict; lỗi trong khi chạy; câu có lời giải cũ; dừng; retry phạm vi hẹp; refresh và báo cáo cũ. Kiểm tra keyboard/focus và 390/768/1440 px.
5. Chạy regression, review bảo mật thông báo/secret, build; sau khi triển khai được yêu cầu, stage-then-swap và smoke test theo DEPLOY.md. Không tạo/sửa lời giải trên DB thật để thử giao diện.

Rủi ro cần chặn trước triển khai: phần trăm phải có đúng mẫu số; snapshot của retry không làm mất lỗi ngoài phạm vi; report phục hồi không giả nhận đang chạy; xem chi tiết không mở khóa ghi trong tác vụ đang hoạt động; lỗi kỹ thuật không lộ key/token/URL có thông tin xác thực.
