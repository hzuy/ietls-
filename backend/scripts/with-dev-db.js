// Chạy 1 lệnh với DATABASE_URL/DIRECT_URL trỏ Postgres dev local (docker-dev.env)
// thay vì backend/.env (Supabase production). Dùng qua npm scripts, không gọi trực tiếp.
//
// Cách dùng: node scripts/with-dev-db.js -- <command> [args...]

const path = require('path')
const fs = require('fs')
const { spawnSync } = require('child_process')

const envPath = path.join(__dirname, '..', 'docker-dev.env')

if (!fs.existsSync(envPath)) {
  console.error(
    [
      `ERROR: Thiếu file "backend/docker-dev.env" — script này cần file đó để trỏ DATABASE_URL/DIRECT_URL vào postgres-dev (127.0.0.1:5433) thay vì backend/.env (Supabase production).`,
      '',
      'Cách tạo: xem mục "DB dev/test local (postgres-dev...)" trong CLAUDE.md (root repo) — cần:',
      '  1. `docker compose up -d postgres-dev` (dựng container Postgres riêng, cổng 5433)',
      '  2. Tạo `backend/docker-dev.env` (gitignored) với DATABASE_URL/DIRECT_URL trỏ 127.0.0.1:5433',
      '  3. `npm run db:dev:push` rồi `npm run db:dev:seed` để có schema + dữ liệu giả',
    ].join('\n')
  )
  process.exit(1)
}

require('dotenv').config({
  path: envPath,
  override: true, // đảm bảo ghi đè DATABASE_URL/DIRECT_URL dù shell/.env đã set giá trị khác
})

if (!(process.env.DATABASE_URL || '').includes('127.0.0.1:5433')) {
  console.error(
    [
      `ERROR: "backend/docker-dev.env" tồn tại nhưng DATABASE_URL không trỏ vào postgres-dev (127.0.0.1:5433) — hiện là: ${process.env.DATABASE_URL || '(không có giá trị)'}.`,
      'Dừng lại để tránh chạy nhầm lên DB khác (kể cả production). Kiểm tra lại nội dung file theo mục "DB dev/test local (postgres-dev...)" trong CLAUDE.md (root repo).',
    ].join('\n')
  )
  process.exit(1)
}

const args = process.argv.slice(2)
const sepIndex = args.indexOf('--')
const command = sepIndex === -1 ? args : args.slice(sepIndex + 1)

if (command.length === 0) {
  console.error('Usage: node scripts/with-dev-db.js -- <command> [args...]')
  process.exit(1)
}

console.log(`[with-dev-db] DATABASE_URL -> ${process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@')}`)

const result = spawnSync(command[0], command.slice(1), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
  cwd: path.join(__dirname, '..'),
})

process.exit(result.status ?? 1)
