import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { format, differenceInCalendarDays } from 'date-fns'
import { AlertCircle, LayoutGrid, MapPin, ArrowLeft } from 'lucide-react'
import MfgStageBoardPage from './MfgStageBoardPage'
import ChuyenKiemPage from './ChuyenKiemPage'
import DongGoiPage from './DongGoiPage'
import WeavingPointsPage from './WeavingPointsPage'

// 4 công đoạn SX + 2 công đoạn sau-đan (Chuyền kiểm, Đóng gói) — tất cả mở bằng cách bấm vào ô.
const STAGES = ['PHOI', 'HAN', 'SON', 'WEAVING'] as const
type StageKey = typeof STAGES[number]
const STAGE_LABEL: Record<StageKey, string> = { PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn', WEAVING: 'Đan' }
// Công đoạn có cổng KCS (đếm hàng chờ duyệt)
const KCS_STAGES: Record<string, 'PHOI' | 'HAN' | 'SON' | null> = { PHOI: 'PHOI', HAN: 'HAN', SON: 'SON', WEAVING: null }

const PI_STATUS_LABEL: Record<string, string> = {
  NEW: 'Mới', PLANNING: 'Lên kế hoạch', PURCHASING: 'Mua hàng',
  PRODUCING: 'Đang SX', QC_STAGE: 'QC', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy',
}

interface Stage { stageType: string; progressPercent: number; status: string }
interface PIItem { quantity: number; productVariant?: { colorCode?: string | null; mfgProduct?: { name: string; factoryCode: string } } }
interface PI {
  id: number; code: string; deadline: string; status: string
  items: PIItem[]; stages: Stage[]
}
type KcsCounts = Record<number, { PHOI: number; HAN: number; SON: number }>

// Dữ liệu Chuyền kiểm / Đóng gói (lấy từ 2 endpoint riêng, map theo piId để hiện % trên bảng)
interface CKPiece { target: number; inspected: number }
interface CKPI { piId: number; pieces: CKPiece[]; pendingReports: unknown[] }
interface PKPI { piId: number; totalTarget: number; totalPacked: number; allDone: boolean }

const fmtPct = (n: number) => `${n}%`

// Drill-down: bấm ô để mở chi tiết công đoạn / chuyền kiểm / đóng gói
type Detail =
  | { kind: 'stage'; piId: number; stage: StageKey }   // Phôi / Hàn / Sơn
  | { kind: 'weaving'; piId: number }                  // Đan: tiến độ + điểm đan
  | { kind: 'chuyen-kiem'; piId: number }
  | { kind: 'dong-goi'; piId: number }

export default function MfgWorkshopBoardPage() {
  const [showDone, setShowDone] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)
  const { user } = useAuth()
  const isDirector = user?.role === 'MANAGER' && !user?.mfgRole
  // prodmgr chỉ XEM chuyền kiểm/đóng gói để quản lý — thao tác do Thủ kho thành phẩm.
  const isProdMgr = user?.mfgRole === 'PRODUCTION_MANAGER'
  const packingReadOnly = isDirector || isProdMgr

  const { data: pisRaw, isLoading, error, refetch } = useFetch<PI[]>(() => api.getProductionInvoices(), [])
  const { data: kcsRaw, refetch: refetchKcs } = useFetch<KcsCounts>(() => api.getKcsPendingCounts(), [])
  const { data: ckRaw, refetch: refetchCk } = useFetch<CKPI[]>(() => api.getChuyenKiem(), [])
  const { data: pkRaw, refetch: refetchPk } = useFetch<PKPI[]>(() => api.getPacking(), [])

  // Khi quay lại từ drill-down, làm mới mọi số liệu
  const handleBack = () => { setDetail(null); refetch(); refetchKcs(); refetchCk(); refetchPk() }

  // ── Drill-down views ──────────────────────────────────────────────────
  if (detail?.kind === 'stage') {
    return <MfgStageBoardPage initialPiId={detail.piId} initialStage={detail.stage} onBack={handleBack} />
  }
  if (detail?.kind === 'weaving') {
    // Phương án B: tiến độ đan (KCS) + danh sách điểm đan ngay bên dưới
    return (
      <div>
        <MfgStageBoardPage initialPiId={detail.piId} initialStage="WEAVING" onBack={handleBack} />
        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '2px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} /> Điểm đan
          </h3>
          <WeavingPointsPage readOnly embedded />
        </div>
      </div>
    )
  }
  if (detail?.kind === 'chuyen-kiem' || detail?.kind === 'dong-goi') {
    return (
      <div>
        <button onClick={handleBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer' }}>
          <ArrowLeft size={15} /> Quay lại bảng điều hành
        </button>
        {detail.kind === 'chuyen-kiem'
          ? <ChuyenKiemPage readOnly={packingReadOnly} filterPiId={detail.piId} />
          : <DongGoiPage readOnly={packingReadOnly} filterPiId={detail.piId} />}
      </div>
    )
  }

  const all = Array.isArray(pisRaw) ? pisRaw : []
  const kcs: KcsCounts = kcsRaw && typeof kcsRaw === 'object' ? kcsRaw : {}
  const pis = all.filter(p => showDone || (p.status !== 'DONE' && p.status !== 'CANCELLED'))

  // Map Chuyền kiểm / Đóng gói theo piId
  const ckMap: Record<number, { pct: number; pending: number }> = {}
  for (const c of (Array.isArray(ckRaw) ? ckRaw : [])) {
    const t = c.pieces.reduce((s, p) => s + p.target, 0)
    const ins = c.pieces.reduce((s, p) => s + p.inspected, 0)
    ckMap[c.piId] = { pct: t > 0 ? Math.round(ins / t * 100) : 0, pending: c.pendingReports?.length ?? 0 }
  }
  const pkMap: Record<number, { pct: number; allDone: boolean }> = {}
  for (const p of (Array.isArray(pkRaw) ? pkRaw : [])) {
    pkMap[p.piId] = { pct: p.totalTarget > 0 ? Math.round(p.totalPacked / p.totalTarget * 100) : 0, allDone: p.allDone }
  }

  const stageOf = (pi: PI, st: StageKey) => pi.stages?.find(s => s.stageType === st)
  const daysLeft = (d: string) => differenceInCalendarDays(new Date(d), new Date())

  // Tổng hợp đầu trang
  const totalKcs = pis.reduce((s, p) => {
    const c = kcs[p.id]; return s + (c ? c.PHOI + c.HAN + c.SON : 0)
  }, 0)
  const lateCount = pis.filter(p => daysLeft(p.deadline) < 0 && p.status !== 'DONE').length

  const pctColor = (pct: number) => pct >= 100 ? '#2e7d32' : pct > 0 ? '#e65100' : 'var(--text3)'
  const pctBg = (pct: number) => pct >= 100 ? '#e8f5e9' : pct > 0 ? '#fff3e0' : 'var(--surface2)'

  // Ô % bấm được (dùng chung cho mọi công đoạn)
  const PctCell = ({ pct, badge, onClick, title, muted }: { pct: number | null; badge?: number; onClick: () => void; title: string; muted?: boolean }) => (
    <button
      onClick={onClick}
      title={title}
      style={{
        position: 'relative', minWidth: 54, padding: '6px 8px', cursor: 'pointer',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: muted ? 'var(--surface2)' : pctBg(pct ?? 0), color: muted ? 'var(--text3)' : pctColor(pct ?? 0),
        fontWeight: 700, fontSize: 12,
      }}
    >
      {pct === null ? '—' : fmtPct(pct)}
      {!!badge && badge > 0 && (
        <span style={{
          position: 'absolute', top: -6, right: -6, minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 8, background: '#e65100', color: '#fff', fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{badge}</span>
      )}
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <LayoutGrid size={20} /> Điều hành xưởng
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={{ color: 'var(--text3)' }}>{pis.length} lệnh</span>
          {lateCount > 0 && <span style={{ padding: '3px 10px', borderRadius: 12, background: '#ffebee', color: '#c62828', fontWeight: 700 }}>🔴 {lateCount} trễ hạn</span>}
          {totalKcs > 0 && <span style={{ padding: '3px 10px', borderRadius: 12, background: '#fff3e0', color: '#e65100', fontWeight: 700 }}>⏳ {totalKcs} chờ KCS</span>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text2)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /> Hiện cả đã xong
          </label>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 24, color: 'var(--text3)' }}>Đang tải bảng điều hành...</div>
      ) : error ? (
        <div style={{ color: '#c62828', display: 'flex', gap: 6 }}><AlertCircle size={16} />Lỗi tải dữ liệu</div>
      ) : (
        <>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 920 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Lệnh SX</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Sản phẩm</th>
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Hạn giao</th>
              {STAGES.map(st => (
                <th key={st} style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>{STAGE_LABEL[st]}</th>
              ))}
              <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>Chuyền kiểm</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>Đóng gói</th>
              <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: 600 }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {pis.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có lệnh SX nào</td></tr>
            )}
            {pis.map(pi => {
              const dl = daysLeft(pi.deadline)
              const isDone = pi.status === 'DONE'
              const dlColor = isDone ? '#2e7d32' : dl < 0 ? '#c62828' : dl <= 7 ? '#e65100' : '#2e7d32'
              const dlBg = isDone ? '#e8f5e9' : dl < 0 ? '#ffebee' : dl <= 7 ? '#fff3e0' : '#e8f5e9'
              const dlText = isDone ? 'Xong' : dl < 0 ? `Trễ ${-dl}n` : dl === 0 ? 'Hôm nay' : `còn ${dl}n`
              const products = (pi.items ?? []).map(it => `${it.productVariant?.mfgProduct?.name ?? '—'} ×${it.quantity}`).join(', ')
              const ck = ckMap[pi.id]
              const pk = pkMap[pi.id]
              return (
                <tr key={pi.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{pi.code}</td>
                  <td style={{ padding: '8px 14px', maxWidth: 240 }}>{products}</td>
                  <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text2)' }}>{format(new Date(pi.deadline), 'dd/MM')}</span>
                    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: dlBg, color: dlColor }}>{dlText}</span>
                  </td>
                  {STAGES.map(st => {
                    const s = stageOf(pi, st)
                    const pct = s?.progressPercent ?? 0
                    const kcsKey = KCS_STAGES[st]
                    const kcsN = kcsKey ? (kcs[pi.id]?.[kcsKey] ?? 0) : 0
                    return (
                      <td key={st} style={{ padding: '6px 8px', textAlign: 'center' }}>
                        <PctCell
                          pct={pct} badge={kcsN}
                          title={st === 'WEAVING' ? `Tiến độ đan + điểm đan — ${pi.code}` : `Mở ${STAGE_LABEL[st]} — ${pi.code}`}
                          onClick={() => setDetail(st === 'WEAVING' ? { kind: 'weaving', piId: pi.id } : { kind: 'stage', piId: pi.id, stage: st })}
                        />
                      </td>
                    )
                  })}
                  {/* Chuyền kiểm */}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <PctCell
                      pct={ck ? ck.pct : null} badge={ck?.pending} muted={!ck}
                      title={ck ? `Mở Chuyền kiểm — ${pi.code}` : 'Chưa có mảnh đan thu về'}
                      onClick={() => setDetail({ kind: 'chuyen-kiem', piId: pi.id })}
                    />
                  </td>
                  {/* Đóng gói */}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <PctCell
                      pct={pk ? pk.pct : null} muted={!pk}
                      title={pk ? `Mở Đóng gói — ${pi.code}` : 'Chưa sẵn sàng đóng gói'}
                      onClick={() => setDetail({ kind: 'dong-goi', piId: pi.id })}
                    />
                  </td>
                  <td style={{ padding: '8px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{PI_STATUS_LABEL[pi.status] ?? pi.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
        Bấm ô công đoạn để mở chi tiết &amp; duyệt KCS. Ô <strong>Đan</strong> mở tiến độ đan + điểm đan; ô <strong>Chuyền kiểm</strong> / <strong>Đóng gói</strong> mở màn thao tác. Số cam = báo cáo đang chờ duyệt.
      </div>
        </>
      )}
    </div>
  )
}
