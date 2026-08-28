#!/usr/bin/env node
/**
 * testcase-report.mjs — gom kết quả 1 test case (đã chạy qua flow.mjs) vào
 * 1 file kết quả tích luỹ (--results-file), rồi (tuỳ chọn) render bảng tổng
 * hợp theo severity — mượn taxonomy 4 mức (critical/high/medium/low) của
 * gstack /qa, không tự chế thang điểm mới.
 *
 * Verdict của TỪNG test case = verdict của flow.mjs (FLOW_VERIFIED/FLOW_FAILED/
 * ...). Script này KHÔNG tự chấm lại "bước nào đã chứng minh chưa" — việc đó
 * đã do engine flow.mjs cưỡng chế (không có shot nào lọt qua mà chưa
 * expectVisible/expectText). Vì vậy PASS ở đây có cùng độ tin cậy như PASS
 * của flow.mjs, không bị hạ chuẩn chỉ vì input gốc là bảng test case.
 *
 * Usage — sau khi 1 test case đã chạy xong qua flow.mjs và có run.json:
 *   node testcase-report.mjs --testcase <parsed-testcase.json> \
 *     --run <path/to/run.json> --results-file <path/to/results.json> [--render]
 *
 * --render (tuỳ chọn): sau khi ghi, in thêm bảng markdown tổng hợp ra
 * <results-file>.md, sắp theo severity giảm dần (critical trước) — style
 * giống "Top N things to fix" của gstack, nhưng KHÔNG bịa health score
 * (không có đủ dữ liệu như crawl toàn app để tính điểm 0-100).
 *
 * `--run` chấp nhận HAI dạng file, miễn có field `.verdict` ở gốc:
 *   1. `run.json` mà flow.mjs tự ghi — CHỈ tồn tại khi verdict FLOW_VERIFIED.
 *   2. Toàn bộ stdout của flow.mjs lưu ra file (`node flow.mjs ... > out.json`)
 *      — dùng được cho CẢ FLOW_VERIFIED lẫn FLOW_FAILED/TARGET_UNREACHABLE/
 *      BLOCKED, vì flow.mjs luôn in JSON ra stdout bất kể verdict. Test case
 *      FAIL thì không có run.json, nên đường (2) là đường bắt buộc khi cần
 *      ghi nhận một FAIL — đừng chỉ thử --run run.json rồi bỏ cuộc nếu thiếu.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'

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

function fail(message) {
  console.log(JSON.stringify({ ok: false, error: message }, null, 2))
  console.error(`❌ ${message}`)
  process.exit(1)
}

if (!args.testcase) fail('Thiếu --testcase <path JSON từ testcase-parse.mjs>')
if (!args.run) fail('Thiếu --run <path run.json do flow.mjs sinh ra>')
if (!args['results-file']) fail('Thiếu --results-file <path file tích luỹ kết quả>')

const testcasePath = resolvePath(String(args.testcase))
const runPath = resolvePath(String(args.run))
const resultsPath = resolvePath(String(args['results-file']))

if (!existsSync(testcasePath)) fail(`Không tìm thấy file test case JSON: ${testcasePath}`)
if (!existsSync(runPath)) fail(`Không tìm thấy run.json: ${runPath}`)

let testcase
let run
try {
  testcase = JSON.parse(readFileSync(testcasePath, 'utf8'))
} catch (error) {
  fail(`test case JSON hỏng: ${error.message}`)
}
try {
  run = JSON.parse(readFileSync(runPath, 'utf8'))
} catch (error) {
  fail(`run.json hỏng: ${error.message}`)
}

const verdict = run.verdict || 'UNKNOWN'
const passed = verdict === 'FLOW_VERIFIED'

const entry = {
  id: testcase.id || testcase.title || '(không tên)',
  title: testcase.title || null,
  feature: testcase.feature || null,
  environment: testcase.environment || null,
  route: testcase.route || null,
  severity: testcase.severity || 'medium',
  category: testcase.category || 'functional',
  stepsDeclared: Array.isArray(testcase.steps) ? testcase.steps.length : null,
  verdict,
  passed,
  runPath,
  sourceFile: testcase.sourceFile || null,
  checkedAt: new Date().toISOString(),
}

// --- ghi tích luỹ, KHÔNG ghi đè kết quả cũ của test case khác ---------------
let results = []
if (existsSync(resultsPath)) {
  try {
    results = JSON.parse(readFileSync(resultsPath, 'utf8'))
    if (!Array.isArray(results)) throw new Error('không phải mảng')
  } catch (error) {
    fail(`results-file hiện có nhưng không parse được (${error.message}) — sửa hoặc xoá file rồi chạy lại.`)
  }
}
// cùng id thì UPDATE (chạy lại test case đó), khác id thì APPEND
const existingIdx = results.findIndex((r) => r.id === entry.id)
if (existingIdx >= 0) results[existingIdx] = entry
else results.push(entry)

writeFileSync(resultsPath, JSON.stringify(results, null, 2) + '\n', 'utf8')

console.log(`${passed ? '✅ PASS' : '❌ FAIL'} — ${entry.id}: ${verdict}`)
console.log(JSON.stringify({ ok: true, entry, resultsFile: resultsPath, totalRecorded: results.length }, null, 2))

// --- render bảng tổng hợp (tuỳ chọn) ---------------------------------------
if (args.render) {
  const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low']
  const sorted = [...results].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))
  const failCount = results.filter((r) => !r.passed).length
  const bySeverity = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    total: results.filter((r) => r.severity === sev).length,
    failed: results.filter((r) => r.severity === sev && !r.passed).length,
  }))

  const md = [
    '# Kết quả Test Case',
    '',
    `- Tổng số test case: ${results.length}`,
    `- Đạt: ${results.length - failCount} · Không đạt: ${failCount}`,
    '',
    '## Theo mức độ nghiêm trọng',
    '',
    '| Severity | Tổng | Không đạt |',
    '|---|---|---|',
    ...bySeverity.map((s) => `| ${s.severity} | ${s.total} | ${s.failed} |`),
    '',
    '## Chi tiết (sắp theo severity — nghiêm trọng nhất trước)',
    '',
    '| Kết quả | ID | Tiêu đề | Severity | Category | Feature | Route |',
    '|---|---|---|---|---|---|---|',
    ...sorted.map(
      (r) =>
        `| ${r.passed ? '✅' : '❌'} | ${r.id} | ${r.title || '—'} | ${r.severity} | ${r.category} | ${r.feature || '—'} | ${r.route || '—'} |`,
    ),
    '',
  ].join('\n')

  const mdPath = resultsPath.replace(/\.json$/, '') + '.md'
  writeFileSync(mdPath, md, 'utf8')
  console.log(`📄 Bảng tổng hợp: ${mdPath}`)
}
