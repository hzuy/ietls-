const { chromium } = require('d:/Duy/ielts-app/backend/node_modules/playwright')
const path = require('path')

const ARTIFACT_DIR = 'C:/Users/ADMIN/.gemini/antigravity-ide/brain/fe99e17e-7027-46a5-a539-efc5e5d4aee0'

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } })

  // Render HTML that loads Tailwind and reproduces the exact ExplanationChipGrid layout with 1, 5, 7, 10 questions
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f4f4f5; padding: 24px; }
      </style>
    </head>
    <body class="space-y-6 max-w-4xl mx-auto">
      <h1 class="text-lg font-bold text-zinc-900 mb-4">Kiểm tra hiển thị lưới ExplanationChipGrid với 1, 5, 7, 10 câu hỏi</h1>

      <!-- 1 QUESTION -->
      <div class="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
        <div class="px-4 py-2 border-b border-zinc-100 bg-zinc-50 font-bold text-xs text-zinc-700">Nhóm 1 câu (Questions 1-1)</div>
        <div class="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200/80 space-y-2">
          <span class="text-[11px] font-bold text-zinc-600 flex items-center gap-1.5 uppercase tracking-wider">
            <span>✨ GIẢI THÍCH 4 BƯỚC</span>
          </span>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            <button class="h-9 w-full min-w-0 px-2.5 inline-flex items-center justify-between gap-1.5 rounded-lg text-xs font-medium border bg-white border-zinc-200 text-zinc-800 shadow-2xs">
              <span class="font-semibold shrink-0">Câu 1</span>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border min-w-0 max-w-full bg-sky-50 text-sky-700 border-sky-300">
                <span class="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                <span class="truncate">AI sinh</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- 5 QUESTIONS -->
      <div class="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
        <div class="px-4 py-2 border-b border-zinc-100 bg-zinc-50 font-bold text-xs text-zinc-700">Nhóm 5 câu (Questions 1-5, đầy đúng 1 hàng desktop 5 cột)</div>
        <div class="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200/80 space-y-2">
          <span class="text-[11px] font-bold text-zinc-600 flex items-center gap-1.5 uppercase tracking-wider">
            <span>✨ GIẢI THÍCH 4 BƯỚC</span>
          </span>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            ${[1, 2, 3, 4, 5].map(n => `
              <button class="h-9 w-full min-w-0 px-2.5 inline-flex items-center justify-between gap-1.5 rounded-lg text-xs font-medium border bg-white border-zinc-200 text-zinc-800 shadow-2xs">
                <span class="font-semibold shrink-0">Câu ${n}</span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border min-w-0 max-w-full ${n === 2 ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-sky-50 text-sky-700 border-sky-300'}">
                  <span class="w-1.5 h-1.5 rounded-full ${n === 2 ? 'bg-emerald-500' : 'bg-sky-500'} shrink-0"></span>
                  <span class="truncate">${n === 2 ? 'Đã duyệt' : 'AI sinh'}</span>
                </span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- 7 QUESTIONS -->
      <div class="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
        <div class="px-4 py-2 border-b border-zinc-100 bg-zinc-50 font-bold text-xs text-zinc-700">Nhóm 7 câu (Questions 1-7, 5 câu hàng 1 + 2 câu hàng 2 thẳng hàng thẳng cột)</div>
        <div class="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200/80 space-y-2">
          <span class="text-[11px] font-bold text-zinc-600 flex items-center gap-1.5 uppercase tracking-wider">
            <span>✨ GIẢI THÍCH 4 BƯỚC</span>
          </span>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            ${[1, 2, 3, 4, 5, 6, 7].map(n => `
              <button class="h-9 w-full min-w-0 px-2.5 inline-flex items-center justify-between gap-1.5 rounded-lg text-xs font-medium border bg-white border-zinc-200 text-zinc-800 shadow-2xs">
                <span class="font-semibold shrink-0">Câu ${n}</span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border min-w-0 max-w-full ${n === 3 ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : n === 4 ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-sky-50 text-sky-700 border-sky-300'}">
                  <span class="w-1.5 h-1.5 rounded-full ${n === 3 ? 'bg-indigo-500' : n === 4 ? 'bg-amber-500' : 'bg-sky-500'} shrink-0"></span>
                  <span class="truncate">${n === 3 ? 'Đã sửa tay' : n === 4 ? 'Chờ duyệt (Lệch)' : 'AI sinh'}</span>
                </span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- 10 QUESTIONS -->
      <div class="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
        <div class="px-4 py-2 border-b border-zinc-100 bg-zinc-50 font-bold text-xs text-zinc-700">Nhóm 10 câu (Questions 1-10, đúng 2 hàng 5 cột đều tăm tắp)</div>
        <div class="px-4 py-2.5 bg-zinc-50/80 border-b border-zinc-200/80 space-y-2">
          <span class="text-[11px] font-bold text-zinc-600 flex items-center gap-1.5 uppercase tracking-wider">
            <span>✨ GIẢI THÍCH 4 BƯỚC</span>
          </span>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `
              <button class="h-9 w-full min-w-0 px-2.5 inline-flex items-center justify-between gap-1.5 rounded-lg text-xs font-medium border bg-white border-zinc-200 text-zinc-800 shadow-2xs">
                <span class="font-semibold shrink-0">Câu ${n}</span>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border min-w-0 max-w-full ${n % 3 === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : n % 4 === 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-sky-50 text-sky-700 border-sky-300'}">
                  <span class="w-1.5 h-1.5 rounded-full ${n % 3 === 0 ? 'bg-emerald-500' : n % 4 === 0 ? 'bg-indigo-500' : 'bg-sky-500'} shrink-0"></span>
                  <span class="truncate">${n % 3 === 0 ? 'Đã duyệt' : n % 4 === 0 ? 'Đã sửa tay' : 'AI sinh'}</span>
                </span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    </body>
    </html>
  `)

  await page.waitForTimeout(600)
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'ui_chip_grid_1_5_7_10_questions.png'),
    fullPage: true,
  })
  console.log('Saved: ui_chip_grid_1_5_7_10_questions.png')

  await browser.close()
}

run().catch(console.error)
