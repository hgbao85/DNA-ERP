/* eslint-disable react-hooks/rules-of-hooks -- `use` của fixture Playwright không phải React Hook */
import { test as base, expect, type APIRequestContext, type CDPSession } from '@playwright/test'
import { API_BASE, FACTORY_PREFIX, QLSX_IP } from './env'

/**
 * Dụng cụ cho bài thử điện thoại công nhân: nói chuyện thẳng với BE (tạo công nhân, nhận sắt, đọc lại số đã ghi) và gắn cho MỖI bài một "IP
 * điện thoại" riêng qua X-Forwarded-For (BE thử chạy TRUST_PROXY_HOPS=1 như Render) - để bài này không ăn hạn mức đăng nhập 8 lần/phút/IP của bài kia.
 */

const host = new URL(API_BASE).hostname
if (!/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
  throw new Error(`Từ chối chạy: ${host} không phải mạng nội bộ. Bài thử tạo công nhân/báo cáo thật - chỉ chạy trên bản sao DB thử.`)
}

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'demo1234'
export const RUN = Date.now().toString(36)

export interface Machine { id: string; code: string; kind: string; stage: string; qrToken: string }
export interface Worker { username: string; pin: string; stage: string }
export interface Output { id: string; kind: string; createdAt: string; state: string; lines: { qty: number; segment: { cutLengthMm: number; materialCode: string } | null; piece: { code: string } | null }[] }

let ipSeq = 0
/** IP riêng trong dải "mạng công ty" (10.88.0.0/16) - mỗi lần gọi một IP mới. */
export function freshIp(): string {
  ipSeq++
  return `${FACTORY_PREFIX}.${100 + Math.floor(ipSeq / 250)}.${(ipSeq % 250) + 1}`
}

export class Backend {
  private qlsx: { token: string; at: number } | null = null
  private seq = 0
  machines!: { cut: Machine; recv: Machine; han: Machine }

  constructor(private readonly req: APIRequestContext) {}

  async call(method: string, path: string, o: { token?: string; body?: unknown; ip?: string; headers?: Record<string, string> } = {}) {
    const res = await this.req.fetch(API_BASE + path, {
      method,
      data: o.body,
      headers: { 'X-Forwarded-For': o.ip ?? QLSX_IP, ...(o.token ? { Authorization: `Bearer ${o.token}` } : {}), ...(o.headers ?? {}) },
    })
    let json: any = null
    try { json = await res.json() } catch { /* không có body */ }
    return { status: res.status(), ok: res.ok(), json, data: json?.data as any }
  }

  async qlsxToken(): Promise<string> {
    if (!this.qlsx || Date.now() - this.qlsx.at > 12 * 60_000) {
      const r = await this.call('POST', '/auth/login', { body: { username: 'qlsx', password: DEMO_PASSWORD } })
      expect(r.ok, `đăng nhập qlsx: ${r.status} ${JSON.stringify(r.json?.message)} - cần BE thử có tài khoản demo (seed-demo)`).toBeTruthy()
      this.qlsx = { token: r.data.accessToken, at: Date.now() }
    }
    return this.qlsx.token
  }

  async createWorker(stage: 'PHOI' | 'HAN' | 'SON', opts: { withPin?: boolean } = {}): Promise<Worker> {
    const withPin = opts.withPin ?? true
    const username = `e2e.${RUN}.${++this.seq}`
    const pin = '246810'
    const c = await this.call('POST', '/floor/workers', { token: await this.qlsxToken(), body: { username, firstName: String(this.seq), lastName: 'E2E', stage } })
    expect(c.status, `tạo công nhân ${username}: ${JSON.stringify(c.json?.message)}`).toBe(201)
    if (withPin) {
      const p = await this.call('POST', '/auth/pin-setup', { ip: freshIp(), body: { username, pin, confirmPin: pin } })
      expect(p.ok, `đặt PIN ${username}: ${p.status}`).toBeTruthy()
    }
    return { username, pin, stage }
  }

  async workerToken(w: Worker): Promise<string> {
    const r = await this.call('POST', '/auth/login', { ip: freshIp(), body: { username: w.username, password: w.pin } })
    expect(r.ok, `đăng nhập ${w.username}: ${r.status} ${JSON.stringify(r.json?.message)}`).toBeTruthy()
    return r.data.accessToken
  }

  /** Các lần báo của công nhân từ mốc `sinceMs` (đọc đúng như màn "Sản lượng của tôi"). */
  async outputs(w: Worker, sinceMs: number): Promise<Output[]> {
    const token = await this.workerToken(w)
    const q = `from=${encodeURIComponent(new Date(sinceMs - 500).toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 60_000).toISOString())}`
    const r = await this.call('GET', `/floor/my-output?${q}`, { token, ip: freshIp() })
    expect(r.ok).toBeTruthy()
    return (r.data as Output[]).filter((o) => Date.parse(o.createdAt) >= sinceMs - 500)
  }

  /** Kiểm BE sống, tìm máy, nhận hết sắt kho đã xuất để máy cắt có loại sắt báo được. Idempotent. */
  async prepare() {
    const health = await this.req.get(API_BASE.replace(/\/api\/v1$/, '/api/health'), { failOnStatusCode: false }).catch(() => null)
    if (!health || !health.ok()) {
      throw new Error(`BE không trả lời ở ${API_BASE} - dựng BE thử theo hướng dẫn đầu playwright.floor.config.ts`)
    }
    const ws = (await this.call('GET', '/floor/workstations', { token: await this.qlsxToken() })).data as Machine[]
    const find = (pred: (w: any) => boolean, name: string) => {
      const m = ws.find((w: any) => w.isActive && pred(w))
      if (!m) throw new Error(`BE thử thiếu máy ${name} đang bật`)
      return m
    }
    this.machines = {
      cut: find((w) => w.kind === 'CUT', 'cắt'),
      recv: find((w) => w.kind === 'STEEL_RECEIVE', 'nhận sắt'),
      han: find((w) => w.kind === 'PIECE' && w.stage === 'HAN', 'hàn'),
    }
    const helper = await this.createWorker('PHOI')
    const token = await this.workerToken(helper)
    const ctx = await this.call('GET', `/floor/scan/${this.machines.recv.qrToken}`, { token, ip: freshIp() })
    for (const s of ctx.data?.steelToReceive ?? []) {
      await this.call('POST', `/floor/scan/${this.machines.recv.qrToken}/steel-issues/${s.steelIssueId}/receive`, { token, ip: freshIp(), body: { receivedBarCount: s.barCount } })
    }
    const cut = await this.call('GET', `/floor/scan/${this.machines.cut.qrToken}`, { token, ip: freshIp() })
    const usable = (cut.data?.pi?.materials ?? []).some((m: any) => m.hasReceivedSteel)
    if (!usable) throw new Error('máy cắt chưa có PI đang chạy hoặc chưa có loại sắt nào đã nhận - mở PI ở tổ Phôi và cho kho xuất sắt trên BE thử')
  }
}

type TestFixtures = { clientIp: string; phoneNet: { setOffline: (offline: boolean) => Promise<void> } }
type WorkerFixtures = { backend: Backend }

export const test = base.extend<TestFixtures, WorkerFixtures>({
  backend: [async ({ playwright }, use) => {
    const req = await playwright.request.newContext()
    const backend = new Backend(req)
    await backend.prepare()
    await use(backend)
    await req.dispose()
  }, { scope: 'worker', timeout: 180_000 }],

  // Mỗi bài một IP điện thoại riêng; bài "ngoài mạng công ty" ghi đè bằng test.use({ clientIp: OUTSIDE_IP }).
  clientIp: async ({}, use) => { await use(freshIp()) },

  page: async ({ page, context, clientIp }, use) => {
    await context.setExtraHTTPHeaders({ 'X-Forwarded-For': clientIp })
    await use(page)
  },

  // Mạng + CPU của điện thoại: máy yếu (metadata.weak, chỉ Chromium) = CPU chậm gấp 4 + mạng ~3G chậm. Bài cần ngắt mạng phải gọi
  // phoneNet.setOffline thay vì context.setOffline - hai cách điều khiển mạng cùng lúc sẽ ghi đè nhau (đã gặp: ngắt mạng không có tác dụng).
  phoneNet: [async ({ page, context, browserName }, use, testInfo) => {
    const slow = { latency: 300, downloadThroughput: (700 * 1024) / 8, uploadThroughput: (350 * 1024) / 8 }
    let cdp: CDPSession | null = null
    if (testInfo.project.metadata?.weak && browserName === 'chromium') {
      cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', { offline: false, ...slow })
    }
    await use({
      setOffline: async (offline) => {
        if (cdp) await cdp.send('Network.emulateNetworkConditions', offline ? { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } : { offline: false, ...slow })
        else await context.setOffline(offline)
      },
    })
  }, { auto: true }],
})

export { expect }
