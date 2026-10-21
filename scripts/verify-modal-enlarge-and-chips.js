const { chromium } = require('d:/Duy/ielts-app/backend/node_modules/playwright')
const path = require('path')
const jwt = require('d:/Duy/ielts-app/backend/node_modules/jsonwebtoken')
const { requireJwtSecret } = require('d:/Duy/ielts-app/backend/scripts/lib/requireJwtSecret')

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity-ide/brain/fe99e17e-7027-46a5-a539-efc5e5d4aee0'

async function getAuthToken() {
  const secret = requireJwtSecret()
  const user = { id: 3, userId: 3, email: 'minh@gmail.com', role: 'teacher', name: 'Minh Teacher' }
  const token = jwt.sign({ userId: 3, email: 'minh@gmail.com', role: 'teacher' }, secret, { expiresIn: '1d' })
  return { token, user }
}

async function run() {
  console.log('=== VERIFYING ENLARGED MODAL & CHIP STATUSES ACROSS ALL 4 SURFACES ===')
  const auth = await getAuthToken()

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })

  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { token: auth.token, user: auth.user })

  const page = await context.newPage()

  // ───────────────────────────────────────────────────────────────────────────
  // 1. READING PRACTICE (/admin/reading-practice)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[1/4] Checking Reading Practice (/admin/reading-practice)...')
  await page.goto('http://localhost:5173/admin/reading-practice')
  await page.waitForTimeout(1000)

  const editReadingPractice = page.locator('button:has-text("Sửa")').first()
  await editReadingPractice.waitFor({ state: 'visible', timeout: 8000 })
  await editReadingPractice.click()
  await page.waitForSelector('text=Chỉnh sửa bài Reading Practice', { timeout: 8000 })
  await page.waitForTimeout(600)

  // Scroll to chip grid in Reading Practice
  const chipGridRP = page.locator('[data-testid="explanation-chip-grid"] .grid').first()
  await chipGridRP.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  // Screenshot 1: Hàng chip trong Reading Practice
  await chipGridRP.screenshot({
    path: path.join(ARTIFACT_DIR, 'screen_chips_all_statuses_reading_practice.png')
  })
  console.log('Saved: screen_chips_all_statuses_reading_practice.png')

  // Open Modal on Câu 1
  const chip1 = chipGridRP.locator('button:has-text("Câu 1")').first()
  await chip1.click()
  await page.waitForSelector('role=dialog', { timeout: 5000 })
  await page.waitForTimeout(500)

  const modalBox = page.locator('div[role="dialog"] > div')

  // Screenshot 2: Modal Tab 1 - Xem lời giải (kích thước cố định 960x720, chữ to chuẩn, padding đẹp)
  await modalBox.screenshot({
    path: path.join(ARTIFACT_DIR, 'screen_modal_tab1_xem_loi_giai.png')
  })
  console.log('Saved: screen_modal_tab1_xem_loi_giai.png')

  // Switch to Tab 2: Góp ý & Tạo lại (đã xóa khối thông báo vàng, textarea dịch lên trên)
  await page.locator('role=tab[name*="Góp ý & Tạo lại"]').click()
  await page.waitForTimeout(400)

  // Screenshot 3: Modal Tab 2 - Góp ý & Tạo lại
  await modalBox.screenshot({
    path: path.join(ARTIFACT_DIR, 'screen_modal_tab2_gop_y_tao_lai.png')
  })
  console.log('Saved: screen_modal_tab2_gop_y_tao_lai.png')

  // Switch to Tab 3: Sửa trực tiếp (textarea nhiều dòng tự giãn, full_sentence & translation full width)
  await page.locator('role=tab[name*="Sửa trực tiếp"]').click()
  await page.waitForTimeout(500)

  // Screenshot 4: Modal Tab 3 - Sửa trực tiếp (phần trên: Bước 1, full_sentence, translation)
  await modalBox.screenshot({
    path: path.join(ARTIFACT_DIR, 'screen_modal_tab3_sua_truc_tiep_multiline_top.png')
  })
  console.log('Saved: screen_modal_tab3_sua_truc_tiep_multiline_top.png')

  // Scroll down inside modal body to show Bước 4 reasoning and distractors
  const modalScrollBody = page.locator('div[role="dialog"] .overflow-y-auto')
  await modalScrollBody.evaluate((el) => { el.scrollTop = 500 })
  await page.waitForTimeout(400)

  // Screenshot 5: Modal Tab 3 - Sửa trực tiếp (phần dưới: Bước 4 reasoning và distractors)
  await modalBox.screenshot({
    path: path.join(ARTIFACT_DIR, 'screen_modal_tab3_sua_truc_tiep_multiline_distractors.png')
  })
  console.log('Saved: screen_modal_tab3_sua_truc_tiep_multiline_distractors.png')

  // Close modal
  await page.locator('div[role="dialog"] button[aria-label="Đóng"]').click()
  await page.waitForTimeout(400)

  // ───────────────────────────────────────────────────────────────────────────
  // 2. LISTENING PRACTICE (/admin/listening-practice)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[2/4] Checking Listening Practice (/admin/listening-practice)...')
  await page.goto('http://localhost:5173/admin/listening-practice')
  await page.waitForTimeout(1000)

  const editListeningPractice = page.locator('button:has-text("Sửa")').first()
  if (await editListeningPractice.isVisible()) {
    await editListeningPractice.click()
    await page.waitForSelector('text=Chỉnh sửa bài Listening Practice', { timeout: 8000 })
    await page.waitForTimeout(600)

    const listeningChipGrid = page.locator('[data-testid="explanation-chip-grid"] .grid').first()
    if (await listeningChipGrid.isVisible()) {
      await listeningChipGrid.scrollIntoViewIfNeeded()
      await listeningChipGrid.screenshot({
        path: path.join(ARTIFACT_DIR, 'screen_chips_listening_practice.png')
      })
      console.log('Saved: screen_chips_listening_practice.png')
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. EXAM READING (/admin/exams/reading)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[3/4] Checking Exam Reading (/admin/exams/reading)...')
  await page.goto('http://localhost:5173/admin/exams/reading')
  await page.waitForTimeout(1500)

  const editExamReading = page.locator('div.bg-white.rounded-lg').filter({ hasText: 'Cambridge 19 Test 1' }).locator('button:has-text("Sửa")').first()
  await editExamReading.waitFor({ state: 'visible', timeout: 10000 })
  await editExamReading.click()
  await page.waitForSelector('span:has-text("Đang sửa đề #")', { timeout: 10000 })
  await page.waitForTimeout(600)

  // Ensure Passage 1 is open
  const p1Header = page.locator('button:has-text("Passage 1")').first()
  if (await p1Header.isVisible()) {
    const panel = page.locator('#passage-panel-0')
    if (!(await panel.isVisible())) {
      await p1Header.click()
      await panel.waitFor({ state: 'visible', timeout: 5000 })
    }
  }
  await page.waitForTimeout(500)

  const chipGridExamReading = page.locator('[data-testid="explanation-chip-grid"] .grid').first()
  if (await chipGridExamReading.isVisible()) {
    await chipGridExamReading.scrollIntoViewIfNeeded()
    await chipGridExamReading.screenshot({
      path: path.join(ARTIFACT_DIR, 'screen_chips_exam_reading.png')
    })
    console.log('Saved: screen_chips_exam_reading.png')
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4. EXAM LISTENING (/admin/exams/listening)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n[4/4] Checking Exam Listening (/admin/exams/listening)...')
  await page.goto('http://localhost:5173/admin/exams/listening')
  await page.waitForTimeout(1500)

  const editExamListening = page.locator('div.bg-white.rounded-lg').filter({ hasText: 'Cambridge 19 Test 1' }).locator('button:has-text("Sửa")').first()
  await editExamListening.waitFor({ state: 'visible', timeout: 10000 })
  await editExamListening.click()
  await page.waitForSelector('span:has-text("Đang sửa đề #")', { timeout: 10000 })
  await page.waitForTimeout(600)

  // Ensure Section 1 is open
  const s1Header = page.locator('button:has-text("Section 1")').first()
  if (await s1Header.isVisible()) {
    const panel = page.locator('#ls-section-panel-0')
    if (!(await panel.isVisible())) {
      await s1Header.click()
      await panel.waitFor({ state: 'visible', timeout: 5000 })
    }
  }
  await page.waitForTimeout(500)

  const chipGridExamListening = page.locator('[data-testid="explanation-chip-grid"] .grid').first()
  if (await chipGridExamListening.isVisible()) {
    await chipGridExamListening.scrollIntoViewIfNeeded()
    await chipGridExamListening.screenshot({
      path: path.join(ARTIFACT_DIR, 'screen_chips_exam_listening.png')
    })
    console.log('Saved: screen_chips_exam_listening.png')
  }

  console.log('\n=== ALL BROWSER SCREENSHOTS TAKEN SUCCESSFULLY ===')
  await browser.close()
}

run().catch((err) => {
  console.error('SCRIPT ERROR:', err)
  process.exit(1)
})
