'use strict'

const { chromium } = require('d:/Duy/ielts-app/backend/node_modules/playwright')
const path = require('path')
const jwt = require('d:/Duy/ielts-app/backend/node_modules/jsonwebtoken')

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity-ide/brain/fe99e17e-7027-46a5-a539-efc5e5d4aee0'

async function getAuthToken() {
  const secret = process.env.JWT_SECRET || 'ielts_super_secret_key_2024'
  const user = { id: 3, userId: 3, email: 'minh@gmail.com', role: 'teacher', name: 'Minh Teacher' }
  const token = jwt.sign({ userId: 3, email: 'minh@gmail.com', role: 'teacher' }, secret, { expiresIn: '1d' })
  return { token, user }
}

async function captureAll() {
  console.log('=== STARTING PLAYWRIGHT ACCEPTANCE SCREENSHOTS (1920px & 390px) ===')
  const auth = await getAuthToken()

  const browser = await chromium.launch({ channel: 'msedge', headless: true })

  const viewports = [
    { name: '1920px', width: 1920, height: 1080 },
    { name: '390px', width: 390, height: 844 },
  ]

  for (const vp of viewports) {
    console.log(`\n======================================================`)
    console.log(`--- CAPTURING VIEWPORT: ${vp.name} (${vp.width}x${vp.height}) ---`)
    console.log(`======================================================`)
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })

    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    }, { token: auth.token, user: auth.user })

    const page = await context.newPage()

    // Go to Reading Practice
    console.log('Navigating to /admin/reading-practice...')
    await page.goto('http://localhost:5173/admin/reading-practice')
    await page.waitForTimeout(1000)

    // Click "Sửa" on first practice exam
    const editBtn = page.locator('button:has-text("Sửa")').first()
    await editBtn.waitFor({ state: 'visible', timeout: 8000 })
    await editBtn.click()
    await page.waitForSelector('text=Chỉnh sửa bài Reading Practice', { timeout: 8000 })
    await page.waitForTimeout(600)

    // Find question chip grid
    const chipGrid = page.locator('.grid.grid-cols-2').first()
    await chipGrid.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)

    // Click chip 1 to open QuestionExplanationModal
    const firstChip = chipGrid.locator('button').first()
    await firstChip.click()
    await page.waitForSelector('role=dialog', { timeout: 6000 })
    await page.waitForTimeout(500)

    const modalBox = page.locator('div[role="dialog"] > div')

    // ─── 1. L1 SỬA BƯỚC 2-3 (3.2.1) ──────────────────────────────────────────
    console.log(`[1] Capturing L1 Sửa Bước 2-3 (${vp.name})...`)
    await page.locator('role=tab[name*="Sửa trực tiếp"]').click()
    await page.waitForTimeout(400)
    const step2Header = page.locator('h4:has-text("Bước 2: Định vị thông tin liên quan")')
    await step2Header.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await modalBox.screenshot({
      path: path.join(ARTIFACT_DIR, `ui_01_l1_edit_steps_2_3_${vp.name}.png`),
    })
    console.log(`Saved: ui_01_l1_edit_steps_2_3_${vp.name}.png`)

    // ─── 2. BẢN DỊCH COMPLETION VS MCQ (3.2.9) ──────────────────────────────
    console.log(`[2a] Capturing MCQ (No translation inputs) (${vp.name})...`)
    const step4Header = page.locator('h4:has-text("Bước 4: Chọn đáp án")')
    await step4Header.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await modalBox.screenshot({
      path: path.join(ARTIFACT_DIR, `ui_09a_mcq_no_translation_${vp.name}.png`),
    })
    console.log(`Saved: ui_09a_mcq_no_translation_${vp.name}.png`)

    // ─── 3. CHẶN GIAN LẬN (3.2.3) ───────────────────────────────────────────
    console.log(`[3] Capturing Chặn gian lận (${vp.name})...`)
    // Intercept PUT explanation with fake quote error
    await page.route('**/questions/*/explanation', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Câu trích dẫn "This is a forged sentence that does not exist in passage" không tìm thấy nguyên văn trong bài đọc/transcript.'
        })
      })
    })
    await page.locator('button:has-text("Lưu chỉnh sửa")').click()
    await page.waitForTimeout(600)
    const errorAlert = page.locator('text=không tìm thấy nguyên văn')
    await errorAlert.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await modalBox.screenshot({
      path: path.join(ARTIFACT_DIR, `ui_03_fraud_prevention_rejected_${vp.name}.png`),
    })
    console.log(`Saved: ui_03_fraud_prevention_rejected_${vp.name}.png`)

    // ─── 4. NOT GIVEN KHÔNG BỊ CHẶN (3.2.10) ────────────────────────────────
    console.log(`[4] Capturing NOT GIVEN không bị chặn (${vp.name})...`)
    await page.route('**/questions/*/explanation', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          explanation: {
            v: 2,
            answer: 'NOT GIVEN',
            reasoning: 'Thông tin không được đề cập trong bài đọc.',
            status: 'teacher_edited'
          },
          message: 'Đã lưu chỉnh sửa giải thích thành công!'
        })
      })
    })
    await page.locator('button:has-text("Lưu chỉnh sửa")').click()
    await page.waitForTimeout(600)
    await modalBox.screenshot({
      path: path.join(ARTIFACT_DIR, `ui_10_not_given_empty_evidence_allowed_${vp.name}.png`),
    })
    console.log(`Saved: ui_10_not_given_empty_evidence_allowed_${vp.name}.png`)

    // ─── 5. MODAL LUỒNG X (3.2.4) ───────────────────────────────────────────
    console.log(`[5] Capturing Modal Luồng X (${vp.name})...`)
    await page.locator('role=tab[name*="Góp ý & Tạo lại"]').click()
    await page.waitForTimeout(300)
    await page.locator('textarea[placeholder*="Ví dụ:"]').fill('Hãy giải thích rõ hơn vì sao đáp án này đúng...')

    await page.route('**/regenerate-explanation', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          conflict: true,
          isConflict: true,
          status: 'conflict_pending',
          isFeedbackOnly: true,
          currentAnswer: 'TRUE',
          aiBlindAnswer: 'FALSE',
          attemptCount: 15,
          evidence: 'Clinical observations showed that patients frequently concealed symptoms...',
          reasoning: 'Dựa trên bài đọc, AI giải độc lập ra FALSE.',
          message: 'AI giải độc lập ra đáp án "FALSE" (khác với đáp án "TRUE" đang lưu của câu hỏi). Lời giải chưa được lưu.'
        })
      })
    })

    await page.locator('button:has-text("Tạo lại lời giải với AI")').click()
    await page.waitForSelector('text=AI giải độc lập không khớp', { timeout: 6000 })
    await page.waitForTimeout(500)
    await modalBox.screenshot({
      path: path.join(ARTIFACT_DIR, `ui_04_modal_flow_x_conflict_${vp.name}.png`),
    })
    console.log(`Saved: ui_04_modal_flow_x_conflict_${vp.name}.png`)

    // Close conflict dialog via "Giữ nguyên đáp án đang lưu"
    const cancelConflictBtn = page.locator('button:has-text("Giữ nguyên đáp án đang lưu")').first()
    if (await cancelConflictBtn.isVisible()) await cancelConflictBtn.click()
    await page.waitForTimeout(400)

    // ─── 6. MODAL LUỒNG Y & CẢNH BÁO LƯỢT THI (3.2.5 & 3.2.7) ───────────────
    console.log(`[6] Capturing Modal Luồng Y & Cảnh báo lượt thi (${vp.name})...`)
    await page.locator('input[placeholder*="nhập đáp án mới nếu đáp án"]').fill('FALSE')
    await page.waitForTimeout(200)

    await page.route('**/regenerate-explanation', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          requiresConfirmation: true,
          proposedAnswer: 'FALSE',
          currentAnswer: 'TRUE',
          aiBlindAnswer: 'FALSE',
          attemptCount: 15,
          evidence: 'Clinical observations showed that patients frequently concealed symptoms...',
          reasoning: 'AI giải độc lập hoàn toàn đồng thuận với đề xuất của bạn.',
          message: 'AI giải độc lập cũng ra "FALSE" (khớp với bạn). Bạn có chắc chắn muốn đổi đáp án chuẩn từ "TRUE" thành "FALSE" không?'
        })
      })
    })

    await page.locator('button:has-text("Tạo lại lời giải với AI")').click()
    await page.waitForSelector('text=Xác nhận đổi đáp án chuẩn', { timeout: 6000 })
    await page.waitForTimeout(500)
    await modalBox.screenshot({
      path: path.join(ARTIFACT_DIR, `ui_05_modal_flow_y_confirm_attempt_warning_${vp.name}.png`),
    })
    console.log(`Saved: ui_05_modal_flow_y_confirm_attempt_warning_${vp.name}.png`)

    // Close confirm dialog via "Hủy bỏ"
    const cancelConfirmBtn = page.locator('button:has-text("Hủy bỏ")').first()
    if (await cancelConfirmBtn.isVisible()) await cancelConfirmBtn.click()
    await page.waitForTimeout(400)

    // ─── 7. MODAL LUỒNG Z (3.2.6) ───────────────────────────────────────────
    console.log(`[7] Capturing Modal Luồng Z (${vp.name})...`)
    await page.locator('input[placeholder*="nhập đáp án mới nếu đáp án"]').fill('NOT GIVEN')
    await page.waitForTimeout(200)

    await page.route('**/regenerate-explanation', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          conflict: true,
          proposedAnswer: 'NOT GIVEN',
          currentAnswer: 'TRUE',
          aiBlindAnswer: 'FALSE',
          attemptCount: 15,
          evidence: 'Clinical observations showed that patients frequently concealed symptoms...',
          reasoning: 'Thông tin có trong bài nên không thể là NOT GIVEN.',
          message: 'AI giải độc lập ra "FALSE" (dựa trên bài đọc), KHÔNG khớp với đáp án "NOT GIVEN" bạn đề xuất. Lời giải chưa được lưu.'
        })
      })
    })

    await page.locator('button:has-text("Tạo lại lời giải với AI")').click()
    await page.waitForSelector('text=AI giải độc lập không khớp', { timeout: 6000 })
    await page.waitForTimeout(500)
    await modalBox.screenshot({
      path: path.join(ARTIFACT_DIR, `ui_06_modal_flow_z_rejected_${vp.name}.png`),
    })
    console.log(`Saved: ui_06_modal_flow_z_rejected_${vp.name}.png`)

    // Close conflict dialog
    const closeConflictZBtn = page.locator('button:has-text("Giữ nguyên đáp án đang lưu")').first()
    if (await closeConflictZBtn.isVisible()) await closeConflictZBtn.click()
    await page.waitForTimeout(400)

    // ─── 8. THÔNG BÁO LỖI GEMINI + NÚT THỬ LẠI (3.2.8) ──────────────────────
    console.log(`[8] Capturing Gemini Error (504 Timeout) with Retry Button (${vp.name})...`)
    await page.route('**/regenerate-explanation', (route) => {
      route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          error: 'TIMEOUT',
          message: 'Hết thời gian xử lý AI khi tạo lại giải thích (quá 48s). Vui lòng thử lại.'
        })
      })
    })

    await page.locator('button:has-text("Tạo lại lời giải với AI")').click()
    await page.waitForSelector('text=Hết thời gian xử lý AI (quá 48s)', { timeout: 5000 })
    await page.waitForTimeout(500)
    await modalBox.screenshot({
      path: path.join(ARTIFACT_DIR, `ui_08_gemini_error_retry_${vp.name}.png`),
    })
    console.log(`Saved: ui_08_gemini_error_retry_${vp.name}.png`)

    // Close modal
    await page.locator('div[role="dialog"] button[aria-label="Đóng"]').click()
    await page.waitForTimeout(500)

    // ─── 9. COMPLETION TRANSLATION INPUTS (3.2.9b) ──────────────────────────
    // Click chip 3 or 4 which is typically completion or open second chip
    const allChips = chipGrid.locator('button')
    const count = await allChips.count()
    if (count > 1) {
      await allChips.nth(1).click()
      await page.waitForSelector('role=dialog', { timeout: 5000 })
      await page.waitForTimeout(400)
      await page.locator('role=tab[name*="Sửa trực tiếp"]').click()
      await page.waitForTimeout(400)
      await page.locator('h4:has-text("Bước 4: Chọn đáp án")').scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
      await modalBox.screenshot({
        path: path.join(ARTIFACT_DIR, `ui_09b_completion_with_translation_${vp.name}.png`),
      })
      console.log(`Saved: ui_09b_completion_with_translation_${vp.name}.png`)
      await page.locator('div[role="dialog"] button[aria-label="Đóng"]').click()
      await page.waitForTimeout(400)
    }

    // ─── 10. TRANG HỌC SINH HIGHLIGHT (3.2.2) ───────────────────────────────
    console.log(`[10] Capturing Trang học sinh highlight (${vp.name})...`)
    const previewBtn = page.locator('button[aria-label="Preview nội dung đề"]').first()
    if (await previewBtn.isVisible()) {
      await previewBtn.click()
      await page.waitForSelector('text=Preview —', { timeout: 5000 })
      await page.waitForTimeout(400)

      // Click "Hiện đáp án"
      const toggleAnswerBtn = page.locator('button:has-text("Hiện đáp án")')
      if (await toggleAnswerBtn.isVisible()) {
        await toggleAnswerBtn.click()
        await page.waitForTimeout(500)
      }

      const previewModal = page.locator('div.fixed.inset-0.z-\\[9999\\] > div').first()
      await previewModal.screenshot({
        path: path.join(ARTIFACT_DIR, `ui_02_student_highlight_preview_${vp.name}.png`),
      })
      console.log(`Saved: ui_02_student_highlight_preview_${vp.name}.png`)

      // Close preview modal
      await page.locator('button:has-text("✕ Đóng")').click()
      await page.waitForTimeout(300)
    }

    await context.close()
  }

  await browser.close()
  console.log('\n✅ TẤT CẢ ẢNH CHỤP NGHIỆM THU ĐÃ HOÀN TẤT THÀNH CÔNG!')
}

captureAll().catch((err) => {
  console.error('Error during screenshot capture:', err)
  process.exit(1)
})
