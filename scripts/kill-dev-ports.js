#!/usr/bin/env node
// Tim va tat tien trinh dang LISTEN dung tren cong dev co dinh cua project
// (backend 3001, frontend 5173). Chi tac dong len PID dang chiem chinh xac
// hai cong nay - khong dung cho muc dich don dep node process khac tren may.
'use strict'

const { execSync } = require('child_process')

const PORTS = [3001, 5173]

if (process.platform !== 'win32') {
  console.error('Script này chỉ hỗ trợ Windows (dùng netstat/taskkill).')
  process.exit(1)
}

function findPidsOnPort(port) {
  const output = execSync('netstat -ano', { encoding: 'utf8' })
  const pids = new Set()
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line.startsWith('TCP') || !line.includes('LISTENING')) continue
    const fields = line.split(/\s+/)
    const localAddress = fields[1]
    const pid = fields[fields.length - 1]
    const lastColon = localAddress.lastIndexOf(':')
    const localPort = Number(localAddress.slice(lastColon + 1))
    if (localPort === port) pids.add(pid)
  }
  return [...pids]
}

function killPid(pid) {
  try {
    execSync(`taskkill /PID ${pid}`, { stdio: 'ignore' })
    console.log(`  Đã tắt êm PID ${pid}`)
    return
  } catch {
    // tắt êm thất bại (thường do process không phải console app) -> buộc dừng
  }
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
    console.log(`  Đã buộc tắt PID ${pid}`)
  } catch (err) {
    console.error(`  Không tắt được PID ${pid}: ${err.message}`)
  }
}

let foundAny = false
for (const port of PORTS) {
  const pids = findPidsOnPort(port)
  if (pids.length === 0) {
    console.log(`Cổng ${port}: đang trống.`)
    continue
  }
  foundAny = true
  console.log(`Cổng ${port}: đang bị chiếm bởi PID ${pids.join(', ')} — tắt...`)
  pids.forEach(killPid)
}

if (!foundAny) {
  console.log('Không có gì để dọn — cả hai cổng 3001 và 5173 đều trống.')
}
