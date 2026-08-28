#!/usr/bin/env node
/**
 * e2e-probe.mjs — Pha 1. READ-ONLY: không ghi file nào, LUÔN exit 0.
 *
 * Vì sao luôn exit 0: probe không bao giờ được là nguyên nhân làm hỏng một lượt
 * dispatch. "Không dò ra gì" là một kết quả hợp lệ, in ra bảng rồi đi tiếp.
 *
 * Usage:
 *   node bin/e2e-probe.mjs [<workspace>] [--host codex|antigravity|claude]
 *                          [--target <url|file|dev>] [--json]
 */

import { resolve as resolvePath } from 'node:path'
import { resolveEnvironment } from '../e2e-kit/resolve.mjs'

const argv = process.argv.slice(2)
const args = { _: [] }
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) {
    args._.push(argv[i])
    continue
  }
  const key = argv[i].slice(2)
  const next = argv[i + 1]
  if (next === undefined || next.startsWith('--')) args[key] = true
  else {
    args[key] = next
    i++
  }
}

let env
try {
  env = resolveEnvironment({
    workspace: resolvePath(args._[0] || args.workspace || process.cwd()),
    host: args.host,
    target: args.target,
    env: args.env,
  })
} catch (err) {
  // Mọi exception biến thành một bậc ladder 'error' — vẫn exit 0.
  console.log(JSON.stringify({ error: err.message, capable: false }, null, 2))
  process.exit(0)
}

if (args.json) {
  console.log(JSON.stringify(env, null, 2))
  process.exit(0)
}

const yn = (v) => (v ? 'CÓ' : 'KHÔNG')
const L = []
L.push('E2E PROBE (read-only)')
L.push('='.repeat(72))
L.push(`host           : ${env.host}   [${env.hostEvidence.join('; ')}]`)
L.push(`workspace      : ${env.workspace.root}`)
L.push(`  kind         : ${env.workspace.kind}${env.workspace.branch ? `   branch: ${env.workspace.branch}` : ''}`)
if (env.workspace.kind === 'worktree') L.push(`  repo gốc     : ${env.workspace.mainRepo}`)
if (env.fallbackRoots.length) L.push(`  fallback     : ${env.fallbackRoots.join(', ')}`)
L.push(`target         : ${env.target.kind} → ${env.target.url || '(chưa resolve được)'}`)
if (env.target.kind === 'dev') {
  L.push(`  dev command  : ${env.target.devCommand || '(không có script dev)'}`)
  if (env.target.devCommandExact === false) {
    L.push(`  ⚠ KHÔNG có script dev riêng cho ${env.secrets.envTarget} — \`${env.target.devCommand}\` có thể trỏ API khác`)
  }
  if (env.target.implicitDefault) {
    L.push(
      '  ⚠ Target KHÔNG được chỉ định (không --target, không cấu hình trong .env.local) — đây là mặc định',
    )
    L.push(
      '    suy ra do KHÔNG có gì khác, không phải lựa chọn có ý thức. Nếu yêu cầu gốc của user mơ hồ',
    )
    L.push(
      '    ("chụp hình", "chạy e2e"...), agent PHẢI hỏi user chọn phạm vi trước khi tin vào target này',
    )
    L.push('    — xem SKILL.md mục "Chưa biết chụp ở đâu — hỏi trước khi chạy".')
  }
}
if (env.target.error) L.push(`  lỗi          : ${env.target.error}`)
L.push('')

L.push('LADDER')
L.push('-'.repeat(72))
L.push('Bậc 1 — script chụp của repo:')
for (const r of env.ladder['1-repo-capture-script']) {
  const state = !r.exists ? 'KHÔNG' : r.syntaxOk ? 'CÓ · syntax OK' : 'CÓ · SYNTAX HỎNG — bỏ qua, dùng fallback kit'
  L.push(`  [${state}] ${r.path}`)
  if (r.syntaxError) L.push(`        → ${r.syntaxError}`)
}
L.push('Bậc 2/3 — node_modules (workspace, rồi repo gốc theo path tuyệt đối):')
for (const r of env.ladder['2-3-node_modules']) {
  L.push(`  [${yn(r.exists)}] ${r.modules}`)
  for (const f of r.found) L.push(`        → ${f.name}@${f.version ?? '?'}`)
}
L.push('Bậc 4/5 — browser binary:')
for (const r of env.ladder['4-5-browser']) {
  if (r.dirs) L.push(`  [cache] ${r.path}  → ${r.dirs.join(', ') || '(rỗng)'}`)
  else L.push(`  [${yn(r.exists)}] ${r.path}   (${r.rung})`)
}
L.push('')

L.push('KẾT QUẢ DÒ')
L.push('-'.repeat(72))
L.push(`runner         : ${env.runner ? `${env.runner.name}@${env.runner.version ?? '?'}` : 'KHÔNG CÓ'}`)
if (env.runner) {
  L.push(`  dir          : ${env.runner.dir}`)
  if (env.runner.borrowedFrom) L.push(`  mượn từ      : ${env.runner.borrowedFrom}   (bậc 3)`)
}
L.push(`browser        : ${env.browser ? env.browser.kind : 'KHÔNG CÓ'}`)
if (env.browser) {
  L.push(`  exe          : ${env.browser.executablePath}`)
  L.push(`  headed       : ${yn(env.browser.supportsHeaded)}${env.browser.supportsHeaded ? '' : '  (headless shell — chụp headed phải dùng chromium-* hoặc channel)'}`)
}
L.push(`capture script : ${env.captureScript || 'KHÔNG CÓ (sẽ tự chụp)'}`)
L.push(`E2E_TARGET     : ${env.secrets.envTarget || '(chưa đặt — chỉ dùng được biến dạng phẳng)'}`)
if (env.secrets.baseUrlFromEnv) L.push(`  base URL     : ${env.secrets.baseUrlFromEnv}   (từ ${env.secrets.baseUrlVar})`)
L.push(`API base       : ${env.secrets.apiBase || '(chưa khai)'}${env.secrets.apiBaseVar ? `   (từ ${env.secrets.apiBaseVar})` : ''}`)
if (env.secrets.envTarget && !env.secrets.apiBaseIsEnvSpecific && env.secrets.apiBase) {
  L.push(`  ⚠ đang dùng biến phẳng E2E_API_BASE cho môi trường ${env.secrets.envTarget} — khai E2E_${env.secrets.envTarget}_API_BASE để khỏi lệch`)
}
L.push(`role dùng được : ${env.secrets.usableRoles.join(', ') || '(không có)'}`)
if (env.secrets.accounts.length) {
  L.push('tài khoản khai trong .env.local:')
  for (const a of env.secrets.accounts) {
    const flag = !a.complete ? 'THIẾU NỬA' : a.activeForTarget ? 'dùng được' : 'không khớp E2E_TARGET'
    L.push(`  [${flag}] role=${a.role.toLowerCase()}${a.dimension ? ` env=${a.dimension}` : ' (phẳng)'}  → ${a.names.join(' + ')}`)
  }
}
if (env.secrets.orphans.length) {
  L.push(`  ⚠ ${env.secrets.orphans.length} tài khoản đầy đủ nhưng KHÔNG khớp E2E_TARGET hiện tại ⇒ không script nào dùng`)
}
L.push('')
L.push(`⇒ capable (đủ để chạy smoke): ${yn(env.capable)}`)
L.push(
  env.capable
    ? '   Bước tiếp: node bin/e2e-provision.mjs <workspace>   (rải kit + chạy cổng smoke)'
    : '   BLOCKED. Không có runner/browser. Cân nhắc `npx playwright install chromium`\n' +
        '   (ghi vào cache máy, KHÔNG vào project — không phạm no-dependency-changes).',
)

console.log(L.join('\n'))
process.exit(0)
