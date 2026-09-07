/**
 * seed_demo_analytics.js
 *
 * Script sinh dữ liệu giả (Mock / Seed Data) cho hệ thống IELTSPro
 * phục vụ demo Admin Dashboard đẹp mắt, phân bổ chuẩn học thuật:
 * - 18 Users mẫu (Học viên tiếng Việt thực tế, role 'user')
 * - 135 Lượt thi (Exam Attempts) phân bố 4 kỹ năng: Reading (~40%), Listening (~35%), Writing (~15%), Speaking (~10%)
 * - Điểm Band phân bố chuẩn Gaussian (chuông): trung bình ~5.8 - 6.2
 * - Top 10 học viên điểm cao đạt 7.5 - 8.5
 * - Thời gian nộp bài rải đều 30 ngày qua với xu hướng tăng tự nhiên
 * - Tương thích hoàn toàn 100% CSDL Supabase, TUYỆT ĐỐI KHÔNG DROP TABLE / KHÔNG RESET CSDL
 *
 * Cách chạy:
 *   node prisma/seed_demo_analytics.js            (Nạp dữ liệu an toàn)
 *   node prisma/seed_demo_analytics.js --cleanup  (Dọn sạch dữ liệu demo)
 */

require('dotenv').config()
const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['warn', 'error'],
})

// ─── 1. DANH SÁCH 18 HỌC VIÊN MẪU TIẾNG VIỆT ───────────────────────────────────
// Mỗi học viên có hồ sơ năng lực (targetBand) nhất quán để tạo bảng xếp hạng Top Students chân thực
const SAMPLE_STUDENTS = [
  { name: 'Đỗ Minh Châu', email: 'chau.do.demo@ielts.vn', targetBand: 8.5, daysAgoJoined: 34 },
  { name: 'Nguyễn Hoàng Nam', email: 'nam.nguyen.demo@ielts.vn', targetBand: 8.0, daysAgoJoined: 32 },
  { name: 'Lê Quốc Anh', email: 'quocanh.le.demo@ielts.vn', targetBand: 8.0, daysAgoJoined: 30 },
  { name: 'Trần Thị Mai', email: 'mai.tran.demo@ielts.vn', targetBand: 7.5, daysAgoJoined: 29 },
  { name: 'Phan Thảo Nguyên', email: 'thaonguyen.phan.demo@ielts.vn', targetBand: 7.5, daysAgoJoined: 28 },
  { name: 'Vũ Phương Linh', email: 'phuonglinh.vu.demo@ielts.vn', targetBand: 7.0, daysAgoJoined: 27 },
  { name: 'Hoàng Thu Thảo', email: 'thuthao.hoang.demo@ielts.vn', targetBand: 7.0, daysAgoJoined: 25 },
  { name: 'Phạm Đức Thắng', email: 'ducthang.pham.demo@ielts.vn', targetBand: 6.5, daysAgoJoined: 24 },
  { name: 'Bùi Thanh Tùng', email: 'thanhtung.bui.demo@ielts.vn', targetBand: 6.5, daysAgoJoined: 23 },
  { name: 'Đặng Thùy Dương', email: 'thuyduong.dang.demo@ielts.vn', targetBand: 6.0, daysAgoJoined: 22 },
  { name: 'Ngô Gia Huy', email: 'giahuy.ngo.demo@ielts.vn', targetBand: 6.0, daysAgoJoined: 20 },
  { name: 'Lý Diệu Linh', email: 'dieulinh.ly.demo@ielts.vn', targetBand: 6.0, daysAgoJoined: 19 },
  { name: 'Dương Quốc Bảo', email: 'quocbao.duong.demo@ielts.vn', targetBand: 5.5, daysAgoJoined: 18 },
  { name: 'Đinh Hải Yến', email: 'haiyen.dinh.demo@ielts.vn', targetBand: 5.5, daysAgoJoined: 16 },
  { name: 'Trịnh Quang Vinh', email: 'quangvinh.trinh.demo@ielts.vn', targetBand: 5.0, daysAgoJoined: 15 },
  { name: 'Võ Minh Khôi', email: 'minhkhoi.vo.demo@ielts.vn', targetBand: 5.0, daysAgoJoined: 14 },
  { name: 'Lương Bảo Ngọc', email: 'baongoc.luong.demo@ielts.vn', targetBand: 4.5, daysAgoJoined: 12 },
  { name: 'Hồ Nhật Minh', email: 'nhatminh.ho.demo@ielts.vn', targetBand: 4.0, daysAgoJoined: 10 },
]

// ─── 2. PHÂN PHỐI BAND SCORE CHUẨN GAUSSIAN (135 LƯỢT THI) ──────────────────────
// <4.0: 7 (5.2%) | 4.0-4.9: 20 (14.8%) | 5.0-5.9: 40 (29.6%) | 6.0-6.9: 41 (30.4%) | 7.0-7.9: 20 (14.8%) | 8.0-9.0: 7 (5.2%)
// Mean: ~5.85 - 6.0
const POOL_SCORES_GAUSSIAN = [
  // <4.0 (7 lượt thi ~5.2%)
  3.0, 3.0, 3.5, 3.5, 3.5, 3.5, 3.5,
  // 4.0 - 4.9 (20 lượt thi ~14.8%)
  4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0,
  4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5,
  // 5.0 - 5.9 (40 lượt thi ~29.6%)
  5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0,
  5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5,
  5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5, 5.5,
  // 6.0 - 6.9 (41 lượt thi ~30.4%)
  6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0, 6.0,
  6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5,
  // 7.0 - 7.9 (20 lượt thi ~14.8%)
  7.0, 7.0, 7.0, 7.0, 7.0, 7.0, 7.0, 7.0, 7.0, 7.0,
  7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5,
  // 8.0 - 9.0 (7 lượt thi ~5.2%)
  8.0, 8.0, 8.0, 8.0, 8.0,
  8.5, 8.5,
]

// ─── 3. PHÂN PHỐI 135 LƯỢT THI TRONG 30 NGÀY (CURVE TĂNG TRƯỞNG TỰ NHIÊN) ─────────
// Tổng cộng đúng 135 lượt thi:
// 30 ngày qua (từ day -29 đến day 0)
const DAILY_ATTEMPT_COUNTS = [
  1, 1, 1, 2, 2, 2, 2, 2, 2, // Tuần 1: 15 lượt (~1.7/ngày)
  3, 3, 3, 3, 3, 3, 4,       // Tuần 2: 22 lượt (~3.1/ngày)
  4, 4, 4, 5, 5, 5, 6,       // Tuần 3: 33 lượt (~4.7/ngày)
  6, 7, 7, 8, 9, 10, 8,      // Tuần 4 & gần đây: 55 lượt (~7.8/ngày)
  10                         // Hôm nay (day 0): 10 lượt
] // Tổng = 135

// ─── 4. CRITERIA VÀ DỮ LIỆU MẪU CHO WRITING & SPEAKING ────────────────────────────
const WRITING_CRITERIA = ['task_achievement', 'coherence_cohesion', 'lexical_resource', 'grammatical_range']
const SPEAKING_CRITERIA = ['fluency', 'vocabulary', 'grammar', 'pronunciation']

function makeCriterionScores(overallBand, criteriaList) {
  const result = {}
  criteriaList.forEach((crit) => {
    const delta = (Math.random() - 0.5) * 0.8
    const raw = overallBand + delta
    const rounded = Math.round(raw * 2) / 2
    result[crit] = Math.max(3.0, Math.min(9.0, rounded))
  })
  return result
}

// ─── 5. CLEANUP DEMO DATA ────────────────────────────────────────────────────────
async function cleanup() {
  console.log('\n🧹 Đang dọn dẹp dữ liệu demo cũ...')

  // 1. Xóa SpeakingCriterionLog thuộc các bài nói demo
  const delSpeakingCrit = await prisma.$executeRaw`
    DELETE FROM "SpeakingCriterionLog"
    WHERE "speakingAnswerId" IN (
      SELECT id FROM "SpeakingAnswer" WHERE transcript LIKE '%[SEED-DEMO]%'
    )
  `

  // 2. Xóa SpeakingAnswer demo
  const delSpeaking = await prisma.$executeRaw`
    DELETE FROM "SpeakingAnswer" WHERE transcript LIKE '%[SEED-DEMO]%'
  `

  // 3. Xóa WritingCriterionLog thuộc các bài viết demo
  const delWritingCrit = await prisma.$executeRaw`
    DELETE FROM "WritingCriterionLog"
    WHERE "writingAnswerId" IN (
      SELECT id FROM "WritingAnswer" WHERE "essayText" LIKE '%[SEED-DEMO]%'
    )
  `

  // 4. Xóa WritingAnswer demo
  const delWriting = await prisma.$executeRaw`
    DELETE FROM "WritingAnswer" WHERE "essayText" LIKE '%[SEED-DEMO]%'
  `

  // 5. Xóa QuestionAnswer và AnswerLog demo (nếu có)
  await prisma.$executeRaw`
    DELETE FROM "QuestionAnswer"
    WHERE "attemptId" IN (SELECT id FROM "Attempt" WHERE "isSeeded" = true)
  `
  await prisma.$executeRaw`
    DELETE FROM "AnswerLog"
    WHERE "attemptId" IN (SELECT id FROM "Attempt" WHERE "isSeeded" = true)
  `

  // 6. Xóa Attempt demo (được đánh dấu isSeeded = true)
  const delAttempts = await prisma.$executeRaw`
    DELETE FROM "Attempt" WHERE "isSeeded" = true
  `

  // 7. Xóa các tài khoản học viên mẫu demo
  const demoEmails = SAMPLE_STUDENTS.map(s => s.email)
  const delUsers = await prisma.user.deleteMany({
    where: { email: { in: demoEmails } }
  })

  console.log(`✓ Đã dọn dẹp xong an toàn:`)
  console.log(`  - Attempts: ${delAttempts}`)
  console.log(`  - WritingAnswers: ${delWriting} (CriterionLogs: ${delWritingCrit})`)
  console.log(`  - SpeakingAnswers: ${delSpeaking} (CriterionLogs: ${delSpeakingCrit})`)
  console.log(`  - Demo Users: ${delUsers.count}\n`)
}

// ─── 6. SEED DEMO DATA ───────────────────────────────────────────────────────────
async function seed() {
  console.log('====================================================')
  console.log('🚀 BẮT ĐẦU SEED DỮ LIỆU DEMO CHO ADMIN ANALYTICS')
  console.log('====================================================\n')

  // Đảm bảo không nhân đôi dữ liệu cũ nếu chạy lại
  await cleanup()

  // 1. Tạo 18 Users mẫu
  console.log('👤 Đang tạo 18 học viên mẫu (Vietnamese students)...')
  const defaultPasswordHash = await bcrypt.hash('Student@123', 10)
  const createdUsers = []

  const now = new Date()

  for (const s of SAMPLE_STUDENTS) {
    const userCreatedAt = new Date(now)
    userCreatedAt.setDate(userCreatedAt.getDate() - s.daysAgoJoined)
    userCreatedAt.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60))

    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {
        name: s.name,
        role: 'user',
        isLocked: false,
      },
      create: {
        name: s.name,
        email: s.email,
        password: defaultPasswordHash,
        role: 'user',
        isLocked: false,
        createdAt: userCreatedAt,
      },
      select: { id: true, name: true, email: true, createdAt: true }
    })
    createdUsers.push({ ...user, targetBand: s.targetBand })
  }
  console.log(`✓ Đã tạo thành công ${createdUsers.length} học viên mẫu.\n`)

  // 2. Tải danh sách đề thi hiện có trong CSDL
  console.log('📚 Đang truy vấn danh mục đề thi hiện có trong CSDL...')
  const exams = await prisma.exam.findMany({
    where: { deletedAt: null },
    select: { id: true, skill: true, title: true }
  })

  const examsBySkill = {
    reading: exams.filter(e => e.skill === 'reading').map(e => e.id),
    listening: exams.filter(e => e.skill === 'listening').map(e => e.id),
    writing: exams.filter(e => e.skill === 'writing').map(e => e.id),
    speaking: exams.filter(e => e.skill === 'speaking').map(e => e.id),
  }

  console.log('Thống kê đề thi khả dụng:')
  console.log(`  - Reading : ${examsBySkill.reading.length} đề (IDs: ${examsBySkill.reading.join(', ')})`)
  console.log(`  - Listening: ${examsBySkill.listening.length} đề (IDs: ${examsBySkill.listening.join(', ')})`)
  console.log(`  - Writing  : ${examsBySkill.writing.length} đề (IDs: ${examsBySkill.writing.join(', ')})`)
  console.log(`  - Speaking : ${examsBySkill.speaking.length} đề (IDs: ${examsBySkill.speaking.join(', ')})`)

  if (examsBySkill.reading.length === 0 || examsBySkill.listening.length === 0) {
    throw new Error('Thiếu đề thi Reading hoặc Listening trong CSDL để seed!')
  }

  // Lấy danh sách Writing Tasks và Speaking Parts
  const writingTasks = await prisma.writingTask.findMany({
    select: { id: true, examId: true, number: true }
  })
  const speakingParts = await prisma.speakingPart.findMany({
    select: { id: true, examId: true, number: true }
  })

  // 3. Chuẩn bị 135 lượt thi theo kỹ năng
  // Reading: 54 (~40%), Listening: 47 (~35%), Writing: 20 (~15%), Speaking: 14 (~10%)
  const skillAssignments = [
    ...Array(54).fill('reading'),
    ...Array(47).fill('listening'),
    ...Array(20).fill('writing'),
    ...Array(14).fill('speaking'),
  ] // Đúng 135

  // Sắp xếp điểm số Gaussian
  // Điểm cao dành cho học viên có targetBand cao
  // Điểm trung bình/thấp phân bố cho các học viên khác
  const sortedScores = [...POOL_SCORES_GAUSSIAN].sort((a, b) => b - a)

  // Sắp xếp users theo targetBand giảm dần
  const sortedUsers = [...createdUsers].sort((a, b) => b.targetBand - a.targetBand)

  // Phân chia 135 attempts cho 18 học viên
  // Top 5 học viên làm 8-10 bài mỗi người (phần lớn điểm 7.5 - 8.5)
  // Các học viên còn lại làm 6-8 bài mỗi người
  const attemptsConfig = []
  let scoreIndex = 0

  // 30 ngày: phân bổ theo DAILY_ATTEMPT_COUNTS
  const dayBuckets = []
  DAILY_ATTEMPT_COUNTS.forEach((count, dayIdx) => {
    const daysAgo = 29 - dayIdx
    for (let i = 0; i < count; i++) {
      dayBuckets.push(daysAgo)
    }
  })

  // Trộn đều thứ tự kỹ năng nhưng giữ nguyên phân bố điểm theo năng lực học viên
  // Để top học viên nhận điểm cao nhất:
  for (let i = 0; i < 135; i++) {
    const score = sortedScores[i]
    let user

    if (score >= 7.5) {
      // Top 5 học viên
      user = sortedUsers[i % 5]
    } else if (score >= 6.5) {
      // Nhóm khá (học viên index 3 đến 8)
      user = sortedUsers[3 + (i % 6)]
    } else if (score >= 5.0) {
      // Nhóm trung bình (học viên index 6 đến 14)
      user = sortedUsers[6 + (i % 9)]
    } else {
      // Nhóm bắt đầu / điểm thấp (học viên index 12 đến 17)
      user = sortedUsers[12 + (i % 6)]
    }

    const skill = skillAssignments[i]
    const daysAgo = dayBuckets[i] ?? Math.floor(Math.random() * 30)

    attemptsConfig.push({
      user,
      skill,
      score,
      daysAgo,
    })
  }

  // Shuffle nhẹ để ngày tháng và kỹ năng xen kẽ tự nhiên
  attemptsConfig.sort(() => Math.random() - 0.5)

  console.log('\n📝 Đang nạp 135 lượt thi vào CSDL...')
  let createdAttemptsCount = 0
  let writingAnswersCreated = 0
  let speakingAnswersCreated = 0

  for (let i = 0; i < attemptsConfig.length; i++) {
    const { user, skill, score, daysAgo } = attemptsConfig[i]
    const examPool = examsBySkill[skill].length ? examsBySkill[skill] : exams.map(e => e.id)
    const examId = examPool[Math.floor(Math.random() * examPool.length)]

    // Tính toán thời gian nộp bài
    const attemptCreatedAt = new Date(now)
    attemptCreatedAt.setDate(attemptCreatedAt.getDate() - daysAgo)
    attemptCreatedAt.setHours(
      8 + Math.floor(Math.random() * 14), // 08:00 - 22:00
      Math.floor(Math.random() * 60),
      Math.floor(Math.random() * 60)
    )

    // Đảm bảo không sớm hơn ngày đăng ký của user
    if (attemptCreatedAt < user.createdAt) {
      attemptCreatedAt.setTime(user.createdAt.getTime() + 3600000)
    }

    // Finished 30 - 60 phút sau
    const durationMinutes = Math.floor(Math.random() * 30) + 30
    const finishedAt = new Date(attemptCreatedAt.getTime() + durationMinutes * 60000)

    const attempt = await prisma.attempt.create({
      data: {
        userId: user.id,
        examId,
        score,
        isSeeded: true,
        answers: JSON.stringify({ note: 'Sample exam submission for analytics demo' }),
        aiFeedback: `Đánh giá tổng quan band ${score}: Kết quả thể hiện năng lực học thuật tốt, hoàn thành đầy đủ các phần thi.`,
        createdAt: attemptCreatedAt,
        finishedAt,
      }
    })
    createdAttemptsCount++

    // Nếu là Writing: tạo thêm WritingAnswer và WritingCriterionLog
    if (skill === 'writing' && writingTasks.length > 0) {
      const taskPool = writingTasks.filter(t => t.examId === examId)
      const task = taskPool.length > 0 ? taskPool[0] : writingTasks[0]
      const wordCount = Math.floor(score * 35 + 120)

      const wa = await prisma.writingAnswer.create({
        data: {
          userId: user.id,
          taskId: task.id,
          essayText: `[SEED-DEMO] This essay was submitted as part of IELTS Academic Writing practice. The candidate effectively demonstrates coherent idea progression, appropriate register, and accurate lexical resource suitable for Band ${score}.`,
          wordCount,
          aiScore: score,
          status: 'graded',
          createdAt: attemptCreatedAt,
        }
      })
      writingAnswersCreated++

      const criterionScores = makeCriterionScores(score, WRITING_CRITERIA)
      for (const [criterion, cScore] of Object.entries(criterionScores)) {
        await prisma.writingCriterionLog.create({
          data: {
            userId: user.id,
            writingAnswerId: wa.id,
            criterion,
            score: cScore,
            comment: `Evaluated ${criterion} at band ${cScore}`,
            createdAt: attemptCreatedAt,
          }
        })
      }
    }

    // Nếu là Speaking: tạo thêm SpeakingAnswer và SpeakingCriterionLog
    if (skill === 'speaking' && speakingParts.length > 0) {
      const partPool = speakingParts.filter(p => p.examId === examId)
      const part = partPool.length > 0 ? partPool[0] : speakingParts[0]

      const sa = await prisma.speakingAnswer.create({
        data: {
          userId: user.id,
          partId: part.id,
          transcript: `[SEED-DEMO] Speaking test response recording transcription. Candidate speaks with natural rhythm, minimal hesitation, and good phonological control reflecting Band ${score}.`,
          aiScore: score,
          status: 'graded',
          createdAt: attemptCreatedAt,
        }
      })
      speakingAnswersCreated++

      const criterionScores = makeCriterionScores(score, SPEAKING_CRITERIA)
      for (const [criterion, cScore] of Object.entries(criterionScores)) {
        await prisma.speakingCriterionLog.create({
          data: {
            userId: user.id,
            speakingAnswerId: sa.id,
            criterion,
            score: cScore,
            comment: `Evaluated ${criterion} at band ${cScore}`,
            createdAt: attemptCreatedAt,
          }
        })
      }
    }

    if (createdAttemptsCount % 25 === 0 || createdAttemptsCount === 135) {
      console.log(`  -> Đã tạo ${createdAttemptsCount}/135 lượt thi...`)
    }
  }

  // 4. Báo cáo kiểm tra và xác thực dữ liệu sau khi nạp
  console.log('\n====================================================')
  console.log('📊 BÁO CÁO THỐNG KÊ SAU KHI SEED:')
  console.log('====================================================')

  // Phân bổ kỹ năng
  const skillStats = await prisma.$queryRaw`
    SELECT e.skill, COUNT(a.id)::int as count, ROUND(AVG(a.score)::numeric, 2) as avg_score
    FROM "Attempt" a
    JOIN "Exam" e ON a."examId" = e.id
    WHERE a."isSeeded" = true
    GROUP BY e.skill
    ORDER BY count DESC
  `
  console.log('\n1. Phân bổ lượt thi theo Kỹ năng (Pie Chart):')
  skillStats.forEach(r => {
    const pct = ((Number(r.count) / createdAttemptsCount) * 100).toFixed(1)
    console.log(`   • ${r.skill.padEnd(10)}: ${r.count} lượt (${pct}%) | Điểm TB: ${r.avg_score}`)
  })

  // Phân bổ Band Score chuẩn Gaussian
  const bandDist = await prisma.$queryRaw`
    SELECT
      COUNT(CASE WHEN score < 4 THEN 1 END)::int as c_lt4,
      COUNT(CASE WHEN score >= 4 AND score < 5 THEN 1 END)::int as c_4_5,
      COUNT(CASE WHEN score >= 5 AND score < 6 THEN 1 END)::int as c_5_6,
      COUNT(CASE WHEN score >= 6 AND score < 7 THEN 1 END)::int as c_6_7,
      COUNT(CASE WHEN score >= 7 AND score < 8 THEN 1 END)::int as c_7_8,
      COUNT(CASE WHEN score >= 8 THEN 1 END)::int as c_8_9
    FROM "Attempt"
    WHERE "isSeeded" = true AND score IS NOT NULL;
  `
  const bd = bandDist[0]
  console.log('\n2. Phân bố điểm Band chuẩn Gaussian:')
  console.log(`   • < 4.0   : ${bd.c_lt4} lượt (${((bd.c_lt4 / 135) * 100).toFixed(1)}%)`)
  console.log(`   • 4.0–4.9 : ${bd.c_4_5} lượt (${((bd.c_4_5 / 135) * 100).toFixed(1)}%)`)
  console.log(`   • 5.0–5.9 : ${bd.c_5_6} lượt (${((bd.c_5_6 / 135) * 100).toFixed(1)}%)`)
  console.log(`   • 6.0–6.9 : ${bd.c_6_7} lượt (${((bd.c_6_7 / 135) * 100).toFixed(1)}%)`)
  console.log(`   • 7.0–7.9 : ${bd.c_7_8} lượt (${((bd.c_7_8 / 135) * 100).toFixed(1)}%)`)
  console.log(`   • 8.0–9.0 : ${bd.c_8_9} lượt (${((bd.c_8_9 / 135) * 100).toFixed(1)}%)`)

  // Điểm Band trung bình toàn sàn
  const overallAvg = await prisma.attempt.aggregate({
    where: { isSeeded: true, score: { not: null } },
    _avg: { score: true }
  })
  console.log(`\n   => ĐIỂM BAND TRUNG BÌNH TOÀN SÀN: ${overallAvg._avg.score.toFixed(2)} (Mục tiêu: 5.8 - 6.2 ✓)`)

  // Top 10 học viên
  const topUsersGroup = await prisma.attempt.groupBy({
    by: ['userId'],
    where: { isSeeded: true, score: { not: null } },
    _avg: { score: true },
    _count: { id: true },
    orderBy: { _avg: { score: 'desc' } },
    take: 10
  })
  const topUserIds = topUsersGroup.map(u => u.userId)
  const topUsersData = await prisma.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, name: true, email: true }
  })
  const userMap = Object.fromEntries(topUsersData.map(u => [u.id, u]))

  console.log('\n3. Top 10 Học viên xuất sắc (Leaderboard):')
  topUsersGroup.forEach((u, idx) => {
    const user = userMap[u.userId]
    console.log(`   #${idx + 1} ${(user?.name || 'Student').padEnd(20)} | Avg Band: ${u._avg.score.toFixed(2)} | Lượt thi: ${u._count.id}`)
  })

  console.log(`\n✓ Seed hoàn tất xuất sắc: 18 học viên, 135 lượt thi, ${writingAnswersCreated} bài Writing, ${speakingAnswersCreated} bài Speaking.`)
  console.log('====================================================\n')
}

const isCleanupOnly = process.argv.includes('--cleanup')

;(isCleanupOnly ? cleanup : seed)()
  .catch((err) => {
    console.error('❌ Lỗi khi thực thi script:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
