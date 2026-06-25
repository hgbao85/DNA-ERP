'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, X, Search, ChevronDown, ChevronRight } from 'lucide-react'
import type { PlanForm } from '../../../types/plan-form'

const CAT_META = {
  sat:           { label: 'Sắt',           color: '#b45309', bg: '#fef3c7' },
  daySon:        { label: 'Dây/Sơn',       color: '#0369a1', bg: '#e0f2fe' },
  vatTuPhuKien:  { label: 'Phụ kiện',      color: '#7c3aed', bg: '#ede9fe' },
  baoBiDongGoi:  { label: 'Bao bì',        color: '#be185d', bg: '#fce7f3' },
} as const

type Cat = keyof typeof CAT_META

interface FlatItem {
  key: string
  pfId: number
  pfStatus: string
  pfCreatedAt: string
  productName: string
  productCode: string
  poNumber: string
  cat: Cat
  name: string
  spec: string | null
  unitQty: string | null
  createdAt: string | null
}

type ApprovalEntry = { status: 'APPROVED' | 'REJECTED'; reason?: string } | null

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PROPOSED: { label: 'Chờ duyệt', color: '#d97706', bg: '#fef3c7' },
  APPROVED: { label: 'Đã duyệt',  color: '#16a34a', bg: '#dcfce7' },
  REJECTED: { label: 'Từ chối',   color: '#dc2626', bg: '#fee2e2' },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.PROPOSED
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, gap: 8 }}>
      <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function pushItems(items: FlatItem[], pf: PlanForm, cat: Cat, arr: any[]) {
  const base = {
    pfId: pf.id,
    pfStatus: pf.status,
    pfCreatedAt: pf.createdAt,
    productName: pf.mfgProduct?.name ?? '—',
    productCode: pf.mfgProduct?.factoryCode ?? '—',
    poNumber: pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`,
  }
  arr.forEach((i: any, idx: number) => items.push({
    ...base,
    key: `${pf.id}-${cat}-${idx}`,
    cat,
    name: i.name,
    spec: [i.specifications, i.thickness != null ? `dày ${i.thickness}mm` : null].filter(Boolean).join(', ') || null,
    unitQty: i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : (i.unit ?? null),
    createdAt: i.createdAt ?? null,
  }))
}

function flattenItems(planForms: PlanForm[]): FlatItem[] {
  const items: FlatItem[] = []
  for (const pf of planForms) {
    const mt = pf.quotaManagement?.materialType
    if (!mt) continue
    if (Array.isArray(mt.sat))           pushItems(items, pf, 'sat',          mt.sat)
    if (Array.isArray(mt.daySon))        pushItems(items, pf, 'daySon',       mt.daySon)
    if (Array.isArray(mt.vatTuPhuKien))  pushItems(items, pf, 'vatTuPhuKien', mt.vatTuPhuKien)
    if (Array.isArray(mt.baoBiDongGoi))  pushItems(items, pf, 'baoBiDongGoi', mt.baoBiDongGoi)
  }
  return items
}

const FILTER_TABS: { id: Cat | 'all'; label: string }[] = [
  { id: 'all',          label: 'Tất cả' },
  { id: 'sat',          label: 'Sắt' },
  { id: 'daySon',       label: 'Dây/Sơn' },
  { id: 'vatTuPhuKien', label: 'Phụ kiện' },
  { id: 'baoBiDongGoi', label: 'Bao bì' },
]

export default function VatTuDashboardPage() {
  const { data: planForms = [], isLoading } = useFetch(() => api.getPlanForms(), [])
  const [approvals, setApprovals] = useState<Record<string, ApprovalEntry>>({})
  const [selected, setSelected] = useState<FlatItem | null>(null)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [filterCat, setFilterCat] = useState<Cat | 'all'>('all')
  const [q, setQ] = useState('')
  const [activeTab, setActiveTab] = useState<'vattu' | 'sku'>('vattu')
  const [selectedSkuPf, setSelectedSkuPf] = useState<PlanForm | null>(null)

  const allItems = flattenItems((planForms ?? []) as PlanForm[])

  const [mockSeeded, setMockSeeded] = useState(false)
  useEffect(() => {
    if (allItems.length === 0 || mockSeeded) return
    const CYCLE = [
      { status: 'APPROVED' as const },
      { status: 'APPROVED' as const },
      { status: 'PROPOSED' as const },
      { status: 'REJECTED' as const, reason: 'Không đủ tồn kho' },
      { status: 'APPROVED' as const },
      { status: 'PROPOSED' as const },
      { status: 'REJECTED' as const, reason: 'Sai quy cách, cần xem lại' },
      { status: 'APPROVED' as const },
      { status: 'PROPOSED' as const },
      { status: 'APPROVED' as const },
    ]
    const seed: Record<string, ApprovalEntry> = {}
    allItems.forEach((item, i) => {
      const c = CYCLE[i % CYCLE.length]
      if (c.status !== 'PROPOSED') seed[item.key] = c
    })
    setApprovals(seed)
    setMockSeeded(true)
  }, [allItems.length])

  const items = allItems.filter(it => {
    const matchCat = filterCat === 'all' || it.cat === filterCat
    const kw = q.trim().toLowerCase()
    const matchQ = !kw ||
      it.name.toLowerCase().includes(kw) ||
      (it.spec ?? '').toLowerCase().includes(kw) ||
      it.productName.toLowerCase().includes(kw) ||
      it.productCode.toLowerCase().includes(kw) ||
      it.poNumber.toLowerCase().includes(kw)
    return matchCat && matchQ
  })

  const approve = (key: string) => {
    setApprovals(p => ({ ...p, [key]: { status: 'APPROVED' } }))
    setShowRejectInput(false)
  }
  const confirmReject = (key: string) => {
    setApprovals(p => ({ ...p, [key]: { status: 'REJECTED', reason: rejectReason.trim() || undefined } }))
    setShowRejectInput(false)
    setRejectReason('')
  }

  const openDetail = (item: FlatItem) => {
    setSelected(item)
    setShowRejectInput(false)
    setRejectReason('')
  }

  const selectedApproval = selected ? (approvals[selected.key] ?? null) : null

  // Compute SKU approval summary grouped by planForm
  const skuList = ((planForms ?? []) as PlanForm[]).map(pf => {
    const pfItems = allItems.filter(it => it.pfId === pf.id)
    const approved = pfItems.filter(it => approvals[it.key]?.status === 'APPROVED').length
    const rejected = pfItems.filter(it => approvals[it.key]?.status === 'REJECTED').length
    const pending  = pfItems.length - approved - rejected
    return { pf, pfItems, approved, rejected, pending, total: pfItems.length }
  }).filter(s => s.pending > 0)


  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách Vật tư đăng ký</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          Tổng hợp vật tư từ tất cả định mức — {items.length}/{allItems.length} mục
        </p>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
        {([['vattu', 'Danh sách vật tư'], ['sku', 'SKU cần duyệt']] as ['vattu'|'sku', string][]).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{
              padding: '8px 16px', fontSize: 13, fontWeight: activeTab === id ? 700 : 500,
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: activeTab === id ? '#e65100' : 'var(--text2)',
              borderBottom: activeTab === id ? '2px solid #e65100' : '2px solid transparent',
              marginBottom: -1,
            }}
          >{label}</button>
        ))}
      </div>

      {activeTab === 'sku' && (
        <div>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}><Loader2 size={18} /> Đang tải...</div>
          ) : selectedSkuPf ? (
            /* ── Detail view ── */
            <div>
              <button
                onClick={() => setSelectedSkuPf(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}
              >
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /> Danh sách
              </button>

              <div style={{ marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>
                  {selectedSkuPf.mfgProduct?.factoryCode} — {selectedSkuPf.mfgProduct?.name}
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Tạo lúc {format(new Date(selectedSkuPf.createdAt), 'HH:mm · dd/MM/yyyy')}
                  {selectedSkuPf.exportOrder?.poNumber && <span> · PO: {selectedSkuPf.exportOrder.poNumber}</span>}
                </div>
              </div>

              {(['sat','daySon','vatTuPhuKien','baoBiDongGoi'] as Cat[]).map(cat => {
                const catItems = allItems.filter(it => it.pfId === selectedSkuPf.id && it.cat === cat && !approvals[it.key])
                if (catItems.length === 0) return null
                const meta = CAT_META[cat]
                return (
                  <div key={cat} style={{ marginBottom: 16, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ background: meta.bg, padding: '8px 14px', fontWeight: 700, fontSize: 13, color: meta.color }}>
                      {meta.label} ({catItems.length} vật tư chờ duyệt)
                    </div>
                    {catItems.map(item => {
                      const approval = approvals[item.key] ?? null
                      return (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{item.name}</div>
                            {item.spec && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{item.spec}</div>}
                          </div>
                          {item.unitQty && <span style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{item.unitQty}</span>}
                          {approval ? (
                            <StatusBadge status={approval.status} />
                          ) : (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => approve(item.key)}
                                style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: 'none', cursor: 'pointer', background: '#dcfce7', color: '#16a34a' }}>
                                Duyệt
                              </button>
                              <button onClick={() => openDetail(item)}
                                style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--surface2)', color: 'var(--text2)' }}>
                                Chi tiết
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ) : skuList.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Không có SKU nào chờ duyệt</div>
          ) : (
            /* ── List view ── */
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                    <th style={thStyle}>SKU</th>
                    <th style={{ ...thStyle, width: 160 }}>Thời gian tạo</th>
                    <th style={{ ...thStyle, width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {skuList.map(({ pf }) => (
                    <tr key={pf.id}
                      onClick={() => setSelectedSkuPf(pf)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={tdStyle}>
                        <span style={{ fontWeight: 700 }}>{pf.mfgProduct?.factoryCode ?? '—'}</span>
                        <span style={{ color: 'var(--text3)', margin: '0 6px' }}>—</span>
                        <span>{pf.mfgProduct?.name ?? '—'}</span>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {format(new Date(pf.createdAt), 'HH:mm · dd/MM/yyyy')}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <ChevronRight size={14} color="var(--text3)" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'vattu' && <>
      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text3)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tìm tên vật tư, sản phẩm, PO…"
            style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.map(ft => {
            const active = filterCat === ft.id
            const meta = ft.id !== 'all' ? CAT_META[ft.id] : null
            return (
              <button
                key={ft.id}
                onClick={() => setFilterCat(ft.id)}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: active ? 700 : 500,
                  borderRadius: 20, border: active ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  background: active ? (meta?.bg ?? '#f1f5f9') : 'var(--surface)',
                  color: active ? (meta?.color ?? '#334155') : 'var(--text2)',
                }}
              >{ft.label}</button>
            )
          })}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <Loader2 size={18} /> Đang tải...
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 100 }} />
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 88 }} />
              <col style={{ width: 180 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>Loại</th>
                <th style={thStyle}>Tên vật tư</th>
                <th style={thStyle}>Quy cách</th>
                <th style={thStyle}>ĐVT / SL</th>
                <th style={thStyle}>Sản phẩm</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const meta = CAT_META[item.cat]
                const approval = approvals[item.key] ?? null
                return (
                  <tr
                    key={item.key}
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.spec ?? '—'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{item.unitQty ?? '—'}</td>
                    <td style={{ ...tdStyle, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{item.productCode}</span>
                      <span style={{ color: 'var(--text3)', margin: '0 4px' }}>—</span>
                      {item.productName}
                    </td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    {q.trim() || filterCat !== 'all' ? 'Không tìm thấy vật tư phù hợp' : 'Không có vật tư nào'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      </>}

      {/* Detail drawer — outside tab fragments so both tabs can open it */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div style={{ background: 'var(--surface)', width: 360, overflow: 'auto', padding: 24, boxShadow: '-4px 0 32px rgba(0,0,0,.14)', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: CAT_META[selected.cat].color, background: CAT_META[selected.cat].bg }}>
                {CAT_META[selected.cat].label}
              </span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 4 }}>
                <X size={18} color="var(--text3)" />
              </button>
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{selected.name}</h3>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{selected.spec ?? '—'}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <InfoRow label="ĐVT / Số lượng" value={selected.unitQty ?? '—'} />
              {selected.createdAt && (
                <InfoRow label="Thời gian nhập" value={format(new Date(selected.createdAt), 'HH:mm · dd/MM/yyyy')} />
              )}
            </div>

            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                Định mức #{selected.pfId}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <InfoRow label="Sản phẩm" value={`${selected.productCode} — ${selected.productName}`} />
                <InfoRow label="Mã lệnh SX" value={selected.poNumber} />
                <InfoRow label="Ngày tạo" value={format(new Date(selected.pfCreatedAt), 'dd/MM/yyyy')} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                  <span style={{ color: 'var(--text3)' }}>Trạng thái</span>
                  <StatusBadge status={selected.pfStatus} />
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Duyệt vật tư
              </div>

              {selectedApproval && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: selectedApproval.status === 'APPROVED' ? '#dcfce7' : '#fee2e2' }}>
                  <StatusBadge status={selectedApproval.status} />
                  {selectedApproval.reason && (
                    <div style={{ marginTop: 5, fontSize: 12, color: '#dc2626', fontStyle: 'italic' }}>{selectedApproval.reason}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => approve(selected.key)}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: selectedApproval?.status === 'APPROVED' ? '#16a34a' : 'rgba(22,163,74,0.12)',
                    color: selectedApproval?.status === 'APPROVED' ? '#fff' : '#16a34a',
                  }}
                >Duyệt</button>
                <button
                  onClick={() => { setShowRejectInput(v => !v); setRejectReason('') }}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: selectedApproval?.status === 'REJECTED' ? '#dc2626' : 'rgba(220,38,38,0.10)',
                    color: selectedApproval?.status === 'REJECTED' ? '#fff' : '#dc2626',
                  }}
                >Từ chối</button>
              </div>

              {showRejectInput && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Lý do từ chối (không bắt buộc)..."
                    rows={3}
                    autoFocus
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                    >Hủy</button>
                    <button
                      onClick={() => confirmReject(selected.key)}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >Xác nhận</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties = { padding: '12px 16px' }
