'use client'
import { useMemo, useState, type ReactNode } from 'react'
import { useFetch } from '../../../../hooks/useFetch'
import SearchInput from '../../../../components/SearchInput'
import FilterPills from '../../../../components/FilterPills'
import EmptyState from '../../../../components/EmptyState'
import LoadingState from '../../../../components/LoadingState'
import Pagination from '../../../../components/Pagination'
import { tableWrap, tbl, th, td, row } from '../../../../styles/table'

export interface AdminReadOnlyColumn<T> {
  key: string
  label: string
  width?: number | string
  align?: 'left' | 'right' | 'center'
  /** `refetch` chỉ dành cho các cột hiếm cần Admin xử lý SỰ CỐ KỸ THUẬT tại chỗ (vd "tạo lại lệnh
   *  sản xuất" khi có race condition) - KHÔNG dùng để thêm nút duyệt/từ chối nghiệp vụ, việc đó vẫn
   *  thuộc đúng phân hệ nghiệp vụ như doc comment component nói rõ bên dưới. */
  render?: (row: T, refetch: () => void) => ReactNode
}

export interface AdminReadOnlyFilterDef<T> {
  key: string
  label: string
  color?: string
  bg?: string
  predicate: (row: T) => boolean
}

// Namespaced để không bao giờ trùng với 1 filter key nghiệp vụ thật — key filter do config
// truyền vào chỉ cần khác đúng chuỗi này.
const ALL_FILTER_KEY = '__admin_all__'

export interface AdminReadOnlyListConfig<T extends { id: number | string }> {
  title: string
  icon: ReactNode
  columns: AdminReadOnlyColumn<T>[]
  searchFields: (keyof T & string)[]
  searchPlaceholder?: string
  filters?: AdminReadOnlyFilterDef<T>[]
  pageSize?: number
  emptyMessage?: string
  fetch: () => Promise<T[]>
}

/**
 * Bảng "tra cứu" chỉ đọc — dùng cho dữ liệu nghiệp vụ có state machine duyệt riêng
 * (Sales PO, đề xuất mua hàng, SKU, PI, chuyển kho...) mà Admin chỉ cần xem/lọc,
 * không thao tác duyệt/từ chối (việc đó thuộc đúng phân hệ nghiệp vụ). Không có nút thêm,
 * không có sửa/xóa — khác AdminEntityPage (engine CRUD).
 *
 * Ngoại lệ hẹp (2026-08-29, xem `AdminReadOnlyColumn.render`): 1 cột có thể nhận thêm `refetch`
 * để Admin xử lý SỰ CỐ KỸ THUẬT hiếm gặp tại chỗ (vd "tạo lại lệnh sản xuất" khi race condition
 * làm lệnh tạo thất bại, xem ProductionInvoicesPage.tsx) - không phải cửa mở cho thao tác nghiệp
 * vụ thường ngày, cùng tinh thần "Tính lại" tạm đặt ở CuttingProposalsPage.tsx.
 */
export default function AdminReadOnlyList<T extends { id: number | string }>({ config }: { config: AdminReadOnlyListConfig<T> }) {
  const { data, isLoading, refetch } = useFetch<T[]>(config.fetch)
  const items = useMemo(() => data ?? [], [data])

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER_KEY)
  const [page, setPage] = useState(1)
  const pageSize = config.pageSize ?? 10

  const filterOptions = useMemo(() => {
    if (!config.filters) return null
    return [{ key: ALL_FILTER_KEY, label: 'Tất cả' }, ...config.filters.map(f => ({ key: f.key, label: f.label, color: f.color, bg: f.bg }))]
  }, [config.filters])

  const countFor = (key: string) => {
    if (key === ALL_FILTER_KEY) return items.length
    const f = config.filters?.find(f => f.key === key)
    return f ? items.filter(f.predicate).length : 0
  }

  const filtered = useMemo(() => {
    let list = items
    if (activeFilter !== ALL_FILTER_KEY && config.filters) {
      const f = config.filters.find(f => f.key === activeFilter)
      if (f) list = list.filter(f.predicate)
    }
    if (search.trim()) {
      const q = search.trim().toLocaleLowerCase('vi')
      list = list.filter(row =>
        config.searchFields.some(field => String((row as Record<string, unknown>)[field] ?? '').toLocaleLowerCase('vi').includes(q))
      )
    }
    return list
  }, [items, activeFilter, search, config.filters, config.searchFields])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {config.icon}
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{config.title}</h3>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>({filtered.length})</span>
        </div>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder={config.searchPlaceholder ?? 'Tìm kiếm...'} />
      </div>

      {filterOptions && (
        <div style={{ marginBottom: 14 }}>
          <FilterPills options={filterOptions} active={activeFilter} onChange={k => { setActiveFilter(k); setPage(1) }} countFor={countFor} />
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        <EmptyState icon={config.icon} message={config.emptyMessage ?? 'Chưa có dữ liệu'} />
      ) : (
        <div style={tableWrap}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {config.columns.map(col => (
                    <th key={col.key} style={{ ...th, textAlign: col.align ?? 'left', width: col.width }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map(item => (
                  <tr key={item.id} style={row}>
                    {config.columns.map(col => (
                      <td key={col.key} style={{ ...td, textAlign: col.align ?? 'left' }}>
                        {col.render ? col.render(item, refetch) : String((item as Record<string, unknown>)[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <Pagination page={currentPage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  )
}
