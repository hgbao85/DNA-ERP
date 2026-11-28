import { useEffect, useState } from 'react'
import { isTransientApiError } from '../services/core/apiError'

/**
 * Công tắc tính năng đọc từ BE (`GET /…/config` trả `{ enabled }`) - dùng chung cho CK_DG_QR, VI_TRI_KHO, DIEU_PHOI_DAN.
 *
 * Đợt 2 lượt 3 (28/11/2026): trước đây mọi lỗi đều được NHỚ là "tắt" cho tới khi tải lại trang. Điện thoại ở xưởng mất sóng lúc mở
 * màn thì cả phiên chạy như công tắc tắt (vd màn kho Thành phẩm mở lại nhập tay dù đã bật QR). Nay:
 *  - lỗi tạm (mất mạng, hết giờ chờ, 429, 5xx): KHÔNG nhớ - lần này coi là tắt, hook tự hỏi lại sau (5 s, 15 s, 30 s, rồi mỗi 60 s)
 *    và khi máy có mạng lại / quay lại tab;
 *  - lỗi hẳn (404 = BE cũ chưa có route, 403…): nhớ là tắt như cũ.
 * Công tắc đổi thì BE khởi động lại, tải lại trang là đúng.
 */
export interface FeatureSwitch {
  load: () => Promise<boolean>
  useSwitch: () => boolean | null
  /** Chỉ cho test: xoá nhớ. */
  reset: () => void
}

const RETRY_MS = [5_000, 15_000, 30_000, 60_000]

export function createFeatureSwitch(fetchConfig: () => Promise<{ enabled?: boolean } | null | undefined>): FeatureSwitch {
  let cached: boolean | null = null
  let inflight: Promise<{ value: boolean; final: boolean }> | null = null

  const ask = (): Promise<{ value: boolean; final: boolean }> => {
    if (cached !== null) return Promise.resolve({ value: cached, final: true })
    inflight ??= fetchConfig()
      .then((c) => ({ value: (cached = !!c?.enabled), final: true }))
      .catch((e: unknown) => {
        if (isTransientApiError(e)) return { value: false, final: false }
        return { value: (cached = false), final: true }
      })
      .finally(() => { inflight = null })
    return inflight
  }

  const useSwitch = (): boolean | null => {
    const [enabled, setEnabled] = useState<boolean | null>(cached)
    useEffect(() => {
      let live = true
      let attempt = 0
      let timer: ReturnType<typeof setTimeout> | null = null
      const run = () => {
        if (timer) { clearTimeout(timer); timer = null }
        void ask().then(({ value, final }) => {
          if (!live) return
          setEnabled(value)
          if (!final) {
            timer = setTimeout(run, RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)])
            attempt += 1
          }
        })
      }
      const again = () => { if (cached === null) run() }
      run()
      window.addEventListener('online', again)
      window.addEventListener('focus', again)
      return () => {
        live = false
        if (timer) clearTimeout(timer)
        window.removeEventListener('online', again)
        window.removeEventListener('focus', again)
      }
    }, [])
    return enabled
  }

  return {
    load: () => ask().then((r) => r.value),
    useSwitch,
    reset: () => { cached = null; inflight = null },
  }
}
