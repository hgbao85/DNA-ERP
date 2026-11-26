import { useEffect, useState } from 'react'
import { getCkDgConfig } from '../services/ck-dg-api'

/**
 * Công tắc Chuyền kiểm / Đóng gói bằng quét QR (CK_DG_QR_ENABLED của BE, 24/11/2026). `null` = đang hỏi BE; lỗi (BE cũ chưa có
 * route) coi như TẮT - màn giữ nguyên như cũ. Nhớ trong phiên (công tắc đổi thì BE khởi động lại, tải lại trang là đúng).
 */
let cached: boolean | null = null
let inflight: Promise<boolean> | null = null

export function loadCkDgEnabled(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached)
  inflight ??= getCkDgConfig()
    .then((c) => (cached = !!c?.enabled))
    .catch(() => (cached = false))
    .finally(() => { inflight = null })
  return inflight
}

export function useCkDgEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(cached)
  useEffect(() => {
    let live = true
    void loadCkDgEnabled().then((v) => { if (live) setEnabled(v) })
    return () => { live = false }
  }, [])
  return enabled
}
