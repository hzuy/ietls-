# IELTS App — Testing Guide & Automation Documentation

Tài liệu hướng dẫn kiểm thử tự động, cấu hình CI/CD và duy trì Test Suite cho dự án IELTS App.

---

## 1. Tổng Quan Test Suite

Hệ thống Test Suite sử dụng **Vitest** làm framework kiểm thử thống nhất cho cả Backend và Frontend, kết hợp **Supertest** (Backend API Integration Test) và **React Testing Library + JSDOM** (Frontend Component Test).

* **Tổng số Test Files**: **16 test files**
* **Tổng số Test Cases**: **75 test cases (100% Passed)**
* **Thời gian thực thi**: ~1.5s (Backend) | ~2.3s (Frontend)

---

## 2. Các Lệnh Chạy Test (Test Commands)

### Backend (`/backend`)
```bash
# Chạy tất cả unit & integration tests một lần
npm run test

# Chạy test ở chế độ Watch (tự chạy lại khi sửa code)
npm run test:watch

# Chạy test và xuất Báo cáo Coverage
npm run test:coverage
```

### Frontend (`/frontend`)
```bash
# Chạy tất cả component & hook tests một lần
npm run test

# Chạy test ở chế độ Watch
npm run test:watch

# Chạy test và xuất Báo cáo Coverage
npm run test:coverage
```

---

## 3. Cấu Trúc File Test Trong Dự Án

### Backend Tests (`/backend`)
* `lib/scoreUtils.test.js`: Kiểm thử công thức IELTS Overall Band Score, Raw Score mapping, rounding rules (.25 down, .75 up) và clamp [0.0 - 9.0].
* `services/cambridge/jsonSanitizer.test.js`: Kiểm thử làm sạch và tự động sửa JSON cắt ngang từ Groq AI (`finish_reason = length`).
* `validators/*.test.js`: Unit test cho 4 Zod validator files (`authValidator`, `submissionValidator`, `adminExamValidator`, `contentValidator`) — bao gồm test bảo tồn Option A `passages: []`.
* `middleware/validate.test.js`: Unit test cho Express Zod validation middleware.
* `routes/auth.test.js`: API Integration test cho `/api/auth/register` và `/api/auth/login` (Supertest + Prisma mock).
* `routes/reading.test.js`: API Integration test nộp bài Reading, tính điểm và lưu attempt.
* `routes/writing.test.js`: API Integration test nộp bài Writing bất đồng bộ (`status: pending`) và mock Groq SDK.

### Frontend Tests (`/frontend`)
* `src/components/ielts40/CurriculumSection.test.jsx`: Component test danh sách 9 tuần, nút "Xem thêm" và accordion mở/đóng.
* `src/components/ielts40/SidebarOffer.test.jsx`: Component test đồng hồ đếm ngược `0d 9h 2m 45s`, `vi.useFakeTimers()` và cleanup `clearInterval`.
* `src/components/courses/HeroStats.test.jsx`: Component test animation đếm số `requestAnimationFrame` tới mốc `2.5 band`, `3000`, `200`.
* `src/components/SkillResult.test.jsx`: Component test render kết quả Reading/Listening, ẩn bảng loại câu hỏi khi thiếu data và phòng chống crash khi `sections` bị undefined.
* `src/pages/WritingExam.test.jsx`: Component test hàm `renderFeedbackList` phòng chống crash khi nhận AI nhận xét dạng String, Array, Object hoặc Null.
* `src/hooks/useUnsavedChanges.test.js`: Custom hook test chặn `beforeunload` khi `isDirty = true`.

---

## 4. Tự Động Hóa CI Workflow (GitHub Actions)

File cấu hình `.github/workflows/test.yml` tự động kích hoạt khi có lệnh `git push` hoặc `pull_request` vào nhánh `main` hoặc `master`:

1. **Job `backend-test`**: Khởi chạy trên Ubuntu Node 20 LTS, cài đặt dependencies và chạy `cd backend && npm run test`.
2. **Job `frontend-test`**: Khởi chạy song song trên Ubuntu Node 20 LTS, cài đặt dependencies và chạy `cd frontend && npm run test`.

> **Lưu ý**: Nếu bất kỳ test case nào thất bại trên GitHub Actions, quy trình CI sẽ báo đỏ ❌. Giúp phát hiện lỗi **TRƯỚC KHI** Render.com tự động deploy code lên Server thật.

---

## 5. Hướng Dẫn Viết Test Mới Cho Developer

Khi thêm tính năng mới hoặc tạo validator/component mới, hãy tuân thủ các nguyên tắc sau:

1. **Backend Validator**: Thêm unit test tương ứng trong `backend/validators/<name>.test.js`.
2. **Backend Route**: Dùng `supertest` kết hợp `require.cache[require.resolve('../lib/prisma')] = { exports: prismaMock }` để đảm bảo test KHÔNG chạm vào DB thật.
3. **Frontend Component**: Đặt file test cùng thư mục với component (ví dụ `MyComponent.test.jsx`). Dùng `@testing-library/react` để query bằng văn bản hoặc vai trò người dùng (`screen.getByText`, `screen.getByRole`).
4. **Không Tạo Giả Tạo Test**: Không cố tình nuốt lỗi. Nếu test phát hiện dữ liệu thiếu làm crash component, hãy bổ sung optional chaining `?.` hoặc fallback `|| []` vào component rồi viết test kiểm tra rendering an toàn.
