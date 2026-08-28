/**
 * smoke.mjs — CỔNG. Chứng minh workspace này thật sự chạy được browser.
 *
 * Launch browser đã resolve → điều hướng target thật → chụp PNG → in JSON.
 * Không inject state, không gọi hàm render nội bộ (evidence-discipline §5).
 *
 * Usage:
 *   node .e2e/smoke.mjs [--target <url|file.html|dev>] [--workspace <path>]
 *                       [--out <dir>] [--viewport desktop|mobile] [--full-page]
 *                       [--timeout 30000] [--wait 500]
 *
 * Exit code — bên gọi dựa vào đây để chấm verdict:
 *   0 = OK        (browser chạy, target tới được, PNG có thật)
 *   2 = PARTIAL   (browser chạy được nhưng target không tới được)
 *   1 = BLOCKED   (không launch được browser / không có runner)
 */

import { mkdirSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { resolveEnvironment, loadChromium, fileBytes } from './resolve.mjs'
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
const env = resolveEnvironment({ workspace, host: args.host, target: args.target, env: args.env })
const timeout = Number(args.timeout || 30000)
const settle = Number(args.wait || 500)

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'tablet-portrait': { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'tablet-landscape': { width: 1024, height: 768, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const viewportName = Object.keys(VIEWPORTS).includes(args.viewport) ? args.viewport : 'desktop'

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
    // Chỉ request xhr/fetch đã được thu thập, nên document/static asset không
    // tham gia. Không loại pageHost: API same-origin vẫn là API thật của app.
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

if (!env.capable) {
  emit(
    {
      ok: false,
      verdict: 'BLOCKED',
      reason: !env.runner ? 'không tìm thấy runner (playwright/playwright-core/puppeteer/cypress)' : 'không tìm thấy browser binary',
      ladder: env.ladder,
    },
    1,
  )
}

if (!env.target.url) {
  emit(
    { ok: false, verdict: 'PARTIAL', reason: env.target.error || 'không resolve được target', target: env.target },
    2,
  )
}

const outDir = resolvePath(args.out || join(workspace, '.e2e', 'out'))
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const png = join(outDir, `smoke-${viewportName}-${stamp}.png`)

const consoleErrors = []
const pageErrors = []
const failedRequests = []
let browser
const started = Date.now()

try {
  const chromium = await loadChromium(env.runner)
  browser = await chromium.launch({
    executablePath: env.browser.executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
} catch (err) {
  emit(
    {
      ok: false,
      verdict: 'BLOCKED',
      reason: `launch thất bại: ${err.message}`,
      runner: env.runner,
      browser: env.browser,
      hint: 'Nếu lỗi là listen EPERM / operation not permitted: sandbox của host đang chặn. Xem .e2e/hosts/<host>.md',
    },
    1,
  )
}

try {
  const context = await browser.newContext({
    viewport: { width: VIEWPORTS[viewportName].width, height: VIEWPORTS[viewportName].height },
    deviceScaleFactor: VIEWPORTS[viewportName].deviceScaleFactor,
    isMobile: Boolean(VIEWPORTS[viewportName].isMobile),
    hasTouch: Boolean(VIEWPORTS[viewportName].hasTouch),
  })
  const page = await context.newPage()

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 500))
  })
  page.on('pageerror', (err) => pageErrors.push(String(err.message).slice(0, 500)))
  const readApiHosts = apiObserver(page, env.secrets.apiBase)
  page.on('requestfailed', (req) =>
    failedRequests.push({ url: req.url().slice(0, 300), error: req.failure()?.errorText || null }),
  )

  let response = null
  try {
    response = await page.goto(env.target.url, { waitUntil: 'load', timeout })
  } catch (err) {
    await browser.close()
    emit(
      {
        ok: false,
        verdict: 'PARTIAL',
        reason: `không tới được target: ${err.message}`,
        target: env.target,
        hint:
          env.target.kind === 'dev'
            ? `Dev server chưa chạy? Khởi động: ${env.target.devCommand || 'pnpm dev'} (port ${env.target.port})`
            : 'Kiểm lại URL/file path',
        browserLaunched: true,
      },
      2,
    )
  }

  const readiness = await waitForReadiness(page, {
    timeout: Math.min(timeout, 10000),
    settleMs: settle,
    readySelector: args['ready-selector'] || null,
    requireNetworkIdle: Boolean(args['require-networkidle']),
  })
  if (!readiness.ok) {
    await browser.close()
    emit(
      {
        ok: false,
        verdict: 'PARTIAL',
        reason: `READINESS_FAILED — ${readiness.blockers.join('; ')}`,
        target: env.target,
        readiness,
        browserLaunched: true,
      },
      2,
    )
  }

  const title = await page.title()
  await page.screenshot({ path: png, fullPage: Boolean(args['full-page']) })
  await browser.close()

  const bytes = fileBytes(png)
  emit(
    {
      ok: bytes > 0,
      verdict: bytes > 0 ? 'READY' : 'PARTIAL',
      host: env.host,
      workspaceKind: env.workspace.kind,
      target: { kind: env.target.kind, url: env.target.url },
      httpStatus: response?.status() ?? null,
      title,
      viewport: viewportName,
      png,
      bytes,
      consoleErrors,
      pageErrors,
      failedRequests: failedRequests.slice(0, 10),
      readiness,
      envTarget: env.secrets.envTarget,
      ...readApiHosts(),
      runner: { name: env.runner.name, version: env.runner.version, dir: env.runner.dir, borrowedFrom: env.runner.borrowedFrom },
      browser: { kind: env.browser.kind, executablePath: env.browser.executablePath, supportsHeaded: env.browser.supportsHeaded },
      elapsedMs: Date.now() - started,
    },
    bytes > 0 ? 0 : 2,
  )
} catch (err) {
  try {
    await browser?.close()
  } catch {
    /* đóng được hay không cũng không đổi kết luận */
  }
  emit({ ok: false, verdict: 'BLOCKED', reason: `smoke lỗi: ${err.message}`, stack: err.stack?.split('\n').slice(0, 5) }, 1)
}
