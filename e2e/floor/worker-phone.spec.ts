import type { Page, Route } from '@playwright/test'
import { FE_ORIGIN, OUTSIDE_IP } from './env'
import { expect, test, type Backend, type Worker } from './fixtures'


/**
 * Bài thử ĐIỆN THOẠI công nhân (QR tại máy). Cách chạy + dựng môi trường: xem đầu playwright.floor.config.ts.
 * Mỗi bài dùng công nhân riêng (tạo bằng API) và một IP điện thoại riêng, nên không ăn hạn mức đăng nhập của nhau.
 */

// ─── thao tác giao diện ──────────────────────────────────────────────────────

const H = {
  username: 'Đăng nhập để báo sản lượng',
  pin: 'Nhập PIN để đăng nhập',
  setup: 'Đặt PIN lần đầu',
}

async function openMachine(page: Page, backend: Backend) {
  await page.goto(`/floor?ws=${backend.machines.cut.qrToken}`)
}

async function enterUsername(page: Page, username: string) {
  await expect(page.getByRole('heading', { name: H.username })).toBeVisible()
  await page.getByLabel('Tên đăng nhập').fill(username)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
}

async function signInWithPin(page: Page, w: Worker) {
  await enterUsername(page, w.username)
  await expect(page.getByRole('heading', { name: H.pin })).toBeVisible()
  await page.getByLabel('PIN (6 số)').fill(w.pin)
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
}

async function signInFirstTime(page: Page, w: Worker) {
  await enterUsername(page, w.username)
  await expect(page.getByRole('heading', { name: H.setup })).toBeVisible()
  await page.getByLabel('PIN mới (6 số)').fill(w.pin)
  await page.getByLabel('Nhập lại PIN để xác nhận').fill(w.pin)
  await page.getByRole('button', { name: 'Lưu PIN và đăng nhập' }).click()
}

const cutScreen = (page: Page) => page.getByRole('heading', { name: 'Báo cắt' })
const qtyInputs = (page: Page) => page.getByLabel(/^Số đoạn \d+mm$/)

/** Nhập 2 + 1 đoạn vào 2 cỡ đầu tiên (tổng 3), chưa bấm Lưu. */
async function fillThree(page: Page) {
  await expect(qtyInputs(page).first()).toBeVisible()
  await qtyInputs(page).nth(0).fill('2')
  await qtyInputs(page).nth(1).fill('1')
}
const saveButton = (page: Page) => page.getByRole('button', { name: 'Lưu 3 đoạn', exact: true })
const confirmDialog = (page: Page) => page.getByRole('dialog', { name: 'Xác nhận báo cắt' })
const confirmButton = (page: Page) => confirmDialog(page).getByRole('button', { name: 'Đúng, lưu 3 đoạn' })
const savedBanner = (page: Page) => page.getByText(/^Đã lưu .*đoạn/)

async function signedInOnCut(page: Page, backend: Backend, w: Worker) {
  await openMachine(page, backend)
  await signInWithPin(page, w)
  await expect(cutScreen(page)).toBeVisible()
}

/** Chặn lần gửi báo đầu tiên bằng `handler`; lần sau chạy thật. CORS: trả lời OPTIONS (preflight) bằng BE thật. */
async function interceptReport(page: Page, handler: (route: Route) => Promise<void>) {
  let first = true
  await page.route('**/floor/scan/*/reports', async (route) => {
    if (route.request().method() !== 'POST' || !first) return route.fallback()
    first = false
    await handler(route)
  })
}
const corsHeaders = { 'access-control-allow-origin': FE_ORIGIN, 'access-control-allow-credentials': 'true' }

// ─── đăng nhập ───────────────────────────────────────────────────────────────

test.describe('Đăng nhập trên điện thoại', () => {
  test('lần đầu: quét link → đặt PIN → vào thẳng màn báo cắt', async ({ page, backend }, testInfo) => {
    const w = await backend.createWorker('PHOI', { withPin: false })
    const t0 = Date.now()
    await openMachine(page, backend)
    await expect(page.getByRole('heading', { name: H.username })).toBeVisible()
    const loadMs = Date.now() - t0
    testInfo.annotations.push({ type: 'tải màn đăng nhập', description: `${loadMs} ms` })
    expect(loadMs, 'màn đăng nhập hiện chậm').toBeLessThan(testInfo.project.metadata?.weak ? 25_000 : 10_000)

    await signInFirstTime(page, w)
    await expect(cutScreen(page)).toBeVisible()
    await expect(page.getByText(/LASER-01/)).toBeVisible()
    await testInfo.attach('man-bao-cat', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('lần sau: nhập PIN, mở lại link vẫn còn đăng nhập, sai PIN báo rõ', async ({ page, backend }) => {
    const w = await backend.createWorker('PHOI')
    await openMachine(page, backend)
    await enterUsername(page, w.username)
    await page.getByLabel('PIN (6 số)').fill('111111')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.getByText(/Sai tên đăng nhập hoặc PIN|còn \d+ lần/)).toBeVisible()
    await page.getByLabel('PIN (6 số)').fill(w.pin)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(cutScreen(page)).toBeVisible()

    await page.reload() // công nhân quét lại tem / mở lại tab
    await expect(cutScreen(page)).toBeVisible()
  })

  test('nhập sai PIN 5 lần: khoá tạm, kể cả khi sau đó nhập đúng PIN', async ({ page, backend }) => {
    const w = await backend.createWorker('PHOI')
    await openMachine(page, backend)
    await enterUsername(page, w.username)
    let locked = false
    for (let i = 0; i < 6 && !locked; i++) {
      await page.getByLabel('PIN (6 số)').fill('111111')
      await page.getByRole('button', { name: 'Đăng nhập' }).click()
      await expect(page.getByRole('alert').or(page.getByText(/Sai tên đăng nhập|còn \d+ lần|khoá|khóa/)).first()).toBeVisible()
      locked = await page.getByText(/khoá|khóa/i).first().isVisible().catch(() => false)
    }
    expect(locked, 'sau 5 lần sai phải báo khoá tạm').toBe(true)
    await page.getByLabel('PIN (6 số)').fill(w.pin)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page.getByText(/khoá|khóa/i).first()).toBeVisible()
    await expect(cutScreen(page)).toBeHidden()
  })

  test.describe('ngoài mạng công ty', () => {
    test.use({ clientIp: OUTSIDE_IP })
    test('đăng nhập bị chặn và nói rõ phải nối Wi-Fi công ty', async ({ page, backend }) => {
      const w = await backend.createWorker('PHOI')
      await openMachine(page, backend)
      await enterUsername(page, w.username)
      await page.getByLabel('PIN (6 số)').fill(w.pin)
      await page.getByRole('button', { name: 'Đăng nhập' }).click()
      await expect(page.getByText(/Wi-Fi.*công ty/)).toBeVisible()
      await expect(cutScreen(page)).toBeHidden()
    })
  })

  test('phiên hết hạn giữa ca: công nhân phải thấy lại màn PIN của chính máy này (LỖ HỔNG ĐÃ BIẾT - chưa làm)', async ({ page, backend }) => {
    // Hiện tại http.ts phát SESSION_EXPIRED → AuthContext `router.replace('/login')` = trang đăng nhập CỦA ERP (tên + mật khẩu), công nhân không biết
    // làm gì (phải quét lại tem). Bài này khẳng định hành vi MONG MUỐN nên đang được đánh dấu "dự kiến hỏng": khi sửa xong (changelog mục 31, GĐ2)
    // Playwright sẽ báo "dự kiến hỏng mà lại qua" → gỡ dòng test.fail bên dưới.
    test.fail(true, 'phiên hết hạn đưa công nhân sang /login của ERP thay vì màn PIN /floor')
    const w = await backend.createWorker('PHOI')
    await signedInOnCut(page, backend, w)
    await page.evaluate(() => { localStorage.setItem('access_token', 'het.han.roi'); localStorage.setItem('refresh_token', 'hong') })
    const refresh = page.waitForResponse((r) => r.url().includes('/auth/refresh'))
    await page.getByRole('tab', { name: 'Sản lượng của tôi' }).click()
    await refresh
    // Chờ đủ để AuthContext chạy xong điều hướng: kiểm sớm hơn sẽ đọc URL TRƯỚC khi trang bị chuyển đi (đã gặp: iPhone/Android yếu "qua" nhầm).
    await page.waitForTimeout(2500)
    await expect(page).toHaveURL(/\/floor\?ws=/)
    await expect(page.getByRole('heading', { name: H.pin }).or(page.getByRole('heading', { name: H.username }))).toBeVisible()
  })

  test('trình duyệt không có crypto.randomUUID (http://IP) vẫn đăng nhập và lưu được', async ({ page, backend }) => {
    await page.addInitScript(() => { delete (Crypto.prototype as { randomUUID?: unknown }).randomUUID })
    const w = await backend.createWorker('PHOI')
    const since = Date.now()
    await signedInOnCut(page, backend, w)
    expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('undefined')
    await fillThree(page)
    await saveButton(page).click()
    await confirmButton(page).click()
    await expect(savedBanner(page)).toBeVisible()
    expect(await backend.outputs(w, since)).toHaveLength(1)
  })
})

// ─── báo sản lượng ───────────────────────────────────────────────────────────

test.describe('Báo cắt trên điện thoại', () => {
  test('nhập số → Lưu → bảng xác nhận → đã lưu; số vào "Sản lượng của tôi" và sổ BE', async ({ page, backend }, testInfo) => {
    const w = await backend.createWorker('PHOI')
    const since = Date.now()
    await signedInOnCut(page, backend, w)
    await fillThree(page)
    await saveButton(page).click()
    await expect(confirmDialog(page)).toBeVisible()
    await expect(confirmDialog(page)).toContainText('Tổng 3 đoạn')
    await testInfo.attach('bang-xac-nhan', { body: await page.screenshot(), contentType: 'image/png' })
    await confirmButton(page).click()
    await expect(savedBanner(page)).toBeVisible()
    await expect(qtyInputs(page).first()).toHaveValue('') // ô nhập được xoá sau khi lưu

    await page.getByRole('tab', { name: 'Sản lượng của tôi' }).click()
    await expect(page.getByText('Chưa gửi KCS').first()).toBeVisible()

    const rows = await backend.outputs(w, since)
    expect(rows).toHaveLength(1)
    expect(rows[0].lines.reduce((s, l) => s + l.qty, 0)).toBe(3)
  })

  test('bấm "Sửa lại" ở bảng xác nhận: không ghi gì, số còn nguyên', async ({ page, backend }) => {
    const w = await backend.createWorker('PHOI')
    const since = Date.now()
    await signedInOnCut(page, backend, w)
    await fillThree(page)
    await saveButton(page).click()
    await confirmDialog(page).getByRole('button', { name: 'Sửa lại' }).click()
    await expect(confirmDialog(page)).toBeHidden()
    await expect(qtyInputs(page).nth(0)).toHaveValue('2')
    expect(await backend.outputs(w, since)).toHaveLength(0)
  })

  test('mất mạng lúc xác nhận: báo rõ, số còn nguyên; có mạng lại bấm lưu → ghi đúng 1 lần', async ({ page, backend, phoneNet }) => {
    const w = await backend.createWorker('PHOI')
    const since = Date.now()
    await signedInOnCut(page, backend, w)
    await fillThree(page)
    await saveButton(page).click()
    await phoneNet.setOffline(true)
    await confirmButton(page).click()
    await expect(page.getByText(/mất kết nối/)).toBeVisible()
    await expect(qtyInputs(page).nth(0)).toHaveValue('2')
    await phoneNet.setOffline(false)
    await saveButton(page).click()
    await confirmButton(page).click()
    await expect(savedBanner(page)).toBeVisible()
    expect(await backend.outputs(w, since)).toHaveLength(1)
  })

  test('BE đã ghi nhưng điện thoại KHÔNG nhận được phản hồi: bấm lưu lại không bị cộng 2 lần', async ({ page, backend, clientIp }) => {
    const w = await backend.createWorker('PHOI')
    const since = Date.now()
    await signedInOnCut(page, backend, w)
    await fillThree(page)
    await interceptReport(page, async (route) => {
      await route.fetch({ headers: { ...route.request().headers(), 'x-forwarded-for': clientIp } }) // BE ghi thật
      await route.abort('connectionreset') // nhưng phản hồi không về tới điện thoại
    })
    await saveButton(page).click()
    await confirmButton(page).click()
    await expect(page.getByText(/mất kết nối/)).toBeVisible()
    expect(await backend.outputs(w, since), 'BE đã ghi lần đầu').toHaveLength(1)
    await saveButton(page).click()
    await confirmButton(page).click() // gửi lại: cùng Idempotency-Key
    await expect(savedBanner(page)).toBeVisible()
    const rows = await backend.outputs(w, since)
    expect(rows, 'gửi lại cùng khoá không được tạo lần báo thứ 2').toHaveLength(1)
    expect(rows[0].lines.reduce((s, l) => s + l.qty, 0)).toBe(3)
  })

  test('bị giới hạn 429: báo "đợi khoảng 1 phút", số còn nguyên, lưu lại được', async ({ page, backend }) => {
    const w = await backend.createWorker('PHOI')
    const since = Date.now()
    await signedInOnCut(page, backend, w)
    await fillThree(page)
    await interceptReport(page, (route) => route.fulfill({
      status: 429, contentType: 'application/json', headers: corsHeaders,
      body: JSON.stringify({ success: false, statusCode: 429, message: 'ThrottlerException: Too Many Requests' }),
    }))
    await saveButton(page).click()
    await confirmButton(page).click()
    await expect(page.getByText('Bấm nhanh quá. Đợi khoảng 1 phút rồi thử lại.')).toBeVisible()
    await expect(page.getByText(/ThrottlerException/)).toHaveCount(0)
    await expect(qtyInputs(page).nth(0)).toHaveValue('2')
    await saveButton(page).click()
    await confirmButton(page).click()
    await expect(savedBanner(page)).toBeVisible()
    expect(await backend.outputs(w, since)).toHaveLength(1)
  })

  test('lỗi 500 của máy chủ: có thông báo, số còn nguyên (ghi lại câu chữ công nhân thấy)', async ({ page, backend }, testInfo) => {
    const w = await backend.createWorker('PHOI')
    await signedInOnCut(page, backend, w)
    await fillThree(page)
    await interceptReport(page, (route) => route.fulfill({
      status: 500, contentType: 'application/json', headers: corsHeaders,
      body: JSON.stringify({ success: false, statusCode: 500, message: 'Internal server error' }),
    }))
    await saveButton(page).click()
    await confirmButton(page).click()
    const banner = page.getByRole('alert').first()
    await expect(banner).toBeVisible()
    const text = (await banner.innerText()).trim()
    testInfo.annotations.push({ type: 'câu công nhân thấy khi máy chủ lỗi 500', description: text })
    // Mục 42b → sửa ở mục 54: phải là câu tiếng Việt, không lộ "Internal server error".
    expect(text).not.toMatch(/Internal server error/i)
    expect(text).toContain('Hệ thống đang lỗi')
    await expect(qtyInputs(page).nth(0)).toHaveValue('2')
  })
})

// ─── bố cục + trợ năng trên màn hẹp ──────────────────────────────────────────

test.describe('Màn hình điện thoại', () => {
  test('không tràn ngang; nút Lưu luôn trong tầm nhìn; nút và ô nhập đủ to cho ngón tay (≥ 44px)', async ({ page, backend }) => {
    const w = await backend.createWorker('PHOI')
    await signedInOnCut(page, backend, w)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), 'tràn ngang').toBeLessThanOrEqual(1)
    await fillThree(page)
    const save = saveButton(page)
    await expect(save).toBeInViewport()
    const small: string[] = []
    const check = async (name: string, l: ReturnType<Page['locator']>) => {
      const box = await l.boundingBox()
      if (box && box.height < 44) small.push(`${name} cao ${Math.round(box.height)}px`)
    }
    await check('nút Lưu', save)
    const n = await qtyInputs(page).count()
    for (let i = 0; i < n; i++) await check(`ô nhập số ${i + 1}`, qtyInputs(page).nth(i))
    expect(small, 'phần tử nhỏ hơn 44px').toEqual([])
  })

  test('axe (WCAG 2 A/AA): không lỗi nghiêm trọng ở màn đăng nhập và màn báo', async ({ page, backend }, testInfo) => {
    const w = await backend.createWorker('PHOI')
    const axePath = require.resolve('axe-core/axe.min.js')
    const run = async (name: string) => {
      // tắt hiệu ứng chuyển màu 0,15 giây của nút (CSS toàn cục): axe chạy giữa lúc nút đổi từ xám sang xanh sẽ đo nhầm màu pha trộn
      await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important }' })
      await page.addScriptTag({ path: axePath })
      const res = await page.evaluate(async () => {
        const r = await (window as unknown as { axe: { run: (c: Document, o: unknown) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[]; html: string; any: { data?: Record<string, unknown> }[] }[] }[] }> } }).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })
        return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target.join(' '), html: v.nodes[0]?.html.slice(0, 160), data: v.nodes[0]?.any[0]?.data }))
      })
      testInfo.annotations.push({ type: `axe · ${name}`, description: res.length ? JSON.stringify(res) : 'không vi phạm' })
      expect(res.filter((v) => v.impact === 'serious' || v.impact === 'critical'), `axe ${name}`).toEqual([])
    }
    await openMachine(page, backend)
    await expect(page.getByRole('heading', { name: H.username })).toBeVisible()
    await run('màn đăng nhập')
    await signInWithPin(page, w)
    await expect(cutScreen(page)).toBeVisible()
    await fillThree(page)
    await run('màn báo cắt')
  })
})
