import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { format, differenceInCalendarDays } from 'date-fns'
import { AlertCircle, LayoutGrid, ArrowLeft } from 'lucide-react'
import { PhoiScreen, TwoTierScreen, PHOI_CFG, HAN_CFG, SON_CFG, type ProcRow, type ProcManh, type ProcLine } from '../../../components/sanxuat/core'
import KhoChuyenKiemPage from '../InboundWarehouse/KhoChuyenKiemPage'
import KhoDongGoiPage from '../InboundWarehouse/KhoDongGoiPage'
import KhoNhapDanPage from '../InboundWarehouse/KhoNhapDanPage'
import type { PlanForm } from '../../../types/plan-form'

// 4 công đoạn SX + 2 công đoạn sau-đan (Chuyền kiểm, Đóng gói) — tất cả mở bằng cách bấm vào ô.
const STAGES = ['PHOI', 'HAN', 'SON', 'WEAVING'] as const
type StageKey = typeof STAGES[number]
const STAGE_LABEL: Record<StageKey, string> = { PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn', WEAVING: 'Đan' }
// Công đoạn có cổng KCS (đếm hàng chờ duyệt)
const KCS_STAGES: Record<string, 'PHOI' | 'HAN' | 'SON' | null> = { PHOI: 'PHOI', HAN: 'HAN', SON: 'SON', WEAVING: null }

const PI_STATUS_LABEL: Record<string, string> = {
  NEW: 'Mới', PURCHASING: 'Mua hàng',
  PRODUCING: 'Đang SX', QC_STAGE: 'QC', DONE: 'Hoàn thành', CANCELLED: 'Đã hủy',
}

interface Stage { stageType: string; progressPercent: number; status: string }
interface PIItem { quantity: number; productVariant?: { colorCode?: string | null; mfgProduct?: { name: string; factoryCode: string } }; prodApproval?: { status?: string } }
interface PI {
  id: number; code: string; deadline: string; status: string
  exportOrderId?: number
  exportOrder?: { poNumber?: string }
  items: PIItem[]; stages: Stage[]
}
type KcsCounts = Record<number, Record<string, number>>

// ── Dropdown lọc theo công đoạn ───────────────────────────────────────────────
type StageFilter = 'ALL' | 'PHOI' | 'HAN' | 'SON' | 'WEAVING' | 'CHUYEN_KIEM' | 'DONG_GOI'

// Dữ liệu Chuyền kiểm / Đóng gói (lấy từ 2 endpoint riêng, map theo piId để hiện % trên bảng)
interface CKPiece { target: number; inspected: number }
interface CKPI { piId: number; pieces: CKPiece[]; pendingReports: unknown[] }
interface PKPI { piId: number; totalTarget: number; totalPacked: number; allDone: boolean }

const fmtPct = (n: number) => `${n}%`
const pctColor = (pct: number) => pct >= 100 ? '#2e7d32' : pct > 0 ? '#e65100' : 'var(--text3)'
const pctBg    = (pct: number) => pct >= 100 ? '#e8f5e9' : pct > 0 ? '#fff3e0' : 'var(--surface2)'

function PctCell({ pct, badge, onClick, title, muted }: {
  pct: number | null; badge?: number; onClick: () => void; title: string; muted?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        position: 'relative', minWidth: 54, padding: '6px 8px', cursor: 'pointer',
        border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        background: muted ? 'var(--surface2)' : pctBg(pct ?? 0),
        color: muted ? 'var(--text3)' : pctColor(pct ?? 0),
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
}

// Thanh "Quay lại" dùng chung cho mọi nhánh drill-down (Phôi/Hàn/Sơn/Đan/Chuyền kiểm/Đóng gói).
function DetailBackBar({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <button
        onClick={onBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface2)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}
      >
        <ArrowLeft size={15} /> Quay lại bảng điều hành
      </button>
      <span style={{ color: 'var(--text3)', fontSize: 13 }}>·</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{label}</span>
    </div>
  )
}

function strHash(s: string): number {
  return s.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
}

const FALLBACK_MANH = ['Mảnh Tựa', 'Mảnh Tay', 'Mảnh Chân']
const FALLBACK_SAT = ['Sắt Vuông 6 zem', 'Sắt Hộp 8 zem']

// 1 PO ngoài bảng tổng hợp ứng với đúng 1 PI — nên khi mở chi tiết Phôi/Hàn/Sơn của 1 lệnh, màn
// dưới PHẢI chỉ hiện đúng 1 dòng (lệnh vừa bấm), không phải cả danh sách nhiều PO như seed tĩnh của
// LenhSanXuatPhoi/Han/Son (dùng cho phoi@/han@/son@ khi họ tự vào màn "Lệnh sản xuất" xem hết việc
// của mình). Ở đây sinh đúng 1 ProcRow: phần đầu (PO/SKU/sản phẩm/SL/hạn giao) lấy từ dữ liệu PI
// thật; phần vật tư/mảnh bên trong vẫn phải mock ổn định theo mã PI vì Phôi/Hàn/Sơn chưa có nguồn dữ
// liệu tổng hợp thật trong hệ thống — cùng kỹ thuật với ThongKePagePlan.tsx (buildPhoiManhs/buildHanLines/buildSonLines).
function buildStageRows(pi: PI, stage: 'PHOI' | 'HAN' | 'SON'): ProcRow[] {
  const h = strHash(pi.code)
  // 1 PO chỉ có đúng 1 SKU (số lượng lớn) — lấy số lượng của riêng SKU đó, không cộng dồn qua các
  // item khác (PI có thể seed nhiều item/SKU cho mục đích demo khác, không đại diện cho 1 PO thật).
  const item = pi.items?.[0]
  const sku = item?.productVariant?.mfgProduct?.factoryCode ?? pi.code
  const productName = item?.productVariant?.mfgProduct?.name ?? '—'
  const soLuong = item?.quantity ?? 0
  const base = { id: pi.id, poNumber: pi.code, sku, productName, soLuong, deadline: pi.deadline, arrangedAt: null as string | null }

  if (stage === 'PHOI') {
    const manhs: ProcManh[] = FALLBACK_MANH.map((name, mi) => {
      const need = 80 + ((h + mi * 23) % 150)
      const done = Math.round(need * (0.2 + ((h + mi * 7) % 60) / 100))
      return {
        id: mi + 1, tenManh: name, perSku: 1,
        lines: [{ id: mi * 10 + 1, itemName: FALLBACK_SAT[mi % FALLBACK_SAT.length], spec: '—', needQty: need, doneQty: done, perManh: 1, lastInputAt: null }],
      }
    })
    return [{ ...base, manhs }]
  }

  const need = 60 + (h % 200)
  const done = Math.round(need * (0.2 + (h % 60) / 100))
  const lines: ProcLine[] = [{
    id: 1, itemName: stage === 'HAN' ? 'Hàn ráp khung' : 'Sơn tĩnh điện', spec: '—',
    needQty: need, doneQty: done, thucCoQty: Math.min(need, done + (h % 15)), lastInputAt: null,
  }]
  return [{ ...base, lines }]
}

// Nhúng đúng giao diện Lệnh sản xuất của phoi@/han@/son@ (PhoiScreen/TwoTierScreen từ core.tsx)
// nhưng chỉ với 1 dòng dữ liệu của đúng lệnh SX đang xem — xem buildStageRows ở trên.
function StageDrillDown({ pi, stage, readOnly }: { pi: PI; stage: 'PHOI' | 'HAN' | 'SON'; readOnly: boolean }) {
  const [rows, setRows] = useState<ProcRow[]>(() => buildStageRows(pi, stage))
  if (stage === 'PHOI') return <PhoiScreen cfg={PHOI_CFG} rows={rows} setRows={setRows} readOnly={readOnly} />
  return <TwoTierScreen cfg={stage === 'HAN' ? HAN_CFG : SON_CFG} seed={() => rows} readOnly={readOnly} />
}

// Drill-down: bấm ô để mở chi tiết công đoạn / chuyền kiểm / đóng gói
type Detail =
  | { kind: 'stage'; pi: PI; stage: 'PHOI' | 'HAN' | 'SON' }
  | { kind: 'weaving'; pi: PI }                        // Đan
  | { kind: 'chuyen-kiem'; pi: PI }
  | { kind: 'dong-goi'; pi: PI }

export default function MfgWorkshopBoardPage({ stageFilter = 'ALL' }: { stageFilter?: string }) {
  const [showDone, setShowDone] = useState(false)
  const [detail, setDetail] = useState<Detail | null>(null)

  const { data: pisRaw, isLoading, error, refetch } = useFetch<PI[]>(() => api.getProductionInvoices(), [])
  const { data: kcsRaw, refetch: refetchKcs } = useFetch<KcsCounts>(() => api.getKcsPendingCounts(), [])
  const { data: ckRaw, refetch: refetchCk } = useFetch<CKPI[]>(() => api.getChuyenKiem(), [])
  const { data: pkRaw, refetch: refetchPk } = useFetch<PKPI[]>(() => api.getPacking(), [])
  const { data: planFormsRaw, refetch: refetchPlanForms } = useFetch<PlanForm[]>(() => api.getPlanForms(), [])

  // Khi quay lại từ drill-down, làm mới mọi số liệu
  const handleBack = () => { setDetail(null); refetch(); refetchKcs(); refetchCk(); refetchPk(); refetchPlanForms() }

  // ── Drill-down views: mở đúng giao diện mà phoi@/han@/son@/khotp@ đang thấy, ở chế độ chỉ xem
  // (qlsx@ chỉ quản lý/theo dõi — thao tác thật do đúng tài khoản chuyên trách thực hiện) ─────────
  if (detail?.kind === 'stage') {
    return (
      <div>
        <DetailBackBar onBack={handleBack} label={`${STAGE_LABEL[detail.stage]} — ${detail.pi.code}`} />
        <StageDrillDown pi={detail.pi} stage={detail.stage} readOnly />
      </div>
    )
  }
  if (detail?.kind === 'weaving') {
    return (
      <div>
        <DetailBackBar onBack={handleBack} label={`Đan — ${detail.pi.code}`} />
        <KhoNhapDanPage readOnly filterPiCode={detail.pi.code} />
      </div>
    )
  }
  if (detail?.kind === 'chuyen-kiem' || detail?.kind === 'dong-goi') {
    return (
      <div>
        <DetailBackBar
          onBack={handleBack}
          label={`${detail.kind === 'chuyen-kiem' ? 'Chuyền kiểm' : 'Đóng gói'} — ${detail.pi.code}`}
        />
        {detail.kind === 'chuyen-kiem'
          ? <KhoChuyenKiemPage readOnly filterExportOrderId={detail.pi.exportOrderId} />
          : <KhoDongGoiPage readOnly filterExportOrderId={detail.pi.exportOrderId} />}
      </div>
    )
  }

  const all = Array.isArray(pisRaw) ? pisRaw : []
  const kcs: KcsCounts = kcsRaw && typeof kcsRaw === 'object' ? kcsRaw : {}

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

  const piMap = new Map(all.map(p => [p.id, p]))
  const planForms = Array.isArray(planFormsRaw) ? planFormsRaw : []

  // Lệnh nhiều SKU: Sếp duyệt từng SKU riêng lẻ, pi.status chỉ chuyển khỏi PLANNING khi TẤT CẢ SKU
  // đã duyệt (xem LenhSXPage.tsx handleApproveItem) — nên phải hiện lệnh ngay khi có SKU đã duyệt,
  // không chờ pi.status đổi, để SKU đó lên bảng tổng hợp đúng lúc Sếp vừa duyệt xong.
  const hasApprovedItem = (p: PI) => (p.items ?? []).some(it => it.prodApproval?.status === 'APPROVED')
  // Lên kế hoạch (PLANNING) chưa vào sản xuất — không hiện ở "Tổng hợp lệnh sản xuất", trừ khi đã
  // có SKU được duyệt (đã thật sự bắt đầu sản xuất dù pi.status còn PLANNING).
  const isVisible = (p: PI) =>
    (p.status !== 'PLANNING' || hasApprovedItem(p)) &&
    (showDone || (p.status !== 'DONE' && p.status !== 'CANCELLED'))

  // 1 dòng = 1 SKU. Với SKU do khsx@demo.com quản lý (PlanForm khác DRAFT), lấy đúng 1 dòng cho mỗi
  // PlanForm — kể cả khi nhiều PlanForm dùng chung 1 PI — để số dòng/dữ liệu luôn khớp 1-1 với "Bảng
  // thống kê" bên khsx (không gộp lại theo PI như trước, gây lệch số lượng item giữa 2 màn).
  const linkedPiIds = new Set(planForms.map(pf => pf.productionInvoiceId).filter((id): id is number => id != null))
  const planFormRows = planForms
    .filter(pf => pf.status !== 'DRAFT' && pf.productionInvoiceId != null)
    .map(pf => ({ key: `pf-${pf.id}`, pi: piMap.get(pf.productionInvoiceId as number) }))
    .filter((r): r is { key: string; pi: PI } => !!r.pi && isVisible(r.pi))

  // Lệnh SX do qlsx tự tạo, chưa từng qua khsx (không có PlanForm nào trỏ tới) — cùng 1 quy tắc hiện.
  const standaloneRows = all
    .filter(p => !linkedPiIds.has(p.id))
    .filter(isVisible)
    .map(p => ({ key: `pi-${p.id}`, pi: p }))

  const allRows = [...planFormRows, ...standaloneRows]
  const rows = stageFilter === 'ALL'         ? allRows
    : stageFilter === 'CHUYEN_KIEM'         ? allRows.filter(r => ckMap[r.pi.id] !== undefined)
    : stageFilter === 'DONG_GOI'            ? allRows.filter(r => pkMap[r.pi.id] !== undefined)
    : allRows.filter(r => r.pi.stages?.some(s => s.stageType === stageFilter))

  const stageOf = (pi: PI, st: StageKey) => pi.stages?.find(s => s.stageType === st)
  const daysLeft = (d: string) => differenceInCalendarDays(new Date(d), new Date())

  // Tổng hợp đầu trang
  const lateCount = rows.filter(r => daysLeft(r.pi.deadline) < 0 && r.pi.status !== 'DONE').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <LayoutGrid size={20} /> Tổng hợp lệnh sản xuất
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span style={{ color: 'var(--text3)' }}>{rows.length} lệnh</span>
          {lateCount > 0 && <span style={{ padding: '3px 10px', borderRadius: 12, background: '#ffebee', color: '#c62828', fontWeight: 700 }}>🔴 {lateCount} trễ hạn</span>}
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
              <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Mã PO</th>
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
            {rows.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có lệnh SX nào</td></tr>
            )}
            {rows.map(({ key, pi }) => {
              const dl = daysLeft(pi.deadline)
              const isDone = pi.status === 'DONE'
              const dlColor = isDone ? '#2e7d32' : dl < 0 ? '#c62828' : dl <= 7 ? '#e65100' : '#2e7d32'
              const dlBg = isDone ? '#e8f5e9' : dl < 0 ? '#ffebee' : dl <= 7 ? '#fff3e0' : '#e8f5e9'
              const dlText = isDone ? 'Xong' : dl < 0 ? `Trễ ${-dl}n` : dl === 0 ? 'Hôm nay' : `còn ${dl}n`
              const products = (pi.items ?? []).map(it => `${it.productVariant?.mfgProduct?.name ?? '—'} ×${it.quantity}`).join(', ')
              const skus = (pi.items ?? []).map(it => it.productVariant?.mfgProduct?.factoryCode).filter(Boolean).join(', ')
              const ck = ckMap[pi.id]
              const pk = pkMap[pi.id]
              return (
                <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: 'var(--text2)' }}>{pi.exportOrder?.poNumber ?? '—'}</td>
                  <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontWeight: 700 }}>{pi.code}</td>
                  <td style={{ padding: '8px 14px', maxWidth: 240 }}>
                    <div>{products}</div>
                    {skus && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{skus}</div>}
                  </td>
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
                          onClick={() => setDetail(st === 'WEAVING' ? { kind: 'weaving', pi } : { kind: 'stage', pi, stage: st })}
                        />
                      </td>
                    )
                  })}
                  {/* Chuyền kiểm */}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <PctCell
                      pct={ck ? ck.pct : null} badge={ck?.pending} muted={!ck}
                      title={ck ? `Mở Chuyền kiểm — ${pi.code}` : 'Chưa có mảnh đan thu về'}
                      onClick={() => setDetail({ kind: 'chuyen-kiem', pi })}
                    />
                  </td>
                  {/* Đóng gói */}
                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <PctCell
                      pct={pk ? pk.pct : null} muted={!pk}
                      title={pk ? `Mở Đóng gói — ${pi.code}` : 'Chưa sẵn sàng đóng gói'}
                      onClick={() => setDetail({ kind: 'dong-goi', pi })}
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
        </>
      )}
    </div>
  )
}
