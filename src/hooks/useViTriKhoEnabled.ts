import { useEffect, useState } from 'react'
import { getViTriKhoConfig } from '../services/vi-tri-kho-api'

/**
 * Công tắc vị trí kho Thành phẩm + load cont (VI_TRI_KHO_ENABLED của BE, 25/11/2026). `null` = đang hỏi BE; lỗi (BE cũ chưa có
 * route) coi như TẮT - màn giữ nguyên như cũ. Nhớ trong phiên (công tắc đổi thì BE khởi động lại, tải lại trang là đúng).
 */
let cached: boolean | null = null
let inflight: Promise<boolean> | null = null

export function loadViTriKhoEnabled(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached)
  inflight ??= getViTriKhoConfig()
    .then((c) => (cached = !!c?.enabled))
    .catch(() => (cached = false))
    .finally(() => { inflight = null })
  return inflight
}

export function useViTriKhoEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(cached)
  useEffect(() => {
    let live = true
    void loadViTriKhoEnabled().then((v) => { if (live) setEnabled(v) })
    return () => { live = false }
  }, [])
  return enabled
}
