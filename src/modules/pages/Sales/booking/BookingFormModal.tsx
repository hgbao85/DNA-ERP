// Phần A – Đợt 10a (YC5): form tạo / sửa / xem booking. Chọn hàng theo từng lệnh SX ở BookingLinePicker.
import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Paperclip, X } from 'lucide-react'
import Modal from '../../../../components/Modal'
import SearchableSelect from '../../../../components/SearchableSelect'
import { useConfirm } from '../../../../hooks/useConfirm'
import { useFetch } from '../../../../hooks/useFetch'
import { useIsMobile } from '../../../../hooks/useMediaQuery'
import {
  confirmBooking, createBooking, getBooking, getBookingMeta, updateBooking,
} from '../../../../services/bookings-api'
import { getCustomers, type BeCustomer } from '../../../../services/customers-api'
import { uploadDocument } from '../../../../services/uploads-api'
import { fmtVnDateTime, isoToVnLocal, vnLocalToIso } from '../../../../utils/bookingDates'
import { btnSecondary } from '../../../../styles/buttons'
import type {
  Booking, BookingAttachment, BookingCandidate, BookingMeta, CreateBookingBody, UpdateBookingBody,
} from '../../../../types/booking'
import BookingLinePicker, { cleanQty, hasOverflowQty, parseQty, useBookingCandidates } from './BookingLinePicker'
import CancelBookingDialog from './CancelBookingDialog'
import {
  CONTAINER_TYPE_SUGGESTIONS, CUTOFF_STYLE, ErrorBanner, StatusPill, errText,
} from './bookingShared'

type SavedInfo = { notice?: string; error?: string }

interface Props {
  /** null = tạo mới. */
  bookingId: string | null
  /** Chỉ xem (KHSX/Sếp dùng lại màn này). */
  readOnly: boolean
  onClose: () => void
  /** Có thay đổi dữ liệu -> làm mới danh sách bên ngoài. */
  onChanged: () => void
}

/** Vỏ modal: tải booking (khi sửa), meta kho/cont và danh sách khách, rồi dựng form. Cha mount có điều kiện để reset state mỗi lần mở. */
export default function BookingFormModal({ bookingId, readOnly, onClose, onChanged }: Props) {
  const { data: meta, error: metaError } = useFetch<BookingMeta>(() => getBookingMeta())
  const { data: customers } = useFetch<BeCustomer[]>(() => getCustomers())
  const [loaded, setLoaded] = useState<{ id: string; booking: Booking | null; error: string | null } | null>(null)
  const [saved, setSaved] = useState<{ booking: Booking; info: SavedInfo; version: number } | null>(null)

  useEffect(() => {
    if (!bookingId) return
    let alive = true
    getBooking(bookingId)
      .then(b => { if (alive) setLoaded({ id: bookingId, booking: b, error: null }) })
      .catch(e => { if (alive) setLoaded({ id: bookingId, booking: null, error: errText(e, 'Không tải được booking') }) })
    return () => { alive = false }
  }, [bookingId])

  const loading = !!bookingId && loaded?.id !== bookingId
  const initial: Booking | null = saved?.booking ?? (bookingId ? loaded?.booking ?? null : null)
  const loadError = bookingId && loaded?.id === bookingId ? loaded.error : null

  let content: React.ReactNode
  if (loadError || metaError) {
    content = <ErrorBanner>{loadError ?? metaError}</ErrorBanner>
  } else if (loading || !meta || !customers) {
    content = <div style={{ padding: 32, color: 'var(--text3)' }}>Đang tải...</div>
  } else {
    content = (
      <FormBody
        key={`${initial?.id ?? 'new'}-${saved?.version ?? 0}`}
        initial={initial}
        meta={meta}
        customers={customers}
        readOnlyProp={readOnly}
        info={saved?.info ?? {}}
        onSaved={(b, info) => { setSaved(s => ({ booking: b, info, version: (s?.version ?? 0) + 1 })); onChanged() }}
        onCancelled={() => { onChanged(); onClose() }}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal open maxWidth={1100}>
      {(loadError || metaError || loading || !meta || !customers) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} aria-label="Đóng" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}><X size={18} /></button>
        </div>
      )}
      {content}
    </Modal>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 5 }

function Field({ label, children, wide = false, style }: { label: string; children: React.ReactNode; wide?: boolean; style?: React.CSSProperties }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : undefined, minWidth: 0, ...style }}>
      <label style={{ ...labelStyle, color: style?.color ?? labelStyle.color }}>{label}</label>
      {children}
    </div>
  )
}

const fullWidth: React.CSSProperties = { width: '100%', boxSizing: 'border-box' }

interface BodyProps {
  initial: Booking | null
  meta: BookingMeta
  customers: BeCustomer[]
  readOnlyProp: boolean
  info: SavedInfo
  onSaved: (b: Booking, info: SavedInfo) => void
  onCancelled: () => void
  onClose: () => void
}

function FormBody({ initial, meta, customers, readOnlyProp, info, onSaved, onCancelled, onClose }: BodyProps) {
  const isMobile = useIsMobile()
  const { ask, confirmModal } = useConfirm()
  const status = initial?.status ?? 'DRAFT'
  const editable = !readOnlyProp && (status === 'DRAFT' || status === 'CONFIRMED')

  const [customerId, setCustomerId] = useState(initial?.customerId ?? '')
  const [bookingNo, setBookingNo] = useState(initial?.bookingNo ?? '')
  const [containerQty, setContainerQty] = useState(String(initial?.containerQty ?? 1))
  const [containerType, setContainerType] = useState(initial?.containerType ?? '40HC')
  const [pod, setPod] = useState(initial?.pod ?? '')
  const [cutSi, setCutSi] = useState(isoToVnLocal(initial?.cutSiAt))
  const [pickupDate, setPickupDate] = useState(initial?.pickupDate?.slice(0, 10) ?? '')
  const [cutOff, setCutOff] = useState(isoToVnLocal(initial?.cutOffAt))
  const [etd, setEtd] = useState(initial?.etd?.slice(0, 10) ?? '')
  const [pickupPlace, setPickupPlace] = useState(initial?.pickupPlace ?? '')
  const [vessel, setVessel] = useState(initial?.vesselVoyage ?? '')
  const [warehouseCode, setWarehouseCode] = useState(initial?.warehouseCode ?? '')
  const [warehouseTouched, setWarehouseTouched] = useState(!!initial?.warehouseCode)
  const [note, setNote] = useState(initial?.note ?? '')
  const [attachments, setAttachments] = useState<BookingAttachment[]>(initial?.attachments ?? [])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [qty, setQty] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {}
    for (const l of initial?.lines ?? []) m[l.productionInvoiceItemId] = String(l.qty)
    return m
  })
  const [linesDirty, setLinesDirty] = useState(false)
  const [customerChanged, setCustomerChanged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(info.error ?? null)
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null)

  const { candidates, error: candError, loading: candLoading } = useBookingCandidates(customerId, initial?.id, editable)

  const savedShort = useMemo(() => {
    const m: Record<string, number> = {}
    for (const l of initial?.lines ?? []) if (l.shortQty > 0) m[l.productionInvoiceItemId] = l.shortQty
    return m
  }, [initial])

  const chosenLines = useMemo(
    () => (candidates ?? []).filter(c => parseQty(qty[c.productionInvoiceItemId]) > 0),
    [candidates, qty],
  )
  const suggestedWarehouse = useMemo(() => {
    if (chosenLines.length === 0) return null
    const codes = new Set(chosenLines.map(c => c.itemWarehouseCode ?? ''))
    if (codes.size !== 1) return null
    const code = [...codes][0]
    return code && meta.finishedWarehouses.some(w => w.code === code) ? code : null
  }, [chosenLines, meta])

  const totalChosen = editable
    ? Object.values(qty).reduce((s, v) => s + parseQty(v), 0)
    : (initial?.lines ?? []).reduce((s, l) => s + l.qty, 0)
  const overflow = editable && candidates ? hasOverflowQty(candidates, qty) : false
  const containerQtyNum = Number(containerQty)
  const warehouseName = meta.finishedWarehouses.find(w => w.code === warehouseCode)?.name ?? ''
  const headerOk = !!customerId && !!bookingNo.trim() && !!pod.trim() && Number.isInteger(containerQtyNum) && containerQtyNum >= 1
  const lineSyncPending = (linesDirty || customerChanged || !initial) && (candLoading || (!!customerId && candidates === null && !candError))
  const canSave = editable && headerOk && !overflow && !busy && !lineSyncPending

  const changeQty = (id: string, value: string) => {
    const next = { ...qty, [id]: value }
    setQty(next)
    setLinesDirty(true)
    if (!warehouseTouched && candidates) {
      const picked = candidates.filter(c => parseQty(next[c.productionInvoiceItemId]) > 0)
      const codes = new Set(picked.map(c => c.itemWarehouseCode ?? ''))
      const code = codes.size === 1 ? [...codes][0] : ''
      if (code && meta.finishedWarehouses.some(w => w.code === code)) setWarehouseCode(code)
    }
  }

  const changeCustomer = (c: BeCustomer) => {
    const next = String(c.id)
    if (next === customerId) return
    const apply = () => {
      setCustomerId(next)
      setCustomerChanged(true)
      setLinesDirty(true)
      setQty({})
    }
    if (totalChosen > 0) {
      ask(
        { title: 'Đổi khách hàng', message: 'Đổi khách hàng sẽ xoá toàn bộ hàng đã chọn trong booking này. Tiếp tục?', confirmLabel: 'Đổi khách và xoá hàng', danger: true },
        apply,
      )
    } else {
      apply()
    }
  }

  const buildLines = (cands: BookingCandidate[]) => cands
    .map(c => ({ productionInvoiceItemId: c.productionInvoiceItemId, qty: parseQty(qty[c.productionInvoiceItemId]) }))
    .filter(l => l.qty > 0)

  const buildBody = (uploaded: BookingAttachment[]): CreateBookingBody & UpdateBookingBody => {
    const body: CreateBookingBody = {
      bookingNo: bookingNo.trim(),
      customerId,
      containerType: containerType.trim() || '40HC',
      containerQty: containerQtyNum,
      pod: pod.trim(),
      cutSiAt: cutSi ? vnLocalToIso(cutSi) : null,
      pickupDate: pickupDate || null,
      cutOffAt: cutOff ? vnLocalToIso(cutOff) : null,
      etd: etd || null,
      pickupPlace: pickupPlace.trim() || null,
      vesselVoyage: vessel.trim() || null,
      warehouseCode: warehouseCode || null,
      note: note.trim() || null,
      attachments: uploaded.map(a => ({ name: a.name, url: a.url })),
    }
    if ((linesDirty || customerChanged || !initial) && candidates) body.lines = buildLines(candidates)
    return body
  }

  /** Upload file mới (chỉ lúc bấm Lưu) rồi tạo/cập nhật. Trả null + hiện lỗi khi hỏng. */
  const persist = async (): Promise<Booking | null> => {
    let current = attachments
    try {
      if (newFiles.length > 0) {
        const added: BookingAttachment[] = []
        for (const f of newFiles) {
          const url = await uploadDocument(f)
          added.push({ name: f.name, url, uploadedAt: null })
        }
        current = [...attachments, ...added]
        setAttachments(current)
        setNewFiles([])
      }
      const body = buildBody(current)
      return initial ? await updateBooking(initial.id, body) : await createBooking(body as CreateBookingBody)
    } catch (e) {
      setError(errText(e, 'Không lưu được booking'))
      return null
    }
  }

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    setError(null)
    try {
      const b = await persist()
      if (b) onSaved(b, { notice: `Đã lưu booking ${b.bookingNo}.` })
    } finally {
      setBusy(false)
    }
  }

  const saveAndConfirm = async () => {
    if (!canSave) return
    if (totalChosen <= 0) { setError('Chưa chọn hàng nào để xếp lên cont. Nhập số bộ ít nhất 1 dòng rồi xác nhận.'); return }
    if (!warehouseCode) { setError('Chưa chọn "Kho thành phẩm gom hàng". Chọn kho gom rồi xác nhận.'); return }
    setBusy(true)
    setError(null)
    try {
      const b = await persist()
      if (!b) return
      try {
        const done = await confirmBooking(b.id)
        onSaved(done, { notice: `Đã lưu và xác nhận booking ${done.bookingNo}.` })
      } catch (e) {
        onSaved(b, { error: `Đã lưu nhưng chưa xác nhận được: ${errText(e, 'lỗi không rõ')}` })
      }
    } finally {
      setBusy(false)
    }
  }

  const poText = (initial?.orderCodes ?? []).join(', ')
  const lenhText = (initial?.lenhCodes ?? []).join(', ')
  const dis = !editable
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 'var(--space-4)' }
  const btnBig: React.CSSProperties = { minHeight: 40, padding: '9px 20px', fontSize: 13, fontWeight: 600, borderRadius: 'var(--radius)', cursor: 'pointer' }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 'var(--space-4)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 700, fontSize: 17 }}>{initial ? `Booking ${initial.bookingNo}` : 'Tạo booking'}</div>
            {initial && <StatusPill status={initial.status} />}
          </div>
          {initial && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
              Tạo bởi {initial.createdByName ?? '—'} · {fmtVnDateTime(initial.createdAt)}
              {poText && <> · PO: <b style={{ color: 'var(--text2)' }}>{poText}</b></>}
              {lenhText && <> · Lệnh: <b style={{ color: 'var(--text2)' }}>{lenhText}</b></>}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng" style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 8, flexShrink: 0 }}><X size={18} /></button>
      </div>

      {info.notice && !error && (
        <div style={{ padding: '8px 12px', marginBottom: 'var(--space-4)', borderRadius: 'var(--radius)', background: 'var(--bg-dcfce7)', color: 'var(--fg-15803d)', fontSize: 13 }}>{info.notice}</div>
      )}
      {initial?.status === 'CANCELLED' && (
        <ErrorBanner>Booking đã huỷ{initial.cancelReason ? `: ${initial.cancelReason}` : ''}</ErrorBanner>
      )}
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div style={grid}>
        <Field label="Khách hàng *">
          {dis ? (
            <input value={initial?.customerName ?? ''} disabled style={fullWidth} />
          ) : (
            <SearchableSelect
              displayValue={customers.find(c => String(c.id) === customerId)?.name ?? ''}
              options={customers}
              getKey={c => String(c.id)}
              getSearchText={c => c.name}
              renderOption={c => <strong>{c.name}</strong>}
              onSelect={changeCustomer}
              placeholder="Gõ để tìm khách hàng"
            />
          )}
        </Field>
        <Field label="Số booking *">
          <input value={bookingNo} onChange={e => setBookingNo(e.target.value)} disabled={dis} style={fullWidth} placeholder="Số booking của hãng tàu" />
        </Field>
        <Field label="Số cont × Loại cont">
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="number" min={1} step={1} value={containerQty} onChange={e => setContainerQty(e.target.value)} disabled={dis} aria-label="Số cont" style={{ width: 80, flexShrink: 0 }} />
            <input list="booking-container-types" value={containerType} onChange={e => setContainerType(e.target.value)} disabled={dis} aria-label="Loại cont" style={{ flex: 1, minWidth: 0 }} />
            <datalist id="booking-container-types">
              {CONTAINER_TYPE_SUGGESTIONS.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
        </Field>
        <Field label="POD – cảng đến *">
          <input value={pod} onChange={e => setPod(e.target.value)} disabled={dis} style={fullWidth} placeholder="LA, NY, TACOMA, TX..." />
        </Field>
        <Field label="Cắt SI (giờ VN)">
          <input type="datetime-local" value={cutSi} onChange={e => setCutSi(e.target.value)} disabled={dis} style={fullWidth} />
        </Field>
        <Field label="Ngày lấy cont">
          <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} disabled={dis} style={fullWidth} />
        </Field>
        <Field label="CUT OFF – hạn chót hạ cont (giờ VN)" style={{ ...CUTOFF_STYLE, padding: 8, borderRadius: 'var(--radius)' }}>
          <input type="datetime-local" value={cutOff} onChange={e => setCutOff(e.target.value)} disabled={dis} style={fullWidth} />
        </Field>
        <Field label="ETD">
          <input type="date" value={etd} onChange={e => setEtd(e.target.value)} disabled={dis} style={fullWidth} />
        </Field>
        <Field label="Nơi lấy cont">
          <input value={pickupPlace} onChange={e => setPickupPlace(e.target.value)} disabled={dis} style={fullWidth} placeholder="Vd QUY NHƠN" />
        </Field>
        <Field label="Tên tàu / chuyến">
          <input value={vessel} onChange={e => setVessel(e.target.value)} disabled={dis} style={fullWidth} placeholder="Vd TÊN TÀU 0123-045N" />
        </Field>
        <Field label="Kho thành phẩm gom hàng">
          <select
            value={warehouseCode}
            onChange={e => { setWarehouseCode(e.target.value); setWarehouseTouched(true) }}
            disabled={dis}
            style={fullWidth}
          >
            <option value="">— Chưa chọn —</option>
            {meta.finishedWarehouses.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
          </select>
          {!dis && suggestedWarehouse && suggestedWarehouse !== warehouseCode && (
            <button
              type="button"
              onClick={() => { setWarehouseCode(suggestedWarehouse); setWarehouseTouched(true) }}
              style={{ marginTop: 5, padding: 0, border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
            >
              Hàng đã chọn đang ở {meta.finishedWarehouses.find(w => w.code === suggestedWarehouse)?.name} - dùng kho này
            </button>
          )}
        </Field>
        <Field label="Ghi chú" wide>
          <textarea value={note} onChange={e => setNote(e.target.value)} disabled={dis} rows={2} style={{ ...fullWidth, minHeight: 60 }} placeholder="Contract No, hạ tháng 10, ghép cont với..." />
        </Field>
        <Field label="File / ảnh booking của hãng tàu" wide>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attachments.map((a, i) => (
              <div key={`${a.url}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)' }}>
                <Paperclip size={13} color="var(--text3)" />
                <a href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--blue)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name} <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
                </a>
                {!dis && (
                  <button type="button" onClick={() => setAttachments(list => list.filter((_, j) => j !== i))} aria-label={`Gỡ ${a.name}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6 }}><X size={14} color="var(--text3)" /></button>
                )}
              </div>
            ))}
            {newFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                <Paperclip size={13} color="var(--text3)" />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name} <span style={{ color: 'var(--text3)' }}>(tải lên khi bấm Lưu)</span></span>
                <button type="button" onClick={() => setNewFiles(list => list.filter((_, j) => j !== i))} aria-label={`Bỏ ${f.name}`} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 6 }}><X size={14} color="var(--text3)" /></button>
              </div>
            ))}
            {attachments.length === 0 && newFiles.length === 0 && dis && <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Không có file đính kèm</span>}
            {!dis && (
              <label style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', minHeight: 40, boxSizing: 'border-box', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface2)', cursor: 'pointer' }}>
                <Paperclip size={14} /> Chọn file / ảnh
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.xls,.xlsx"
                  style={{ display: 'none' }}
                  onChange={e => { const files = Array.from(e.target.files ?? []); if (files.length) setNewFiles(list => [...list, ...files]); e.target.value = '' }}
                />
              </label>
            )}
          </div>
        </Field>
      </div>

      <div style={{ fontWeight: 700, fontSize: 14, margin: '4px 0 6px' }}>Hàng xếp lên cont</div>
      <BookingLinePicker
        customerChosen={!!customerId}
        candidates={candidates}
        loading={candLoading}
        error={candError}
        qty={qty}
        onQtyChange={(id, v) => changeQty(id, cleanQty(v))}
        savedShort={savedShort}
        readOnly={dis}
        viewLines={initial?.lines ?? []}
        containerVolumeM3={meta.containerVolumeM3}
        containerQty={Number.isFinite(containerQtyNum) ? containerQtyNum : 0}
        warehouseCode={warehouseCode}
        warehouseName={warehouseName}
        isMobile={isMobile}
      />
      {overflow && <div style={{ marginTop: 8, fontSize: 12.5, color: 'var(--fg-e24b4a)', fontWeight: 600 }}>Có dòng nhập vượt số còn lại - sửa lại mới lưu được.</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 'var(--space-6)' }}>
        <div>
          {editable && initial && (initial.status === 'DRAFT' || initial.status === 'CONFIRMED') && (
            <button type="button" disabled={busy} onClick={() => setCancelTarget(initial)} style={{ ...btnBig, background: 'var(--surface)', border: '1px solid var(--fg-e24b4a)', color: 'var(--fg-e24b4a)' }}>Huỷ booking</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...btnSecondary, ...btnBig, fontWeight: 500 }}>Đóng</button>
          {editable && (
            <button type="button" onClick={save} disabled={!canSave} style={{ ...btnBig, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', opacity: canSave ? 1 : 0.6, cursor: canSave ? 'pointer' : 'not-allowed' }}>
              {busy ? 'Đang lưu...' : 'Lưu'}
            </button>
          )}
          {editable && status === 'DRAFT' && (
            <button type="button" onClick={saveAndConfirm} disabled={!canSave} style={{ ...btnBig, background: 'var(--bg-15803d)', border: 'none', color: '#fff', opacity: canSave ? 1 : 0.6, cursor: canSave ? 'pointer' : 'not-allowed' }}>
              {busy ? 'Đang lưu...' : 'Lưu & xác nhận'}
            </button>
          )}
        </div>
      </div>

      {confirmModal}
      <CancelBookingDialog booking={cancelTarget} onClose={() => setCancelTarget(null)} onCancelled={onCancelled} />
    </>
  )
}
