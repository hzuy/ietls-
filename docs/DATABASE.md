# Database Schema

Tài liệu này mô tả cấu trúc cơ sở dữ liệu chi tiết của dự án **IELTS Practice App** (Sử dụng PostgreSQL & Prisma).

---

## Sơ đồ quan hệ tổng quan

```text
ExamSeries ──< BookCover
ExamSeries ──< Exam

Exam ──< Passage         ──< QuestionGroup ──< Question
      │                  │                ──< NoteSection ──< NoteLine
      │                  │                ──< MatchingOption
      │                  └──< Question (standalone)
      │
      ├──< ListeningSection ──< QuestionGroup ──< Question
      │                     └──< Question (standalone)
      │
      ├──< WritingTask  ──< WritingAnswer
      ├──< SpeakingPart ──< SpeakingQuestion
      │                 ──< SpeakingAnswer
      └──< Attempt      ──< QuestionAnswer

User ──< Attempt
     ──< WritingAnswer
     ──< SpeakingAnswer
```

---

## Chi tiết các bảng chính (Models)

### 1. Bảng `User`

Lưu trữ thông tin tài khoản người dùng và phân quyền.

| Field | Type | Ghi chú |
|-------|------|---------|
| `id` | Int PK | Khóa chính tự tăng |
| `email` | String | Unique - Email đăng nhập |
| `password` | String | Bcrypt hash (10 rounds) |
| `name` | String | Tên hiển thị của người dùng |
| `role` | String | `"user"` \| `"admin"` \| `"teacher"` (Mặc định: `"user"`) |
| `createdAt` | DateTime| Thời điểm tạo tài khoản |

### 2. Bảng `Exam`

Thông tin cơ bản về một đề thi (Cambridge Test hoặc Practice Exam).

| Field | Type | Ghi chú |
|-------|------|---------|
| `id` | Int PK | Khóa chính |
| `title` | String | Tên đề thi |
| `skill` | String | `reading` \| `listening` \| `writing` \| `speaking` |
| `bookNumber` | Int? | Số cuốn sách (Ví dụ: 1-19 cho series Cambridge) |
| `testNumber` | Int? | Số đề trong cuốn (Ví dụ: 1-4) |
| `seriesId` | Int? | FK → `ExamSeries` |
| `coverImageUrl`| String? | URL ảnh bìa (Lưu trên Cloudinary) |

### 3. Bảng `Question` (Dùng chung cho Reading & Listening)

Cấu trúc lưu trữ câu hỏi và đáp án cho các bài thi trắc nghiệm/điền từ.

| Field | Type | Ghi chú |
|-------|------|---------|
| `number` | Int | Số thứ tự câu hỏi (Sử dụng auto-renumber token-based) |
| `type` | String | Loại câu hỏi (vd: `mcq`, `fill_blank`, `true_false_ng`...) |
| `questionText` | String | Nội dung chi tiết câu hỏi |
| `options` | String? | JSON array chứa danh sách các lựa chọn (nếu có) |
| `correctAnswer`| String | Đáp án chính xác |
| `passageId` | Int? | FK → `Passage` (Cho Reading) |
| `listeningSectionId`| Int? | FK → `ListeningSection` (Cho Listening) |
| `groupId` | Int? | FK → `QuestionGroup` (Nếu câu hỏi thuộc một nhóm chung đề bài) |

**Các loại câu hỏi (`type`) hỗ trợ:**
- `mcq` / `mcq_multi`: Trắc nghiệm 1 đáp án / Trắc nghiệm nhiều đáp án
- `fill_blank` / `short_answer`: Điền từ vào chỗ trống / Trả lời ngắn
- `true_false_ng` / `yes_no_ng`: Dạng bài T/F/NG hoặc Y/N/NG
- `matching` / `matching_headings` / `matching_features` / `matching_paragraph` / `matching_endings`: Các dạng bài nối thông tin
- `choose_title`: Chọn tiêu đề
- `diagram_completion` / `map_diagram`: Điền nhãn cho sơ đồ / bản đồ

### 4. Bảng `WritingAnswer`

Lưu trữ bài làm Writing của người dùng cùng với feedback từ hệ thống AI (Groq).

| Field | Type | Ghi chú |
|-------|------|---------|
| `essayText` | String | Nội dung bài viết của người dùng |
| `wordCount` | Int | Số lượng từ đếm được |
| `aiFeedback` | String? | JSON chứa nhận xét chi tiết 4 tiêu chí từ AI |
| `aiScore` | Float? | Band score do AI chấm (0-9, làm tròn bước 0.5) |

### 5. Bảng `Attempt` (Reading & Listening)

Ghi nhận kết quả các lượt thi trắc nghiệm của người dùng (Reading, Listening).

| Field | Type | Ghi chú |
|-------|------|---------|
| `userId` | Int | FK → `User` |
| `examId` | Int | FK → `Exam` |
| `score` | Float? | Band score người dùng đạt được (0.0 - 9.0) |
| `finishedAt` | DateTime? | Thời điểm nộp bài / hoàn thành |
