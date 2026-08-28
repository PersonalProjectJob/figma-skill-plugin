/**
 * resolve.mjs — nguồn DUY NHẤT của logic dò năng lực E2E.
 *
 * Không phụ thuộc package ngoài (chỉ node built-in) để chạy được trong worktree
 * chưa `pnpm install`. Mọi hàm trả về dữ kiện đọc từ máy + path tuyệt đối; không
 * hàm nào đoán, không hàm nào tự cài gì.
 *
 * Dùng bởi: bin/e2e-probe.mjs, bin/e2e-provision.mjs, smoke.mjs, capture.mjs.
 */

import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir, platform } from 'node:os'
import { join, resolve as resolvePath, dirname, basename, isAbsolute } from 'node:path'
import { pathToFileURL } from 'node:url'

const IS_WIN = platform() === 'win32'
const IS_MAC = platform() === 'darwin'

/**
 * Sơ đồ biến tài khoản E2E — dò động, KHÔNG hardcode danh sách role.
 *
 * Hai dạng tên đều được nhận, dạng có môi trường thắng khi `E2E_TARGET` được đặt:
 *   E2E_<ROLE>_EMAIL            / E2E_<ROLE>_PASSWORD            (phẳng)
 *   E2E_<ENV>_<ROLE>_EMAIL      / E2E_<ENV>_<ROLE>_PASSWORD      (có môi trường)
 *
 * Nhờ dò động, thêm một role mới (manager, customer, cashier…) chỉ là thêm 2 dòng
 * vào `.env.local` — không phải sửa file nào trong kit.
 */
export const ENV_DIMENSIONS = ['DEV', 'STAGING', 'TEST', 'PROD', 'LOCAL']
const ACCOUNT_RE = /^E2E_(?:([A-Z0-9]+)_)?([A-Z0-9]+)_(EMAIL|PASSWORD)$/

/**
 * Biến KHÔNG phải secret nên được phép đọc GIÁ TRỊ ở đây (resolve.mjs mặc định
 * chỉ đọc tên). Whitelist tường minh để không có đường nào lọt giá trị mật khẩu.
 */
const NON_SECRET_RE = /^(E2E_TARGET|E2E_[A-Z0-9]*_?API_BASE|E2E_[A-Z0-9]*_?BASE_URL)$/

const RUNNER_NAMES = ['playwright', 'playwright-core', 'puppeteer', 'cypress']

// ---------------------------------------------------------------- host

/**
 * Dò host đang chạy.
 *
 * THỨ TỰ QUAN TRỌNG: xét Claude TRƯỚC Codex. Một phiên Claude Code có plugin
 * codex-companion vẫn mang `CODEX_COMPANION_SESSION_ID` trong env (đã quan sát
 * được trên máy này), nên xét Codex trước sẽ nhận diện sai.
 *
 * Antigravity không có env marker đáng tin ⇒ trả 'unknown' thay vì đoán.
 */
export function detectHost(explicit) {
  if (explicit) {
    const h = String(explicit).toLowerCase()
    const alias = { gemini: 'antigravity', antigravity: 'antigravity', codex: 'codex', claude: 'claude' }
    if (!alias[h]) throw new Error(`--host không hợp lệ: ${explicit} (codex|antigravity|claude)`)
    return { host: alias[h], evidence: ['--host truyền tay'] }
  }
  const e = process.env
  if (e.CLAUDECODE || e.CLAUDE_CODE_ENTRYPOINT) {
    return {
      host: 'claude',
      evidence: [e.CLAUDECODE ? 'CLAUDECODE' : 'CLAUDE_CODE_ENTRYPOINT'].map((k) => `env ${k} set`),
    }
  }
  const codexMarker = ['CODEX_SANDBOX', 'CODEX_SANDBOX_NETWORK_DISABLED', 'CODEX_HOME'].find((k) => e[k])
  if (codexMarker) return { host: 'codex', evidence: [`env ${codexMarker} set`] }
  return {
    host: 'unknown',
    evidence: ['không có env marker của claude/codex; Antigravity không phát env marker đáng tin'],
  }
}

// ------------------------------------------------------------ workspace

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/**
 * Phân loại workspace: 'repo' | 'worktree' | 'plain'.
 *
 * worktree nhận ra bằng `git-dir !== git-common-dir`. `mainRepo` suy ra từ
 * git-common-dir — nhờ vậy bậc 3 của ladder (node_modules repo gốc) không phải
 * hardcode path nào.
 */
export function classifyWorkspace(workspace) {
  const gitDir = git(['rev-parse', '--absolute-git-dir'], workspace)
  if (!gitDir) return { kind: 'plain', root: workspace, gitDir: null, commonDir: null, mainRepo: null }

  const commonDir = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], workspace) || gitDir
  const top = git(['rev-parse', '--show-toplevel'], workspace) || workspace
  const norm = (p) => (p ? p.replace(/\\/g, '/').replace(/\/+$/, '') : p)
  const isWorktree = norm(gitDir) !== norm(commonDir)
  // commonDir là `<mainRepo>/.git` (hoặc chính repo khi bare)
  const mainRepo = basename(commonDir) === '.git' ? dirname(commonDir) : null

  return {
    kind: isWorktree ? 'worktree' : 'repo',
    root: top,
    gitDir,
    commonDir,
    mainRepo: isWorktree ? mainRepo : top,
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], workspace),
  }
}

/**
 * Nơi ghi nhớ những root đã từng có runner.
 *
 * Vì sao cần: folder trần ngoài repo (prototype HTML rời, landing whitelabel)
 * không có node_modules ở đâu cả — mà đó lại đúng ca cần chụp evidence nhất.
 * Chạy skill một lần trong repo thật là mọi folder trần sau đó dùng lại được.
 */
export function knownRootsFile() {
  return join(homedir(), '.e2e-setup', 'known-roots.json')
}

export function readKnownRoots() {
  try {
    const raw = JSON.parse(readFileSync(knownRootsFile(), 'utf8'))
    return (Array.isArray(raw) ? raw : []).filter((p) => typeof p === 'string' && existsSync(join(p, 'node_modules')))
  } catch {
    return []
  }
}

/** Ghi nhớ root vừa dùng được (giữ 5 cái gần nhất). Lỗi ghi thì bỏ qua, không phá lượt chạy. */
export function rememberRoot(root) {
  if (!root || !existsSync(join(root, 'node_modules'))) return
  try {
    const next = [root, ...readKnownRoots().filter((p) => p !== root)].slice(0, 5)
    mkdirSync(dirname(knownRootsFile()), { recursive: true })
    writeFileSync(knownRootsFile(), JSON.stringify(next, null, 2))
  } catch {
    /* ghi nhớ là tiện nghi, không phải điều kiện đúng đắn */
  }
}

/** Đi ngược cây thư mục tìm node_modules (monorepo, hoặc folder nằm trong một project khác). */
function upwardRoots(start, limit = 6) {
  const roots = []
  let dir = start
  for (let i = 0; i < limit; i++) {
    const parent = dirname(dir)
    if (!parent || parent === dir) break
    dir = parent
    if (existsSync(join(dir, 'node_modules'))) roots.push(dir)
  }
  return roots
}

/** npm global root — bậc cuối, chỉ gọi khi các bậc trên đã trượt (execFileSync ~300ms). */
function npmGlobalModules() {
  try {
    const out = execFileSync(IS_WIN ? 'npm.cmd' : 'npm', ['root', '-g'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return out && existsSync(out) ? out : null
  } catch {
    return null
  }
}

/**
 * Nguồn dự phòng để mượn node_modules / capture script, theo thứ tự tin cậy:
 * repo gốc của worktree → E2E_FALLBACK_REPO → đi ngược cây → root đã ghi nhớ.
 */
export function fallbackRoots(ws) {
  const roots = []
  const push = (p) => {
    const t = p && String(p).trim()
    if (t && t !== ws.root && existsSync(t) && !roots.includes(t)) roots.push(t)
  }
  if (ws.mainRepo) push(ws.mainRepo)
  for (const p of (process.env.E2E_FALLBACK_REPO || '').split(/[;,]/)) push(p)
  upwardRoots(ws.root).forEach(push)
  readKnownRoots().forEach(push)
  return roots
}

// --------------------------------------------------------------- runner

/**
 * Bậc 2 + 3: tìm runner trong workspace, rồi trong các root dự phòng theo path
 * tuyệt đối, rồi cuối cùng là npm global.
 *
 * Thứ tự quét = thứ tự tin cậy; hàm dừng ở hit đầu tiên nhưng vẫn trả về toàn bộ
 * `rungs` để báo cáo in được từng bậc đã thử (BLOCKED phải kèm bằng chứng).
 */
export function findRunner(workspace, extraRoots = []) {
  const rungs = []
  const scan = (modules, label, root) => {
    const rung = { root: root ?? null, label, modules, exists: existsSync(modules), found: [] }
    if (rung.exists) {
      for (const name of RUNNER_NAMES) {
        const dir = join(modules, name)
        const pkg = join(dir, 'package.json')
        if (!existsSync(pkg)) continue
        let version = null
        try {
          version = JSON.parse(readFileSync(pkg, 'utf8')).version
        } catch {
          /* package.json hỏng — vẫn ghi nhận là có, version null */
        }
        rung.found.push({ name, dir, version })
      }
    }
    rungs.push(rung)
    return rung
  }

  scan(join(workspace, 'node_modules'), 'workspace', workspace)
  for (const root of extraRoots) scan(join(root, 'node_modules'), 'dự phòng', root)

  const pick = () => {
    for (const rung of rungs) {
      for (const name of RUNNER_NAMES) {
        const hit = rung.found.find((f) => f.name === name)
        if (hit) return { runner: { ...hit, borrowedFrom: rung.root === workspace ? null : rung.root ?? rung.label }, rungs }
      }
    }
    return null
  }

  const early = pick()
  if (early) return early

  const global = npmGlobalModules()
  if (global) scan(global, 'npm global', null)
  return pick() || { runner: null, rungs }
}

/** Import chromium từ runner đã resolve (playwright-core expose cả index.mjs và index.js). */
export async function loadChromium(runner) {
  if (!runner) throw new Error('Không có runner để load chromium')
  const entry = ['index.mjs', 'index.js'].map((f) => join(runner.dir, f)).find((f) => existsSync(f))
  if (!entry) throw new Error(`Không tìm thấy entry của ${runner.name} trong ${runner.dir}`)
  const mod = await import(pathToFileURL(entry).href)
  const chromium = mod.chromium || mod.default?.chromium
  if (!chromium) throw new Error(`${runner.name} không expose chromium`)
  return chromium
}

// -------------------------------------------------------------- browser

function browserCacheRoots() {
  const roots = []
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0') {
    roots.push(process.env.PLAYWRIGHT_BROWSERS_PATH)
  }
  if (IS_WIN) {
    const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    roots.push(join(local, 'ms-playwright'))
  } else if (IS_MAC) {
    roots.push(join(homedir(), 'Library', 'Caches', 'ms-playwright'))
  } else {
    roots.push(join(homedir(), '.cache', 'ms-playwright'))
  }
  return roots.filter((r) => existsSync(r))
}

const EXE_BASENAMES = IS_WIN
  ? ['chrome-headless-shell.exe', 'chrome.exe', 'headless_shell.exe']
  : ['chrome-headless-shell', 'chrome', 'headless_shell', 'Chromium', 'Google Chrome']

/** Quét sâu tối đa 4 cấp tìm executable — không hardcode tên thư mục arch. */
function findExeUnder(dir, depth = 4) {
  if (depth < 0 || !existsSync(dir)) return null
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return null
  }
  for (const ent of entries) {
    const full = join(dir, ent.name)
    if (ent.isFile() && EXE_BASENAMES.includes(ent.name)) return full
    if (IS_MAC && ent.isDirectory() && ent.name.endsWith('.app')) {
      const inner = findExeUnder(join(full, 'Contents', 'MacOS'), 1)
      if (inner) return inner
    }
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue
    const hit = findExeUnder(join(dir, ent.name), depth - 1)
    if (hit) return hit
  }
  return null
}

const CHANNEL_CANDIDATES = () => {
  if (IS_WIN) {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files'
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    return [
      { kind: 'channel-chrome', path: join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe') },
      { kind: 'channel-chrome', path: join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe') },
      { kind: 'channel-edge', path: join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
      { kind: 'channel-edge', path: join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe') },
    ]
  }
  if (IS_MAC) {
    return [
      { kind: 'channel-chrome', path: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' },
      { kind: 'channel-edge', path: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge' },
    ]
  }
  return [
    { kind: 'channel-chrome', path: '/usr/bin/google-chrome' },
    { kind: 'channel-chrome', path: '/usr/bin/chromium' },
    { kind: 'channel-chrome', path: '/usr/bin/chromium-browser' },
  ]
}

/**
 * Bậc 4 + 5: browser binary. Ưu tiên chromium_headless_shell (rev cao nhất) →
 * chromium → channel Chrome/Edge đã cài.
 *
 * headless shell KHÔNG chạy được headed ⇒ trả supportsHeaded để bên gọi biết.
 */
export function findBrowser() {
  const rungs = []

  const forced = process.env.E2E_BROWSER_EXECUTABLE
  if (forced) {
    const ok = existsSync(forced)
    rungs.push({ rung: 'env E2E_BROWSER_EXECUTABLE', path: forced, exists: ok })
    if (ok) return { browser: { kind: 'forced', executablePath: forced, supportsHeaded: true }, rungs }
  }

  for (const root of browserCacheRoots()) {
    let dirs = []
    try {
      dirs = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    } catch {
      /* không đọc được cache root */
    }
    const pick = (re) =>
      dirs
        .map((n) => ({ n, m: re.exec(n) }))
        .filter((x) => x.m)
        .sort((a, b) => Number(b.m[1]) - Number(a.m[1]))
    const groups = [
      { kind: 'headless-shell', supportsHeaded: false, list: pick(/^chromium_headless_shell-(\d+)$/) },
      { kind: 'chromium', supportsHeaded: true, list: pick(/^chromium-(\d+)$/) },
    ]
    rungs.push({ rung: 'cache máy', path: root, exists: true, dirs })
    for (const g of groups) {
      for (const cand of g.list) {
        const exe = findExeUnder(join(root, cand.n))
        if (exe) {
          return {
            browser: { kind: g.kind, executablePath: exe, rev: Number(cand.m[1]), supportsHeaded: g.supportsHeaded },
            rungs,
          }
        }
      }
    }
  }

  for (const cand of CHANNEL_CANDIDATES()) {
    const ok = existsSync(cand.path)
    rungs.push({ rung: 'channel đã cài', path: cand.path, exists: ok })
    if (ok) return { browser: { kind: cand.kind, executablePath: cand.path, supportsHeaded: true }, rungs }
  }

  return { browser: null, rungs }
}

// --------------------------------------------------------------- capture

/** Bậc 1: script chụp của repo (naming convention đã đúng sẵn — ưu tiên uỷ quyền). */
export function findCaptureScript(workspace, extraRoots = []) {
  const rungs = []
  const candidates = []
  if (process.env.E2E_CAPTURE_SCRIPT) candidates.push(process.env.E2E_CAPTURE_SCRIPT)
  for (const root of [workspace, ...extraRoots]) candidates.push(join(root, 'scripts', 'capture-evidence.mjs'))
  for (const p of candidates) {
    const ok = existsSync(p)
    if (!ok) {
      rungs.push({ path: p, exists: false, syntaxOk: null })
      continue
    }
    let syntaxOk = true
    let syntaxError = null
    try {
      execFileSync(process.execPath, ['--check', p], { encoding: 'utf8', stdio: 'pipe' })
    } catch (error) {
      syntaxOk = false
      syntaxError = String(error.stderr || error.message).split('\n').slice(0, 4).join(' ')
    }
    rungs.push({ path: p, exists: true, syntaxOk, syntaxError })
    if (syntaxOk) return { captureScript: p, rungs }
  }
  return { captureScript: null, rungs }
}

// --------------------------------------------------------------- secrets

/** Đọc TÊN biến từ .env.local — KHÔNG bao giờ trả giá trị. */
function envNamesInFile(file) {
  if (!existsSync(file)) return null
  try {
    return readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((l) => /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(l))
      .filter(Boolean)
      .map((m) => m[1])
  } catch {
    return null
  }
}

/** Đọc giá trị của các biến trong whitelist NON_SECRET_RE. Không đọc gì khác. */
function nonSecretValues(file) {
  const out = {}
  if (!existsSync(file)) return out
  try {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
      if (m && NON_SECRET_RE.test(m[1])) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* không đọc được thì coi như không có */
  }
  return out
}

/**
 * Kiểm kê tài khoản automation. Trả về TÊN biến + trạng thái, không bao giờ giá trị
 * (trừ whitelist non-secret: E2E_TARGET, base URL, api base).
 */
export function findSecrets(workspace, extraRoots = [], envOverride = null) {
  const files = [workspace, ...extraRoots].map((r) => join(r, '.env.local'))
  const sources = []
  const seen = new Set(Object.keys(process.env).filter((k) => k.startsWith('E2E_')))
  if (seen.size) sources.push({ from: 'process.env', names: [...seen].sort() })
  for (const file of files) {
    const names = envNamesInFile(file)
    if (!names) continue
    const relevant = names.filter((n) => n.startsWith('E2E_'))
    sources.push({ from: file, names: relevant.sort() })
    relevant.forEach((n) => seen.add(n))
  }

  const nonSecret = Object.assign({}, ...files.reverse().map(nonSecretValues))
  for (const k of Object.keys(process.env)) if (NON_SECRET_RE.test(k)) nonSecret[k] = process.env[k]
  // --env <name> thắng E2E_TARGET trong file; không có cả hai thì null.
  const envTarget = String(envOverride || nonSecret.E2E_TARGET || '').toUpperCase() || null

  // gom theo (dimension, role)
  const buckets = new Map()
  for (const name of seen) {
    const m = ACCOUNT_RE.exec(name)
    if (!m) continue
    const [, maybeDim, maybeRole, field] = m
    // "E2E_OWNER_EMAIL": maybeDim=undefined, role=OWNER.
    // "E2E_DEV_OWNER_EMAIL": maybeDim=DEV, role=OWNER — nhưng chỉ khi DEV là dimension đã biết,
    // nếu không thì đó là role hai từ và ta coi cả cụm là role.
    const isDim = maybeDim && ENV_DIMENSIONS.includes(maybeDim)
    const dim = isDim ? maybeDim : null
    const role = isDim ? maybeRole : [maybeDim, maybeRole].filter(Boolean).join('_')
    const key = `${dim || ''}|${role}`
    if (!buckets.has(key)) buckets.set(key, { dimension: dim, role, email: false, password: false })
    buckets.get(key)[field.toLowerCase()] = true
  }

  const accounts = [...buckets.values()]
    .map((b) => ({
      ...b,
      names: [
        `E2E_${b.dimension ? b.dimension + '_' : ''}${b.role}_EMAIL`,
        `E2E_${b.dimension ? b.dimension + '_' : ''}${b.role}_PASSWORD`,
      ],
      complete: b.email && b.password,
      // dùng được cho `--role <role>` ngay bây giờ hay không
      activeForTarget: b.dimension === null || b.dimension === envTarget,
    }))
    .sort((a, b) => (a.role + (a.dimension || '')).localeCompare(b.role + (b.dimension || '')))

  const usableRoles = [...new Set(accounts.filter((a) => a.complete && a.activeForTarget).map((a) => a.role.toLowerCase()))]
  const orphans = accounts.filter((a) => a.complete && !a.activeForTarget)
  const halfDone = accounts.filter((a) => !a.complete)

  return {
    envTarget,
    baseUrlVar: envTarget ? `E2E_${envTarget}_BASE_URL` : null,
    baseUrlFromEnv: envTarget ? nonSecret[`E2E_${envTarget}_BASE_URL`] || null : null,
    // API base theo môi trường, rơi về biến phẳng khi chưa khai riêng.
    apiBase: (envTarget && nonSecret[`E2E_${envTarget}_API_BASE`]) || nonSecret.E2E_API_BASE || null,
    apiBaseVar: envTarget && nonSecret[`E2E_${envTarget}_API_BASE`] ? `E2E_${envTarget}_API_BASE` : nonSecret.E2E_API_BASE ? 'E2E_API_BASE' : null,
    apiBaseIsEnvSpecific: Boolean(envTarget && nonSecret[`E2E_${envTarget}_API_BASE`]),
    accounts,
    usableRoles,
    orphans,
    halfDone,
    sources,
    // giữ hai khoá cũ để chỗ gọi cũ không vỡ
    present: accounts.filter((a) => a.complete).flatMap((a) => a.names),
    missing: halfDone.flatMap((a) => a.names.filter((_, i) => !(i === 0 ? a.email : a.password))),
  }
}

// ---------------------------------------------------------------- target

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function devPort(workspace) {
  for (const name of ['vite.config.ts', 'vite.config.js', 'vite.config.mts']) {
    const file = join(workspace, name)
    if (!existsSync(file)) continue
    try {
      const m = /server\s*:\s*\{[^}]*?\bport\s*:\s*(\d{2,5})/s.exec(readFileSync(file, 'utf8'))
      if (m) return Number(m[1])
    } catch {
      /* đọc được hay không thì vẫn có fallback */
    }
  }
  return 3000
}

/**
 * Lệnh khởi động dev server ĐÚNG môi trường.
 *
 * Repo này định nghĩa môi trường bằng *vite mode*, không bằng URL deploy riêng:
 * `pnpm dev` (mode development) trỏ test-api, `pnpm dev:staging` trỏ staging-api,
 * cả hai cùng chạy localhost. Nên chạy sai script = app nói chuyện với API sai
 * trong khi URL nhìn y hệt. Đây là lỗi không thể nhìn ra từ ảnh chụp.
 */
export function devCommandForEnv(workspace, envTarget) {
  const pkg = readJson(join(workspace, 'package.json'))
  if (!pkg?.scripts) return null
  const wanted = envTarget ? `dev:${envTarget.toLowerCase()}` : null
  if (wanted && pkg.scripts[wanted]) return { script: wanted, command: `pnpm ${wanted}`, exact: true }
  if (pkg.scripts.dev) {
    return {
      script: 'dev',
      command: 'pnpm dev',
      // không có script riêng cho môi trường này ⇒ `pnpm dev` có thể trỏ API khác
      exact: !envTarget || envTarget === 'DEV' || envTarget === 'LOCAL',
    }
  }
  return null
}

/** Phân loại target: url | file | dev. */
export function classifyTarget(spec, workspace, envTarget = null) {
  if (spec && /^https?:\/\//i.test(spec)) {
    // URL localhost CHINH LA dev server => van phai do port va van phai nhac dung
    // lenh khoi dong theo moi truong. Repo nay dat E2E_<ENV>_BASE_URL = localhost
    // (moi truong phan biet bang vite mode, khong bang host), nen coi no la 'url'
    // se lam mat canh bao "phai chay pnpm dev:staging".
    let host = null
    let port = null
    try {
      const u = new URL(spec)
      host = u.hostname
      port = u.port ? Number(u.port) : u.protocol === 'https:' ? 443 : 80
    } catch {
      /* URL hong thi de nguyen duong url ben duoi */
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      const dev = devCommandForEnv(workspace, envTarget)
      return {
        kind: 'dev',
        url: spec.replace(/\/$/, ''),
        port,
        portCandidates: [...new Set([port, 3000, 3001, 3002, 5173, 5174].filter(Boolean))],
        devCommand: dev?.command || null,
        devCommandExact: dev ? dev.exact : null,
        fromLocalhostUrl: true,
      }
    }
    return { kind: 'url', url: spec }
  }

  if (spec && spec !== 'dev' && /\.html?$/i.test(spec)) {
    const abs = isAbsolute(spec) ? spec : resolvePath(workspace, spec)
    if (!existsSync(abs)) return { kind: 'file', url: null, path: abs, error: 'file không tồn tại' }
    return { kind: 'file', url: pathToFileURL(abs).href, path: abs }
  }

  const pkg = readJson(join(workspace, 'package.json'))
  const dev = devCommandForEnv(workspace, envTarget)
  const port = devPort(workspace)
  // Cùng danh sách port mà scripts/capture-evidence.mjs dò — dev server hay bị
  // vite đẩy sang port kế khi 3000 đã bận, và khi đó target cứng ở 3000 là sai.
  const candidates = [...new Set([port, 3000, 3001, 3002, 5173, 5174])]
  return {
    kind: 'dev',
    url: `http://localhost:${port}`,
    port,
    portCandidates: candidates,
    devCommand: dev?.command || null,
    devCommandExact: dev ? dev.exact : null,
    hasPackageJson: Boolean(pkg),
    // true CHỈ khi không có --target lẫn không có cấu hình .env.local nào cả —
    // tức "dev" này là suy ra do KHÔNG có gì khác, không phải user/agent chọn
    // dev một cách có ý thức (truyền --target dev rõ ràng thì spec !== falsy,
    // implicitDefault = false). Dùng để cảnh báo probe/provision: nếu yêu cầu
    // gốc của user mơ hồ (chỉ nói "chụp hình"/"chạy e2e"), agent phải HỎI
    // trước khi tin vào target này — xem SKILL.md mục "Chưa biết chụp ở đâu".
    implicitDefault: !spec,
  }
}

/**
 * Dò port nào đang thật sự phục vụ app (chỉ cho target kind 'dev').
 * Trả về { url, port, checked } — url null nghĩa là không port nào phản hồi.
 */
export async function resolveDevUrl(target, { timeoutMs = 1500 } = {}) {
  if (target.kind !== 'dev') return { url: target.url, port: target.port ?? null, checked: [] }
  const checked = []
  for (const port of target.portCandidates || [target.port]) {
    const url = `http://localhost:${port}`
    try {
      const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(timeoutMs) })
      const body = res.ok ? await res.text() : ''
      const looksLikeApp = body.includes('id="root"') || body.includes('/@vite/client')
      checked.push({ port, status: res.status, looksLikeApp })
      if (res.ok && looksLikeApp) return { url, port, checked }
    } catch (err) {
      checked.push({ port, error: err.name === 'TimeoutError' ? 'timeout' : 'không kết nối được' })
    }
  }
  return { url: null, port: null, checked }
}

// ------------------------------------------------------------ aggregate

/**
 * Gom toàn bộ dò thành một object. `capable` = có đủ runner + browser để chạy
 * smoke; verdict READY chỉ được cấp SAU khi smoke exit 0 (xem e2e-provision).
 */
export function resolveEnvironment({ workspace = process.cwd(), host, target, env: envOverride } = {}) {
  const ws = classifyWorkspace(resolvePath(workspace))
  const extraRoots = fallbackRoots(ws)
  const hostInfo = detectHost(host)
  const { runner, rungs: runnerRungs } = findRunner(ws.root, extraRoots)
  const { browser, rungs: browserRungs } = findBrowser()
  const { captureScript, rungs: captureRungs } = findCaptureScript(ws.root, extraRoots)
  const secrets = findSecrets(ws.root, extraRoots, envOverride)

  // Không truyền --target mà .env.local đã khai E2E_TARGET + E2E_<ENV>_BASE_URL
  // ⇒ dùng luôn, để file cấu hình của repo là nguồn sự thật chứ không phải cờ dòng lệnh.
  const effectiveTarget = target || secrets.baseUrlFromEnv || undefined

  return {
    at: new Date().toISOString(),
    host: hostInfo.host,
    hostEvidence: hostInfo.evidence,
    workspace: ws,
    fallbackRoots: extraRoots,
    target: {
      ...classifyTarget(effectiveTarget, ws.root, secrets.envTarget),
      fromEnvTarget: !target && Boolean(secrets.baseUrlFromEnv),
      implicitDefault: !target && !Boolean(secrets.baseUrlFromEnv),
    },
    runner,
    browser,
    captureScript,
    secrets,
    ladder: {
      '1-repo-capture-script': captureRungs,
      '2-3-node_modules': runnerRungs,
      '4-5-browser': browserRungs,
    },
    capable: Boolean(runner && browser),
  }
}

/** stat an toàn, dùng cho "số trong báo cáo phải khớp đĩa". */
export function fileBytes(file) {
  try {
    return statSync(file).size
  } catch {
    return null
  }
}
