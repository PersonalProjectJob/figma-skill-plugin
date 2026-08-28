/**
 * flow.mjs — chạy một luồng NGƯỜI THẬT DÙNG, không phải chỉ mở trang.
 *
 * Khác `smoke.mjs` ở chỗ nào: smoke chỉ chứng minh "máy này mở được browser và
 * tới được target" (cổng năng lực). flow.mjs chứng minh "đi hết được luồng
 * người dùng và tới đúng trạng thái cần chụp".
 *
 * Bốn ràng buộc cứng, sinh ra từ các ca thật đã gặp (agent nộp ảnh chưa chứng minh trạng thái, và một
 * đợt review evidence thật trên một feature catalog nhiều bước):
 *   1. Chỉ dùng API tương tác thật (click/fill/press/select/scroll/reload). Không có verb nào
 *      gọi hàm render nội bộ hay set state — inject state KHÔNG phải E2E.
 *   2. Mỗi lần chụp (`shot`) phải có ít nhất một bước CHỨNG MINH đã tới đúng
 *      trạng thái kể từ lần chụp trước (`waitFor`/`expectText`/`expectVisible`/
 *      `expectUrl`). Chụp mà chưa chứng minh ⇒ flow FAIL, không ra ảnh.
 *   3. Flow phải có ≥1 bước tương tác thật. Flow chỉ có `goto` + `shot` là
 *      smoke đội lốt luồng ⇒ FAIL.
 *   4. Shot sau scroll phải có expectation sau lần scroll cuối; output ghi
 *      scrollY, target/method, expectation và readiness.
 *
 * Usage:
 *   node .e2e/flow.mjs --flow <name|path.json> [--workspace <p>] [--target <t>]
 *        [--login ui|none] [--role owner|staff] [--out <dir>] [--json]
 *
 * Exit code:
 *   0 = FLOW_VERIFIED   · 1 = BLOCKED (không có runner/browser)
 *   2 = TARGET_UNREACHABLE                · 3 = FLOW_FAILED (bước nào đó trượt)
 */

import { existsSync, mkdirSync, readFileSync, statSync, renameSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { basename, dirname, join, resolve as resolvePath, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveEnvironment, loadChromium, resolveDevUrl, fileBytes } from './resolve.mjs'
import { waitForReadiness } from './readiness.mjs'

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

const workspace = resolvePath(args.workspace || process.cwd())
const dot = join(workspace, '.e2e')

/**
 * Host API mà trang thật sự gọi trong lượt này.
 *
 * Vì sao cần: repo định nghĩa môi trường bằng *vite mode*, nên `pnpm dev` và
 * `pnpm dev:staging` cùng chạy localhost:3000 mà trỏ hai API khác nhau. Ảnh chụp
 * hai môi trường trông y hệt. Cách duy nhất để biết mình đang đo đúng môi trường
 * là xem trang gọi API nào — nên ta ghi lại và đối chiếu, thay vì tin lời khai.
 */
function apiObserver(page, expectedApiBase) {
  const hosts = new Set()
  page.on('request', (req) => {
    const type = req.resourceType()
    if (type !== 'xhr' && type !== 'fetch') return
    try {
      const { host } = new URL(req.url())
      if (host) hosts.add(host)
    } catch {
      /* URL lạ thì bỏ qua */
    }
  })
  return () => {
    const seen = [...hosts].sort()
    let expectedHost = null
    try {
      expectedHost = expectedApiBase ? new URL(expectedApiBase).host : null
    } catch {
      expectedHost = null
    }
    // Chỉ xhr/fetch được thu thập. Không loại pageHost: API same-origin vẫn là
    // request app hợp lệ và phải được dùng để xác nhận môi trường.
    const base = expectedHost ? expectedHost.split('.').slice(-2).join('.') : null
    const appApiHosts = base ? seen.filter((h) => h === base || h.endsWith('.' + base)) : []
    const apiCandidateHosts = appApiHosts.filter((host) => /(^|[-.])api([-.]|$)/i.test(host.split(':')[0]))
    return {
      apiHostsSeen: seen,
      expectedApiHost: expectedHost,
      appApiHostsSeen: appApiHosts,
      apiCandidateHostsSeen: apiCandidateHosts,
      // xac nhan duoc dung moi truong
      apiHostVerified: Boolean(expectedHost && appApiHosts.includes(expectedHost)),
      // chac chan SAI moi truong: co goi API cung ho nhung khong phai host mong doi
      // Same-origin fetch/RSC không tự chứng minh sai môi trường. Chỉ kết luận
      // mismatch khi đã thấy một host API-looking cùng họ nhưng khác host mong đợi.
      apiHostMismatch: Boolean(expectedHost && apiCandidateHosts.length && !apiCandidateHosts.includes(expectedHost)),
    }
  }
}

function emit(payload, code) {
  console.log(JSON.stringify(payload, null, 2))
  process.exit(code)
}

// ------------------------------------------------------------- flow file
if (!args.flow) emit({ ok: false, verdict: 'FLOW_FAILED', reason: 'thiếu --flow <name|path.json>' }, 3)
const flowPath = isAbsolute(String(args.flow))
  ? String(args.flow)
  : [join(dot, 'flows', `${args.flow}.json`), join(dot, 'flows', String(args.flow)), resolvePath(String(args.flow))].find(existsSync)
if (!flowPath || !existsSync(flowPath)) {
  emit({ ok: false, verdict: 'FLOW_FAILED', reason: `không tìm thấy flow: ${args.flow}`, lookedIn: join(dot, 'flows') }, 3)
}
let flow
try {
  flow = JSON.parse(readFileSync(flowPath, 'utf8'))
} catch (err) {
  emit({ ok: false, verdict: 'FLOW_FAILED', reason: `flow JSON hỏng: ${err.message}`, flowPath }, 3)
}
if (!Array.isArray(flow.steps) || !flow.steps.length) {
  emit({ ok: false, verdict: 'FLOW_FAILED', reason: 'flow không có steps', flowPath }, 3)
}

// Một lệnh cho người vận hành: mỗi viewport chạy trong process/context mới,
// lặp lại toàn bộ chuỗi thao tác, rồi tự đóng gói local. Không chia sẻ business
// state giữa các viewport; --fresh-session cũng buộc login UI lại khi flow cần.
if (args.viewport === 'all') {
  const viewportNames = ['desktop', 'tablet-portrait', 'tablet-landscape', 'mobile']
  const evidenceRoot = resolvePath(
    args['evidence-root'] || args.out || join(workspace, '.e2e', 'out', flow.name || 'flow'),
  )
  const childBase = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--viewport' || argv[i] === '--evidence-root' || argv[i] === '--out') {
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) i++
      continue
    }
    childBase.push(argv[i])
  }

  const runs = []
  for (const viewport of viewportNames) {
    const child = spawnSync(
      process.execPath,
      [fileURLToPath(import.meta.url), ...childBase, '--viewport', viewport, '--evidence-root', evidenceRoot, '--fresh-session'],
      { encoding: 'utf8' },
    )
    let result = null
    try {
      result = JSON.parse(child.stdout)
    } catch {
      result = { ok: false, verdict: 'FLOW_FAILED', reason: 'child không trả JSON hợp lệ' }
    }
    runs.push({ viewport, exitCode: child.status, result, stderr: child.stderr?.trim() || null })
    if (child.status !== 0) {
      console.log(`❌ Flow all-viewports failed at ${viewport}`)
      console.log(JSON.stringify({ ok: false, verdict: 'FLOW_FAILED', evidenceRoot, runs }, null, 2))
      process.exit(child.status || 3)
    }
  }

  const bundleArgs = [
    join(dirname(fileURLToPath(import.meta.url)), 'bundle.mjs'),
    '--evidence-dir',
    evidenceRoot,
    '--feature',
    String(flow.feature || flow.name || basename(evidenceRoot)),
    '--environment',
    String(args.env || flow.env || 'configured target'),
    '--route',
    String(flow.route || flow.target || '(xem flow)'),
    '--flow',
    flowPath,
  ]
  const bundle = spawnSync(process.execPath, bundleArgs, { encoding: 'utf8' })
  if (bundle.status !== 0) {
    console.log('❌ Flow đạt nhưng bundle local thất bại')
    console.log(JSON.stringify({ ok: false, verdict: 'BUNDLE_FAILED', evidenceRoot, runs, bundle: { stdout: bundle.stdout, stderr: bundle.stderr } }, null, 2))
    process.exit(3)
  }

  console.log(`✅ FLOW_VERIFIED — 4/4 viewports; local bundle complete: ${evidenceRoot}`)
  console.log(JSON.stringify({ ok: true, verdict: 'FLOW_VERIFIED', evidenceRoot, runs, bundleOutput: bundle.stdout.trim() }, null, 2))
  process.exit(0)
}

// --------------------------------------------------------------- capability
const env = resolveEnvironment({ workspace, host: args.host, target: args.target || flow.target, env: args.env || flow.env })
if (!env.capable) {
  emit(
    {
      ok: false,
      verdict: 'BLOCKED',
      reason: !env.runner ? 'không có runner' : 'không có browser binary',
      ladder: env.ladder,
    },
    1,
  )
}

let baseUrl = env.target.url
let devProbe = null
if (env.target.kind === 'dev') {
  devProbe = await resolveDevUrl(env.target)
  if (!devProbe.url) {
    emit(
      {
        ok: false,
        verdict: 'TARGET_UNREACHABLE',
        reason: 'không port nào phục vụ app',
        checked: devProbe.checked,
        hint: `Khởi động dev server: ${env.target.devCommand || 'pnpm dev'}`,
      },
      2,
    )
  }
  baseUrl = devProbe.url
}
if (!baseUrl) {
  emit({ ok: false, verdict: 'TARGET_UNREACHABLE', reason: env.target.error || 'không resolve được target' }, 2)
}

// ------------------------------------------------------------- credentials
/**
 * Đọc GIÁ TRỊ biến môi trường (khác resolve.mjs — nơi đó cố ý chỉ đọc TÊN).
 * Giá trị chỉ tồn tại trong bộ nhớ tiến trình này: không log, không ghi ra file,
 * không đưa vào JSON output.
 */
function envValues(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

/**
 * Nội suy `${VAR}` trong flow file từ env/.env.local.
 *
 * Nhờ vậy flow file không phải chứa secret: `{"fill": {..., "value": "${E2E_OWNER_EMAIL}"}}`.
 * Giá trị sau nội suy KHÔNG được ghi vào steps[] hay JSON output — chỉ đi vào
 * locator.fill(). Bước nào có nội suy thì ghi nhãn `valueMasked: true`.
 */
function interpolate(raw, merged) {
  if (typeof raw !== 'string') return { value: raw, masked: false }
  let masked = false
  const value = raw.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => {
    masked = true
    // ROLE_EMAIL / ROLE_PASSWORD: giải qua credentials() nên flow tự đi theo
    // --role và E2E_TARGET, không phải sửa file flow mỗi lần đổi môi trường.
    if (name === 'ROLE_EMAIL' || name === 'ROLE_PASSWORD') {
      const c = credentials()
      const v = name === 'ROLE_EMAIL' ? c.email : c.password
      if (!v) throw new Error(`thiếu credential cho role "${role}": đã thử ${(c.varNames || []).join(', ')}`)
      return v
    }
    const v = merged[name]
    if (v === undefined) throw new Error(`nội suy thất bại: thiếu biến ${name}`)
    return v
  })
  return { value, masked }
}

const loginMode = String(args.login || flow.login || 'none')
const role = String(args.role || flow.role || 'owner')

const MERGED_ENV = (() => {
  const files = [join(workspace, '.env.local'), ...env.fallbackRoots.map((r) => join(r, '.env.local'))]
  return Object.assign({}, ...files.reverse().map(envValues), process.env)
})()

/**
 * Giải tên biến cho `--role <ten>`. Role là tự do (owner/staff/manager/customer…),
 * và có trục môi trường: E2E_TARGET=dev ⇒ ưu tiên E2E_DEV_<ROLE>_*, không có thì
 * rơi về dạng phẳng E2E_<ROLE>_*. Trả về CẢ tên biến đã dùng (tên là an toàn để
 * log) nhưng giá trị thì chỉ đi vào locator.fill().
 */
function credentials() {
  const merged = MERGED_ENV
  const R = role.toUpperCase()
  const T = String(args.env || merged.E2E_TARGET || '').toUpperCase()
  const candidates = []
  if (T) candidates.push([`E2E_${T}_${R}_EMAIL`, `E2E_${T}_${R}_PASSWORD`])
  candidates.push([`E2E_${R}_EMAIL`, `E2E_${R}_PASSWORD`])
  for (const [e, pw] of candidates) {
    if (merged[e] && merged[pw]) return { email: merged[e], password: merged[pw], usedNames: [e, pw] }
  }
  return { email: null, password: null, varNames: candidates.flat() }
}

// --------------------------------------------------------------- selectors
const STRATEGIES = ['role', 'text', 'label', 'placeholder', 'testId', 'css']

/** Ưu tiên role/text (accessibility tree) — `css` là cửa thoát, bị đánh dấu trong báo cáo. */
function locate(page, sel) {
  if (typeof sel === 'string') return { locator: page.locator(sel), strategy: 'css', escapeHatch: true }
  const key = STRATEGIES.find((k) => sel[k] !== undefined)
  if (!key) throw new Error(`selector không hợp lệ: ${JSON.stringify(sel)}`)
  switch (key) {
    case 'role':
      return { locator: page.getByRole(sel.role, sel.name ? { name: sel.name, exact: Boolean(sel.exact) } : undefined), strategy: 'role' }
    case 'text':
      return { locator: page.getByText(sel.text, { exact: Boolean(sel.exact) }), strategy: 'text' }
    case 'label':
      return { locator: page.getByLabel(sel.label, { exact: Boolean(sel.exact) }), strategy: 'label' }
    case 'placeholder':
      return { locator: page.getByPlaceholder(sel.placeholder, { exact: Boolean(sel.exact) }), strategy: 'placeholder' }
    case 'testId':
      return { locator: page.getByTestId(sel.testId), strategy: 'testId' }
    default:
      return { locator: page.locator(sel.css), strategy: 'css', escapeHatch: true }
  }
}

function pick(locator, sel) {
  if (typeof sel === 'object' && sel !== null && Number.isInteger(sel.nth)) return locator.nth(sel.nth)
  return locator.first()
}

// --------------------------------------------------------------- login UI
const LOGIN_CFG = (() => {
  const f = [join(dot, 'login.json'), join(dirname(fileURLToPath(import.meta.url)), 'login.json')].find(existsSync)
  if (f) {
    try {
      return JSON.parse(readFileSync(f, 'utf8'))
    } catch {
      /* dùng mặc định dưới */
    }
  }
  return null
})()

async function performUiLogin(page, record) {
  const cfg = LOGIN_CFG
  if (!cfg) throw new Error('thiếu login.json — không biết form đăng nhập ở đâu')
  const creds = credentials()
  if (!creds.email || !creds.password) {
    throw new Error(
      `thiếu credential cho role "${role}": đã thử ${creds.varNames.join(', ')} trong env và .env.local`,
    )
  }

  await page.goto(baseUrl + cfg.route, { waitUntil: 'load', timeout: Number(flow.timeout || 30000) })
  await pick(locate(page, cfg.emailSelector).locator, cfg.emailSelector).fill(creds.email)
  await pick(locate(page, cfg.passwordSelector).locator, cfg.passwordSelector).fill(creds.password)
  await pick(locate(page, cfg.submitSelector).locator, cfg.submitSelector).click()

  // Bằng chứng đăng nhập thành công: rời khỏi route login.
  try {
    await page.waitForURL((u) => !u.pathname.startsWith(cfg.route), { timeout: Number(cfg.successTimeout || 20000) })
  } catch {
    const visibleError = await page
      .locator('form')
      .first()
      .innerText()
      .catch(() => null)
    throw new Error(`login UI không thoát khỏi ${cfg.route}${visibleError ? ` — trang báo: ${String(visibleError).slice(0, 200)}` : ''}`)
  }
  record.push({
    at: new Date().toISOString(),
    route: cfg.route,
    result: 'ok',
    role,
    usedVars: creds.usedNames,
  })
}

// --------------------------------------------------------------- chạy flow
const VIEWPORTS = {
  desktop: { width: 1440, height: 900, dsf: 1, isMobile: false },
  tablet: { width: 768, height: 1024, dsf: 2, isMobile: true, hasTouch: true },
  'tablet-portrait': { width: 768, height: 1024, dsf: 2, isMobile: true, hasTouch: true },
  'tablet-landscape': { width: 1024, height: 768, dsf: 2, isMobile: true, hasTouch: true },
  mobile: { width: 375, height: 812, dsf: 2, isMobile: true, hasTouch: true },
}
const rawVp = args.viewport || flow.viewport
const vpName = Object.keys(VIEWPORTS).includes(rawVp) ? rawVp : 'desktop'
const vp = VIEWPORTS[vpName]

const viewportFolder = (root, name) =>
  name === 'desktop'
    ? join(root, 'desktop')
    : name === 'mobile'
      ? join(root, 'mobile')
      : name === 'tablet-portrait'
        ? join(root, 'tablet', 'portrait')
        : join(root, 'tablet', 'landscape')
const outDir = args['evidence-root']
  ? viewportFolder(resolvePath(args['evidence-root']), vpName)
  : resolvePath(args.out || join(dot, 'out', flow.name || 'flow'))
mkdirSync(outDir, { recursive: true })
const stateDir = join(dot, 'state')
mkdirSync(stateDir, { recursive: true })
const stateFile = join(stateDir, `${role}-${vpName}.json`)
const STATE_MAX_AGE_MS = Number(flow.stateMaxAgeMs || 8 * 60 * 60 * 1000)
/** Session cache còn hạn hay không — hết hạn thì đăng nhập lại qua UI. */
const stateFresh = (() => {
  if (args['fresh-session'] || !existsSync(stateFile)) return false
  try {
    return Date.now() - statSync(stateFile).mtimeMs < STATE_MAX_AGE_MS
  } catch {
    return false
  }
})()

const steps = []
const shots = []
const loginRecord = []
const consoleErrors = []
const pageErrors = []
let scrollsSinceLastShot = []
let expectationsSinceLastShot = []
let interactions = 0
let provenSinceLastShot = false
let escapeHatchUsed = 0
const started = Date.now()

const chromium = await loadChromium(env.runner)
const browser = await chromium.launch({
  executablePath: env.browser.executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

let context
let page
let readApiHosts = () => ({ apiHostsSeen: [], expectedApiHost: null, apiHostMismatch: false })
let verdict = 'FLOW_VERIFIED'
let failure = null

try {
  const ctxOpts = {
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    isMobile: Boolean(vp.isMobile),
    hasTouch: Boolean(vp.hasTouch),
    colorScheme: flow.dark ? 'dark' : 'light',
  }
  if (flow.video !== false) ctxOpts.recordVideo = { dir: join(outDir, 'video') }
  if (loginMode === 'ui' && stateFresh) ctxOpts.storageState = stateFile

  context = await browser.newContext(ctxOpts)
  if (flow.trace !== false) await context.tracing.start({ screenshots: true, snapshots: true })
  page = await context.newPage()
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 500)))
  page.on('pageerror', (e) => pageErrors.push(String(e.message).slice(0, 500)))
  readApiHosts = apiObserver(page, env.secrets.apiBase)

  if (loginMode === 'ui' && !stateFresh) {
    await performUiLogin(page, loginRecord)
    await context.storageState({ path: stateFile })
  } else if (loginMode === 'ui') {
    loginRecord.push({ result: 'reused-state', file: stateFile, note: 'session cache còn hạn' })
  } else if (loginMode !== 'none') {
    throw new Error(`--login ${loginMode} không được hỗ trợ ở đây (dùng ui|none; đường token-injection nằm ở scripts/capture-evidence.mjs)`)
  }

  const timeout = Number(flow.timeout || 30000)

  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i]
    const verb = Object.keys(step)[0]
    const t0 = Date.now()
    const rec = { i, verb, strategy: null }
    try {
      switch (verb) {
        // ---- điều hướng (KHÔNG tính là tương tác người dùng) ----
        case 'goto': {
          const to = /^https?:|^file:/.test(step.goto) ? step.goto : baseUrl + step.goto
          await page.goto(to, { waitUntil: 'load', timeout })
          rec.url = to
          break
        }

        // ---- tương tác người thật ----
        case 'click':
        case 'dblclick':
        case 'hover':
        case 'check':
        case 'uncheck': {
          const { locator, strategy, escapeHatch } = locate(page, step[verb])
          rec.strategy = strategy
          if (escapeHatch) escapeHatchUsed++
          await pick(locator, step[verb])[verb === 'dblclick' ? 'dblclick' : verb]({ timeout })
          interactions++
          break
        }
        case 'fill': {
          const sel = step.fill
          const { locator, strategy, escapeHatch } = locate(page, sel)
          rec.strategy = strategy
          if (escapeHatch) escapeHatchUsed++
          const { value, masked } = interpolate(sel.value ?? '', MERGED_ENV)
          if (masked) rec.valueMasked = true
          await pick(locator, sel).fill(String(value), { timeout })
          interactions++
          break
        }
        case 'select': {
          const sel = step.select
          const { locator, strategy, escapeHatch } = locate(page, sel)
          rec.strategy = strategy
          if (escapeHatch) escapeHatchUsed++
          await pick(locator, sel).selectOption(String(sel.value), { timeout })
          interactions++
          break
        }
        case 'press': {
          await page.keyboard.press(String(step.press))
          interactions++
          break
        }
        case 'reload': {
          // page.reload() — hành động thật (giống người bấm F5/nút reload trình
          // duyệt), không phải goto lại cùng URL (goto không kích hoạt lại đúng
          // vòng đời load như reload thật). Dùng để kiểm dữ liệu có còn sau khi
          // tải lại hay không (ví dụ: kiểm tra lưu thành công có bền hay không).
          await page.reload({ waitUntil: 'load', timeout })
          interactions++
          break
        }
        case 'scroll': {
          // Dùng mouse.wheel() — sự kiện input tổng hợp thật (giống click/fill), KHÔNG
          // page.evaluate(scrollTo/scrollBy). scrollIntoViewIfNeeded() của Playwright cũng
          // hợp lệ ở đây vì nó là API tương tác chuẩn của Playwright, không phải gọi hàm
          // render nội bộ của app.
          const spec = step.scroll
          const beforeY = await page.evaluate(() => window.scrollY)
          if (spec && typeof spec === 'object' && spec.to) {
            const { locator, strategy, escapeHatch } = locate(page, spec.to)
            rec.strategy = strategy
            if (escapeHatch) escapeHatchUsed++
            await pick(locator, spec.to).scrollIntoViewIfNeeded({ timeout })
            rec.scroll = { method: 'scrollIntoViewIfNeeded-fallback', target: spec.to, beforeY }
          } else {
            const NAMED = { down: 600, up: -600 }
            const dy = typeof spec === 'string' ? Number(NAMED[spec] ?? 0) : Number(spec?.y ?? 400)
            const dx = typeof spec === 'object' ? Number(spec?.x ?? 0) : 0
            await page.mouse.wheel(dx, dy)
            await page.waitForTimeout(150) // để nội dung lazy-load kịp bắt, giống người thật dừng lại nhìn
            rec.scroll = { method: 'mouse.wheel', deltaX: dx, deltaY: dy, beforeY }
          }
          rec.scroll.afterY = await page.evaluate(() => window.scrollY)
          scrollsSinceLastShot.push({ step: i, ...rec.scroll })
          interactions++
          break
        }

        // ---- chứng minh trạng thái ----
        case 'waitFor': {
          const { locator, strategy, escapeHatch } = locate(page, step.waitFor)
          rec.strategy = strategy
          if (escapeHatch) escapeHatchUsed++
          await pick(locator, step.waitFor).waitFor({ state: 'visible', timeout })
          expectationsSinceLastShot.push({ step: i, verb, selector: step.waitFor })
          provenSinceLastShot = true
          break
        }
        case 'expectVisible': {
          const { locator, strategy, escapeHatch } = locate(page, step.expectVisible)
          rec.strategy = strategy
          if (escapeHatch) escapeHatchUsed++
          const selected = pick(locator, step.expectVisible)
          const visible = await selected.isVisible()
          const box = visible ? await selected.boundingBox() : null
          const viewport = page.viewportSize()
          const inViewport = Boolean(
            box &&
              viewport &&
              box.x < viewport.width &&
              box.y < viewport.height &&
              box.x + box.width > 0 &&
              box.y + box.height > 0,
          )
          rec.viewportBox = box
          rec.inViewport = inViewport
          if (!visible) throw new Error('phần tử không hiển thị')
          if (!inViewport) throw new Error('phần tử có trong DOM nhưng chưa nằm trong viewport — cần scroll như người dùng')
          expectationsSinceLastShot.push({ step: i, verb, selector: step.expectVisible, inViewport, viewportBox: box })
          provenSinceLastShot = true
          break
        }
        case 'expectText': {
          await page.getByText(String(step.expectText), { exact: false }).first().waitFor({ state: 'visible', timeout })
          rec.strategy = 'text'
          expectationsSinceLastShot.push({ step: i, verb, text: String(step.expectText) })
          provenSinceLastShot = true
          break
        }
        case 'expectUrlNot': {
          await page.waitForURL((u) => !u.pathname.includes(String(step.expectUrlNot)), { timeout })
          rec.url = page.url()
          expectationsSinceLastShot.push({ step: i, verb, url: String(step.expectUrlNot) })
          provenSinceLastShot = true
          break
        }
        case 'expectUrl': {
          await page.waitForURL((u) => u.href.includes(String(step.expectUrl)) || u.pathname.includes(String(step.expectUrl)), { timeout })
          rec.url = page.url()
          expectationsSinceLastShot.push({ step: i, verb, url: String(step.expectUrl) })
          provenSinceLastShot = true
          break
        }

        // ---- chụp (chỉ được phép khi đã chứng minh) ----
        case 'shot': {
          if (!provenSinceLastShot) {
            throw new Error(
              'chụp mà chưa chứng minh đã tới đúng trạng thái — cần một bước waitFor/expectText/' +
                'expectVisible/expectUrl kể từ lần chụp trước. Ảnh không được tạo.',
            )
          }
          if (scrollsSinceLastShot.length) {
            const lastScrollStep = scrollsSinceLastShot.at(-1).step
            const proofAfterScroll = expectationsSinceLastShot.some(
              (proof) => proof.step > lastScrollStep && proof.verb === 'expectVisible' && proof.inViewport === true,
            )
            if (!proofAfterScroll) {
              throw new Error('ảnh sau scroll thiếu expectVisible xác nhận target thật sự nằm trong viewport sau lần scroll cuối')
            }
          }
          const readiness = await waitForReadiness(page, {
            timeout: Math.min(timeout, Number(flow.readinessTimeout || 10000)),
            settleMs: Number(flow.settleBeforeShot || 300),
            requireNetworkIdle: false,
          })
          if (!readiness.ok) throw new Error(`READINESS_FAILED — ${readiness.blockers.join('; ')}`)
          const file = join(outDir, `${String(step.shot).replace(/[^\w.-]/g, '_')}-${vpName}.png`)
          await page.screenshot({ path: file, fullPage: Boolean(step.fullPage ?? flow.fullPage) })
          shots.push({
            label: String(step.shot),
            url: page.url(),
            file,
            bytes: fileBytes(file),
            scrollY: await page.evaluate(() => window.scrollY),
            scrolls: scrollsSinceLastShot,
            expectations: expectationsSinceLastShot,
            readiness,
          })
          scrollsSinceLastShot = []
          expectationsSinceLastShot = []
          provenSinceLastShot = false
          break
        }

        // ---- chờ trơn: KHÔNG tính là chứng minh ----
        case 'settle': {
          await page.waitForTimeout(Math.min(Number(step.settle) || 300, 3000))
          break
        }

        default:
          throw new Error(`verb không hỗ trợ: ${verb}`)
      }
      rec.status = 'ok'
    } catch (err) {
      rec.status = 'fail'
      rec.error = String(err.message).split('\n').slice(0, 3).join(' ')
      steps.push({ ...rec, ms: Date.now() - t0 })
      failure = `bước ${i} (${verb}): ${rec.error}`
      verdict = 'FLOW_FAILED'
      break
    }
    steps.push({ ...rec, ms: Date.now() - t0 })
  }

  // Ràng buộc 3: flow không có tương tác thật thì đó là smoke đội lốt.
  if (verdict === 'FLOW_VERIFIED' && interactions === 0) {
    verdict = 'FLOW_FAILED'
    failure =
      'flow không có bước tương tác nào (chỉ goto/shot) ⇒ đây là smoke, không phải luồng người dùng. ' +
      'Dùng smoke.mjs nếu chỉ cần cổng năng lực.'
  }
} catch (err) {
  verdict = verdict === 'FLOW_VERIFIED' ? 'FLOW_FAILED' : verdict
  failure = failure || String(err.message)
}

/**
 * Bằng chứng lấy từ MÔI TRƯỜNG SAI tệ hơn không có bằng chứng, vì nó trông hợp lệ.
 *
 * Ca thật: E2E_TARGET=staging nhưng dev server đang chạy `pnpm dev` (mode
 * development) nên app nói chuyện với test-api. Flow vẫn xanh, ảnh vẫn đẹp, và
 * không có gì trong ảnh cho thấy đó là môi trường khác. Nên mismatch phải là một
 * verdict riêng, không được rơi vào FLOW_VERIFIED.
 */
const apiCheck = readApiHosts()
if (verdict === 'FLOW_VERIFIED' && apiCheck.apiHostMismatch) {
  verdict = 'ENV_MISMATCH'
  failure =
    `E2E_TARGET=${env.secrets.envTarget} kỳ vọng API ${apiCheck.expectedApiHost} nhưng trang gọi ` +
    `${apiCheck.apiHostsSeen.join(', ')}. Dev server đang chạy sai mode — khởi động lại bằng ` +
    `\`${env.target.devCommand || 'pnpm dev'}\` rồi chạy lại.`
}
if (verdict === 'FLOW_VERIFIED' && env.secrets.envTarget && !apiCheck.apiHostVerified) {
  // Khong ket luan sai — chi noi ro la KHONG xac nhan duoc, de nguoi review biet.
  apiCheck.envNote =
    `không xác nhận được môi trường: trang không gọi API nào thuộc ${apiCheck.expectedApiHost}` +
    ` trong lượt này (host thấy: ${apiCheck.apiHostsSeen.join(', ') || 'không có'})`
}

/**
 * Flow trượt thì ảnh của lượt đó KHÔNG được nằm chung với ảnh hợp lệ.
 *
 * Vì sao phải làm: một bước `shot` có thể pass ở tầng bước (đã chứng minh) trong
 * khi flow vẫn trượt ở ràng buộc cuối. Ảnh còn lại trên đĩa lúc đó trông y như
 * bằng chứng thật — đây chính là cách một task từng nộp được bằng chứng xấu mà
 * vẫn trình bày như đo thật. Không xoá (còn cần để debug), mà dồn sang REJECTED/ và
 * đổi tên để không ai dán nhầm vào issue.
 */
if (verdict !== 'FLOW_VERIFIED' && shots.length) {
  const rejectedDir = join(outDir, 'REJECTED')
  mkdirSync(rejectedDir, { recursive: true })
  for (const shot of shots) {
    try {
      const dest = join(rejectedDir, `REJECTED-${basename(shot.file)}`)
      renameSync(shot.file, dest)
      shot.file = dest
      shot.rejected = true
      shot.note = 'ảnh từ một lượt flow TRƯỢT — không được dùng làm bằng chứng'
    } catch (err) {
      shot.rejected = true
      shot.note = `không di chuyển được sang REJECTED/ (${err.message}) — tự kiểm tra trước khi dùng`
    }
  }
}

let tracePath = null
let videoPath = null
try {
  if (context && flow.trace !== false) {
    tracePath = join(outDir, 'trace.zip')
    await context.tracing.stop({ path: tracePath })
  }
  if (page && flow.video !== false) {
    const v = page.video()
    await context?.close()
    videoPath = v ? await v.path() : null
  } else {
    await context?.close()
  }
} catch {
  /* trace/video là bổ trợ, thiếu nó không đổi verdict */
} finally {
  await browser.close()
}

const code =
  verdict === 'FLOW_VERIFIED' ? 0 : verdict === 'TARGET_UNREACHABLE' ? 2 : verdict === 'ENV_MISMATCH' ? 4 : 3
const result = {
  ok: verdict === 'FLOW_VERIFIED',
  verdict,
  failure,
  flow: { name: flow.name || null, file: flowPath, steps: flow.steps.length },
  host: env.host,
  workspaceKind: env.workspace.kind,
  target: { kind: env.target.kind, baseUrl, devProbe: devProbe?.checked ?? null },
  viewport: vpName,
  login: { mode: loginMode, role, record: loginRecord },
  envTarget: env.secrets.envTarget,
  ...apiCheck,
  interactions,
  escapeHatchSelectors: escapeHatchUsed,
  steps,
  shots,
  consoleErrors,
  pageErrors,
  trace: tracePath && fileBytes(tracePath) ? { file: tracePath, bytes: fileBytes(tracePath) } : null,
  video: videoPath && fileBytes(videoPath) ? { file: videoPath, bytes: fileBytes(videoPath) } : null,
  runner: { name: env.runner.name, version: env.runner.version },
  browser: { kind: env.browser.kind },
  elapsedMs: Date.now() - started,
}

// Persist a redacted, machine-readable audit next to each viewport's PNGs.
// bundle.mjs requires these four records before it can declare the evidence PASS.
if (verdict === 'FLOW_VERIFIED') {
  const runAudit = {
    schemaVersion: 1,
    verdict,
    flow: { name: flow.name || null, steps: flow.steps.length },
    viewport: vpName,
    envTarget: env.secrets.envTarget,
    apiHostsSeen: apiCheck.apiHostsSeen,
    expectedApiHost: apiCheck.expectedApiHost,
    apiHostVerified: apiCheck.apiHostVerified,
    interactions,
    steps,
    shots: shots.map((shot) => ({
      label: shot.label,
      url: shot.url,
      file: basename(shot.file),
      bytes: shot.bytes,
      scrollY: shot.scrollY,
      scrolls: shot.scrolls,
      expectations: shot.expectations,
      readiness: shot.readiness,
    })),
    consoleErrors,
    pageErrors,
    runner: result.runner,
    browser: result.browser,
    elapsedMs: result.elapsedMs,
  }
  writeFileSync(join(outDir, 'run.json'), JSON.stringify(runAudit, null, 2) + '\n', 'utf8')
}

emit(result, code)
