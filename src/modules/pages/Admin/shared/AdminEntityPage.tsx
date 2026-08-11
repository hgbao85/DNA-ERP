'use client'
import { useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, X } from 'lucide-react'
import { useFetch } from '../../../../hooks/useFetch'
import { useConfirm, type ConfirmOptions } from '../../../../hooks/useConfirm'
import { uploadImage } from '../../../../services/api'
import Modal from '../../../../components/Modal'
import SearchInput from '../../../../components/SearchInput'
import FilterPills from '../../../../components/FilterPills'
import EmptyState from '../../../../components/EmptyState'
import LoadingState from '../../../../components/LoadingState'
import Pagination from '../../../../components/Pagination'
import { btnSecondary } from '../../../../styles/buttons'
import { tableWrap, tbl, th, td, row } from '../../../../styles/table'

export interface AdminColumn<T> {
  key: string
  label: string
  width?: number | string
  align?: 'left' | 'right' | 'center'
  render?: (row: T) => ReactNode
}

export interface AdminFormField<T> {
  /** Field ảo (không có trong T) được cho phép — dùng cho khối UI thuần điều khiển nhiều field
      khác cùng lúc (vd "Loại nhân viên"), kết hợp với excludeFromPayload + type 'custom'. */
  name: (keyof T & string) | (string & {})
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'image' | 'hidden' | 'custom'
  options?: { value: string; label: string }[]
  required?: boolean
  placeholder?: string
  /** Giá trị khởi tạo khi mở form "Thêm mới" (vd isActive mặc định true). */
  defaultValue?: unknown
  /** Trả về thông báo lỗi, hoặc undefined nếu hợp lệ. */
  validate?: (value: unknown, allValues: Partial<T>) => string | undefined
  /** Ẩn field theo điều kiện phụ thuộc field khác (vd chỉ hiện mfgRole khi role = WAREHOUSE_STAFF). */
  showIf?: (allValues: Partial<T>) => boolean
  /** Khi sửa (không phải tạo mới) và người dùng để trống — bỏ field này khỏi payload thay vì
      gửi chuỗi rỗng (vd mật khẩu: để trống nghĩa là "giữ nguyên", không phải "xóa mật khẩu"). */
  skipIfBlankOnEdit?: boolean
  /** type: 'hidden' — field vẫn tham gia showIf/validate/payload như bình thường nhưng không
      render dòng nào trong modal (dùng khi 1 field 'custom' khác đã tự vẽ UI điều khiển nó). */
  /** type: 'custom' — Render tự vẽ toàn bộ khối (không có label mặc định), nhận thẳng setField
      để điều khiển cả field khác cùng lúc (vd 1 khối chọn "Loại nhân viên" set lại mfgRole/warehouseScope). */
  Render?: ComponentType<{ value: unknown; values: Partial<T>; setField: (name: string, value: unknown) => void }>
  /** Không đưa field này vào payload lưu — dùng cho field UI thuần không map tới cột dữ liệu nào. */
  excludeFromPayload?: boolean
}

export interface AdminFilterDef<T> {
  key: string
  label: string
  color?: string
  bg?: string
  predicate: (row: T) => boolean
}

/** Helper truyền cho rowActions: tự làm mới danh sách (refetch) và mở hộp xác nhận dùng chung
 *  (cùng modal với nút Xóa — lỗi từ action sẽ hiện ngay trong modal). */
export interface AdminRowActionHelpers {
  refetch: () => void
  ask: (opts: ConfirmOptions, action: () => void | Promise<void>) => void
}

export interface AdminEntityConfig<T extends { id: number | string }> {
  title: string
  icon: ReactNode
  columns: AdminColumn<T>[]
  searchFields: (keyof T & string)[]
  searchPlaceholder?: string
  filters?: AdminFilterDef<T>[]
  formFields: AdminFormField<T>[]
  pageSize?: number
  emptyMessage?: string
  addLabel?: string
  deleteConfirm: (row: T) => { title?: string; message: string }
  api: {
    list: () => Promise<T[]>
    create: (data: Record<string, unknown>) => Promise<T>
    /** Bỏ trống khi BE không hỗ trợ sửa (vd Notifications - chỉ có create/list/mark-read ở BE) -
     *  ẩn hẳn nút Sửa và tắt bấm-dòng-để-sửa thay vì gọi vào hàm không tồn tại. */
    update?: (id: number | string, data: Record<string, unknown>) => Promise<T | undefined>
    /** Bỏ trống khi BE không hỗ trợ xóa - ẩn hẳn nút Xóa, xem ghi chú ở `update`. */
    remove?: (id: number | string) => Promise<{ id: number | string }>
  }
  /** Nút thao tác thêm cho mỗi dòng, chèn trước nút Sửa/Xóa (vd "Đặt lại mật khẩu"/"Khóa" ở Users).
   *  Nhận helper { refetch, ask } để tự làm mới danh sách + hỏi xác nhận sau khi gọi API. */
  rowActions?: (row: T, helpers: AdminRowActionHelpers) => ReactNode
  /** Chặn xóa — trả về thông báo lỗi để hiển thị, undefined để cho phép. */
  guardDelete?: (row: T) => string | undefined
  /** Chặn lưu (tạo/sửa) — trả về thông báo lỗi để hiển thị, undefined để cho phép. */
  guardSave?: (values: Partial<T>, isNew: boolean) => string | undefined
  /** Gọi sau khi tạo/sửa/xóa thành công — nơi gọi thường dùng để ghi audit log. */
  onMutate?: (action: 'create' | 'update' | 'delete', row: T) => void
}

// Namespaced để không bao giờ trùng với 1 filter key nghiệp vụ thật (vd Notification's
// audience 'all') — key filter do config truyền vào chỉ cần khác đúng chuỗi này.
const ALL_FILTER_KEY = '__admin_all__'

function defaultCell<T>(row: T, key: string): ReactNode {
  const v = (row as Record<string, unknown>)[key]
  if (v === null || v === undefined) return <span style={{ color: 'var(--text3)' }}>—</span>
  if (typeof v === 'boolean') return v ? 'Có' : 'Không'
  return String(v)
}

export default function AdminEntityPage<T extends { id: number | string }>({
  config,
  readOnly = false,
  embedded = false,
}: {
  config: AdminEntityConfig<T>
  /** Ép toàn bộ trang về chỉ xem bất kể config có update/remove hay không - dùng khi cùng 1
   *  entity được nhúng vào 1 màn khác cho người xem không có quyền sửa (vd Giám đốc xem Điểm
   *  đan qua tab "Quản lý sản xuất" - xem MfgApp.tsx). */
  readOnly?: boolean
  /** Ẩn tiêu đề/icon riêng - dùng khi nhúng vào 1 tab con đã có tiêu đề của màn cha (vd tab
   *  "Thông tin điểm đan" trong QuanLyDiemDanPage). */
  embedded?: boolean
}) {
  const { data, isLoading, error: loadError, refetch } = useFetch<T[]>(config.api.list)
  const items = useMemo(() => data ?? [], [data])

  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>(ALL_FILTER_KEY)
  const [page, setPage] = useState(1)
  const pageSize = config.pageSize ?? 10

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [values, setValues] = useState<Partial<T>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Ảnh mới chọn nhưng CHƯA upload lên Cloudinary - chỉ preview tạm qua object URL của trình
  // duyệt. Chỉ thật sự upload lúc bấm Lưu (xem handleSave) - bấm Hủy/đóng modal thì object URL
  // bị revoke, KHÔNG có gì từng lên Cloudinary nên không tạo ảnh rác mồ côi.
  // `uploadedUrl` cache lại kết quả upload SAU LẦN ĐẦU thành công - nếu Lưu thất bại vì lý do
  // khác (vd trùng mã) và người dùng sửa rồi bấm Lưu lại, dùng thẳng URL đã có thay vì upload lại
  // cùng 1 file nhiều lần (mỗi lần upload lại là thêm 1 ảnh rác trên Cloudinary không ai dọn).
  const [pendingImages, setPendingImages] = useState<Record<string, { file: File; previewUrl: string; uploadedUrl?: string }>>({})

  const { ask, confirmModal } = useConfirm()

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

  const visibleFields = (allValues: Partial<T>) => config.formFields.filter(f => !f.showIf || f.showIf(allValues))
  const canUpdate = !readOnly && !!config.api.update
  const canRemove = !readOnly && !!config.api.remove
  const hasRowActions = !!(canUpdate || canRemove || (!readOnly && config.rowActions))

  // Revoke toàn bộ object URL đang preview - gọi khi đóng modal (Hủy/Lưu xong/mở lại) để
  // không rò rỉ bộ nhớ trình duyệt giữ ảnh đã chọn nhưng không còn dùng tới nữa.
  const clearPendingImages = () => {
    setPendingImages(prev => {
      Object.values(prev).forEach(p => URL.revokeObjectURL(p.previewUrl))
      return {}
    })
  }

  const openCreate = () => {
    setEditing(null)
    const defaults = Object.fromEntries(
      config.formFields.filter(f => f.defaultValue !== undefined).map(f => [f.name, f.defaultValue])
    ) as Partial<T>
    setValues(defaults)
    setErrors({})
    setFormError(null)
    clearPendingImages()
    setFormOpen(true)
  }

  const openEdit = (row: T) => {
    setEditing(row)
    setValues({ ...row })
    setErrors({})
    setFormError(null)
    clearPendingImages()
    setFormOpen(true)
  }

  const closeForm = () => {
    if (saving) return
    clearPendingImages()
    setFormOpen(false)
  }

  const setField = (name: string, value: unknown) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }

  const selectPendingImage = (name: string, file: File) => {
    setPendingImages(prev => {
      const previous = prev[name]
      if (previous) URL.revokeObjectURL(previous.previewUrl)
      return { ...prev, [name]: { file, previewUrl: URL.createObjectURL(file) } }
    })
  }

  const removeImage = (name: string) => {
    setPendingImages(prev => {
      const pending = prev[name]
      if (!pending) return prev
      URL.revokeObjectURL(pending.previewUrl)
      const next = { ...prev }
      delete next[name]
      return next
    })
    setField(name, null)
  }

  const handleSave = async () => {
    const isNew = !editing
    const fields = visibleFields(values)
    const nextErrors: Record<string, string> = {}
    fields.forEach(f => {
      const v = (values as Record<string, unknown>)[f.name]
      const hasPendingImage = f.type === 'image' && !!pendingImages[f.name]
      if (f.required && !hasPendingImage && (v === undefined || v === null || v === '')) {
        nextErrors[f.name] = 'Bắt buộc'
        return
      }
      const err = f.validate?.(v, values)
      if (err) nextErrors[f.name] = err
    })
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    const guardErr = config.guardSave?.(values, isNew)
    if (guardErr) {
      setFormError(guardErr)
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      // Upload thật lên Cloudinary CHỈ tới lúc này (không phải lúc chọn file) - nếu Lưu thất bại
      // ngay dưới đây thì ảnh vừa upload sẽ mồ côi, nhưng đó là trường hợp hiếm (Lưu lỗi validate/
      // trùng mã...) so với việc user bấm Hủy giữa chừng, vốn xảy ra thường xuyên hơn nhiều và giờ
      // không tốn 1 lần gọi Cloudinary nào nữa. Đã upload thành công 1 lần (uploadedUrl) thì lần
      // Lưu lại sau đó (vd sửa xong mã trùng) dùng thẳng URL cũ, không upload lại cùng file.
      const resolvedValues: Record<string, unknown> = { ...values }
      for (const [name, pending] of Object.entries(pendingImages)) {
        const url = pending.uploadedUrl ?? (await uploadImage(pending.file))
        resolvedValues[name] = url
        if (!pending.uploadedUrl) {
          setPendingImages(prev => (prev[name] ? { ...prev, [name]: { ...prev[name], uploadedUrl: url } } : prev))
        }
      }

      // Field bị ẩn bởi showIf (vd mfgRole khi đã đổi role sang BOSS) gửi null để dọn giá trị cũ,
      // thay vì bỏ qua — nếu không giá trị cũ vẫn còn trong bản ghi dù không còn hiển thị trên form.
      // Field có giá trị undefined khi TẠO MỚI bị loại khỏi payload — service tạo mới dùng
      // {...defaults, ...data}, key undefined trong `data` sẽ ghi đè mất giá trị mặc định phía
      // service (vd isActive). Khi SỬA thì giữ undefined lại để Object.assign() xóa được field
      // optional mà người dùng chủ động để trống (vd bỏ chọn nhóm kho phụ trách).
      const payload = Object.fromEntries(
        config.formFields
          .filter(f => !f.excludeFromPayload)
          .filter(f => !(f.skipIfBlankOnEdit && !isNew && !resolvedValues[f.name]))
          .map(f => {
            const visible = fields.includes(f)
            return [f.name, visible ? resolvedValues[f.name] : null] as const
          })
          .filter(([, v]) => isNew ? v !== undefined : true)
      )
      if (!isNew && !canUpdate) return // không thể xảy ra - openEdit đã bị chặn khi thiếu update/readOnly
      const saved = isNew
        ? await config.api.create(payload)
        : await config.api.update!((editing as T).id, payload)
      if (saved) config.onMutate?.(isNew ? 'create' : 'update', saved)
      clearPendingImages()
      setFormOpen(false)
      await refetch()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Không thể lưu dữ liệu')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (row: T) => {
    if (!canRemove) return // không thể xảy ra - nút Xóa đã bị ẩn khi thiếu remove/readOnly
    const guardErr = config.guardDelete?.(row)
    if (guardErr) {
      alert(guardErr)
      return
    }
    const { title, message } = config.deleteConfirm(row)
    ask({ title, message, danger: true, confirmLabel: 'Xóa' }, async () => {
      await config.api.remove!(row.id)
      config.onMutate?.('delete', row)
      await refetch()
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {!embedded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            {config.icon}
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{config.title}</h2>
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>({filtered.length})</span>
          </div>
        )}
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1) }} placeholder={config.searchPlaceholder ?? 'Tìm kiếm...'} />
        {!readOnly && (
          <button
            onClick={openCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#3949ab', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            <Plus size={14} /> {config.addLabel ?? 'Thêm mới'}
          </button>
        )}
      </div>

      {filterOptions && (
        <div style={{ marginBottom: 14 }}>
          <FilterPills options={filterOptions} active={activeFilter} onChange={k => { setActiveFilter(k); setPage(1) }} countFor={countFor} />
        </div>
      )}

      {loadError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(198, 40, 40, 0.08)', border: '1px solid rgba(198, 40, 40, 0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 14,
          color: '#c62828', fontSize: 13, fontWeight: 500,
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Không tải được dữ liệu: {loadError}</span>
          <button
            onClick={refetch}
            style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#c62828', background: 'transparent', border: '1px solid rgba(198, 40, 40, 0.4)', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}
          >
            Thử lại
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : filtered.length === 0 ? (
        loadError
          ? null // đã báo lỗi ở banner trên — tránh vừa hiện lỗi vừa hiện "chưa có dữ liệu" gây hiểu lầm
          : <EmptyState icon={config.icon} message={config.emptyMessage ?? 'Chưa có dữ liệu'} />
      ) : (
        <div style={tableWrap}>
          <div style={{ overflowX: 'auto' }}>
            <table style={tbl}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {config.columns.map(col => (
                    <th key={col.key} style={{ ...th, textAlign: col.align ?? 'left', width: col.width }}>{col.label}</th>
                  ))}
                  {hasRowActions && (
                    <th style={{ ...th, width: config.rowActions ? 120 : 90, textAlign: 'right' }}>Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paged.map(item => (
                  <tr
                    key={item.id}
                    style={{ ...row, cursor: canUpdate ? 'pointer' : 'default' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    onClick={() => canUpdate && openEdit(item)}
                  >
                    {config.columns.map(col => (
                      <td key={col.key} style={{ ...td, textAlign: col.align ?? 'left' }}>
                        {col.render ? col.render(item) : defaultCell(item, col.key)}
                      </td>
                    ))}
                    {hasRowActions && (
                      <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          {!readOnly && config.rowActions?.(item, { refetch, ask })}
                          {canUpdate && (
                            <button
                              onClick={() => openEdit(item)}
                              title="Sửa"
                              style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
                            >
                              <Pencil size={14} strokeWidth={2.25} />
                            </button>
                          )}
                          {canRemove && (
                            <button
                              onClick={() => handleDelete(item)}
                              title="Xóa"
                              style={{ width: 26, height: 26, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: '#c62828', cursor: 'pointer' }}
                            >
                              <Trash2 size={14} strokeWidth={2.25} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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

      <Modal open={formOpen} onClose={closeForm} maxWidth={480}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
          {editing ? `Sửa ${config.title.toLowerCase()}` : `Thêm ${config.title.toLowerCase()}`}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
          {visibleFields(values).filter(f => f.type !== 'hidden').map(f => (
            <div key={f.name}>
              {f.type === 'custom' ? (
                f.Render && <f.Render value={(values as Record<string, unknown>)[f.name]} values={values} setField={setField} />
              ) : (
              <>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                {f.label}{f.required && <span style={{ color: '#c62828' }}> *</span>}
              </label>

              {f.type === 'checkbox' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={!!(values as Record<string, unknown>)[f.name]}
                    onChange={e => setField(f.name, e.target.checked)}
                  />
                  {f.placeholder}
                </label>
              ) : f.type === 'select' ? (
                <select
                  value={String((values as Record<string, unknown>)[f.name] ?? '')}
                  onChange={e => setField(f.name, e.target.value || undefined)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
                >
                  <option value="">— Không —</option>
                  {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === 'image' ? (
                <div>
                  {(() => {
                    const previewUrl = pendingImages[f.name]?.previewUrl ?? (values as Record<string, unknown>)[f.name]
                    return previewUrl ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <img
                          src={String(previewUrl)}
                          alt=""
                          style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(f.name)}
                          title="Xóa ảnh"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
                        >
                          <X size={12} /> Xóa ảnh
                        </button>
                      </div>
                    ) : null
                  })()}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (file) selectPendingImage(f.name, file)
                    }}
                    style={{ width: '100%', fontSize: 13 }}
                  />
                </div>
              ) : f.type === 'number' ? (
                <input
                  type="number"
                  value={String((values as Record<string, unknown>)[f.name] ?? '')}
                  onChange={e => setField(f.name, e.target.value === '' ? undefined : Number(e.target.value))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
                />
              ) : (
                <input
                  type={f.type}
                  value={String((values as Record<string, unknown>)[f.name] ?? '')}
                  onChange={e => setField(f.name, e.target.value)}
                  placeholder={f.placeholder}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }}
                />
              )}
              </>
              )}

              {errors[f.name] && <div style={{ color: '#c62828', fontSize: 11, marginTop: 4 }}>{errors[f.name]}</div>}
            </div>
          ))}
        </div>

        {formError && <div style={{ color: '#c62828', fontSize: 12, marginTop: 12 }}>{formError}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={closeForm} disabled={saving} style={btnSecondary}>Hủy</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#3949ab', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </Modal>

      {confirmModal}
    </div>
  )
}
