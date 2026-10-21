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
  console.log('=== STARTING BROWSER SCREENSHOT VERIFICATION ===')
  const auth = await getAuthToken()

  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })

  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }, { token: auth.token, user: auth.user })

  const page = await context.newPage()
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('BROWSER ERROR:', msg.text())
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 1. READING PRACTICE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n1. Navigating to Reading Practice (/admin/reading-practice)...')
  await page.goto('http://localhost:5173/admin/reading-practice')
  await page.waitForTimeout(1000)

  // Click Sửa first item
  const editReadingPractice = page.locator('button:has-text("Sửa")').first()
  await editReadingPractice.waitFor({ state: 'visible', timeout: 8000 })
  await editReadingPractice.click()
  await page.waitForSelector('text=Chỉnh sửa bài Reading Practice', { timeout: 8000 })
  await page.waitForTimeout(600)

  // Scroll to question group card
  const chipGridReadingPractice = page.locator('.grid.grid-cols-2').first()
  await chipGridReadingPractice.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  // Screenshot 1: Reading Practice chip row
  await chipGridReadingPractice.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_reading_practice_chip_grid.png')
  })
  console.log('Saved: ui_reading_practice_chip_grid.png')

  // Click first question chip to open QuestionExplanationModal
  const firstChipReadingPractice = chipGridReadingPractice.locator('button').first()
  await firstChipReadingPractice.click()
  await page.waitForSelector('role=dialog', { timeout: 5000 })
  await page.waitForTimeout(400)

  // Screenshot 2: Modal Tab 1 (Xem lời giải)
  const modalBox = page.locator('div[role="dialog"] > div')
  await modalBox.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_modal_tab1_view.png')
  })
  console.log('Saved: ui_modal_tab1_view.png')

  // Switch to Tab 2 (Góp ý & Tạo lại)
  await page.locator('role=tab[name*="Góp ý & Tạo lại"]').click()
  await page.waitForTimeout(400)

  // Screenshot 3: Modal Tab 2 (Góp ý & Tạo lại)
  await modalBox.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_modal_tab2_feedback.png')
  })
  console.log('Saved: ui_modal_tab2_feedback.png')

  // Switch to Tab 3 (Sửa trực tiếp)
  await page.locator('role=tab[name*="Sửa trực tiếp"]').click()
  await page.waitForTimeout(400)

  // Screenshot 4: Modal Tab 3 (Sửa trực tiếp)
  await modalBox.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_modal_tab3_direct_edit.png')
  })
  console.log('Saved: ui_modal_tab3_direct_edit.png')

  // Close modal via top-right X button
  const closeXBtn = page.locator('div[role="dialog"] button[aria-label="Đóng"]')
  await closeXBtn.click()
  await page.waitForTimeout(400)

  // Open Preview Modal in Reading Practice
  const previewReadingPracticeBtn = page.locator('button:has-text("Xem trước")')
  await previewReadingPracticeBtn.click()
  await page.waitForSelector('text=Xem trước —', { timeout: 5000 })
  await page.waitForTimeout(400)

  // Screenshot 5: Reading Practice preview toolbar
  const previewHeaderRP = page.locator('div:has-text("Xem trước —")').locator('..').first()
  await previewHeaderRP.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_preview_toolbar_reading_practice.png')
  })
  console.log('Saved: ui_preview_toolbar_reading_practice.png')

  // Close preview modal
  await page.locator('button:has-text("✕ Đóng")').click()
  await page.waitForTimeout(400)

  // ───────────────────────────────────────────────────────────────────────────
  // 2. LISTENING PRACTICE
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n2. Navigating to Listening Practice (/admin/listening-practice)...')
  await page.goto('http://localhost:5173/admin/listening-practice')
  await page.waitForTimeout(1000)

  const editListeningPractice = page.locator('button:has-text("Sửa")').first()
  await editListeningPractice.waitFor({ state: 'visible', timeout: 8000 })
  await editListeningPractice.click()
  await page.waitForSelector('text=Chỉnh sửa bài Listening Practice', { timeout: 8000 })
  await page.waitForTimeout(600)

  const chipGridListeningPractice = page.locator('.grid.grid-cols-2').first()
  await chipGridListeningPractice.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  // Screenshot 6: Listening Practice chip row
  await chipGridListeningPractice.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_listening_practice_chip_grid.png')
  })
  console.log('Saved: ui_listening_practice_chip_grid.png')

  // Open Preview Modal in Listening Practice
  const previewListeningPracticeBtn = page.locator('button:has-text("Xem trước")')
  await previewListeningPracticeBtn.click()
  await page.waitForSelector('text=Xem trước —', { timeout: 5000 })
  await page.waitForTimeout(400)

  // Screenshot 7: Listening Practice preview toolbar
  const previewHeaderLP = page.locator('div:has-text("Xem trước —")').locator('..').first()
  await previewHeaderLP.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_preview_toolbar_listening_practice.png')
  })
  console.log('Saved: ui_preview_toolbar_listening_practice.png')

  await page.locator('button:has-text("✕ Đóng")').click()
  await page.waitForTimeout(400)

  // ───────────────────────────────────────────────────────────────────────────
  // 3. EXAM READING (/admin/exams/reading)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n3. Navigating to Exam Reading (/admin/exams/reading)...')
  await page.goto('http://localhost:5173/admin/exams/reading')
  await page.waitForTimeout(1500)

  // Click edit first exam reading in list
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

  // Find chip grid in exam reading
  const chipGridExamReading = page.locator('.grid.grid-cols-2').first()
  await chipGridExamReading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  // Screenshot 8: Exam Reading chip grid
  await chipGridExamReading.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_exam_reading_chip_grid.png')
  })
  console.log('Saved: ui_exam_reading_chip_grid.png')

  // Open Preview in Exam Reading
  const previewExamReadingBtn = page.locator('button:has-text("Xem trước")').first()
  await previewExamReadingBtn.click()
  await page.waitForSelector('text=Xem trước —', { timeout: 5000 })
  await page.waitForTimeout(400)

  // Screenshot 9: Exam Reading preview toolbar
  const previewHeaderER = page.locator('div:has-text("Xem trước —")').locator('..').first()
  await previewHeaderER.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_preview_toolbar_exam_reading.png')
  })
  console.log('Saved: ui_preview_toolbar_exam_reading.png')

  // ───────────────────────────────────────────────────────────────────────────
  // 4. EXAM LISTENING (/admin/exams/listening)
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n4. Navigating to Exam Listening (/admin/exams/listening)...')
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

  const chipGridExamListening = page.locator('.grid.grid-cols-2').first()
  await chipGridExamListening.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  // Screenshot 10: Exam Listening chip grid
  await chipGridExamListening.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_exam_listening_chip_grid.png')
  })
  console.log('Saved: ui_exam_listening_chip_grid.png')

  // Open Preview in Exam Listening
  const previewExamListeningBtn = page.locator('button:has-text("Xem trước")').first()
  await previewExamListeningBtn.click()
  await page.waitForSelector('text=Xem trước —', { timeout: 5000 })
  await page.waitForTimeout(400)

  // Screenshot 11: Exam Listening preview toolbar
  const previewHeaderEL = page.locator('div:has-text("Xem trước —")').locator('..').first()
  await previewHeaderEL.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_preview_toolbar_exam_listening.png')
  })
  console.log('Saved: ui_preview_toolbar_exam_listening.png')

  console.log('\n=== ALL BROWSER SCREENSHOTS TAKEN SUCCESSFULLY! ===')
  await browser.close()
}

run().catch(err => {
  console.error('VERIFICATION ERROR:', err)
  process.exit(1)
})
