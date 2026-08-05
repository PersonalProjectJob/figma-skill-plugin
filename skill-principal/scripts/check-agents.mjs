#!/usr/bin/env node
/**
 * check-agents — biến quy ước phân vai thành exit code.
 *
 * Kiểm:
 *   - `name` trong frontmatter khớp tên file (agent được định danh bằng `name`; lệch là gọi không ra)
 *   - `Agent(...)` chỉ trỏ tới vai tồn tại
 *   - vai kiểm/review/plan KHÔNG có Write/Edit/NotebookEdit trong allowlist
 *
 * Vì sao cần: "verifier không được sửa code" nằm trong README thì chỉ là câu văn. Ai thêm `Write`
 * vào allowlist một buổi chiều nào đó sẽ không ai thấy — trừ khi có cổng chạy được.
 *
 *   node scripts/check-agents.mjs            # mặc định quét ./agents
 *   node scripts/check-agents.mjs <dir>
 */

import fs from 'node:fs';
import path from 'node:path';

// Vai chỉ được đọc. Thêm vai kiểm-định mới thì thêm tên vào đây.
const NO_WRITE_ROLES = ['role-verifier', 'role-reviewer', 'role-planner', 'role-evidence-auditor'];
const WRITE_TOOLS = ['Write', 'Edit', 'NotebookEdit'];

const dir = process.argv[2] ?? 'agents';
if (!fs.existsSync(dir)) {
  console.error(`ERROR: không tìm thấy '${dir}' (cwd: ${process.cwd()})`);
  process.exit(2);
}

const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md');
const field = (fm, k) => {
  const m = fm.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : '';
};

const defs = {};
let problems = 0;
const fail = msg => { console.log(`FAIL ${msg}`); problems++; };

for (const f of files) {
  const fm = fs.readFileSync(path.join(dir, f), 'utf8').split('---')[1] ?? '';
  const name = field(fm, 'name');
  defs[name] = { file: f, model: field(fm, 'model'), effort: field(fm, 'effort'), tools: field(fm, 'tools'), deny: field(fm, 'disallowedTools') };
  if (`${name}.md` !== f) fail(`name khác filename: ${f} -> "${name}"`);
}

console.log(`vai tìm thấy trong ${dir}: ${Object.keys(defs).join(', ') || '(không có)'}\n`);

for (const [name, d] of Object.entries(defs)) {
  console.log(`  ${name.padEnd(24)} ${(d.model || '?') + '/' + (d.effort || '?')}  ${d.deny ? `deny[${d.deny}]` : '(không deny)'}`);
  for (const m of d.tools.matchAll(/Agent\(([^)]*)\)/g)) {
    for (const ref of m[1].split(',').map(s => s.trim())) {
      if (!defs[ref]) fail(`${d.file}: Agent(${ref}) trỏ vai không tồn tại`);
    }
  }
}

console.log('');
for (const name of NO_WRITE_ROLES) {
  const d = defs[name];
  if (!d) { console.log(`  --  ${name} không có file (bỏ qua)`); continue; }
  const bad = WRITE_TOOLS.filter(t => new RegExp(`\\b${t}\\b`).test(d.tools));
  if (bad.length) fail(`${name}: có tool ghi trong allowlist (${bad.join(', ')}) — vai kiểm/review không được sửa code`);
  else console.log(`  OK  ${name} không có tool ghi`);
}

console.log(`\n${problems === 0 ? 'OK — 0 vấn đề' : `${problems} VẤN ĐỀ`}`);
process.exit(problems === 0 ? 0 : 1);
