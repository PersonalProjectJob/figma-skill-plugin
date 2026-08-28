#!/usr/bin/env node
/**
 * e2e-provision.mjs — Pha 2 (rải kit) + Pha 3 (cổng smoke).
 *
 * Chỉ ghi trong `<workspace>/.e2e/`. Không sửa package.json, không sửa
 * .gitignore, không cài package. Đăng ký `.e2e/` vào `.git/info/exclude` để
 * `git status` vẫn trắng khi bàn giao (evidence-discipline §6).
 *
 * Usage:
 *   node bin/e2e-provision.mjs [<workspace>] [--host codex|antigravity|claude]
 *                              [--target <url|file|dev>] [--for US-xxx]
 *                              [--skip-smoke]
 *
 * Exit code: 0 = READY · 2 = PARTIAL · 1 = BLOCKED
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveEnvironment, fileBytes, rememberRoot } from '../e2e-kit/resolve.mjs'

const SKILL_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..')
const KIT = join(SKILL_ROOT, 'e2e-kit')

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

const workspace = resolvePath(args._[0] || args.workspace || process.cwd())
const env = resolveEnvironment({ workspace, host: args.host, target: args.target, env: args.env })
const dot = join(env.workspace.root, '.e2e')
const notes = []

for (const rung of env.ladder['1-repo-capture-script'].filter((item) => item.exists && item.syntaxOk === false)) {
  notes.push(`bỏ qua delegated capture script lỗi syntax: ${rung.path} — fallback kit vẫn được provision`)
}

// Ghi nhớ root đã cấp runner, để lần sau chạy trong folder trần vẫn dò ra.
if (env.runner) rememberRoot(env.runner.borrowedFrom || env.workspace.root)

// ---------------------------------------------------------- Pha 2: rải kit
mkdirSync(join(dot, 'out'), { recursive: true })
mkdirSync(join(dot, 'hosts'), { recursive: true })

const copied = []
for (const f of ['resolve.mjs', 'readiness.mjs', 'smoke.mjs', 'capture.mjs', 'flow.mjs', 'bundle.mjs', 'publish.mjs', 'log-append.mjs', 'env-writer.mjs', 'testcase-parse.mjs', 'testcase-report.mjs', 'login.json']) {
  const src = join(KIT, f)
  if (!existsSync(src)) continue
  copyFileSync(src, join(dot, f))
  copied.push(join(dot, f))
}
// flow mẫu: chỉ thêm cái còn thiếu — flow do người dùng viết trong .e2e/flows/ không bị ghi đè
mkdirSync(join(dot, 'flows'), { recursive: true })
for (const f of readdirSync(join(KIT, 'flows')).filter((n) => n.endsWith('.json'))) {
  const dest = join(dot, 'flows', f)
  if (existsSync(dest)) continue
  copyFileSync(join(KIT, 'flows', f), dest)
  copied.push(dest)
}
for (const h of ['codex.md', 'antigravity.md', 'claude.md']) {
  const src = join(KIT, 'hosts', h)
  if (existsSync(src)) {
    copyFileSync(src, join(dot, 'hosts', h))
    copied.push(join(dot, 'hosts', h))
  }
}

// git sạch: .git/info/exclude — worktree DÙNG CHUNG file này với repo gốc.
let excludeFile = null
if (env.workspace.commonDir) {
  const infoDir = join(env.workspace.commonDir, 'info')
  excludeFile = join(infoDir, 'exclude')
  try {
    mkdirSync(infoDir, { recursive: true })
    const current = existsSync(excludeFile) ? readFileSync(excludeFile, 'utf8') : ''
    if (!/^\.e2e\/?\s*$/m.test(current)) {
      appendFileSync(excludeFile, `${current.endsWith('\n') || current === '' ? '' : '\n'}.e2e/\n`)
      notes.push(`đã thêm \`.e2e/\` vào ${excludeFile} (local-only, untracked, dùng chung với repo gốc)`)
    } else {
      notes.push(`\`.e2e/\` đã có trong ${excludeFile}`)
    }
  } catch (err) {
    notes.push(`KHÔNG ghi được ${excludeFile}: ${err.message} — nhớ xoá \`.e2e/\` trước khi bàn giao`)
  }
} else {
  notes.push('folder trần (không phải git) — bỏ qua bước info/exclude')
}

// repo GitHub của WORKSPACE (không phải của --evidence-dir sau này) — để
// publish.mjs có nguồn đúng thay vì tự dò lại (evidence-dir thường là vault,
// một repo khác hẳn app). Không phải secret, ghi thẳng tên "owner/repo".
const repoRes = spawnSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], {
  cwd: env.workspace.root,
  encoding: 'utf8',
})
const workspaceRepo = repoRes.status === 0 ? repoRes.stdout?.trim() || null : null
if (!workspaceRepo) {
  notes.push('không xác định được remote GitHub của workspace — publish.mjs sẽ cần --repo tay')
}

// secrets: chỉ TÊN biến, không bao giờ giá trị
writeFileSync(
  join(dot, 'env.json'),
  JSON.stringify(
    {
      generatedAt: env.at,
      note: 'Chỉ chứa TÊN biến (+ repo GitHub của workspace). Không bao giờ ghi giá trị secret vào file này.',
      repo: workspaceRepo,
      // Nơi log-append.mjs ghi LOG.md tổng hợp — BỀN, nằm trong chính skill repo
      // (SKILL_ROOT), không trong workspace/.e2e/ (sẽ mất khi worktree bị xoá).
      skillLogRoot: join(SKILL_ROOT, 'log'),
      required: [...env.secrets.present, ...env.secrets.missing].sort(),
      present: env.secrets.present,
      missing: env.secrets.missing,
      sources: env.secrets.sources.map((s) => ({ from: s.from, names: s.names })),
    },
    null,
    2,
  ),
)

// ---------------------------------------------------------- Pha 3: cổng smoke
const smokeCmd = [
  process.execPath,
  join(dot, 'smoke.mjs'),
  '--workspace',
  env.workspace.root,
  ...(args.target ? ['--target', String(args.target)] : []),
  // chuyển tiếp host để JSON của smoke không nói khác REPORT.md
  ...(args.host ? ['--host', String(args.host)] : []),
  ...(args.env ? ['--env', String(args.env)] : []),
]
let smoke = { skipped: true, stdout: '', stderr: '', status: null }
if (!args['skip-smoke'] && env.capable) {
  const res = spawnSync(smokeCmd[0], smokeCmd.slice(1), { encoding: 'utf8' })
  smoke = { skipped: false, stdout: res.stdout || '', stderr: res.stderr || '', status: res.status }
}

let verdict
if (!env.capable) verdict = 'BLOCKED'
else if (args['skip-smoke']) verdict = 'PARTIAL'
else if (smoke.status === 0) verdict = 'READY'
else if (smoke.status === 2) verdict = 'PARTIAL'
else verdict = 'BLOCKED'

// PNG do smoke tạo — số byte phải đọc lại từ đĩa trong lượt này (§7)
let smokeJson = null
try {
  smokeJson = JSON.parse(smoke.stdout)
} catch {
  /* smoke có thể chết trước khi in JSON */
}
const pngOnDisk = smokeJson?.png ? { path: smokeJson.png, bytes: fileBytes(smokeJson.png) } : null
if (verdict === 'READY' && (!pngOnDisk || !pngOnDisk.bytes)) {
  verdict = 'PARTIAL'
  notes.push('smoke exit 0 nhưng PNG không đọc được trên đĩa ⇒ hạ xuống PARTIAL')
}
// Server đang chạy sai mode ⇒ mọi ảnh chụp sau đó là bằng chứng của môi trường
// khác. Năng lực vẫn đủ, nhưng KHÔNG được dùng để tick Visual DoD ⇒ PARTIAL.
if (verdict === 'READY' && smokeJson?.apiHostMismatch) {
  verdict = 'PARTIAL'
  notes.push(
    `LỆCH MÔI TRƯỜNG: E2E_TARGET=${env.secrets.envTarget} kỳ vọng API ` +
      `${smokeJson.expectedApiHost} nhưng trang gọi ${(smokeJson.apiHostsSeen || []).join(', ')}. ` +
      `Khởi động lại dev server bằng \`${env.target.devCommand || 'pnpm dev'}\`.`,
  )
}
if (verdict === 'READY' && env.secrets.missing.length && env.target.kind === 'dev') {
  notes.push(
    `thiếu ${env.secrets.missing.join(', ')} — chụp màn cần đăng nhập sẽ không chạy được; ` +
      'route công khai thì không ảnh hưởng',
  )
}
if (env.target.implicitDefault) {
  notes.push(
    'target là mặc định ngầm (dev) do không có --target hay cấu hình — nếu yêu cầu mơ hồ, agent phải hỏi user trước khi tin vào target này',
  )
}

// ---------------------------------------------------------- artefact ra
const hostDoc = join(dot, 'hosts', `${env.host === 'unknown' ? 'claude' : env.host}.md`)
const hostNotes = existsSync(hostDoc)
  ? readFileSync(hostDoc, 'utf8')
  : '(không có ghi chú host — chạy lại với --host)'

const captureCmd = env.captureScript
  ? `node "${join(dot, 'capture.mjs')}" --route <route> --screen <screen-slug> --state current --slug <US-xxx> --desc <mo-ta> --role owner --us-file "<absolute-US-md>"`
  : `node "${join(dot, 'capture.mjs')}" --url "${env.target.url || '<url>'}" --out "<TaskFolder>" --viewport all`

const fill = (tpl) =>
  tpl
    .replaceAll('{{VERDICT}}', verdict)
    .replaceAll('{{GENERATED_AT}}', env.at)
    .replaceAll('{{HOST}}', env.host)
    .replaceAll('{{WORKSPACE}}', env.workspace.root)
    .replaceAll('{{WORKSPACE_KIND}}', env.workspace.kind)
    .replaceAll('{{TARGET_KIND}}', env.target.kind)
    .replaceAll('{{TARGET_URL}}', env.target.url || '(chưa resolve)')
    .replaceAll('{{DEV_COMMAND}}', env.target.devCommand || '(không có script dev)')
    .replaceAll('{{RUNNER}}', env.runner ? `${env.runner.name}@${env.runner.version ?? '?'} — ${env.runner.dir}` : 'KHÔNG CÓ')
    .replaceAll('{{RUNNER_BORROWED}}', env.runner?.borrowedFrom ? `mượn từ repo gốc: ${env.runner.borrowedFrom}` : 'nằm trong workspace')
    .replaceAll('{{BROWSER}}', env.browser ? `${env.browser.kind} — ${env.browser.executablePath}` : 'KHÔNG CÓ')
    .replaceAll('{{BROWSER_HEADED}}', env.browser ? (env.browser.supportsHeaded ? 'có' : 'KHÔNG (headless shell)') : 'n/a')
    .replaceAll(
      '{{SMOKE_CMD}}',
      `node "${join(dot, 'smoke.mjs')}" --workspace "${env.workspace.root}"` +
        (args.target ? ` --target "${args.target}"` : ''),
    )
    .replaceAll('{{CAPTURE_CMD}}', captureCmd)
    .replaceAll('{{CAPTURE_SCRIPT}}', env.captureScript || '(không có — capture.mjs tự chụp)')
    .replaceAll(
      '{{PUBLISH_CMD}}',
      `node "${join(dot, 'publish.mjs')}" --evidence-dir "<folder chứa ảnh vừa chụp>" --tag qa-evidence`,
    )
    .replaceAll('{{FLOW_SCRIPT}}', join(dot, 'flow.mjs'))
    .replaceAll('{{FLOWS_DIR}}', join(dot, 'flows'))
    .replaceAll('{{SECRETS_MISSING}}', env.secrets.missing.join(', ') || '(không thiếu)')
    .replaceAll('{{HOST_NOTES}}', hostNotes)
    .replaceAll('{{FOR}}', args.for ? String(args.for) : '(không gắn US)')

const tplPath = join(KIT, 'PROMPT-BLOCK.tmpl.md')
if (existsSync(tplPath)) {
  writeFileSync(join(dot, 'PROMPT-BLOCK.md'), fill(readFileSync(tplPath, 'utf8')))
}

const ladderText = [
  'Bậc 1 — script chụp của repo:',
  ...env.ladder['1-repo-capture-script'].flatMap((r) => [
    `  [${!r.exists ? 'KHÔNG' : r.syntaxOk ? 'CÓ · syntax OK' : 'CÓ · SYNTAX HỎNG, đã bỏ qua'}] ${r.path}`,
    ...(r.syntaxError ? [`        → ${r.syntaxError}`] : []),
  ]),
  'Bậc 2/3 — node_modules:',
  ...env.ladder['2-3-node_modules'].flatMap((r) => [
    `  [${r.exists ? 'CÓ' : 'KHÔNG'}] ${r.modules}`,
    ...r.found.map((f) => `        → ${f.name}@${f.version ?? '?'}`),
  ]),
  'Bậc 4/5 — browser:',
  ...env.ladder['4-5-browser'].map((r) =>
    r.dirs ? `  [cache] ${r.path} → ${r.dirs.join(', ') || '(rỗng)'}` : `  [${r.exists ? 'CÓ' : 'KHÔNG'}] ${r.path} (${r.rung})`,
  ),
].join('\n')

const report = `# E2E REPORT — \`${verdict}\`

- sinh lúc: ${env.at}
- workspace: \`${env.workspace.root}\` (${env.workspace.kind}${env.workspace.branch ? `, branch \`${env.workspace.branch}\`` : ''})
- host: \`${env.host}\` — ${env.hostEvidence.join('; ')}
- gắn với: ${args.for ? `\`${args.for}\`` : '(không gắn US)'}
- target: \`${env.target.kind}\` → ${env.target.url || '(chưa resolve)'}

## Năng lực đã resolve

| Thứ | Giá trị |
|---|---|
| runner | ${env.runner ? `\`${env.runner.name}@${env.runner.version ?? '?'}\`` : '**KHÔNG CÓ**'} |
| runner dir | ${env.runner ? `\`${env.runner.dir}\`` : '—'} |
| bậc mượn | ${env.runner?.borrowedFrom ? `\`${env.runner.borrowedFrom}\` (bậc 3)` : 'trong workspace (bậc 2)'} |
| browser | ${env.browser ? `\`${env.browser.kind}\`` : '**KHÔNG CÓ**'} |
| browser exe | ${env.browser ? `\`${env.browser.executablePath}\`` : '—'} |
| chụp headed | ${env.browser ? (env.browser.supportsHeaded ? 'có' : 'KHÔNG — headless shell') : 'n/a'} |
| capture script | ${env.captureScript ? `\`${env.captureScript}\`` : 'không có (capture.mjs tự chụp)'} |
| secrets thiếu | ${env.secrets.missing.join(', ') || '(không thiếu)'} |

## Ladder đã leo

\`\`\`
${ladderText}
\`\`\`

## Cổng smoke

Lệnh:

\`\`\`bash
${smokeCmd.map((c) => (c.includes(' ') ? `"${c}"` : c)).join(' ')}
\`\`\`

exit code: \`${smoke.skipped ? 'skipped' : smoke.status}\`

\`\`\`json
${smoke.stdout.trim() || '(không có stdout)'}
\`\`\`
${smoke.stderr.trim() ? `\nstderr:\n\n\`\`\`\n${smoke.stderr.trim()}\n\`\`\`\n` : ''}
PNG đọc lại từ đĩa trong lượt này: ${pngOnDisk ? `\`${pngOnDisk.path}\` — **${pngOnDisk.bytes} bytes**` : '(không có)'}

## Đã ghi những gì

${copied.map((f) => `- \`${f}\``).join('\n')}
- \`${join(dot, 'env.json')}\` (chỉ tên biến)
- \`${join(dot, 'PROMPT-BLOCK.md')}\`
- \`${join(dot, 'REPORT.md')}\` (file này)

Ghi chú:

${notes.map((n) => `- ${n}`).join('\n') || '- (không có)'}

## Nghĩa của verdict

| Verdict | Được làm gì |
|---|---|
| \`READY\` | Được phép viết yêu cầu ảnh/số đo runtime vào prompt executor |
| \`PARTIAL\` | **Không** được dùng để tick Visual DoD; sửa cái thiếu ở trên rồi chạy lại |
| \`BLOCKED\` | Kết quả hợp lệ. Không được lặng lẽ thay bằng đọc code tĩnh rồi tick PASS |
`

writeFileSync(join(dot, 'REPORT.md'), report)

// ---------------------------------------------------------- stdout
const out = []
out.push('='.repeat(72))
out.push(`E2E ${verdict} — ${env.workspace.root}`)
out.push('='.repeat(72))
out.push(`host        : ${env.host}   workspace: ${env.workspace.kind}`)
out.push(`target      : ${env.target.kind} → ${env.target.url || '(chưa resolve)'}`)
out.push(`runner      : ${env.runner ? `${env.runner.name}@${env.runner.version ?? '?'}` : 'KHÔNG CÓ'}${env.runner?.borrowedFrom ? `  (mượn bậc 3: ${env.runner.borrowedFrom})` : ''}`)
out.push(`browser     : ${env.browser ? `${env.browser.kind} — ${env.browser.executablePath}` : 'KHÔNG CÓ'}`)
out.push(`smoke exit  : ${smoke.skipped ? 'skipped' : smoke.status}`)
out.push(`PNG         : ${pngOnDisk ? `${pngOnDisk.path}  (${pngOnDisk.bytes} bytes)` : '(không có)'}`)
if (notes.length) {
  out.push('ghi chú     :')
  for (const n of notes) out.push(`  - ${n}`)
}
out.push('')
out.push(`report      : ${join(dot, 'REPORT.md')}`)
out.push(`prompt block: ${join(dot, 'PROMPT-BLOCK.md')}`)
out.push('')
out.push('--- smoke stdout (nguyên văn) ---')
out.push(smoke.stdout.trim() || '(không có)')
if (smoke.stderr.trim()) {
  out.push('--- smoke stderr ---')
  out.push(smoke.stderr.trim())
}
console.log(out.join('\n'))

process.exit(verdict === 'READY' ? 0 : verdict === 'PARTIAL' ? 2 : 1)
