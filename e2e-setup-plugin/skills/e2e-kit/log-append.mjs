#!/usr/bin/env node
/**
 * log-append.mjs — ghi 1 entry mới lên ĐẦU log tổng hợp (manager đọc nhanh,
 * không cần mở từng bundle), chạy SAU bundle.mjs.
 *
 * Log sống NGOÀI workspace/worktree — mặc định lấy `skillLogRoot` do
 * e2e-provision.mjs ghi vào `.e2e/env.json` lúc provision (bền qua nhiều
 * task/worktree, vì `.e2e/` của một task cụ thể sẽ mất khi worktree bị xoá).
 * Ép chỗ khác bằng --log-dir.
 *
 * Usage:
 *   node log-append.mjs --evidence-dir <folder bundle.mjs vừa chạy xong>
 *                        [--workspace <ws>] [--log-dir <path tuyệt đối>]
 *                        [--feature <tên>] [--token "<Codex tự báo cáo, nếu có>"]
 */

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, resolve as resolvePath } from 'node:path'

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

function fail(message, details = {}) {
  console.log(`❌ Log append failed — ${message}`)
  console.log(JSON.stringify({ ok: false, error: message, ...details }, null, 2))
  process.exit(1)
}

if (!args['evidence-dir']) fail('thiếu --evidence-dir <folder bundle.mjs vừa chạy xong>')
const evidenceDir = resolvePath(String(args['evidence-dir']))
const manifestPath = join(evidenceDir, 'manifest.json')
if (!existsSync(manifestPath)) fail(`không thấy manifest.json — chạy bundle.mjs trước khi log-append.mjs: ${manifestPath}`)

let manifest
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch (error) {
  fail(`manifest.json hỏng: ${error.message}`, { manifestPath })
}

// --- logDir: PHẢI bền qua nhiều workspace/worktree — không có thì FAIL rõ,
// không âm thầm rơi về workspace hiện tại (mất hết mục đích "update liên tục").
let logDir = args['log-dir'] ? resolvePath(String(args['log-dir'])) : null
if (!logDir) {
  const envJsonPath = join(resolvePath(String(args.workspace || process.cwd())), '.e2e', 'env.json')
  if (existsSync(envJsonPath)) {
    try {
      const envJson = JSON.parse(readFileSync(envJsonPath, 'utf8'))
      if (envJson.skillLogRoot) logDir = resolvePath(envJson.skillLogRoot)
    } catch {
      /* rơi xuống fail dưới nếu vẫn null */
    }
  }
}
if (!logDir) {
  fail(
    'không xác định được logDir (nơi lưu bền, ngoài workspace hiện tại). Chạy lại ' +
      '`node bin/e2e-provision.mjs <workspace>` (bản mới có ghi `skillLogRoot` vào .e2e/env.json), ' +
      'hoặc truyền --log-dir <path tuyệt đối> tay.',
  )
}
// `skillLogRoot` trong env.json là path trên máy đã chạy e2e-provision.mjs —
// nếu executor chạy trên MÁY/SANDBOX KHÁC (Codex/Gemini remote, hoặc workspace
// bị giao cho máy khác với máy đã provision), path đó không tồn tại ở đây ⇒
// mkdirSync sẽ throw. Bắt rõ, đừng để user thấy raw stacktrace.
try {
  mkdirSync(logDir, { recursive: true })
} catch (error) {
  fail(
    `không tạo/ghi được logDir: ${logDir} — ${error.message}. Thường là do máy/sandbox đang chạy ` +
      'lệnh này KHÔNG PHẢI máy đã chạy `e2e-provision.mjs` (skillLogRoot trong .e2e/env.json là path ' +
      'tuyệt đối trên máy đó, không tự dò lại được ở đây). Truyền --log-dir <path tuyệt đối, GHI ĐƯỢC ' +
      'trên chính máy này> để log cho lượt này, hoặc bỏ log-append.mjs (bundle.mjs vẫn tạo đủ ' +
      'FEATURE.md/manifest.json/ZIP mà không cần log tổng hợp).',
    { logDir },
  )
}

const feature = String(args.feature || manifest.feature || basename(evidenceDir))
const now = new Date()
// "Aug 25 2026" — đúng quy tắc đặt tên entry đã chốt với user 2026-08-25
const dateLabel = now
  .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  .replace(',', '')
const runStamp = now.toISOString().replace(/[:.]/g, '-')
const slug = feature.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'feature'

// --- thời gian: SỐ THẬT (sum elapsedMs từng viewport từ manifest, không suy đoán)
const totalMs = (manifest.runtimeEvidence || []).reduce((sum, run) => sum + (Number(run.elapsedMs) || 0), 0)
function fmtDuration(ms) {
  if (!ms) return 'không đo được'
  const totalSec = Math.round(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`
}
const timeLabel = fmtDuration(totalMs)

// --- token: KHÔNG BAO GIỜ bịa. Chỉ có số khi được truyền tay (Codex tự báo cáo
// qua codex-progress.py --summary). Claude main-loop không có tool đọc lại
// token của chính nó — xem e2e-setup/SKILL.md điểm 14 + agents/nx-reporter.md.
const tokenLabel = args.token ? String(args.token) : 'không đo được (Claude main-loop không có tool đọc lại token)'

// --- copy thumbnail bền cạnh LOG.md (KHÔNG link vào evidenceDir gốc — evidenceDir
// nằm trong workspace/.e2e/out, sẽ mất khi worktree bị xoá).
const thumbsRoot = join(logDir, 'thumbs', `${slug}-${runStamp}`)
mkdirSync(thumbsRoot, { recursive: true })

// Kích thước thật theo đúng preset của flow.mjs (VIEWPORT_PRESETS) — không đoán,
// đổi ở đây thì cũng phải đổi đúng preset đó để 2 bên không lệch nhau.
const viewportOrder = ['desktop', 'tablet/portrait', 'tablet/landscape', 'mobile']
const viewportLabel = {
  desktop: 'Desktop (1440x900)',
  'tablet/portrait': 'Tablet Portrait (768x1024)',
  'tablet/landscape': 'Tablet Landscape (1024x768)',
  mobile: 'Mobile (375x812)',
}

// hàng = shot label (click mở đúng URL lúc chụp), cột = viewport — giống layout
// bảng mẫu (URL/step theo hàng, device theo cột), chỉ đổi tên cột cho khớp 4
// viewport chuẩn của skill này và thêm kích thước vào header.
const shotRows = new Map()
const shotUrls = new Map()
for (const run of manifest.runtimeEvidence || []) {
  const vp = run.folder
  if (!viewportLabel[vp]) continue
  for (const shot of run.shots || []) {
    const shotFile = basename(shot.file)
    const srcAbs = join(evidenceDir, ...vp.split('/'), shotFile)
    if (!existsSync(srcAbs)) continue
    const destName = `${vp.replace('/', '-')}--${shotFile}`
    copyFileSync(srcAbs, join(thumbsRoot, destName))
    const relFromLog = `thumbs/${slug}-${runStamp}/${destName}`
    if (!shotRows.has(shot.label)) shotRows.set(shot.label, {})
    shotRows.get(shot.label)[vp] = relFromLog
    if (shot.url && !shotUrls.has(shot.label)) shotUrls.set(shot.label, shot.url)
  }
}
if (shotRows.size === 0) {
  fail('manifest.json không có shot nào có ảnh đọc được trên đĩa — chạy lại flow/bundle trước khi log', {
    evidenceDir,
  })
}

// --- ZIP cạnh evidenceDir (bundle.mjs tạo `<evidenceDir>.zip`), nếu có
const zipPath = `${evidenceDir}.zip`
const zipInfo = existsSync(zipPath)
  ? { bytes: statSync(zipPath).size, sha256: createHash('sha256').update(readFileSync(zipPath)).digest('hex') }
  : null

const tableHeader = `| Shot (click mở URL lúc chụp) | ${viewportOrder.map((v) => viewportLabel[v]).join(' | ')} |`
const tableSep = `|---|${viewportOrder.map(() => '---').join('|')}|`
const tableRows = [...shotRows.entries()].map(([label, cells]) => {
  const cellsMd = viewportOrder.map((v) => (cells[v] ? `![${label}](${cells[v]})` : '—'))
  const shotUrl = shotUrls.get(label)
  const shotCell = shotUrl
    ? `**${label}**<br>[${shotUrl}](${shotUrl})`
    : `${label} _(không ghi được URL — flow.mjs cũ, chạy lại)_`
  return `| ${shotCell} | ${cellsMd.join(' | ')} |`
})

const entryLines = [
  `## ${feature} - ${dateLabel} - ${timeLabel} / token: ${tokenLabel}`,
  '',
  `- Environment: ${manifest.environment || 'không ghi rõ'}`,
  `- Route: ${manifest.route || 'không ghi rõ'}`,
]
if (zipInfo) entryLines.push(`- ZIP: \`${zipInfo.bytes} bytes\`, SHA-256: \`${zipInfo.sha256}\``)
entryLines.push('', tableHeader, tableSep, ...tableRows, '')
const entry = entryLines.join('\n')

const MARKER = '<!-- ENTRIES:BEGIN -->\n'
const HEADER =
  '# E2E Evidence Log\n\n' +
  'Mới → cũ (entry mới nhất luôn ở trên). Mỗi entry là 1 lượt `flow.mjs --viewport all` + `bundle.mjs`.\n' +
  'Ảnh thumbnail đã được copy bền cạnh file này (folder `thumbs/`) — không phụ thuộc worktree/evidence-dir\n' +
  'gốc, vốn sẽ mất khi `git worktree remove`. Xem bundle gốc (trace/video đầy đủ) qua đường dẫn trong mỗi entry.\n\n' +
  MARKER

const logPath = join(logDir, 'LOG.md')
let existing = existsSync(logPath) ? readFileSync(logPath, 'utf8') : HEADER
if (!existing.includes(MARKER)) existing = HEADER + existing
const idx = existing.indexOf(MARKER) + MARKER.length
writeFileSync(logPath, existing.slice(0, idx) + entry + '\n' + existing.slice(idx), 'utf8')

console.log(`✅ Log entry: ${logPath} — ## ${feature} - ${dateLabel} - ${timeLabel}`)
console.log(
  JSON.stringify(
    {
      ok: true,
      logPath,
      thumbsRoot,
      shots: shotRows.size,
      totalMs,
      timeLabel,
      tokenLabel,
      zip: zipInfo,
    },
    null,
    2,
  ),
)
