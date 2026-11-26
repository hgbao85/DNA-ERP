import { useEffect, useState } from 'react'
import { getDieuPhoiDanConfig } from '../services/weaving-coordination-api'

/**
 * Công tắc Điều phối đan (DIEU_PHOI_DAN_ENABLED của BE, 25/11/2026). `null` = đang hỏi BE; lỗi (BE cũ chưa có route) coi như TẮT -
 * màn giữ nguyên như cũ. Nhớ trong phiên (công tắc đổi thì BE khởi động lại, tải lại trang là đúng).
 */
let cached: boolean | null = null
let inflight: Promise<boolean> | null = null

export function loadDieuPhoiDanEnabled(): Promise<boolean> {
  if (cached !== null) return Promise.resolve(cached)
  inflight ??= getDieuPhoiDanConfig()
    .then((c) => (cached = !!c?.enabled))
    .catch(() => (cached = false))
    .finally(() => { inflight = null })
  return inflight
}

export function useDieuPhoiDanEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(cached)
  useEffect(() => {
    let live = true
    void loadDieuPhoiDanEnabled().then((v) => { if (live) setEnabled(v) })
    return () => { live = false }
  }, [])
  return enabled
}
