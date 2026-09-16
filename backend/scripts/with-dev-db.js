// Chạy 1 lệnh với DATABASE_URL/DIRECT_URL trỏ Postgres dev local (docker-dev.env)
// thay vì backend/.env (Supabase production). Dùng qua npm scripts, không gọi trực tiếp.
//
// Cách dùng: node scripts/with-dev-db.js -- <command> [args...]

const path = require('path')
const { spawnSync } = require('child_process')

require('dotenv').config({
  path: path.join(__dirname, '..', 'docker-dev.env'),
  override: true, // đảm bảo ghi đè DATABASE_URL/DIRECT_URL dù shell/.env đã set giá trị khác
})

if (!process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
  console.error('ERROR: docker-dev.env không trỏ vào postgres-dev (127.0.0.1:5433). Dừng lại để tránh chạy nhầm lên DB khác.')
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
