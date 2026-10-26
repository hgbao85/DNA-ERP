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
 * `initialPiId`/`onConsumeInitialPi`: cho phép LenhSanXuatPhoi.tsx nhảy thẳng vào đúng PI đang mở
 * (nút "Xem hướng dẫn cắt" trong CutBatchPanel) thay vì bắt chọn lại từ đầu.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Ruler, AlertTriangle } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeSteelIssue } from '../../../services/steel-issues-api'
import {
  getCuttingProposalsForInvoice, getCuttingProposal,
  type CuttingProposal, type CuttingProposalLine,
} from '../../../services/cutting-proposals-api'
import { buildCuttingGuideTable, buildPieceSummary, exportCuttingGuideExcel, exportCuttingGuideExcelAll, machineSummaryText, printCuttingGuide } from '../../../utils/cuttingGuide'
import { fmtBundles, fmtPercent } from '../../../utils/cutMachine'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import PrintExportButton from '../../../components/PrintExportButton'
import { useRealtimeRefetch } from '../../../realtime/hooks'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
// overflowX (không cắt): trên điện thoại bảng rộng hơn khung thì cuộn ngang thay vì mất cột bên phải.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }

interface PiOption { productionInvoiceId: string; poNumber: string }

function buildPiOptions(issues: BeSteelIssue[]): PiOption[] {
  const seen = new Map<string, string>()
  for (const i of issues) {
    if (!seen.has(i.productionInvoiceId)) seen.set(i.productionInvoiceId, i.salesOrderCode ?? i.piCode)
  }
  return [...seen.entries()].map(([productionInvoiceId, poNumber]) => ({ productionInvoiceId, poNumber }))
}

export default function HuongDanCatPage({ initialPiId, onConsumeInitialPi }: {
  initialPiId?: string | null
  onConsumeInitialPi?: () => void
}) {
  const { data: issues, isLoading, error, refetch } = useFetch<BeSteelIssue[]>(() => api.getSteelIssuesByStatus(), [])
  useRealtimeRefetch(['steel-issues'], refetch)
  const piOptions = useMemo(() => buildPiOptions(issues ?? []), [issues])
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

  if (isLoading) return <LoadingState />
  // 2026-09-11 (QA audit B2): error trước `!issues` - xem LoadErrorState doc comment.
  if (error || !issues) return <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  const selPi = selPiId ? piOptions.find(p => p.productionInvoiceId === selPiId) ?? { productionInvoiceId: selPiId, poNumber: selPiId } : null
  if (selPi) {
    return <PiCuttingGuide pi={selPi} onBack={() => setSelPiId(null)} />
  }

  return (
    <div>
      <h2 style={{ ...pageTitle, marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Ruler size={20} /> Hướng dẫn cắt
      </h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Bảng cắt theo đúng phương án đã duyệt cho từng loại sắt — chọn PO/PI để xem chi tiết và xuất file in.
      </div>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>PO / PI</th>
              <th style={{ ...th, width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {piOptions.map(p => (
              <tr key={p.productionInvoiceId} onClick={() => setSelPiId(p.productionInvoiceId)}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{p.poNumber}</td>
                <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><ChevronRight size={16} /></td>
              </tr>
            ))}
            {piOptions.length === 0 && (
              <tr><td colSpan={2} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}><div className="table-empty-msg"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Chưa có PI nào được xuất sắt</span></div></td></tr>
            )}
          </tbody>
        </table>
      </div>
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
  const lines = (detail?.lines ?? []).filter(l => l.feasible && (l.patterns?.length ?? 0) > 0)

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
              onExcel={() => exportCuttingGuideExcelAll(pi.poNumber, lines)}
              onPdf={() => printCuttingGuide(pi.poNumber, lines)}
            />
          </div>
        )}
      </div>

      {isLoading || detailLoading ? (
        <LoadingState />
      ) : error || !proposals ? (
        <LoadErrorState error={error ?? 'Không rõ nguyên nhân'} onRetry={refetch} />
      ) : !approved ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Chưa có phương án cắt nào đã duyệt cho PO/PI này.
        </div>
      ) : lines.length === 0 ? (
        <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Không có loại sắt nào cắt được (mọi dòng đều không khả thi).
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {lines.map(l => <MaterialGuide key={l.materialId} poNumber={detail!.poNumber} line={l} />)}
        </div>
      )}
    </div>
  )
}

function MaterialGuide({ poNumber, line }: { poNumber: string; line: CuttingProposalLine }) {
  const { columns, columnLabels, rows } = buildCuttingGuideTable(line)
  const pieces = buildPieceSummary(line)
  // Cột "Cách cắt theo bó" chỉ hiện khi phương án tính bằng MC Tự động; MC Laser/phương án cũ giữ nguyên bảng. Ở màn Phôi đã có
  // "bó đoạn" (CutBundle: bó đoạn đã cắt giao Hàn) nên bó sắt cây ghi là "bó cây" cho khỏi lẫn.
  const hasBundles = rows.some(r => fmtBundles(r.bundles) !== null)
  const machineText = machineSummaryText(line, 'bó cây')
  // Cột "Cách cắt theo bó cây" LUÔN đứng ngay sau STT trên màn hình (2026-10-24): trước chỉ làm vậy ở điện thoại, nhưng tablet 768
  // và cả máy tính với loại nhiều cỡ đoạn (SAT-HOP-10X20: bảng 1331 px trong khung 1167 px) cũng cuộn ngang làm khuất cột cuối.
  // Bản in/Excel (utils/cuttingGuide.ts) vẫn để cột này ở cuối như bản in MC Laser.
  const bundleFirst = hasBundles
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{line.materialCode} — {line.materialName}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            Mua {line.bestStockLengthMm ?? '—'}mm × {line.totalBars ?? '—'} cây
            {line.wastePercentage != null && <> · hao hụt {fmtPercent(line.wastePercentage)}%</>}
          </div>
          {machineText && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>Máy cắt: <b>{machineText}</b></div>
          )}
          {/* Cỡ đặt riêng (auto_scan mở lại 2026-08-26) - PHẢI nổi bật, không để thợ/Mua hàng
              tưởng nhầm đây là cây chuẩn 6000mm vẫn hay đặt. */}
          {line.lengthSource === 'scan' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '3px 9px', borderRadius: 6, background: 'var(--bg-fff3e0)', color: 'var(--fg-e65100)', fontSize: 11, fontWeight: 700 }}>
              ⚠ Cỡ đặt riêng {line.bestStockLengthMm}mm — không phải cây chuẩn
            </div>
          )}
        </div>
        <PrintExportButton
          label="In"
          // Nút viền: chữ cam #e65100 trên nền trắng chỉ 3,79:1 (chữ 12px) -> dùng cam đậm hơn --fg-c2410c (~5,2:1; chế độ tối tự sáng lên).
          color="var(--fg-c2410c)"
          onExcel={() => exportCuttingGuideExcel(poNumber, line)}
          onPdf={() => printCuttingGuide(poNumber, [line])}
        />
      </div>

      {/* Bảng TỔNG KẾT CẮT — cùng layout "In kết quả" của MC Laser (SL cần/SL cắt theo cỡ đoạn),
          để màn hình khớp với bản in ra cho thợ. */}
      <div style={{ overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>Tên sắt</th>
              <th style={thR}>Đoạn (mm)</th>
              <th style={thR}>SL cần</th>
              <th style={thR}>SL cắt</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map(p => (
              <tr key={p.size} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={td}>{p.names.length > 0 ? p.names.join(', ') : <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                <td style={tdR}>{p.size}</td>
                <td style={tdR}>{Number.isNaN(p.demand) ? <span style={{ color: 'var(--text3)' }}>—</span> : p.demand}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{p.produced}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={{ ...th, width: 40 }}>STT</th>
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
                {bundleFirst && <td style={{ ...td, minWidth: 150 }}>{fmtBundles(r.bundles, 'bó cây') ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>}
                {r.counts.map((c, ci) => (
                  <td key={columns[ci]} style={{ ...tdR, fontWeight: c > 0 ? 700 : 400, color: c > 0 ? 'var(--text)' : 'var(--text3)' }}>{c > 0 ? c : '—'}</td>
                ))}
                <td style={tdR}>{r.wastePerBarMm != null ? r.wastePerBarMm.toLocaleString('vi-VN') : '—'}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{r.barCount}</td>
                {hasBundles && !bundleFirst && (
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtBundles(r.bundles, 'bó cây') ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
