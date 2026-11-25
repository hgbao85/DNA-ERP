'use client'

/**
 * Hướng dẫn cắt (Phôi) — bảng cắt BẮT BUỘC theo đúng phương án đã duyệt (KHÔNG phải "gợi ý")
 * theo từng cỡ đoạn × kiểu cắt, dạng lưới ô-theo-ô để thợ cắt theo và in ra treo tại xưởng.
 *
 * Tách thành màn riêng trên sidebar (2026-08-25) - trước đó chỉ là 1 khối "chip" gọn trong
 * CutBatchPanel (LenhSanXuatPhoi.tsx), khó nhìn với nhiều cỡ và không in được. Dữ liệu và cách
 * dựng bảng dùng CHUNG với Admin/businessData/CuttingProposalsPage.tsx (xem utils/cuttingGuide.ts)
 * - cùng nguồn CuttingProposal.lines[].patterns, chỉ khác UI/quyền: màn này CHỈ đọc (không có
 * "Tính lại"), liệt kê PI theo đúng nguồn getSteelIssuesByStatus() như LenhSanXuatPhoi.tsx (PHOI_STAFF
 * không có SKU:VIEW/PRODUCTION_ORDER:VIEW để tự resolve danh sách PI qua đường khác) thay vì phẳng
 * mọi PO như Admin.
 *
 * 23/11/2026 (bỏ hàng đợi xưởng, gộp Sản lượng vào đây): bảng tổng kết mỗi loại sắt thêm Đã cắt / KCS đạt / Lỗi / Còn thiếu (từ
 * GET /production-invoices/:id/phoi-progress, công thức ở guideOutputModel.ts), dòng nhỏ công đoạn phụ dưới cỡ đoạn, khối
 * "Mảnh Phôi" cuối trang; danh sách lệnh có "Xong Phôi dd/mm" + %. Bản in / Excel giữ nguyên. Tự tải lại theo realtime.
 *
 * `initialPiId`/`onConsumeInitialPi`: cho phép LenhSanXuatPhoi.tsx nhảy thẳng vào đúng PI đang mở
 * (nút "Xem hướng dẫn cắt" trong CutBatchPanel) thay vì bắt chọn lại từ đầu.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, Ruler, AlertTriangle } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { getPhoiProgress, type BePhoiProgressItem, type BeSteelIssue } from '../../../services/steel-issues-api'
import { floorAdmin, type BeStageDetail, type BeStageProgressRow } from '../../../services/floor-api'
import {
  getCuttingProposalsForInvoice, getCuttingProposal,
  type CuttingProposal, type CuttingProposalLine,
} from '../../../services/cutting-proposals-api'
import { barsLineText, buildCuttingGuideTable, buildPieceSummary, cutMachineLineText, exportCuttingGuideExcel, exportCuttingGuideExcelAll, hasLeftoverBars, hasMachineColumn, printCuttingGuide } from '../../../utils/cuttingGuide'
import { fmtBundles } from '../../../utils/cutMachine'
import { fmtBars, fmtMm, fmtNum, fmtPct } from '../../../utils/numberFormat'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { PatternMachineCell } from '../ProductionPlan/CuttingSolvePanel'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import PrintExportButton from '../../../components/PrintExportButton'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { useLenhCodeLookup } from '../../../components/LenhCode'
import { piecesOf, type PieceView } from '../Floor/piDetailModel'
import PiProgressCard from '../Floor/PiProgressCard'
import { stageMissingText } from '../Floor/stageOutputModel'
import {
  chunkIds, cutOutputsOf, needShown, outputKey, phoiDoneLabel, piecesSummaryText, progressById, stepLinesOf, stepLinesText, waitingText,
  type SegmentOutput, type StepLine,
} from './guideOutputModel'

/** Số tự tải lại khi KCS chấm / công nhân báo / xong Phôi (AC25). */
const LIVE_TOPICS = ['steel-issues', 'qc-reviews', 'floor'] as const

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
// overflowX (không cắt): trên điện thoại bảng rộng hơn khung thì cuộn ngang thay vì mất cột bên phải.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }

// Hai cột đầu của bảng tổng kết đứng yên khi cuộn ngang (nền đặc để không lộ chữ cuộn phía sau).
const stickyName: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', minWidth: 110, maxWidth: 140, whiteSpace: 'normal' }
const stickyMm: React.CSSProperties = { position: 'sticky', left: 110, zIndex: 1, background: 'var(--surface)', minWidth: 64, borderRight: '1px solid var(--border)' }

interface PiOption { productionInvoiceId: string; poNumber: string; piCode?: string }

function buildPiOptions(issues: BeSteelIssue[]): PiOption[] {
  const seen = new Map<string, PiOption>()
  for (const i of issues) {
    if (!seen.has(i.productionInvoiceId)) seen.set(i.productionInvoiceId, { productionInvoiceId: i.productionInvoiceId, poNumber: i.salesOrderCode ?? i.piCode, piCode: i.piCode })
  }
  return [...seen.values()]
}

export default function HuongDanCatPage({ initialPiId, onConsumeInitialPi }: {
  initialPiId?: string | null
  onConsumeInitialPi?: () => void
}) {
  const { data: issues, isLoading, error, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  const lenhOf = useLenhCodeLookup((issues ?? []).map(i => i.piCode))
  const piOptions = useMemo(
    () => buildPiOptions(issues ?? []).map(p => ({ ...p, poNumber: lenhOf(p.poNumber) })),
    [issues, lenhOf],
  )
  // Tiến độ Phôi từng lệnh (% + "Xong Phôi dd/mm"): chỉ là phần thêm - lỗi / thiếu quyền thì danh sách vẫn hiện như cũ.
  const piIdsKey = piOptions.map(p => p.productionInvoiceId).join(',')
  // Truyền đúng id các lệnh đang hiện (lệnh cũ ngoài bảng chia / quá 7 ngày vẫn có %), chia lô 200.
  const stage = useFetch<BeStageProgressRow[]>(
    () => Promise.all(chunkIds(piIdsKey ? piIdsKey.split(',') : []).map(ids => floorAdmin.stageProgress('PHOI', null, ids).catch(() => [] as BeStageProgressRow[]))).then(r => r.flat()),
    [piIdsKey],
  )
  const progress = useMemo(() => progressById(stage.data), [stage.data])
  const refetchAll = () => { void refetch(); void stage.refetch() }
  useRealtimeRefetch(LIVE_TOPICS, refetchAll)
  // Đọc initialPiId NGAY lúc khởi tạo (không đợi issues tải xong) - component này mount lại từ
  // đầu mỗi lần chuyển sang tab "Hướng dẫn cắt" (MfgApp chỉ render tab đang chọn), nên state khởi
  // tạo 1 lần là đủ, không cần effect để đồng bộ theo prop đổi sau khi đã mount.
  const [selPiId, setSelPiId] = useState<string | null>(initialPiId ?? null)

  // "Tiêu" initialPiId đúng 1 lần lúc mount - báo cha xoá đi để lần vào tay tiếp theo (bấm PO khác
  // trong danh sách) không bị nhảy lại PI cũ. Effect chỉ gọi callback của CHA, không tự setState.
  useEffect(() => {
    if (initialPiId) onConsumeInitialPi?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tiêu đề trang hiện cả lúc đang tải / lỗi (13/11/2026) - trước đây lỗi thay cả trang, mất tiêu đề, người dùng không biết đang ở màn nào.
  const header = (
    <>
      <h2 style={{ ...pageTitle, marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Ruler size={20} /> Hướng dẫn cắt
      </h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Bảng cắt theo đúng phương án đã duyệt cho từng loại sắt — chọn PO/lệnh để xem chi tiết và xuất file in.
      </div>
    </>
  )

  if (isLoading) return <div>{header}<LoadingState /></div>
  // 2026-09-11 (QA audit B2): error trước `!issues` - xem LoadErrorState doc comment.
  if (error || !issues) return <div>{header}<LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} /></div>

  const selPi = selPiId ? piOptions.find(p => p.productionInvoiceId === selPiId) ?? { productionInvoiceId: selPiId, poNumber: selPiId } : null
  if (selPi) {
    return <PiCuttingGuide pi={selPi} onBack={() => setSelPiId(null)} />
  }

  return (
    <div>
      {header}
      {piOptions.length === 0 ? (
        <div style={{ ...card, padding: 32, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Chưa có PI nào được xuất sắt</span>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>% = số đã báo trừ lỗi trên số cần (gồm phần KCS chưa chấm).</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {piOptions.map(p => {
              const row = progress.get(p.productionInvoiceId)
              const done = row ? phoiDoneLabel(row.phoiDoneAt) : null
              return (
                <li key={p.productionInvoiceId}>
                  <PiProgressCard title={<span style={{ fontFamily: 'monospace' }}>{p.poNumber}</span>}
                    status={done ?? (row && !row.complete ? stageMissingText(row, 'đoạn / mảnh') : null)} statusTone={done ? 'green' : 'amber'}
                    deadline={row?.deadline} percent={row ? row.percent : null} onClick={() => setSelPiId(p.productionInvoiceId)} />
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

function PiCuttingGuide({ pi, onBack }: { pi: PiOption; onBack: () => void }) {
  const { data: proposals, isLoading, error, refetch } = useFetch<CuttingProposal[]>(
    () => getCuttingProposalsForInvoice(pi.productionInvoiceId), [pi.productionInvoiceId],
  )
  const approved = (proposals ?? []).find(p => p.status === 'APPROVED') ?? null
  const { data: detail, isLoading: detailLoading } = useFetch<CuttingProposal | null>(
    () => approved ? getCuttingProposal(approved.id) : Promise.resolve(null),
    [approved?.id],
  )
  // Sản lượng (23/11/2026): cột Đã cắt / KCS đạt / Lỗi / Còn thiếu từ phoi-progress; công đoạn phụ + mảnh Phôi từ chi tiết lệnh Phôi.
  // Chỉ là phần thêm: lỗi / thiếu quyền thì bảng cắt vẫn hiện như cũ (không có cột sản lượng).
  const phoi = useFetch<BePhoiProgressItem[] | null>(() => getPhoiProgress(pi.productionInvoiceId).catch(() => null), [pi.productionInvoiceId])
  const stageDetail = useFetch<BeStageDetail | null>(() => floorAdmin.stageDetail('PHOI', pi.productionInvoiceId).catch(() => null), [pi.productionInvoiceId])
  const { refetch: refetchPhoi } = phoi
  const { refetch: refetchDetail } = stageDetail
  useRealtimeRefetch(LIVE_TOPICS, () => { void refetchPhoi(); void refetchDetail() })
  const outputs = useMemo(() => (phoi.data ? cutOutputsOf(phoi.data) : null), [phoi.data])
  const stepLines = useMemo(() => stepLinesOf(stageDetail.data?.phoi), [stageDetail.data])
  const pieces = useMemo(() => (stageDetail.data ? piecesOf(stageDetail.data, null) : []), [stageDetail.data])
  const piecesSummary = piecesSummaryText(pieces)
  const lines = (detail?.lines ?? []).filter(l => l.feasible && (l.patterns?.length ?? 0) > 0)
  // Xưởng không có laze (vd Phước An): nhóm laze hiện "MC Tự động · lỗ làm tay". Thiếu machineContext = coi như laze dùng được.
  const laserAllowed = detail?.machineContext?.laserAllowed !== false

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{pi.poNumber}</h2>
        {/* Cùng 1 PO thường có nhiều loại sắt - xuất chung 1 file (mỗi vật tư 1 sheet) để in 1
            lần, thay vì bấm từng vật tư. Chỉ hiện khi có ≥2 vật tư, 1 vật tư thì nút riêng bên
            dưới đã đủ, thêm nút này chỉ dư thừa. */}
        {lines.length > 1 && (
          <div style={{ marginLeft: 'auto' }}>
            <PrintExportButton
              label={`In (${lines.length} vật tư)`}
              // Nền cam ĐẬM riêng cho nút này (2026-10-24, UX-9): chữ trắng 12px đậm trên #e65100 chỉ 3,79:1 (< 4,5:1);
              // #bf360c ~5,6:1. Không đổi --bg-e65100 vì đó là màu nút cam chung toàn app (người dùng chốt chỉ đổi nút này).
              color="var(--bg-bf360c)"
              variant="solid"
              onExcel={() => exportCuttingGuideExcelAll(pi.poNumber, lines, laserAllowed)}
              onPdf={() => printCuttingGuide(pi.poNumber, lines, laserAllowed)}
            />
          </div>
        )}
      </div>

      {piecesSummary && (
        <button type="button" onClick={() => document.getElementById('phoi-pieces')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12, padding: '6px 12px', minHeight: 34, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 999, background: 'var(--surface)', color: pieces.some(p => p.remaining > 0) ? 'var(--amber)' : 'var(--green)', cursor: 'pointer' }}>
          {piecesSummary}
        </button>
      )}

      {isLoading || detailLoading ? (
        <LoadingState />
      ) : error || !proposals ? (
        <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />
      ) : !approved ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Chưa có phương án cắt nào đã duyệt cho PO/lệnh này.
        </div>
      ) : lines.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Không có loại sắt nào cắt được (mọi dòng đều không khả thi).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {lines.map(l => <MaterialGuide key={l.materialId} poNumber={detail!.poNumber} line={l} laserAllowed={laserAllowed} outputs={outputs} stepLines={stepLines} />)}
          <PhoiPiecesBlock pieces={pieces} />
        </div>
      )}
    </div>
  )
}

function MaterialGuide({ poNumber, line, laserAllowed, outputs, stepLines }: {
  poNumber: string; line: CuttingProposalLine; laserAllowed: boolean
  /** Số sản lượng theo (loại sắt, cỡ đoạn); null = chưa có (BE cũ / thiếu quyền) thì bảng không có 4 cột mới. */
  outputs: Map<string, SegmentOutput> | null
  stepLines: Map<string, StepLine[]>
}) {
  const { columns, columnLabels, rows } = buildCuttingGuideTable(line)
  const pieces = buildPieceSummary(line)
  // Cột "Cách cắt theo bó" chỉ hiện khi phương án tính bằng MC Tự động; MC Laser/phương án cũ giữ nguyên bảng. Ở màn Phôi đã có
  // "bó đoạn" (CutBundle: bó đoạn đã cắt giao Hàn) nên bó sắt cây ghi là "bó cây" cho khỏi lẫn.
  const hasBundles = rows.some(r => fmtBundles(r.bundles) !== null)
  const isMobile = useIsMobile()
  const namesBySize = new Map((line.pieceSummary ?? []).map((p) => [p.size, p.names]))
  // MỘT dòng "Máy cắt" (13/11/2026): tổng theo lớp máy của từng cây, khớp cột Máy; không có dữ liệu lớp máy mới rơi về máy lúc tính.
  const machineText = cutMachineLineText(line, laserAllowed, 'bó cây')
  // Cột "Cách cắt theo bó cây" LUÔN đứng ngay sau STT trên màn hình (2026-10-24): trước chỉ làm vậy ở điện thoại, nhưng tablet 768
  // và cả máy tính với loại nhiều cỡ đoạn (SAT-HOP-10X20: bảng 1331 px trong khung 1167 px) cũng cuộn ngang làm khuất cột cuối.
  // Bản in/Excel (utils/cuttingGuide.ts) vẫn để cột này ở cuối như bản in MC Laser.
  const bundleFirst = hasBundles
  // Cột "Máy" (13/11/2026) ngay sau STT: lớp máy của từng nhóm cây + đoạn dập. Không có machineGroups thì không hiện cột, bảng như cũ.
  const hasMachine = hasMachineColumn(rows)
  // CS2 (20/11/2026): có cây lẻ kho Phôi thì mỗi kiểu cắt ghi rõ dài cây - thợ lấy đúng cây lẻ cho đúng kiểu.
  const hasLen = hasLeftoverBars(line)
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{line.materialCode} — {line.materialName}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {barsLineText(line)}
            {line.wastePercentage != null && <> · hao hụt {fmtPct(line.wastePercentage)}</>}
          </div>
          {machineText && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Máy cắt: <b>{machineText}</b></div>
          )}
          {/* Cỡ đặt riêng (auto_scan mở lại 2026-08-26) - PHẢI nổi bật, không để thợ/Mua hàng
              tưởng nhầm đây là cây chuẩn 6000mm vẫn hay đặt. */}
          {line.lengthSource === 'scan' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '3px 9px', borderRadius: 6, background: 'var(--bg-fff3e0)', color: 'var(--fg-e65100)', fontSize: 11, fontWeight: 700 }}>
              ⚠ Cỡ đặt riêng {fmtMm(line.bestStockLengthMm)} — không phải cây chuẩn
            </div>
          )}
        </div>
        <PrintExportButton
          label="In"
          // Nút viền: chữ cam #e65100 trên nền trắng chỉ 3,79:1 (chữ 12px) -> dùng cam đậm hơn --fg-c2410c (~5,2:1; chế độ tối tự sáng lên).
          color="var(--fg-c2410c)"
          onExcel={() => exportCuttingGuideExcel(poNumber, line, laserAllowed)}
          onPdf={() => printCuttingGuide(poNumber, [line], laserAllowed)}
        />
      </div>

      {/* Bảng TỔNG KẾT CẮT — cùng layout "In kết quả" của MC Laser (SL cần/SL cắt theo cỡ đoạn),
          để màn hình khớp với bản in ra cho thợ. */}
      <div style={{ overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
        <table style={{ width: '100%', minWidth: outputs ? 700 : undefined, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {/* Giữ chữ "Tên sắt" như bảng "In kết quả" của máy laze cũ xưởng đã quen; cột này là tên chi tiết (mảnh) dùng cỡ đoạn. */}
              {/* Tên sắt + Đoạn đứng yên khi cuộn ngang: màn hẹp vẫn thấy dòng nào và Còn thiếu. */}
              <th style={{ ...th, ...stickyName, background: 'var(--surface2)' }} title="Tên chi tiết (mảnh) dùng cỡ đoạn này - cùng cách ghi với bảng In kết quả của máy laze">Tên sắt</th>
              <th style={{ ...thR, ...stickyMm, background: 'var(--surface2)' }}>Đoạn (mm)</th>
              {outputs && <th style={thR} title="Số cần trừ (đã cắt − lỗi); phần đã báo mà KCS chưa chấm tính tạm">Còn thiếu</th>}
              <th style={thR} title="Số cần theo định mức, gồm phần cắt lại">Cần</th>
              <th style={thR} title="Số đoạn theo phương án cắt (như bản in)">Theo phương án</th>
              {outputs && <>
                <th style={thR} title="Công nhân đã báo cắt (đã trừ phần KCS ghi thiếu), gồm cả phần KCS chưa chấm">Đã cắt</th>
                <th style={thR} title="Đã cắt trừ lỗi và trừ phần KCS chưa chấm (đang mở / KCS đang chấm)">KCS đạt</th>
                <th style={thR} title="KCS chấm không đạt, cộng dồn">Lỗi</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {pieces.map(p => {
              const o = outputs?.get(outputKey(line.materialId, p.size))
              const subText = stepLinesText(stepLines.get(outputKey(line.materialId, p.size)))
              const need = needShown(p.demand, o)
              return (
                <tr key={p.size} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, ...stickyName }}>
                    {p.names.length > 0 ? p.names.join(', ') : <span style={{ color: 'var(--text3)' }}>—</span>}
                    {subText && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{subText}</div>}
                  </td>
                  <td style={{ ...tdR, ...stickyMm }}>{fmtNum(p.size)}</td>
                  {outputs && (o
                    ? <td style={{ ...tdR, fontWeight: 700, color: o.missing > 0 ? 'var(--amber)' : 'var(--green)' }}>{fmtNum(o.missing)}</td>
                    : <td style={{ ...tdR, color: 'var(--text3)' }}>—</td>)}
                  <td style={tdR}>
                    {need.value == null ? <span style={{ color: 'var(--text3)' }}>—</span> : fmtNum(need.value)}
                    {need.recut > 0 && <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>(+{fmtNum(need.recut)} cắt lại)</div>}
                    {!!p.fromStock && <div style={{ fontSize: 11, color: 'var(--green)', whiteSpace: 'nowrap' }} title="Đoạn dư có sẵn trong kho Phôi, thủ kho xuất cho tổ - không phải cắt">(+{fmtNum(p.fromStock)} có sẵn trong kho)</div>}
                  </td>
                  <td style={{ ...tdR, fontWeight: 700 }}>
                    {fmtNum(p.produced)}
                    {!Number.isNaN(p.demand) && p.produced > p.demand && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)', whiteSpace: 'nowrap' }} title="Đoạn dư cắt từ khúc thừa cây mua cuối - báo cắt, làm đủ công đoạn, KCS chấm rồi vào phần dư kho Phôi">(+{fmtNum(p.produced - p.demand)} đoạn dư)</div>}
                  </td>
                  {outputs && (o ? <>
                    <td style={tdR}>
                      {fmtNum(o.cut)}
                      {o.waiting > 0 && <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{waitingText(o.open, o.awaiting)}</div>}
                    </td>
                    <td style={{ ...tdR, fontWeight: o.passed > 0 ? 700 : 400, color: o.passed > 0 ? 'var(--green)' : 'var(--text3)' }}>{fmtNum(o.passed)}</td>
                    <td style={{ ...tdR, color: o.failed > 0 ? 'var(--red)' : 'var(--text3)', fontWeight: o.failed > 0 ? 700 : 400 }}>{o.failed > 0 ? fmtNum(o.failed) : '—'}</td>
                  </> : <td colSpan={3} style={{ ...tdR, color: 'var(--text3)' }}>—</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {isMobile ? (
        // Điện thoại (< 640 px, 13/11/2026): bảng kiểu cắt thêm cột Máy nên HH/cây và Số cây bị đẩy ra ngoài màn -> mỗi kiểu cắt một thẻ.
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rows.map((r, i) => {
            const segs = r.counts
              // "400 mm × 11" dính liền (dấu cách không ngắt) để điện thoại không xuống dòng giữa số và đơn vị.
              .map((c, ci) => (c > 0 ? `${namesBySize.get(columns[ci])?.length ? `${namesBySize.get(columns[ci])!.join(', ')} ` : ''}${fmtMm(columns[ci]).replace(' ', ' ')} × ${c}` : null))
              .filter((x): x is string => x !== null)
            return (
              <div key={r.patternIndex} style={{ padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border)' : undefined, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Kiểu {i + 1}{hasLen && r.stockLengthMm != null && <> · cây {fmtMm(r.stockLengthMm)}</>}</span>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{fmtBars(r.barCount)}</span>
                </div>
                {hasMachine && <PatternMachineCell groups={r.machineGroups} laserAllowed={laserAllowed} />}
                {bundleFirst && fmtBundles(r.bundles, 'bó cây') && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', overflowWrap: 'anywhere' }}>{fmtBundles(r.bundles, 'bó cây')}</div>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{segs.join(' · ')}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>HH/cây {r.wastePerBarMm != null ? fmtMm(r.wastePerBarMm) : '—'}</div>
              </div>
            )
          })}
        </div>
      ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={{ ...th, width: 40 }}>STT</th>
              {hasMachine && <th style={th}>Máy</th>}
              {hasLen && <th style={thR}>Dài cây</th>}
              {bundleFirst && <th style={th}>Cách cắt theo bó cây</th>}
              {/* Tiêu đề cỡ đoạn dài ("Tay trái, Tay phải (445mm)") được xuống dòng - để nowrap thì 1 loại nhiều cỡ đã rộng hơn màn hình. */}
              {columnLabels.map((label, i) => <th key={columns[i]} style={{ ...thR, whiteSpace: 'normal', minWidth: 72 }}>{label}</th>)}
              <th style={thR}>HH/cây</th>
              <th style={thR}>Số cây</th>
              {hasBundles && !bundleFirst && <th style={th}>Cách cắt theo bó cây</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.patternIndex} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontWeight: 600 }}>{i + 1}</td>
                {hasMachine && <td style={td}><PatternMachineCell groups={r.machineGroups} laserAllowed={laserAllowed} /></td>}
                {hasLen && <td style={{ ...tdR, fontWeight: 700 }}>{fmtNum(r.stockLengthMm)}</td>}
                {bundleFirst && <td style={{ ...td, minWidth: 150 }}>{fmtBundles(r.bundles, 'bó cây') ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>}
                {r.counts.map((c, ci) => (
                  <td key={columns[ci]} style={{ ...tdR, fontWeight: c > 0 ? 700 : 400, color: c > 0 ? 'var(--text)' : 'var(--text3)' }}>{c > 0 ? c : '—'}</td>
                ))}
                <td style={tdR}>{fmtNum(r.wastePerBarMm)}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{fmtNum(r.barCount)}</td>
                {hasBundles && !bundleFirst && (
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtBundles(r.bundles, 'bó cây') ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

/** Khối "Mảnh Phôi" cuối trang (Q1 phương án A): mảnh Phôi / vật tư thành phẩm của lệnh - để QLSX thấy vì sao lệnh chưa đóng Phôi. */
function PhoiPiecesBlock({ pieces }: { pieces: PieceView[] }) {
  if (pieces.length === 0) return null
  const n = (v: number) => fmtNum(v)
  const dim = (v: number, color?: string, bold = false): React.CSSProperties => ({ ...tdR, color: v > 0 ? (color ?? 'inherit') : 'var(--text3)', fontWeight: v > 0 && bold ? 700 : 400 })
  return (
    <div id="phoi-pieces" style={{ ...card, scrollMarginTop: 12 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Mảnh Phôi</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Mảnh / vật tư thành phẩm tổ Phôi tự báo, tính chung cho cả lệnh. Còn thiếu = cần trừ (đã báo − lỗi).</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...th, ...stickyName, background: 'var(--surface2)', borderRight: '1px solid var(--border)' }}>Mảnh</th>
              <th style={thR}>Còn thiếu</th>
              <th style={thR}>Cần</th>
              <th style={thR}>KCS đạt</th>
              <th style={thR} title="Đã lưu đợt, KCS chưa bấm Chấm">Đang mở</th>
              <th style={thR} title="KCS đã bấm Chấm, chưa chấm xong">KCS đang chấm</th>
              <th style={thR}>Lỗi</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map(p => (
              <tr key={p.key} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, ...stickyName, borderRight: '1px solid var(--border)' }}>{p.name} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.code}</span>{p.skus.length > 0 && <div style={{ fontSize: 11, color: 'var(--text2)' }}>SKU: {p.skus.join(', ')}</div>}</td>
                <td style={{ ...tdR, fontWeight: 700, color: p.remaining > 0 ? 'var(--amber)' : 'var(--green)' }}>{n(p.remaining)}</td>
                <td style={tdR}>{n(p.required)}</td>
                <td style={dim(p.passed, 'var(--green)', true)}>{n(p.passed)}</td>
                <td style={dim(p.open)}>{p.open > 0 ? n(p.open) : '—'}</td>
                <td style={dim(p.awaiting)}>{p.awaiting > 0 ? n(p.awaiting) : '—'}</td>
                <td style={dim(p.failed, 'var(--red)', true)}>{p.failed > 0 ? n(p.failed) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
