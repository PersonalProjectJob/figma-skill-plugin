#!/usr/bin/env node
/**
 * testcase-parse.mjs — đọc 1 file test case (Markdown, KHÔNG phải flow.json)
 * và in ra JSON có cấu trúc: metadata + danh sách bước (Bước / Kết quả mong đợi).
 *
 * Chỉ PARSE — không dịch bước thành hành động thật, không chạy browser. Việc
 * dịch "Bước" thành verb thật (click/fill/scroll...) và "Kết quả mong đợi"
 * thành bước chứng minh (expectText/expectVisible) là việc của AGENT đọc JSON
 * này rồi tự viết ra 1 flow.json chạy qua flow.mjs — engine cưỡng chế của
 * flow.mjs (chỉ verb thật, mỗi shot phải có chứng minh) áp dụng y nguyên,
 * không bị nới lỏng chỉ vì input gốc là bảng thay vì JSON.
 *
 * Định dạng file (xem ví dụ trong SKILL.md mục "Test theo test case"):
 *
 *   # TC-001: <tiêu đề>
 *
 *   - **Feature:** <tên tính năng>
 *   - **Environment:** <dev|staging|test|prod|local>
 *   - **Route:** <route/URL>
 *   - **Severity nếu fail:** <critical|high|medium|low>
 *   - **Category:** <visual|functional|ux|content|performance|console|accessibility>
 *
 *   | # | Bước | Kết quả mong đợi |
 *   |---|------|-------------------|
 *   | 1 | ...  | ...               |
 *
 * Usage: node testcase-parse.mjs --file <path.md>
 */

import { existsSync, readFileSync } from 'node:fs'
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

if (!args.file) fail('Thiếu --file <path đến file test case .md>')
const filePath = resolvePath(String(args.file))
if (!existsSync(filePath)) fail(`Không tìm thấy file: ${filePath}`)

const raw = readFileSync(filePath, 'utf8')
const lines = raw.split(/\r?\n/)

// --- heading: "# TC-001: Tiêu đề" hoặc chỉ "# Tiêu đề" -------------------
const headingLine = lines.find((l) => /^#\s+\S/.test(l))
let id = null
let title = null
if (headingLine) {
  const text = headingLine.replace(/^#\s+/, '').trim()
  const m = /^([A-Za-z]+-\d+)\s*:\s*(.+)$/.exec(text)
  if (m) {
    id = m[1]
    title = m[2]
  } else {
    title = text
  }
}
if (!id) id = null // agent tự đặt id khi cần (vd theo tên file)

// --- metadata: dòng "- **Key:** value" -------------------------------------
const SEVERITY_ENUM = ['critical', 'high', 'medium', 'low']
const CATEGORY_ENUM = ['visual', 'functional', 'ux', 'content', 'performance', 'console', 'accessibility']
const warnings = []
const metaRaw = {}
for (const line of lines) {
  const m = /^-\s+\*\*([^*:]+):\*\*\s*(.+)$/.exec(line.trim())
  if (!m) continue
  metaRaw[m[1].trim().toLowerCase()] = m[2].trim()
}

function findMeta(...keyFragments) {
  for (const [key, value] of Object.entries(metaRaw)) {
    if (keyFragments.some((f) => key.includes(f))) return value
  }
  return null
}

const feature = findMeta('feature') || null
const environment = findMeta('environment', 'env') || null
const route = findMeta('route', 'url') || null

let severity = findMeta('severity')
if (severity) {
  const norm = severity.trim().toLowerCase()
  if (SEVERITY_ENUM.includes(norm)) severity = norm
  else {
    warnings.push(`severity "${severity}" không khớp enum (${SEVERITY_ENUM.join('/')}) — dùng mặc định "medium"`)
    severity = 'medium'
  }
} else {
  warnings.push('thiếu Severity — dùng mặc định "medium"')
  severity = 'medium'
}

let category = findMeta('category')
if (category) {
  const norm = category.trim().toLowerCase()
  if (CATEGORY_ENUM.includes(norm)) category = norm
  else {
    warnings.push(`category "${category}" không khớp enum (${CATEGORY_ENUM.join('/')}) — dùng mặc định "functional"`)
    category = 'functional'
  }
} else {
  warnings.push('thiếu Category — dùng mặc định "functional"')
  category = 'functional'
}

// --- bảng bước: tìm header có "Bước"/"Step" + "mong đợi"/"expected" --------
function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}
function isSeparatorRow(cells) {
  return cells.every((c) => /^:?-+:?$/.test(c))
}

const tableLines = lines.filter((l) => /^\s*\|.*\|\s*$/.test(l))
let steps = []
if (tableLines.length >= 2) {
  const headerCells = splitRow(tableLines[0]).map((c) => c.toLowerCase())
  const stepColIdx = headerCells.findIndex((c) => /bước|step/.test(c))
  const expectedColIdx = headerCells.findIndex((c) => /mong đợi|expected|kết quả/.test(c))
  if (stepColIdx === -1 || expectedColIdx === -1) {
    warnings.push('tìm thấy bảng nhưng không xác định được cột "Bước"/"Kết quả mong đợi" — bỏ qua bảng')
  } else {
    const dataRows = tableLines.slice(1).filter((l) => !isSeparatorRow(splitRow(l)))
    steps = dataRows.map((line, idx) => {
      const cells = splitRow(line)
      return {
        n: idx + 1,
        action: cells[stepColIdx] || '',
        expected: cells[expectedColIdx] || '',
      }
    })
  }
} else {
  warnings.push('không tìm thấy bảng Bước/Kết quả mong đợi nào trong file')
}

if (!steps.length) {
  fail('Test case không có bước nào để chạy (bảng rỗng hoặc không parse được) — sửa file rồi thử lại.')
}

const result = {
  ok: true,
  sourceFile: filePath,
  id,
  title,
  feature,
  environment,
  route,
  severity,
  category,
  steps,
  warnings: warnings.length ? warnings : undefined,
}
console.log(JSON.stringify(result, null, 2))
