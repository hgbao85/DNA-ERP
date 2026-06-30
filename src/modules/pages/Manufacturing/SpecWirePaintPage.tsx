import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, Eye } from 'lucide-react'
import NotifBell from '../../../components/NotifBell'

// ─── Types ────────────────────────────────────────────────────────────
type BomItem = { id: number; ten: string; thoiGian: string }
type WireLine = { uid: number; maDay: string; unit: string; soLuong?: string; specifications: string; imageUrl: string }
type PendingReq = { uid: number; bomId: number; lines: WireLine[]; submittedAt: string }
type RejectedWireLine = WireLine & { submittedAt: string; lyDo: string }

// ─── Mock data ────────────────────────────────────────────────────────
const MOCK_BOMS: BomItem[] = [
  { id: 1, ten: 'Ghế J55',      thoiGian: '23/06/2026' },
  { id: 2, ten: 'Ghế IEA-3',    thoiGian: '22/06/2026' },
  { id: 3, ten: 'Bàn mặt kính', thoiGian: '21/06/2026' },
  { id: 4, ten: 'Ghế GoPlus',   thoiGian: '20/06/2026' },
]

const APPROVED_BOM_IDS: number[] = [1]

const MOCK_PENDING: PendingReq[] = [
  {
    uid: 1, bomId: 2, submittedAt: '24/06/2026 09:15:22', lines: [
      { uid: 1, maDay: 'DY-NH-002', unit: 'kg',  soLuong: '120', specifications: 'Dây nhựa xanh + sơn xám', imageUrl: '' },
      { uid: 2, maDay: 'SN-XM-001', unit: 'lít', soLuong: '60',  specifications: 'Sơn xám tĩnh điện',       imageUrl: '' },
    ],
  },
]

const MOCK_DRAFT: Record<number, WireLine[]> = {
  3: [{ uid: 3, maDay: 'DY-PE-003', unit: 'kg', soLuong: '80', specifications: 'Dây PE trắng', imageUrl: '' }],
}

const MOCK_REJECTED_LINES: Record<number, RejectedWireLine[]> = {
  4: [
    { uid: 99, maDay: 'DY-NH-999', unit: 'kg', soLuong: '10', specifications: 'Dây nhựa tím', imageUrl: '', submittedAt: '19/06/2026 10:30:00', lyDo: 'Màu dây không có trong bảng màu tiêu chuẩn — vui lòng chọn lại mã từ danh sách vật tư' },
  ],
}

const APPROVED_CATALOG: WireLine[] = [
  { uid: 10, maDay: 'DY-PE-001', unit: 'kg',  specifications: 'Dây PE xám GSS',       imageUrl: '' },
  { uid: 11, maDay: 'SN-DEN-01', unit: 'lít', specifications: 'Sơn đen tĩnh điện',    imageUrl: '' },
]

// ─── Main ─────────────────────────────────────────────────────────────
export default function SpecWirePaintPage({ subTab, onSubTabChange }: {
  subTab: 'dinh-muc' | 'catalog'
  onSubTabChange: (t: 'dinh-muc' | 'catalog') => void
}) {
  const [approvedBomIds] = useState<number[]>(APPROVED_BOM_IDS)
  const [pendingReqs, setPendingReqs] = useState<PendingReq[]>(MOCK_PENDING)
  const [draftsByBom, setDraftsByBom] = useState<Record<number, WireLine[]>>(MOCK_DRAFT)
  const [reqUid, setReqUid] = useState(2)
  const [draftUid, setDraftUid] = useState(4)

  const [selectedBom, setSelectedBom] = useState<BomItem | null>(null)
  const [fMaDay, setFMaDay] = useState('')
  const [fUnit, setFUnit] = useState('')
  const [fSoLuong, setFSoLuong] = useState('')
  const [fSpecifications, setFSpecifications] = useState('')
  const [fImageUrl, setFImageUrl] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [catalogPreviewUrl, setCatalogPreviewUrl] = useState<string | null>(null)
  const [fErr, setFErr] = useState('')
  const [sentMsg, setSentMsg] = useState(false)
  const [bomSearch, setBomSearch] = useState('')
  const [catalogSearch, setCatalogSearch] = useState('')
  const [rejectedLines] = useState<Record<number, RejectedWireLine[]>>(MOCK_REJECTED_LINES)

  const bomStatus = (bomId: number): 'approved' | 'pending' | 'rejected' | 'canInput' =>
    approvedBomIds.includes(bomId) ? 'approved'
    : pendingReqs.some(r => r.bomId === bomId) ? 'pending'
    : (rejectedLines[bomId] ?? []).length > 0 ? 'rejected'
    : 'canInput'

  const currentDrafts = selectedBom ? (draftsByBom[selectedBom.id] ?? []) : []
  const currentPending = selectedBom ? pendingReqs.filter(r => r.bomId === selectedBom.id) : []

  const openBom = (bom: BomItem) => {
    setSelectedBom(bom)
    setFMaDay(''); setFUnit(''); setFSoLuong(''); setFSpecifications(''); setFImageUrl('')
    setShowPreview(false); setFErr(''); setSentMsg(false)
  }

  const addToDraft = () => {
    setFErr('')
    if (!fMaDay.trim() || !selectedBom) { setFErr('Vui lòng nhập Mã dây.'); return }
    const line: WireLine = { uid: draftUid, maDay: fMaDay.trim(), unit: fUnit.trim(), soLuong: fSoLuong.trim(), specifications: fSpecifications.trim(), imageUrl: fImageUrl.trim() }
    setDraftsByBom(d => ({ ...d, [selectedBom.id]: [...(d[selectedBom.id] ?? []), line] }))
    setDraftUid(n => n + 1)
    setFMaDay(''); setFUnit(''); setFSoLuong(''); setFSpecifications(''); setFImageUrl('')
  }

  const removeDraft = (uid: number) => {
    if (!selectedBom) return
    setDraftsByBom(d => ({ ...d, [selectedBom.id]: (d[selectedBom.id] ?? []).filter(x => x.uid !== uid) }))
  }

  const submitAll = () => {
    if (!currentDrafts.length || !selectedBom) return
    setPendingReqs(p => [...p, { uid: reqUid, bomId: selectedBom.id, lines: [...currentDrafts], submittedAt: new Date().toLocaleString('vi-VN') }])
    setReqUid(n => n + 1)
    setDraftsByBom(d => ({ ...d, [selectedBom.id]: [] }))
    setSentMsg(true); setTimeout(() => setSentMsg(false), 3000)
  }

  /* ══ ĐỊNH MỨC CHI TIẾT: DETAIL ══ */
  if (subTab === 'dinh-muc' && selectedBom) {
    const st = bomStatus(selectedBom.id)
    return (
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Dây & Sơn</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập thông tin dây và sơn theo SKU</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setSelectedBom(null)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)',
          }}>
            <ChevronLeft size={14} /> Quay lại
          </button>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{selectedBom.ten}</span>
        </div>

        {st === 'approved' && (
          <div style={{ padding: '10px 16px', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 'var(--radius-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <span style={{ fontWeight: 600, color: '#2e7d32', fontSize: 13 }}>Đã duyệt lần trước</span>
            <span style={{ fontSize: 12, color: '#388e3c' }}>— có thể gửi thêm đề xuất bổ sung nếu còn thiếu</span>
          </div>
        )}

        {st === 'pending' && (
          <div style={{ padding: '10px 16px', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 'var(--radius-lg)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            <span style={{ fontWeight: 600, color: '#f57c00', fontSize: 13 }}>Đang chờ duyệt</span>
            <span style={{ fontSize: 12, color: '#ef6c00' }}>— không thể nhập thêm vật tư cho SKU này cho đến khi được duyệt</span>
          </div>
        )}

        {/* Form thêm — khoá khi đang chờ duyệt */}
        {st !== 'pending' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--text)' }}>
            {st === 'approved' ? 'Gửi đề xuất bổ sung' : 'Thêm vật tư vào danh sách'}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 120 }}>
              <FL>SKU</FL>
              <div style={{ padding: '7px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {selectedBom.ten}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 130 }}>
              <FL>Mã dây <span style={{ color: '#e53935' }}>*</span></FL>
              <MaDaySearch
                value={fMaDay}
                catalog={APPROVED_CATALOG}
                onSelect={item => {
                  if (item) {
                    setFMaDay(item.maDay)
                    setFUnit(item.unit)
                    setFSpecifications(item.specifications)
                  } else {
                    setFMaDay(''); setFUnit(''); setFSpecifications('')
                    setFSoLuong('')
                  }
                  setFErr('')
                }}
              />
            </div>
            <div style={{ width: 68 }}>
              <FL>ĐVT</FL>
              <input value={fUnit} onChange={e => setFUnit(e.target.value)}
                placeholder="kg" style={inputStyle} />
            </div>
            <div style={{ width: 90 }}>
              <FL>Số lượng</FL>
              <input type="number" min={0} value={fSoLuong} onChange={e => setFSoLuong(e.target.value)}
                placeholder="VD: 120" style={inputStyle} />
            </div>
            <div style={{ flex: 2, minWidth: 180 }}>
              <FL>Mô tả</FL>
              <input value={fSpecifications} onChange={e => setFSpecifications(e.target.value)}
                placeholder="VD: Dây PE xám + sơn tĩnh điện" style={inputStyle} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <FL>Image URL</FL>
              <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                <input value={fImageUrl} onChange={e => { setFImageUrl(e.target.value); setShowPreview(false) }}
                  placeholder="https://..." style={{ ...inputStyle, flex: 1 }} />
                {fImageUrl.trim() && (
                  <button onClick={() => setShowPreview(v => !v)} title="Xem ảnh" style={{
                    padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                    background: showPreview ? 'var(--surface2)' : 'var(--surface)',
                    cursor: 'pointer', color: showPreview ? '#1565c0' : 'var(--text3)',
                    display: 'flex', alignItems: 'center', flexShrink: 0,
                  }}>
                    <Eye size={15} />
                  </button>
                )}
                {showPreview && fImageUrl.trim() && (
                  <ImageModal url={fImageUrl.trim()} onClose={() => setShowPreview(false)} />
                )}
              </div>
            </div>
            <button onClick={addToDraft} style={{
              padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)',
              background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>+ Thêm</button>
          </div>
          {fErr && (
            <div style={{ marginTop: 10, padding: '8px 12px', background: '#ffebee', color: '#c62828', borderRadius: 'var(--radius)', fontSize: 13 }}>{fErr}</div>
          )}
        </div>
        )}

        {/* Draft list */}
        {currentDrafts.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid #c5cae9', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 16px', background: '#e8eaf6', borderBottom: '1px solid #c5cae9', fontWeight: 700, fontSize: 14, color: '#1a237e' }}>
              Danh sách chờ gửi
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: '#c5cae9', color: '#1a237e', borderRadius: 20, padding: '2px 8px' }}>
                {currentDrafts.length} vật tư
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['SKU', 'Mã dây', 'ĐVT', 'Số lượng', 'Mô tả', ''].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentDrafts.map(d => (
                  <tr key={d.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>{selectedBom?.ten}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{d.maDay}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{d.unit || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{d.soLuong || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{d.specifications || '—'}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button onClick={() => removeDraft(d.uid)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2 }}>
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
              <button onClick={submitAll} style={{
                padding: '8px 24px', border: 'none', borderRadius: 'var(--radius)',
                background: '#1565c0', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = '#0d47a1')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1565c0')}
              >Gửi đề xuất ({currentDrafts.length} vật tư) →</button>
            </div>
          </div>
        )}

        {sentMsg && (
          <div style={{ padding: '10px 16px', background: '#e8f5e9', color: '#2e7d32', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: 13, marginBottom: 16 }}>
            ✓ Đã gửi đề xuất thành công — đang chờ duyệt.
          </div>
        )}

        {/* Pending list */}
        {currentPending.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid #ffe082', borderLeft: '4px solid #f57c00', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', background: '#fff8e1', borderBottom: '1px solid #ffe082', fontWeight: 700, fontSize: 14, color: '#e65100' }}>
              Đang chờ duyệt
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, background: '#ffe082', color: '#e65100', borderRadius: 20, padding: '2px 8px' }}>
                {currentPending.reduce((s, r) => s + r.lines.length, 0)} vật tư
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                  {['SKU', 'Mã dây', 'ĐVT', 'Số lượng', 'Mô tả', 'Gửi lúc', 'Trạng thái'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: i === 6 ? 'right' : 'left', fontWeight: 600, color: 'var(--text2)', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentPending.flatMap(req => req.lines.map(l => (
                  <tr key={`${req.uid}-${l.uid}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text2)' }}>{selectedBom?.ten}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{l.maDay}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{l.unit || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{l.soLuong || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{l.specifications || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12 }}>{req.submittedAt}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <span style={{ background: '#fff8e1', color: '#f57c00', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Chờ duyệt</span>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rejected section */}
        {(rejectedLines[selectedBom.id] ?? []).length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid #ffcdd2', borderLeft: '4px solid #c62828', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginTop: 16 }}>
            <div style={{ padding: '12px 16px', background: '#ffebee', borderBottom: '1px solid #ffcdd2', fontWeight: 700, fontSize: 14, color: '#b71c1c', display: 'flex', alignItems: 'center', gap: 10 }}>
              ✕ Bị từ chối
              <span style={{ fontSize: 12, fontWeight: 600, background: '#ffcdd2', color: '#b71c1c', borderRadius: 20, padding: '2px 8px' }}>
                {(rejectedLines[selectedBom.id] ?? []).length} vật tư
              </span>
              <span style={{ fontSize: 12, color: '#c62828', fontWeight: 400, marginLeft: 4 }}>— xem lý do và gửi lại đề xuất mới</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#fff5f5', borderBottom: '1px solid #ffcdd2' }}>
                  {['Mã dây', 'ĐVT', 'Số lượng', 'Mô tả', 'Gửi lúc', 'Lý do từ chối'].map((h, i) => (
                    <th key={i} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: '#b71c1c', fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(rejectedLines[selectedBom.id] ?? []).map(l => (
                  <tr key={l.uid} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: 'var(--text)' }}>{l.maDay}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text2)' }}>{l.unit || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text)' }}>{l.soLuong || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)' }}>{l.specifications || '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 12, whiteSpace: 'nowrap' }}>{l.submittedAt}</td>
                    <td style={{ padding: '10px 14px', color: '#c62828', fontSize: 13 }}>{l.lyDo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {currentDrafts.length === 0 && currentPending.length === 0 && (rejectedLines[selectedBom.id] ?? []).length === 0 && !sentMsg && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
            Chưa có đề xuất nào. Điền form phía trên để bắt đầu.
          </div>
        )}
      </div>
    )
  }

  /* ══ ĐỊNH MỨC CHI TIẾT: LIST ══ */
  if (subTab === 'dinh-muc') {
    return (
      <div>
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Quản lý định mức — Dây & Sơn</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Nhập thông tin dây và sơn theo SKU</p>
          </div>
          <NotifBell
            items={MOCK_BOMS.filter(b => approvedBomIds.includes(b.id)).map(n => ({ id: n.id, title: n.ten, subtitle: `Đã duyệt định mức dây & sơn · ${n.thoiGian}` }))}
            emptyText="Chưa có định mức nào được duyệt."
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            value={bomSearch}
            onChange={e => setBomSearch(e.target.value)}
            placeholder="Tìm theo tên SKU…"
            style={{ maxWidth: 280, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['SKU', 'Thời gian', 'Trạng thái', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_BOMS.filter(b => b.ten.toLowerCase().includes(bomSearch.toLowerCase()) && bomStatus(b.id) !== 'approved').map(item => {
                const st = bomStatus(item.id)
                return (
                  <tr key={item.id}
                    onClick={() => openBom(item)}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{item.ten}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.thoiGian}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {st === 'pending'
                        ? <span style={{ background: '#fff3e0', color: '#e65100', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>⏳ Đợi duyệt</span>
                        : st === 'rejected'
                        ? <span style={{ background: '#ffebee', color: '#c62828', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>✕ Bị từ chối</span>
                        : <span style={{ background: '#eef2ff', color: '#3949ab', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Chờ nhập</span>
                      }
                    </td>
                    <td style={{ padding: '12px 14px' }}><ChevronRight size={16} color="var(--text3)" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  /* ══ DANH SÁCH VẬT TƯ ══ */
  return (
    <>
      <div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách vật tư — Dây & Sơn</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>Các mã dây & sơn đã được duyệt</p>
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            value={catalogSearch}
            onChange={e => setCatalogSearch(e.target.value)}
            placeholder="Tìm theo mã dây hoặc mô tả…"
            style={{ maxWidth: 320, padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
          />
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
                {['Mã dây', 'Mô tả', 'ĐVT', 'Image URL'].map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {APPROVED_CATALOG.filter(c => {
                const q = catalogSearch.toLowerCase()
                return c.maDay.toLowerCase().includes(q) || c.specifications.toLowerCase().includes(q)
              }).map((item, i, arr) => (
                <tr key={item.uid} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>{item.maDay}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text3)' }}>{item.specifications || '—'}</td>
                  <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{item.unit || '—'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    {item.imageUrl ? (
                      <button onClick={() => setCatalogPreviewUrl(item.imageUrl)} title="Xem ảnh" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: 2,
                      }}>
                        <Eye size={15} />
                      </button>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                </tr>
              ))}
              {APPROVED_CATALOG.filter(c => {
                const q = catalogSearch.toLowerCase()
                return c.maDay.toLowerCase().includes(q) || c.specifications.toLowerCase().includes(q)
              }).length === 0 && (
                <tr>
                  <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                    {catalogSearch ? 'Không tìm thấy kết quả.' : 'Chưa có vật tư nào được duyệt.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {catalogPreviewUrl && (
        <ImageModal url={catalogPreviewUrl} onClose={() => setCatalogPreviewUrl(null)} />
      )}
    </>
  )
}

function MaDaySearch({ value, onSelect, catalog }: {
  value: string
  onSelect: (item: WireLine | null) => void
  catalog: WireLine[]
}) {
  const [search, setSearch] = useState('')
  const [focused, setFocused] = useState(false)

  const filtered = search.trim() === ''
    ? catalog
    : catalog.filter(c =>
        c.maDay.toLowerCase().includes(search.toLowerCase()) ||
        c.specifications.toLowerCase().includes(search.toLowerCase())
      )

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 130 }}>
      <input
        value={focused ? search : value}
        placeholder="Chọn hoặc nhập mã dây…"
        onFocus={() => { setFocused(true); setSearch('') }}
        onBlur={() => setTimeout(() => { setFocused(false); setSearch('') }, 150)}
        onChange={e => { setSearch(e.target.value); onSelect(null) }}
        style={{ ...inputStyle, paddingRight: value && !focused ? 28 : 10 }}
      />
      {value && !focused && (
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={() => onSelect(null)}
          style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', display: 'flex', alignItems: 'center', padding: 2,
          }}>
          <X size={13} />
        </button>
      )}
      {focused && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 20px rgba(0,0,0,.12)',
          maxHeight: 240, overflowY: 'auto', marginTop: 4,
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '10px 14px', color: 'var(--text3)', fontSize: 13 }}>
              Không tìm thấy — mã dây phải được cấu hình sẵn trong danh sách
            </div>
          ) : filtered.map(c => (
            <div key={c.uid}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(c); setFocused(false); setSearch('') }}
              style={{
                padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                background: c.maDay === value ? 'var(--surface2)' : 'transparent',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = c.maDay === value ? 'var(--surface2)' : 'transparent')}
            >
              <div style={{ fontSize: 13, fontWeight: c.maDay === value ? 700 : 500, color: 'var(--text)' }}>{c.maDay}</div>
              {c.specifications && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{c.specifications}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ImageModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      <img
        src={url}
        alt="preview"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '60vw', maxHeight: '70vh',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          objectFit: 'contain',
          cursor: 'default',
        }}
      />
    </div>
  )
}

function ImagePreview({ url }: { url: string }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  return (
    <div style={{ marginTop: 8 }}>
      {status !== 'error' && (
        <img
          src={url}
          alt="preview"
          onLoad={() => setStatus('ok')}
          onError={() => setStatus('error')}
          style={{
            maxWidth: 160, maxHeight: 120, borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', objectFit: 'contain',
            display: status === 'loading' ? 'none' : 'block',
            background: 'var(--surface2)',
          }}
        />
      )}
      {status === 'loading' && (
        <div style={{ width: 160, height: 60, borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text3)' }}>
          Đang tải…
        </div>
      )}
      {status === 'error' && (
        <div style={{ padding: '5px 8px', background: '#ffebee', color: '#c62828', borderRadius: 'var(--radius)', fontSize: 11 }}>
          Không tải được ảnh
        </div>
      )}
    </div>
  )
}

function FL({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase' as const }}>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  background: 'var(--surface)', color: 'var(--text)',
  outline: 'none', boxSizing: 'border-box',
}
