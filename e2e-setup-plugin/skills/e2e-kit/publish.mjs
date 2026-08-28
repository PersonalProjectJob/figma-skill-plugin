#!/usr/bin/env node
/**
 * publish.mjs — đóng gói evidence (.png + .md) thành .zip rồi upload lên
 * GitHub Release, trả về URL. Đây là bước SAU capture/flow — publish.mjs
 * không tự chụp gì, chỉ đóng gói cái đã có trên đĩa.
 *
 * Quyết định thiết kế: platform lưu = zip + GitHub Release assets. Không cần
 * OAuth/API key mới — dùng `gh` CLI đã login sẵn trong máy (so với Google
 * Drive/Sheet, vốn cần bạn tự làm OAuth consent trong browser trước).
 *
 * Usage:
 *   node .e2e/publish.mjs --evidence-dir <dir> [--repo owner/name]
 *                          [--tag <tag>] [--slug <ten>]
 *
 * Bốn quyết định đã sửa lại sau lượt phân tích 2026-08-24 (xem DESIGN.md §12.4
 * để đọc lý do đầy đủ — đây chỉ ghi LÀM GÌ, không lặp lại VÌ SAO):
 *
 * 1. Repo KHÔNG tự dò từ --evidence-dir nữa (evidence-dir thường là 1 folder
 *    trong Obsidian vault — MỘT git repo khác, có remote GitHub CỦA RIÊNG NÓ,
 *    không liên quan gì tới app repo). Thứ tự resolve giờ là: --repo → field
 *    `repo` trong env.json cùng thư mục (do e2e-provision.mjs ghi từ chính
 *    workspace app) → nếu cả hai đều thiếu, FAIL rõ ràng, không đoán.
 * 2. Tag mặc định đổi từ 1 release evergreen sang theo tuần ISO
 *    (`qa-evidence-2026-W35`) — tính từ giờ hệ thống, không phụ thuộc sprint
 *    file của bất kỳ project cụ thể nào (giữ script portable).
 * 3. Trước khi zip: chỉ nhận đuôi file evidence-like; file khớp pattern tên
 *    hay dùng cho secret (.env, token, credential, password, apikey, .pem,
 *    .key…) làm FAIL cứng, không zip, không im lặng loại bỏ.
 * 4. Không viết gì vào evidenceDir (không tạo MANIFEST.md, không để zip cạnh
 *    nó) — dựng trong 1 thư mục tạm hệ thống, xoá sau khi upload xong; giữ
 *    lại nếu thất bại để debug.
 *
 * In ra 1 dòng tóm tắt trước (để agent relay nhanh không cần đọc JSON),
 * rồi JSON đầy đủ: { ok, zip, release, asset, excluded } hoặc { ok:false, error }.
 */

import { existsSync, mkdirSync, mkdtempSync, copyFileSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve as resolvePath } from 'node:path'
import { fileBytes } from './resolve.mjs'

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

function fail(code, msg) {
  console.log(JSON.stringify({ ok: false, error: msg }, null, 2))
  console.error(`❌ ${msg}`)
  process.exit(code)
}

if (!args['evidence-dir']) {
  fail(1, 'Thiếu --evidence-dir <folder chứa .png/.md cần đóng gói>')
}
const evidenceDir = resolvePath(String(args['evidence-dir']))
if (!existsSync(evidenceDir) || !statSync(evidenceDir).isDirectory()) {
  fail(1, `Không tìm thấy folder: ${evidenceDir}`)
}

// Đọc đệ quy để publish được cây chuẩn desktop/tablet/{portrait,landscape}/mobile.
// Dotfile KHÔNG bị lọc trước secret-check.
function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.isFile()) files.push(relative(evidenceDir, full).replaceAll('\\', '/'))
  }
  return files
}
const skippedDirs = []
const allFiles = walk(evidenceDir)
if (!allFiles.length) {
  fail(1, `Folder không có file nào để đóng gói (chỉ có subfolder: ${skippedDirs.join(', ') || 'không có gì'}): ${evidenceDir}`)
}

// --- (3) chặn secret trước khi chạm tới zip --------------------------------
const SECRET_NAME_PATTERN = /(\.env(\..+)?$|token|credential|password|passwd|secret|apikey|api[-_]?key|id_rsa|\.pem$|\.key$|\.pfx$|\.p12$)/i
const secretHits = allFiles.filter((f) => SECRET_NAME_PATTERN.test(f))
if (secretHits.length) {
  fail(
    1,
    `Folder chứa file tên khớp pattern secret, TỪ CHỐI đóng gói để tránh rò rỉ: ${secretHits.join(', ')}\n` +
      `Xoá/di chuyển các file này ra khỏi ${evidenceDir} rồi chạy lại. Không có cách bỏ qua cảnh báo này.`,
  )
}

// --- chỉ nhận đuôi file evidence-like; còn lại loại ra (không silent) -----
const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|bmp|md|txt|json|zip|webm|mp4|mov|log|har|trace)$/i
const included = allFiles.filter((f) => ALLOWED_EXT.test(f))
const excluded = allFiles.filter((f) => !ALLOWED_EXT.test(f))
if (!included.length) {
  fail(1, `Không có file nào khớp đuôi evidence-like (${allFiles.join(', ')}) trong ${evidenceDir}.`)
}

// --- (4) dựng trong thư mục tạm, KHÔNG viết gì vào evidenceDir -------------
const stagingDir = mkdtempSync(join(tmpdir(), 'e2e-publish-'))
for (const f of included) {
  const dest = join(stagingDir, ...f.split('/'))
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(join(evidenceDir, ...f.split('/')), dest)
}
const hasMd = included.some((f) => f.toLowerCase().endsWith('.md'))
if (!hasMd) {
  const manifest = [
    `# Evidence — ${basename(evidenceDir)}`,
    '',
    `Đóng gói lúc ${new Date().toISOString()}. Không có file .md mô tả sẵn trong folder khi đóng gói — đây là manifest tự sinh, chỉ liệt kê file kèm theo.`,
    '',
    ...included.map((f) => `- \`${f}\` — ${fileBytes(join(evidenceDir, ...f.split('/')))} bytes`),
    '',
  ].join('\n')
  writeFileSync(join(stagingDir, 'MANIFEST.md'), manifest)
}

// --- đặt tên zip (trong thư mục tạm, không cạnh evidenceDir) ---------------
const slug = String(args.slug || basename(evidenceDir)).replace(/[^a-zA-Z0-9._-]+/g, '-')
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) // 2026-08-24T10-15-30
const zipPath = join(tmpdir(), `${slug}--${stamp}.zip`)

function cleanupStaging() {
  try {
    rmSync(stagingDir, { recursive: true, force: true })
  } catch {
    /* best-effort */
  }
}

// --- zip: PowerShell Compress-Archive (Windows) hoặc `zip` (posix) ---------
function makeZip() {
  if (process.platform === 'win32') {
    const psCmd = `Compress-Archive -Path "${join(stagingDir, '*')}" -DestinationPath "${zipPath}" -Force`
    const res = spawnSync('powershell', ['-NoProfile', '-Command', psCmd], { encoding: 'utf8' })
    return { ok: res.status === 0, stdout: res.stdout, stderr: res.stderr, cmd: psCmd }
  }
  const res = spawnSync('zip', ['-r', zipPath, '.'], { cwd: stagingDir, encoding: 'utf8' })
  return { ok: res.status === 0, stdout: res.stdout, stderr: res.stderr, cmd: `zip -r "${zipPath}" .` }
}

const zipResult = makeZip()
if (!zipResult.ok || !existsSync(zipPath)) {
  cleanupStaging()
  fail(
    1,
    `KHÔNG zip được (${process.platform === 'win32' ? 'Compress-Archive' : 'zip'} lỗi).\n` +
      `lệnh: ${zipResult.cmd}\nstderr: ${zipResult.stderr || '(không có)'}`,
  )
}
cleanupStaging()
const zipBytes = fileBytes(zipPath)

// --- (1) repo: --repo, hoặc field `repo` trong env.json (ghi bởi provision
// TỪ WORKSPACE APP THẬT) cùng thư mục publish.mjs — KHÔNG tự dò từ
// evidence-dir nữa (evidence-dir thường là vault, một repo khác hẳn).
function resolveRepo() {
  if (args.repo) return { repo: String(args.repo), source: '--repo' }
  const envJsonPath = join(dirname(resolvePath(process.argv[1])), 'env.json')
  if (existsSync(envJsonPath)) {
    try {
      const parsed = JSON.parse(readFileSync(envJsonPath, 'utf8'))
      if (parsed.repo) return { repo: String(parsed.repo), source: envJsonPath }
    } catch {
      /* env.json hỏng → rơi xuống fail bên dưới, không đoán */
    }
  }
  return null
}
const repoResolved = resolveRepo()
if (!repoResolved) {
  fail(
    1,
    'Không xác định được repo GitHub để upload — publish.mjs không còn tự dò từ --evidence-dir ' +
      '(evidence-dir thường nằm trong Obsidian vault, một git repo KHÁC với repo app của bạn; ' +
      'tự dò ở đó có thể publish nhầm sang repo cá nhân của người khác). Truyền --repo owner/name, ' +
      'hoặc chạy `e2e-provision.mjs` trong workspace app trước — nó ghi đúng repo vào .e2e/env.json.',
  )
}
const repo = repoResolved.repo

// --- (2) tag mặc định theo tuần ISO, không phải 1 release evergreen -------
function isoWeekTag(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
  return `qa-evidence-${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
const tag = String(args.tag || isoWeekTag())

// --- release đã tồn tại chưa? nếu chưa thì tạo (title = tag) --------------
const viewRes = spawnSync('gh', ['release', 'view', tag, '--repo', repo, '--json', 'tagName'], {
  encoding: 'utf8',
})
let releaseCreated = false
if (viewRes.status !== 0) {
  const createRes = spawnSync(
    'gh',
    [
      'release',
      'create',
      tag,
      '--repo',
      repo,
      '--title',
      tag,
      '--notes',
      'Chứa file evidence QA (ảnh/zip) do skill e2e-setup đóng gói tự động. Không phải bản phát hành phần mềm — an toàn để bỏ qua khi xem changelog.',
    ],
    { encoding: 'utf8' },
  )
  if (createRes.status !== 0) {
    fail(1, `KHÔNG tạo được release "${tag}" trên ${repo}.\nstderr: ${createRes.stderr || createRes.stdout || '(không có)'}`)
  }
  releaseCreated = true
}

// --- upload asset (--clobber để re-run cùng tên file vẫn an toàn) ---------
const uploadRes = spawnSync('gh', ['release', 'upload', tag, zipPath, '--repo', repo, '--clobber'], {
  encoding: 'utf8',
})
if (uploadRes.status !== 0) {
  fail(1, `KHÔNG upload được asset lên release "${tag}" của ${repo}.\nstderr: ${uploadRes.stderr || uploadRes.stdout || '(không có)'}\nZip giữ lại để debug: ${zipPath}`)
}
rmSync(zipPath, { force: true })

const assetName = basename(zipPath)
const url = `https://github.com/${repo}/releases/download/${tag}/${assetName}`

console.log(`✅ Uploaded: ${url}`)
console.log(
  JSON.stringify(
    {
      ok: true,
      zip: { name: assetName, bytes: zipBytes },
      release: { repo, tag, created: releaseCreated, page: `https://github.com/${repo}/releases/tag/${tag}`, repoSource: repoResolved.source },
      asset: { name: assetName, url },
      included,
      excluded: excluded.length ? excluded : undefined,
      skippedSubfolders: skippedDirs.length ? skippedDirs : undefined,
    },
    null,
    2,
  ),
)
