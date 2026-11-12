import { useEffect, useState } from 'react'
import { ClipboardList, FileCheck2, Paperclip, X } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { getSuppliers } from '../../../services/api'
import { printSupplierOrder } from '../../../services/supplier-orders-api'

/**
 * Popup dùng chung cho đơn đặt hàng NCC (2026-11-04, bản v8 mục 4.10) ở màn "Lệnh mua vật tư":
 * tạo đơn (bắt buộc chọn NCC, hệ thống cấp số đơn) và huỷ đơn chưa duyệt (bắt buộc lý do).
 */

function ModalShell({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <ClipboardList size={17} color="var(--fg-2563eb)" />
          <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} aria-label="Đóng" style={{ display: 'flex', padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={17} />
          </button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          {footer}
        </div>
      </div>
    </div>
  )
}

const secondaryBtn: React.CSSProperties = { padding: '7px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }
const primaryBtn = (disabled: boolean, danger = false): React.CSSProperties => ({
  padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, color: '#fff',
  background: disabled ? 'var(--bg-93c5fd)' : danger ? 'var(--fg-dc2626)' : 'var(--bg-2563eb)',
  cursor: disabled ? 'default' : 'pointer',
})
const errBox: React.CSSProperties = { marginTop: 12, padding: '8px 10px', fontSize: 12, color: 'var(--fg-991b1b)', background: 'var(--bg-fee2e2)', border: '1px solid var(--fg-fca5a5)', borderRadius: 8 }
const fieldStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }

export function CreateSupplierOrderModal({ itemNames, onClose, onConfirm }: {
  itemNames: string[]
  onClose: () => void
  onConfirm: (supplierId: string) => Promise<void>
}) {
  const { data: suppliers, isLoading } = useFetch(getSuppliers)
  const [supplierId, setSupplierId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const active = (suppliers ?? []).filter(s => s.isActive).sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  const confirm = async () => {
    if (!supplierId || busy) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm(supplierId)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Tạo đơn đặt hàng"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} disabled={busy} style={secondaryBtn}>Huỷ</button>
        <button onClick={() => void confirm()} disabled={!supplierId || busy} style={primaryBtn(!supplierId || busy)}>
          {busy ? 'Đang tạo…' : 'Tạo đơn, cấp số'}
        </button>
      </>}
    >
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        {itemNames.length} vật tư: <strong>{itemNames.join(', ')}</strong>. Hệ thống cấp ngay số đơn đặt hàng tiếp theo của nhà cung cấp này (vd 53/2026) — số in trên phiếu đề xuất và phiếu nhập kho.
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }} htmlFor="so-supplier">
        Nhà cung cấp <span style={{ color: 'var(--fg-dc2626)' }}>*</span>
      </label>
      <select id="so-supplier" value={supplierId} disabled={busy || isLoading} onChange={e => setSupplierId(e.target.value)} style={fieldStyle}>
        <option value="">{isLoading ? 'Đang tải…' : '— Chọn nhà cung cấp —'}</option>
        {active.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
      </select>
      {!isLoading && active.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>Chưa có nhà cung cấp nào đang hợp tác — nhờ Admin thêm ở Danh mục &gt; Nhà cung cấp.</div>
      )}
      {err && <div style={errBox}>{err}</div>}
    </ModalShell>
  )
}

export function CancelSupplierOrderModal({ orderLabel, everSigned, onClose, onConfirm }: {
  orderLabel: string
  /** Đơn đã từng có phiếu Giám đốc ký (revision > 0) thì giữ số; chưa biết (undefined) thì nói chung cả 2 trường hợp. */
  everSigned?: boolean
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const confirm = async () => {
    if (!reason.trim() || busy) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Huỷ đơn đặt hàng"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} disabled={busy} style={secondaryBtn}>Không huỷ</button>
        <button onClick={() => void confirm()} disabled={!reason.trim() || busy} style={primaryBtn(!reason.trim() || busy, true)}>
          {busy ? 'Đang huỷ…' : 'Huỷ đơn'}
        </button>
      </>}
    >
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        Huỷ <strong>{orderLabel}</strong>: các vật tư quay về &quot;Chưa vào đơn đặt hàng&quot;. {everSigned === true
          ? 'Đơn đã từng có phiếu Giám đốc ký nên số đơn này giữ nguyên, không cấp lại.'
          : everSigned === false
            ? 'Số đơn này sẽ được cấp lại cho đơn kế tiếp của cùng nhà cung cấp.'
            : 'Đơn chưa từng có phiếu Giám đốc ký thì số đơn được cấp lại cho đơn kế tiếp của cùng nhà cung cấp; đơn đã ký rồi Thay phiếu thì giữ số.'}
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }} htmlFor="so-cancel-reason">
        Lý do <span style={{ color: 'var(--fg-dc2626)' }}>*</span>
      </label>
      <textarea id="so-cancel-reason" rows={3} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} style={{ ...fieldStyle, resize: 'vertical' }} />
      {err && <div style={errBox}>{err}</div>}
    </ModalShell>
  )
}

const ACCEPT_ATTR = 'image/*,application/pdf,.pdf,.xls,.xlsx'
const MAX_FILE_BYTES = 10 * 1024 * 1024

/**
 * Popup "Sếp đã duyệt" - chọn file phiếu Sếp đã ký tay rồi xác nhận (2026-08-27).
 *
 * Upload HOÃN tới lúc bấm Xác nhận (không upload ngay lúc chọn file) - cùng idiom
 * AdminEntityPage.tsx: người dùng chọn nhầm file rồi đóng popup là chuyện thường, upload ngay sẽ
 * để lại file rác vĩnh viễn trên Cloudinary vì không có đường xoá.
 */
export function BossApproveModal({ itemCount, orderLabel, onClose, onConfirm }: {
  itemCount: number
  /** Đơn đặt hàng đang duyệt, vd "Kim Phát – Số 53/2026" (2026-11-04: duyệt theo đơn). */
  orderLabel: string
  onClose: () => void
  onConfirm: (file: File) => Promise<void>
}) {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Chỉ ảnh mới xem trước được; PDF/Excel hiện tên file. Tính URL đồng bộ theo `file` (không qua
  // state riêng - tránh setState trong effect) - effect chỉ lo THU HỒI object URL khi đổi/đóng để
  // không giữ blob trong bộ nhớ tab.
  const previewUrl = file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const pick = (f: File | undefined) => {
    setErr('')
    if (!f) return
    if (f.size > MAX_FILE_BYTES) {
      setErr(`File ${(f.size / 1024 / 1024).toFixed(1)}MB - vượt giới hạn 10MB`)
      return
    }
    setFile(f)
  }

  const confirm = async () => {
    if (!file || busy) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm(file)
      onClose()
    } catch (e) {
      // Giữ popup mở kèm lỗi tại chỗ - đóng popup ở đây sẽ khiến người dùng mất file vừa chọn và
      // chỉ còn banner chung chung ở đầu trang, không rõ thao tác nào hỏng.
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <FileCheck2 size={17} color="var(--fg-2563eb)" />
          <span style={{ fontSize: 15, fontWeight: 700 }}>Sếp đã duyệt</span>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} style={{ display: 'flex', padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
            Tải lên phiếu <strong>đã có chữ ký của Sếp</strong> cho đơn đặt hàng <strong>{orderLabel}</strong> để xác nhận {itemCount} vật tư trong đơn được duyệt mua.
            Sau bước này Kho mới nhận hàng được.
          </div>

          <label
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 16px', border: '1.5px dashed var(--border)', borderRadius: 10, cursor: busy ? 'default' : 'pointer', background: 'var(--surface2)' }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" style={{ maxHeight: 160, maxWidth: '100%', borderRadius: 6 }} />
            ) : (
              <Paperclip size={22} color="var(--text3)" />
            )}
            <span style={{ fontSize: 13, fontWeight: 600, color: file ? 'var(--text)' : 'var(--text3)', wordBreak: 'break-all', textAlign: 'center' }}>
              {file ? file.name : 'Chọn file từ máy tính'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Ảnh, PDF hoặc Excel · tối đa 10MB</span>
            <input
              type="file"
              accept={ACCEPT_ATTR}
              hidden
              disabled={busy}
              onChange={e => {
                pick(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>

          {err && (
            <div style={{ marginTop: 12, padding: '8px 10px', fontSize: 12, color: 'var(--fg-991b1b)', background: 'var(--bg-fee2e2)', border: '1px solid var(--fg-fca5a5)', borderRadius: 8 }}>
              {err}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: busy ? 'default' : 'pointer' }}
          >
            Huỷ
          </button>
          <button
            onClick={() => void confirm()}
            disabled={!file || busy}
            style={{ padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: !file || busy ? 'var(--bg-93c5fd)' : 'var(--bg-2563eb)', color: '#fff', cursor: !file || busy ? 'default' : 'pointer' }}
          >
            {busy ? 'Đang tải lên…' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Tải file phiếu đề xuất .xlsx của 1 đơn (2026-11-04, bản v8 mục 7.6): BE điền mẫu
 * PHIEU_DE_XUAT_MAU_TRONG_IEA rồi trả base64 trong envelope JSON - giải mã thành Blob và tải xuống.
 */
export async function printSupplierOrderFile(orderId: string): Promise<void> {
  const { fileName, base64 } = await printSupplierOrder(orderId)
  const bytes = Uint8Array.from(atob(base64), ch => ch.charCodeAt(0))
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** THAY PHIẾU (bản v8 mục 7.2, 7.11) - đơn đã ký về chờ duyệt để gỡ dòng / sửa số mua; bắt buộc lý do. */
export function ReviseSupplierOrderModal({ orderLabel, onClose, onConfirm }: {
  orderLabel: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const confirm = async () => {
    if (!reason.trim() || busy) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm(reason.trim())
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Thay phiếu"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} disabled={busy} style={secondaryBtn}>Không</button>
        <button onClick={() => void confirm()} disabled={!reason.trim() || busy} style={primaryBtn(!reason.trim() || busy)}>
          {busy ? 'Đang xử lý…' : 'Thay phiếu'}
        </button>
      </>}
    >
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        Đơn <strong>{orderLabel}</strong> đã có phiếu Giám đốc ký. Thay phiếu đưa đơn về chờ duyệt để gỡ vật tư hoặc sửa số mua; vật tư chưa nhận hàng tạm dừng nhận cho tới khi có phiếu ký mới. Sau đó in lại phiếu (ghi &quot;THAY PHIẾU&quot;, cùng số đơn), xin Giám đốc ký và bấm &quot;Sếp đã duyệt&quot; lần nữa.
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }} htmlFor="so-revise-reason">
        Lý do <span style={{ color: 'var(--fg-dc2626)' }}>*</span>
      </label>
      <textarea id="so-revise-reason" rows={3} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} style={{ ...fieldStyle, resize: 'vertical' }} />
      {err && <div style={errBox}>{err}</div>}
    </ModalShell>
  )
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000

/** Dòng còn chờ nhận của 1 đơn đã ký - đầu vào "Đóng phần thiếu". */
export interface ShortageLine {
  id: string
  proposalId: string
  materialName: string
  orderCode: string | null
  unit: string
  buyQty: number
  purchaseQty: number
  receivedQty: number
}

/**
 * "Đóng phần thiếu" (Đợt 5e, bản v8 7.13): NCC không giao nốt. Dòng chọn được đóng kèm lý do; phần CẦN mua còn thiếu
 * (cần mua − đã nhận) quay lại "Vật tư chờ vào đơn" để đặt NCC khác bằng đơn + phiếu ký mới; phần mua dư chưa về thì bỏ.
 */
export function CloseShortageModal({ orderLabel, lines, onClose, onConfirm }: {
  orderLabel: string
  lines: ShortageLine[]
  onClose: () => void
  onConfirm: (itemIds: string[], reason: string) => Promise<void>
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(lines.map(l => l.id)))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ok = picked.size > 0 && reason.trim().length >= 3 && !busy

  const toggle = (id: string) => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const confirm = async () => {
    if (!ok) return
    setBusy(true)
    setErr('')
    try {
      await onConfirm([...picked], reason.trim())
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Đóng phần thiếu"
      onClose={onClose}
      footer={<>
        <button onClick={onClose} disabled={busy} style={secondaryBtn}>Không</button>
        <button onClick={() => void confirm()} disabled={!ok} style={primaryBtn(!ok)}>
          {busy ? 'Đang xử lý…' : 'Đóng phần thiếu'}
        </button>
      </>}
    >
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
        Đơn <strong>{orderLabel}</strong>: NCC không giao nốt. Dòng được chọn sẽ đóng lại, Kho không nhận tiếp. Phần cần mua còn thiếu
        quay lại &quot;Vật tư chờ vào đơn&quot; để đặt nhà cung cấp khác (đơn mới, phiếu Giám đốc ký mới); phần mua dư chưa về thì bỏ.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {lines.map(l => {
          const short = r4(l.purchaseQty - l.receivedQty)
          const reorder = r4(Math.max(0, l.buyQty - l.receivedQty))
          return (
            <label key={l.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={picked.has(l.id)} disabled={busy} onChange={() => toggle(l.id)} style={{ marginTop: 3 }} />
              <span>
                <b>{l.materialName}</b>
                {l.orderCode && <span style={{ fontFamily: 'monospace', fontSize: 12 }}> · {l.orderCode}</span>}
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)' }}>
                  Đã nhận {l.receivedQty}/{l.purchaseQty} {l.unit} · thiếu {short} {l.unit}
                  {reorder > 0 ? ` → mua lại ${reorder} ${l.unit}` : ' → đã đủ số cần, không mua lại'}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }} htmlFor="so-short-reason">
        Lý do <span style={{ color: 'var(--fg-dc2626)' }}>*</span>
      </label>
      <textarea id="so-short-reason" rows={3} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} placeholder="Vd: NCC báo hết hàng, không giao nốt" style={{ ...fieldStyle, resize: 'vertical' }} />
      {err && <div style={errBox}>{err}</div>}
    </ModalShell>
  )
}
