/**
 * readiness.mjs — cổng sẵn sàng dùng chung trước khi chụp evidence.
 *
 * Chỉ ĐỌC trạng thái trang. Không sửa DOM/CSS, không inject state. `networkidle`
 * có thể không đạt trên trang dùng long-polling/RUM; trường hợp đó được ghi rõ
 * thay vì bị catch rồi biến mất. Flow có expectation nghiệp vụ riêng nên có thể
 * tiếp tục khi networkidle timeout, nhưng loader/font/image vẫn là blocker.
 */

export const LOADER_SELECTORS = [
  '.animate-spin',
  'svg.animate-spin',
  '[role="progressbar"]',
  '.skeleton',
  '[aria-busy="true"]',
  '[data-loading="true"]',
]

async function visibleMatches(page, selectors) {
  const visible = []
  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    let visibleCount = 0
    for (let i = 0; i < count; i++) {
      if (await locator.nth(i).isVisible().catch(() => false)) visibleCount++
    }
    if (visibleCount) visible.push({ selector, visibleCount })
  }
  return visible
}

async function waitForVisibleLoadersToClear(page, selectors, timeout) {
  const deadline = Date.now() + timeout
  let visible = await visibleMatches(page, selectors)
  while (visible.length && Date.now() < deadline) {
    await page.waitForTimeout(100)
    visible = await visibleMatches(page, selectors)
  }
  return visible
}

async function waitForImages(page, timeout) {
  const deadline = Date.now() + timeout
  let pending = []
  do {
    const images = page.locator('img:visible')
    const count = await images.count()
    pending = []
    for (let i = 0; i < count; i++) {
      const state = await images
        .nth(i)
        .evaluate((img) => ({ complete: img.complete, naturalWidth: img.naturalWidth, src: img.currentSrc || img.src }))
        .catch(() => ({ complete: true, naturalWidth: 1, src: '(detached)' }))
      if (!state.complete || state.naturalWidth === 0) pending.push(String(state.src).slice(0, 240))
    }
    if (!pending.length || Date.now() >= deadline) break
    await page.waitForTimeout(100)
  } while (true)
  return pending
}

/**
 * @param {import('playwright-core').Page} page
 * @param {{timeout?:number, settleMs?:number, readySelector?:string|null, requireNetworkIdle?:boolean}} options
 */
export async function waitForReadiness(page, options = {}) {
  const timeout = Math.max(500, Number(options.timeout || 10000))
  const settleMs = Math.max(0, Math.min(Number(options.settleMs || 300), 3000))
  const started = Date.now()
  const blockers = []

  const networkIdle = { ok: true, timeoutMs: timeout, error: null }
  try {
    await page.waitForLoadState('networkidle', { timeout })
  } catch (error) {
    networkIdle.ok = false
    networkIdle.error = String(error.message).split('\n')[0]
    if (options.requireNetworkIdle) blockers.push('networkidle timeout')
  }

  let readySelector = null
  if (options.readySelector) {
    readySelector = { selector: String(options.readySelector), visible: false, error: null }
    try {
      await page.locator(readySelector.selector).first().waitFor({ state: 'visible', timeout })
      readySelector.visible = true
    } catch (error) {
      readySelector.error = String(error.message).split('\n')[0]
      blockers.push(`ready selector chưa visible: ${readySelector.selector}`)
    }
  }

  const visibleLoaders = await waitForVisibleLoadersToClear(page, LOADER_SELECTORS, timeout)
  if (visibleLoaders.length) blockers.push(`loader còn visible: ${visibleLoaders.map((x) => x.selector).join(', ')}`)

  const fonts = { ok: true, error: null }
  try {
    await page.evaluate(() => document.fonts?.ready || Promise.resolve())
  } catch (error) {
    fonts.ok = false
    fonts.error = String(error.message).split('\n')[0]
    blockers.push('font settling thất bại')
  }

  const pendingImages = await waitForImages(page, timeout)
  if (pendingImages.length) blockers.push(`${pendingImages.length} image chưa tải xong`)

  if (settleMs) await page.waitForTimeout(settleMs)

  return {
    ok: blockers.length === 0,
    blockers,
    networkIdle,
    readySelector,
    visibleLoaders,
    fonts,
    images: { pendingCount: pendingImages.length, pending: pendingImages.slice(0, 10) },
    elapsedMs: Date.now() - started,
  }
}
