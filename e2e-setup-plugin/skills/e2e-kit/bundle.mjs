#!/usr/bin/env node
/**
 * bundle.mjs — bàn giao local bắt buộc sau flow evidence.
 *
 * Tạo/ghi đè trong evidence root: FEATURE.md, manifest.json, SHA256SUMS.txt;
 * tạo ZIP ở cạnh folder. Không upload. GitHub Release là bước tùy chọn riêng.
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { basename, dirname, extname, join, relative, resolve as resolvePath } from 'node:path'

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
  console.log(`❌ Evidence bundle failed — ${message}`)
  console.log(JSON.stringify({ ok: false, error: message, ...details }, null, 2))
  process.exit(1)
}

if (!args['evidence-dir']) fail('thiếu --evidence-dir <Task/Feature folder>')
const evidenceDir = resolvePath(String(args['evidence-dir']))
if (!existsSync(evidenceDir) || !statSync(evidenceDir).isDirectory()) fail(`không tìm thấy folder: ${evidenceDir}`)

function walk(root, dir = root) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(root, full))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

function rel(file) {
  return relative(evidenceDir, file).replaceAll('\\', '/')
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

const requiredFolders = [
  'desktop',
  'tablet/portrait',
  'tablet/landscape',
  'mobile',
]
const coverage = {}
const viewportRuns = []
for (const folder of requiredFolders) {
  const absolute = join(evidenceDir, ...folder.split('/'))
  const pngCount = existsSync(absolute) ? walk(absolute).filter((f) => extname(f).toLowerCase() === '.png').length : 0
  coverage[folder] = pngCount
  const runPath = join(absolute, 'run.json')
  if (!existsSync(runPath)) fail(`thiếu runtime audit: ${folder}/run.json`)
  try {
    const run = JSON.parse(readFileSync(runPath, 'utf8'))
    if (run.verdict !== 'FLOW_VERIFIED') fail(`runtime audit không PASS: ${folder}/run.json`, { verdict: run.verdict })
    if (!Array.isArray(run.shots) || run.shots.length !== pngCount) {
      fail(`runtime audit không khớp số ảnh: ${folder}/run.json`, { shots: run.shots?.length ?? null, pngCount })
    }
    viewportRuns.push({ folder, ...run })
  } catch (error) {
    if (error?.message?.startsWith('runtime audit')) throw error
    fail(`runtime audit JSON hỏng: ${folder}/run.json — ${error.message}`)
  }
}
const missingCoverage = Object.entries(coverage).filter(([, count]) => count === 0).map(([folder]) => folder)
if (missingCoverage.length) {
  fail(`thiếu ảnh ở viewport bắt buộc: ${missingCoverage.join(', ')}`, { coverage })
}

const SECRET_NAME_PATTERN = /(^|\/)(\.env(\..+)?|.*token.*|.*credential.*|.*password.*|.*passwd.*|.*secret.*|.*api[-_]?key.*|id_rsa|.*\.(pem|key|pfx|p12))$/i
const secretHits = walk(evidenceDir).map(rel).filter((file) => SECRET_NAME_PATTERN.test(file))
if (secretHits.length) fail(`từ chối đóng gói file có tên giống secret: ${secretHits.join(', ')}`)

let flow = null
if (args.flow && existsSync(resolvePath(String(args.flow)))) {
  try {
    flow = JSON.parse(readFileSync(resolvePath(String(args.flow)), 'utf8'))
  } catch (error) {
    fail(`flow JSON hỏng: ${error.message}`)
  }
}

const feature = String(args.feature || flow?.feature || flow?.name || basename(evidenceDir))
const environment = String(args.environment || flow?.env || 'không ghi rõ')
const route = String(args.route || flow?.route || flow?.target || 'không ghi rõ')
const actionLines = Array.isArray(flow?.steps)
  ? flow.steps.map((step, index) => {
      const verb = Object.keys(step)[0]
      const value = step[verb]
      if (verb === 'fill') return `${index + 1}. fill ${JSON.stringify(value, (key, item) => (key === 'value' ? '(masked)' : item))}`
      return `${index + 1}. ${verb} ${typeof value === 'string' ? value : JSON.stringify(value)}`
    })
  : ['1. Xem manifest.json để đọc action log của runner.']

const featurePath = join(evidenceDir, 'FEATURE.md')
const featureMd = [
  `# ${feature} — E2E Evidence`,
  '',
  `- Environment: ${environment}`,
  `- Route/target: ${route}`,
  `- Captured: ${new Date().toISOString()}`,
  '- Result: **PASS** chỉ khi 4 viewport đều chạy lại flow và bundle này được tạo thành công.',
  '',
  '## Evidence contract',
  '',
  '- First-view screenshots chỉ dùng để định hướng, không chứng minh tính năng tương tác.',
  '- Mỗi viewport chạy trong browser context mới và lặp lại toàn bộ chuỗi thao tác.',
  '- Không inject state; không sửa DOM/CSS để làm ảnh đẹp hơn.',
  '- Ảnh sau scroll phải có expectation xác nhận target visible trước khi chụp.',
  '',
  '## User flow',
  '',
  ...actionLines,
  '',
  '## Viewport coverage',
  '',
  ...Object.entries(coverage).map(([folder, count]) => `- \`${folder}/\`: ${count} PNG`),
  '',
  'Chi tiết file, byte, SHA-256, scrollY, expectation và readiness nằm trong `manifest.json` và `SHA256SUMS.txt`.',
  '',
].join('\n')
writeFileSync(featurePath, featureMd, 'utf8')

const generatedNames = new Set(['manifest.json', 'SHA256SUMS.txt'])
const evidenceFiles = walk(evidenceDir)
  .filter((file) => !generatedNames.has(rel(file)))
  .sort((a, b) => rel(a).localeCompare(rel(b)))
const manifest = {
  generatedAt: new Date().toISOString(),
  feature,
  environment,
  route,
  evidenceRoot: evidenceDir,
  coverage,
  runtimeEvidence: viewportRuns.map((run) => ({
    viewport: run.viewport,
    folder: run.folder,
    verdict: run.verdict,
    interactions: run.interactions,
    apiHostVerified: run.apiHostVerified,
    steps: run.steps,
    shots: run.shots,
    elapsedMs: run.elapsedMs,
  })),
  screenshotCount: evidenceFiles.filter((file) => extname(file).toLowerCase() === '.png').length,
  files: evidenceFiles.map((file) => ({ path: rel(file), bytes: statSync(file).size, sha256: sha256(file) })),
}
const manifestPath = join(evidenceDir, 'manifest.json')
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')

const checksumFiles = walk(evidenceDir)
  .filter((file) => rel(file) !== 'SHA256SUMS.txt')
  .sort((a, b) => rel(a).localeCompare(rel(b)))
const checksumPath = join(evidenceDir, 'SHA256SUMS.txt')
writeFileSync(checksumPath, checksumFiles.map((file) => `${sha256(file)}  ${rel(file)}`).join('\n') + '\n', 'utf8')

const zipPath = resolvePath(String(args.zip || `${evidenceDir}.zip`))
mkdirSync(dirname(zipPath), { recursive: true })
let zipResult
if (process.platform === 'win32') {
  const quote = (value) => `'${String(value).replaceAll("'", "''")}'`
  const command = `Compress-Archive -Path ${quote(join(evidenceDir, '*'))} -DestinationPath ${quote(zipPath)} -Force`
  zipResult = spawnSync('powershell', ['-NoProfile', '-Command', command], { encoding: 'utf8' })
} else {
  zipResult = spawnSync('zip', ['-r', zipPath, '.'], { cwd: evidenceDir, encoding: 'utf8' })
}
if (zipResult.status !== 0 || !existsSync(zipPath)) {
  fail(`không tạo được ZIP: ${zipResult.stderr || zipResult.stdout || 'unknown error'}`)
}

const result = {
  ok: true,
  evidenceRoot: evidenceDir,
  feature: featurePath,
  manifest: manifestPath,
  checksums: checksumPath,
  zip: { path: zipPath, bytes: statSync(zipPath).size, sha256: sha256(zipPath) },
  coverage,
  screenshotCount: manifest.screenshotCount,
}
console.log(`✅ Evidence bundle: ${zipPath}`)
console.log(JSON.stringify(result, null, 2))
