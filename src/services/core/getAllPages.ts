import { http } from './http'

/**
 * Tải HẾT các trang của 1 danh sách phân trang (16/11/2026).
 *
 * BE giới hạn `limit` tối đa 100 (`@Max(100)` ở PaginationQueryDto, dùng chung mọi endpoint). Trước đây
 * khoảng 50 chỗ gọi `?limit=100` rồi chỉ đọc trang 1 -> dữ liệu vượt 100 dòng (lệnh SX, SKU, đề xuất
 * mua, lô sản xuất, lượt KCS...) lặng lẽ biến mất khỏi màn hình và khỏi các con số tổng.
 *
 * - Endpoint trả mảng thẳng (không phân trang) -> trả nguyên mảng, chỉ 1 request.
 * - Endpoint trả `{ data, meta: { totalPages } }` -> đọc trang 1, rồi các trang còn lại theo từng đợt
 *   `CONCURRENCY` request (cả xưởng dùng chung 1 IP NAT, BE throttle 100 request/phút theo IP - không
 *   bắn hàng chục request cùng lúc).
 * - Bỏ trùng theo `id`: danh sách sắp mới nhất trước, có dòng mới chen vào giữa 2 lần đọc trang thì 1
 *   dòng có thể xuất hiện ở cả 2 trang.
 * - Trần `MAX_PAGES` (5.000 dòng) để 1 màn không treo khi dữ liệu bất thường; chạm trần thì cảnh báo ở
 *   console - lúc đó endpoint cần lọc/tổng hợp ở BE thay vì tải hết.
 */
export const PAGE_LIMIT = 100
export const MAX_PAGES = 50
const CONCURRENCY = 3

type Page<T> = T[] | { data: T[]; meta?: { totalPages?: number } }

export async function getAllPages<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T[]> {
  const fetchPage = (page: number) => http.get<Page<T>>(path, { params: { ...params, limit: PAGE_LIMIT, page } })

  const first = await fetchPage(1)
  if (Array.isArray(first)) return first

  const totalPages = Math.max(1, first.meta?.totalPages ?? 1)
  const lastPage = Math.min(totalPages, MAX_PAGES)
  if (totalPages > MAX_PAGES) {
    console.warn(`getAllPages(${path}): ${totalPages} trang, chỉ tải ${MAX_PAGES} trang đầu`)
  }

  const pages: T[][] = [first.data ?? []]
  for (let start = 2; start <= lastPage; start += CONCURRENCY) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, lastPage - start + 1) }, (_, i) => fetchPage(start + i))
    for (const res of await Promise.all(batch)) pages.push(Array.isArray(res) ? res : (res.data ?? []))
  }

  const seen = new Set<unknown>()
  const out: T[] = []
  for (const row of pages.flat()) {
    const id = (row as { id?: unknown } | null)?.id
    if (id != null) {
      if (seen.has(id)) continue
      seen.add(id)
    }
    out.push(row)
  }
  return out
}
