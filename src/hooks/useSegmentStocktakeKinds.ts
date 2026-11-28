import { useEffect, useState } from 'react'
import { getSegmentStocktakeConfig } from '../services/segment-stock-api'

/**
 * Loại kho được kiểm kê đoạn (GET /segment-stock/stocktake-config): ['PHOI'], thêm 'HAN' khi BE bật giao nhận giữa tổ. `null` = đang
 * hỏi BE; lỗi (BE cũ chưa có route) coi như chỉ kho Phôi - màn giữ nguyên như cũ. Nhớ trong phiên (công tắc đổi thì BE khởi động lại,
 * tải lại trang là đúng).
 */
let cached: string[] | null = null
let inflight: Promise<string[]> | null = null

export function loadSegmentStocktakeKinds(): Promise<string[]> {
  if (cached !== null) return Promise.resolve(cached)
  inflight ??= getSegmentStocktakeConfig()
    .then((c) => (cached = Array.isArray(c?.kinds) ? c.kinds : ['PHOI']))
    .catch(() => (cached = ['PHOI']))
    .finally(() => { inflight = null })
  return inflight
}

export function useSegmentStocktakeKinds(): string[] | null {
  const [kinds, setKinds] = useState<string[] | null>(cached)
  useEffect(() => {
    let live = true
    void loadSegmentStocktakeKinds().then((v) => { if (live) setKinds(v) })
    return () => { live = false }
  }, [])
  return kinds
}
