import { useEffect, useState } from 'react'
import { getPlanningParams } from '../services/system-config-api'

/**
 * Phần A – Đợt 2: tiền tố số LSX Admin khai (`SystemConfig.lsxPrefixes`) - đọc qua `GET /system-config/planning-params` (mọi
 * người đăng nhập đọc được; route của Đợt 1). Rỗng = mọi tiền tố đúng dạng. Lỗi/BE cũ chưa có field -> [] (ô nhập cho gõ tự do,
 * BE vẫn kiểm). Nhớ trong phiên trang để nhiều ô LSX trên 1 màn chỉ gọi 1 lần.
 */
let cache: Promise<string[]> | null = null

function loadLsxPrefixes(): Promise<string[]> {
  if (!cache) {
    cache = getPlanningParams()
      .then((p) => (Array.isArray(p?.lsxPrefixes) ? p.lsxPrefixes : []))
      .catch(() => {
        cache = null // lần sau thử lại
        return []
      })
  }
  return cache
}

/** Admin vừa lưu Cấu hình -> bỏ nhớ để màn khác đọc lại. */
export function invalidateLsxPrefixes() {
  cache = null
}

export function useLsxPrefixes(): string[] {
  const [prefixes, setPrefixes] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    loadLsxPrefixes().then((p) => { if (alive) setPrefixes(p) })
    return () => { alive = false }
  }, [])
  return prefixes
}
