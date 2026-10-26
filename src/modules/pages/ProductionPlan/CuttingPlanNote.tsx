'use client'

/**
 * Tóm tắt PHƯƠNG ÁN CẮT của 1 lệnh sản xuất (PI) trên màn duyệt (QLSX/Sếp) - luồng "Solve trước →
 * tạo lệnh sản xuất" (2026-09-30): phương án đã được solver tính TRƯỚC khi PI ra đời nên người duyệt
 * thấy số THẬT (tổng số cây, % hao hụt) ngay trên màn, không còn duyệt trên số ước tính.
 *
 * Bấm "Xem chi tiết" mới nạp phương án đầy đủ (từng loại sắt: số cây, chiều dài cây, hao hụt) - danh
 * sách PI không kéo sẵn chi tiết của mọi lệnh cho nhẹ.
 *
 * Không có phương án (PI theo luồng cũ, solver chỉ chạy sau khi Sếp duyệt) thì KHÔNG hiện gì.
 */

import { useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { getCuttingProposal, type CuttingProposal } from '../../../services/cutting-proposals-api'
import { errMsg } from '../../../utils/errors'
import type { SolverMachine } from '../../../types/admin'
import { fmtPercent, linesMachine, machineLabel } from '../../../utils/cutMachine'
import { SolveLinesTable } from './CuttingSolvePanel'

export interface CuttingPlanSummary {
  proposalId: string
  status: string
  totalBars: number | null
  wastePercentage: number | null
  /** Có loại sắt vượt ngưỡng hao hụt - người duyệt phải thấy rõ (KHSX không bị chặn khi tạo lệnh). */
  hasOverThreshold?: boolean
  /** Máy cắt ĐÃ DÙNG tính phương án này (đã quy đổi theo mặc định). Thiếu thì dùng máy KHSX chọn cho lệnh / máy trên chi tiết. */
  machine?: SolverMachine | null
}

export default function CuttingPlanNote({
  plan, isMobile, machine,
}: {
  plan: CuttingPlanSummary | null | undefined
  isMobile: boolean
  /** Máy KHSX chọn riêng cho lệnh này (ProductionInvoice.solverMachine); null = theo mặc định. */
  machine?: SolverMachine | null
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<CuttingProposal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Phương án đang tính/lỗi/bị thay thế không có số cuối cùng để duyệt - chỉ hiện khi đã có tổng cây.
  if (!plan || plan.totalBars == null) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !detail && !loading) {
      setLoading(true)
      setError(null)
      getCuttingProposal(plan.proposalId)
        .then(setDetail)
        .catch((e) => setError(errMsg(e, 'Không tải được chi tiết phương án cắt')))
        .finally(() => setLoading(false))
    }
  }

  // Máy cắt hiện khi biết (KHSX chọn riêng, BE ghi trên phương án, hoặc có trong chi tiết đã nạp) - Sếp duyệt cần biết máy nào.
  // plan.machine (BE luôn trả) đứng đầu để nhãn không hiện/ẩn giữa chừng khi nạp chi tiết; dòng khả thi chưa ghi máy = MC Laser (cutMachine.lineMachine).
  const machineName = machineLabel(plan.machine ?? machine ?? linesMachine(detail?.lines) ?? null)
  // Nhãn cảnh báo: cùng một trạng thái dùng MỘT tên + MỘT màu ở mọi màn. "Cao hơn mức mặc định" (hổ phách) = lọt nhờ chế độ chấp nhận hao hụt
  // cao hơn; "Vượt ngưỡng" (đỏ) CHỈ khi chi tiết đã nạp cho thấy có dòng thật sự vượt trần (overThreshold). BE hasOverThreshold gồm cả ca "cao hơn mức
  // mặc định" nên chưa nạp chi tiết thì chỉ được nói mức nhẹ.
  const reallyOver = detail?.lines?.some((l) => l.overThreshold === true) ?? false

  return (
    <div style={{ padding: '11px 14px', marginBottom: 14, background: 'var(--bg-f0fdf4)', border: '1px solid var(--border)', borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 13 }}>
        <Check size={14} style={{ color: 'var(--fg-166534)', flexShrink: 0 }} />
        <b>Phương án cắt đã tính</b>
        <span style={{ color: 'var(--text2)' }}>
          <b>{plan.totalBars}</b> cây
          {plan.wastePercentage != null && <> · hao hụt <b>{fmtPercent(plan.wastePercentage)}%</b></>}
        </span>
        {machineName && <span style={{ color: 'var(--text2)' }}>Máy cắt: <b>{machineName}</b></span>}
        <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>— duyệt lệnh này là duyệt đúng số này</span>
        {plan.hasOverThreshold && (
          reallyOver ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--bg-fee2e2)', color: 'var(--fg-b91c1c)' }}>
              <AlertTriangle size={11} /> Có loại sắt vượt ngưỡng hao hụt
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: 'var(--bg-fffbeb)', color: 'var(--fg-b45309)' }}>
              <AlertTriangle size={11} /> Có loại sắt hao hụt cao hơn mức mặc định
            </span>
          )
        )}
        <button
          onClick={toggle}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '3px 10px', minHeight: isMobile ? 40 : undefined, background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text2)' }}
        >
          {open ? 'Ẩn chi tiết' : 'Xem chi tiết'}
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {loading && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Loader2 size={13} className="spin" /> Đang tải…
            </div>
          )}
          {error && <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--fg-991b1b)' }}>{error}</div>}
          {detail?.lines && detail.lines.length > 0 && (
            <SolveLinesTable
              lines={detail.lines}
              totalBarsAll={detail.totalBarsAll}
              wastePercentage={detail.wastePercentage}
              totalSolveSeconds={detail.totalSolveSeconds}
              isMobile={isMobile}
            />
          )}
        </div>
      )}
    </div>
  )
}
