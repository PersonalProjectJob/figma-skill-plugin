/**
 * capture.mjs — chụp evidence.
 *
 * Có `scripts/capture-evidence.mjs` (bậc 1 của ladder) ⇒ UỶ QUYỀN cho nó, kể cả
 * khi script nằm ở repo gốc chứ không ở worktree. Lý do: naming convention +
 * auth-by-API + layout output của evidence đã sống trong script đó; nhân bản ở
 * đây là tạo nguồn sự thật thứ hai.
 *
 * Không có bậc 1 ⇒ tự chụp (ca folder trần / prototype HTML rời).
 *
 * Uỷ quyền:
 *   node .e2e/capture.mjs --route dashboard/settings --screen dashboard-settings \
 *        --state current --slug US-012 --desc nut-luu-bi-che --role owner [...]
 *
 * Tự chụp:
 *   node .e2e/capture.mjs --url <url|file.html> --out <file.png> \
 *        [--viewport desktop|tablet-portrait|tablet-landscape|mobile|all]
 *        [--full-page] [--dark] [--wait 500] [--ready-selector <css>]
 */

import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve as resolvePath, extname } from 'node:path'
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
const env = resolveEnvironment({ workspace, host: args.host, target: args.url || args.target, env: args.env })

// --- đường uỷ quyền -----------------------------------------------------
const wantsRepoConvention = Boolean(args.route || args.screen || args.slug)
let captureTargetUrl = env.target.url
if (wantsRepoConvention) {
  if (env.captureScript) {
    console.log(`[capture] uỷ quyền cho ${env.captureScript}`)
    const res = spawnSync(process.execPath, [env.captureScript, ...argv], {
      stdio: 'inherit',
      cwd: dirname(dirname(env.captureScript)),
    })
    process.exit(res.status ?? 1)
  }
  if (!env.capable || !env.target.url) {
    console.error(
      'Delegated scripts/capture-evidence.mjs không dùng được và fallback kit thiếu target/runner/browser.\n' +
        'Ladder đã thử:\n' +
        env.ladder['1-repo-capture-script']
          .map((r) => `  ${!r.exists ? 'KHÔNG' : r.syntaxOk ? 'CÓ · syntax OK' : 'CÓ · SYNTAX HỎNG'} ${r.path}`)
          .join('\n'),
    )
    process.exit(1)
  }
  captureTargetUrl = args.route
    ? new URL(String(args.route), env.target.url.endsWith('/') ? env.target.url : `${env.target.url}/`).href
    : env.target.url
  console.warn(`[capture] delegated script không dùng được; fallback kit chụp orientation-only tại ${captureTargetUrl}`)
}

// --- đường tự chụp ------------------------------------------------------
if (!env.capable) {
  console.error(
    `BLOCKED — ${!env.runner ? 'không có runner' : 'không có browser binary'}.\n` +
      'Chạy lại `/e2e-setup` để xem ladder đầy đủ.',
  )
  process.exit(1)
}
if (!captureTargetUrl) {
  console.error(`Không resolve được target: ${env.target.error || '(thiếu --url)'}`)
  process.exit(2)
}

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false },
  tablet: { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'tablet-portrait': { width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  'tablet-landscape': { width: 1024, height: 768, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  mobile: { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
}
const viewportArg = args.viewport || (wantsRepoConvention ? 'all' : undefined)
const wanted =
  viewportArg === 'all'
    ? ['desktop', 'tablet-portrait', 'tablet-landscape', 'mobile']
    : viewportArg === 'tablet' || viewportArg === 'tablets'
      ? ['tablet-portrait', 'tablet-landscape']
      : viewportArg === 'both'
        ? ['desktop', 'mobile']
        : Object.keys(VIEWPORTS).includes(viewportArg)
          ? [viewportArg]
          : ['desktop']

const baseOut = resolvePath(
  args.out || join(workspace, '.e2e', 'out', viewportArg === 'all' ? String(args.slug || args.screen || 'capture') : 'capture.png'),
)
const structured = viewportArg === 'all' || viewportArg === 'tablet' || viewportArg === 'tablets'
const structuredRoot = structured && extname(baseOut) ? baseOut.slice(0, -extname(baseOut).length) : baseOut
const viewportFolder = (name) =>
  name === 'desktop'
    ? join(structuredRoot, 'desktop')
    : name === 'mobile'
      ? join(structuredRoot, 'mobile')
      : name === 'tablet-portrait'
        ? join(structuredRoot, 'tablet', 'portrait')
        : join(structuredRoot, 'tablet', 'landscape')
if (structured) mkdirSync(structuredRoot, { recursive: true })
else mkdirSync(dirname(baseOut), { recursive: true })

const chromium = await loadChromium(env.runner)
const browser = await chromium.launch({
  executablePath: env.browser.executablePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const written = []
const failures = []
try {
  for (const name of wanted) {
    const vp = VIEWPORTS[name]
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: Boolean(vp.isMobile),
      hasTouch: Boolean(vp.hasTouch),
      colorScheme: args.dark ? 'dark' : 'light',
    })
    const page = await context.newPage()
    try {
      await page.goto(captureTargetUrl, { waitUntil: 'load', timeout: Number(args.timeout || 30000) })
      const readiness = await waitForReadiness(page, {
        timeout: Math.min(Number(args.timeout || 30000), 10000),
        settleMs: Number(args.wait || 500),
        readySelector: args['ready-selector'] || null,
        requireNetworkIdle: Boolean(args['require-networkidle']),
      })
      if (!readiness.ok) throw new Error(`READINESS_FAILED — ${readiness.blockers.join('; ')}`)

      const ext = extname(baseOut) || '.png'
      const file = structured
        ? join(viewportFolder(name), '00-first-view-orientation.png')
        : wanted.length > 1
          ? baseOut.slice(0, -ext.length) + `-${name}` + ext
          : baseOut
      mkdirSync(dirname(file), { recursive: true })
      await page.screenshot({ path: file, fullPage: Boolean(args['full-page']) })
      written.push({ viewport: name, file, bytes: fileBytes(file), readiness, evidenceClass: 'orientation-only' })
    } catch (error) {
      failures.push({ viewport: name, error: String(error.message) })
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

const ok = failures.length === 0 && written.length === wanted.length
console.log(`${ok ? '✅' : '❌'} Capture ${ok ? 'complete' : 'failed'} — ${written.length}/${wanted.length} viewport(s)`)
console.log(JSON.stringify({ ok, target: captureTargetUrl, evidenceClass: 'orientation-only', written, failures }, null, 2))
process.exit(ok ? 0 : 3)
