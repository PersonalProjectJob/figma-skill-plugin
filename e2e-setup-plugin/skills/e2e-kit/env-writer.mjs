#!/usr/bin/env node
/**
 * env-writer.mjs — ghi/cập nhật credential test-account vào .env.local của
 * REPO GỐC (không phải worktree), an toàn và idempotent.
 *
 * Lý do có file này: trước đây thiếu credential thì người điều phối phải tự
 * tay mở `.env.local` ra sửa. Với người vận hành qua 1 coding agent (không tự
 * gõ lệnh/sửa file), bước đó là một bước thủ công không cần thiết — agent nên
 * HỎI ngay trong chat rồi tự ghi file, KHÔNG bảo user "tự đi tạo file" (xem
 * SKILL.md mục "Chưa có .env.local — hỏi ngay, đừng bảo user tự tạo").
 *
 * Đọc email/password từ STDIN dạng JSON — KHÔNG qua argv, để tránh lộ giá trị
 * qua process list (`ps`/Task Manager) trên máy nhiều người dùng. `--role`/
 * `--env` chỉ là TÊN biến, không phải secret, nên vẫn qua argv như bình thường.
 *
 * Usage:
 *   echo '{"email":"...","password":"..."}' | node .e2e/env-writer.mjs \
 *     --role owner [--env dev|staging|test|prod|local] [--workspace <path>]
 *
 * In ra: TÊN biến đã ghi + đường dẫn file — KHÔNG BAO GIỜ in giá trị thật.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { classifyWorkspace } from './resolve.mjs'

const argv = process.argv.slice(2)
const args = {}
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue
  const key = argv[i].slice(2)
  const next = argv[i + 1]
  if (next === undefined || next.startsWith('--')) args[key] = true
  else {
    args[key] = next
    i++
  }
}

function fail(msg) {
  console.error(`❌ ${msg}`)
  console.log(JSON.stringify({ ok: false, error: msg }))
  process.exit(1)
}

if (!args.role) fail('Thiếu --role <ten-role>, vd owner|staff|manager')
const role = String(args.role).toUpperCase().replace(/[^A-Z0-9_]/g, '_')
const envName = args.env ? String(args.env).toUpperCase() : null

// --- đọc secret từ STDIN, KHÔNG phải argv -----------------------------------
function readStdin() {
  return new Promise((resolve, reject) => {
    if (process.stdin.isTTY) {
      resolve('') // không có gì để đọc qua pipe — tránh treo chờ vô hạn
      return
    }
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

const raw = await readStdin()
let creds
try {
  creds = JSON.parse(raw)
} catch {
  fail('STDIN không phải JSON hợp lệ. Gửi qua pipe: {"email":"...","password":"..."}')
}
const email = creds?.email ? String(creds.email).trim() : ''
const password = creds?.password ? String(creds.password) : ''
if (!email || !password) fail('Thiếu email hoặc password trong JSON đọc từ STDIN.')

// --- xác định .env.local của REPO GỐC (không phải worktree) ----------------
// Cùng logic với resolve.mjs dùng để ĐỌC secret — để ghi đúng file mà mọi
// script khác trong kit sẽ tìm tới, không tạo một bản .env.local thứ hai lạc.
const workspace = args.workspace || process.cwd()
const ws = classifyWorkspace(workspace)
const targetRoot = ws.mainRepo || ws.root
const targetFile = join(targetRoot, '.env.local')

const emailKey = envName ? `E2E_${envName}_${role}_EMAIL` : `E2E_${role}_EMAIL`
const passKey = envName ? `E2E_${envName}_${role}_PASSWORD` : `E2E_${role}_PASSWORD`

// --- đọc file hiện có, cập nhật-hoặc-thêm, KHÔNG xoá/ghi đè phần còn lại ---
let lines = existsSync(targetFile) ? readFileSync(targetFile, 'utf8').split(/\r?\n/) : []

function upsert(list, key, value) {
  const re = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`)
  const idx = list.findIndex((l) => re.test(l))
  const line = `${key}=${value}`
  if (idx >= 0) {
    list[idx] = line
    return { list, action: 'updated' }
  }
  list.push(line)
  return { list, action: 'added' }
}

const alreadyHadEmailKey = lines.some((l) => new RegExp(`^\\s*(?:export\\s+)?${emailKey}\\s*=`).test(l))
if (!alreadyHadEmailKey && lines.length && lines[lines.length - 1] !== '') {
  lines.push('')
  lines.push(`# Thêm bởi env-writer.mjs lúc ${new Date().toISOString()} — role "${role}"${envName ? ` (env ${envName})` : ''}`)
}

const r1 = upsert(lines, emailKey, email)
lines = r1.list
const r2 = upsert(lines, passKey, password)
lines = r2.list

writeFileSync(targetFile, lines.join('\n').replace(/\n{3,}/g, '\n\n'), 'utf8')

console.log(`✅ Đã ${r1.action === 'added' ? 'thêm' : 'cập nhật'} ${emailKey} + ${passKey} vào ${targetFile}`)
console.log(
  JSON.stringify(
    {
      ok: true,
      file: targetFile,
      written: [emailKey, passKey],
      actions: { [emailKey]: r1.action, [passKey]: r2.action },
    },
    null,
    2,
  ),
)
