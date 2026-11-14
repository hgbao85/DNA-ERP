'use client'

/** Tab "Báo sản lượng": tiêu đề máy, việc của máy (máy cắt), rồi khu nhận sắt hoặc phần chọn lệnh + nhập số. */

import type { RefObject } from 'react'
import { useLenhCodeLookup } from '../../../../components/LenhCode'
import type { BeScanContext, BeScanPi } from '../../../../services/floor-api'
import MachineWork from './MachineWork'
import { PiPicker, SkuPicker } from './Pickers'
import PieceForm from './PieceForm'
import SegmentForm from './SegmentForm'
import {
  hasPickablePi, isOnlyRunningPi, isReworkSelected, needPiAction, reportTitle, STAGE_LABEL, STEP_LABEL, workstationSubtitle,
} from './scanModel'
import { ActionBar, Banner } from './ScanParts'
import { column, hintFaint, loadingText, tabColumn } from './scanUi'
import SteelReceiveRow from './SteelReceiveRow'
import { useScanReport } from './useScanReport'

type Report = Omit<ReturnType<typeof useScanReport>, 'flashRef' | 'reportRef'>
type RefProp = { reportRef: RefObject<HTMLDivElement> }

/** Hai form nhập số (Hàn/Sơn theo mảnh, Phôi theo đoạn) của lệnh đang chọn. */
function ReportForms({ ctx, pi, orderId, r, reportRef }: {
  ctx: BeScanContext; pi: BeScanPi; orderId: string | null; r: Report
} & RefProp) {
  const w = ctx.workstation
  const lenhOf = useLenhCodeLookup([pi.code])
  const order = pi.orders.find((o) => o.productionOrderId === orderId)
    ?? pi.orders.find((o) => o.floorStage === 'ACTIVE') ?? pi.orders[0] ?? null
  const only = isOnlyRunningPi(ctx)
  const base = (o: NonNullable<typeof order>) => ({ productionInvoiceId: pi.productionInvoiceId, productionOrderId: o.productionOrderId })
  return (
    <div ref={reportRef} style={{ ...column(16), scrollMarginTop: 12 }}>
      {!only && <PiPicker ctx={ctx} selectedPi={r.selectedPi} onSelect={r.selectPi} />}
      {isReworkSelected(ctx, r.selectedPi) && (
        <Banner tone="warn">Đang báo LÀM BÙ cho lệnh {pi.code} (lệnh này tổ đã làm qua rồi).</Banner>
      )}
      <SkuPicker orders={pi.orders} value={order?.productionOrderId ?? null} onChange={r.setOrderId} piCode={only ? pi.code : undefined} />
      {order && order.floorStage !== 'ACTIVE' && (
        <Banner tone="warn">Sản phẩm này quản lý chưa cho làm (hoặc đang tạm dừng). Chưa báo được.</Banner>
      )}
      {order && (w.kind === 'PIECE' ? (
        <PieceForm key={order.productionOrderId} items={pi.piecePlans?.[order.productionOrderId]?.items ?? []}
          context={`${lenhOf(pi.code)} · ${order.sku}`} stageLabel={STAGE_LABEL[w.stage].toLowerCase()}
          onSubmit={(pieceId, qty, summary) => r.send({ ...base(order), pieceId, qty }, summary)} />
      ) : (
        <SegmentForm key={order.productionOrderId} materials={pi.materials ?? []} orderId={order.productionOrderId}
          kindLabel={w.kind === 'CUT' ? 'Cắt' : STEP_LABEL[w.processStep ?? ''] ?? 'Làm'} context={`${lenhOf(pi.code)} · ${order.sku}`}
          onSubmit={(materialId, segments, summary) => r.send({ ...base(order), materialId, segments }, summary)} />
      ))}
    </div>
  )
}

/** Chưa có lệnh mặc định (vd máy đã cắt hết việc được chia) nhưng vẫn có lệnh để chọn báo thêm: nút chính tắt kèm lý do. */
function ChoosePi({ ctx, r, reportRef }: { ctx: BeScanContext; r: Report } & RefProp) {
  return (
    <div ref={reportRef} style={{ ...column(8), scrollMarginTop: 12 }}>
      <PiPicker ctx={ctx} selectedPi={r.selectedPi} onSelect={r.selectPi} />
      <div style={hintFaint}>Chọn lệnh để báo.</div>
      <ActionBar action={needPiAction(ctx.workstation, !!ctx.machineWork)} onClick={() => undefined} />
    </div>
  )
}

function ReportBody({ ctx, r, reportRef }: { ctx: BeScanContext; r: Report } & RefProp) {
  const w = ctx.workstation
  if (w.kind === 'STEEL_RECEIVE') {
    const list = ctx.steelToReceive ?? []
    if (list.length === 0) return <Banner tone="info">Chưa có sắt nào chờ bạn nhận.</Banner>
    return <>{list.map((iss) => <SteelReceiveRow key={iss.steelIssueId} issue={iss} onReceive={r.receive} />)}</>
  }
  if (ctx.pi) return <ReportForms ctx={ctx} pi={ctx.pi} orderId={r.orderId} r={r} reportRef={reportRef} />
  if (hasPickablePi(ctx)) return <ChoosePi ctx={ctx} r={r} reportRef={reportRef} />
  return <Banner tone="info">Tổ {STAGE_LABEL[w.stage]} chưa có lệnh nào để làm. Báo quản lý xếp lệnh cho tổ.</Banner>
}

export default function ReportTab({ ws }: { ws: string }) {
  const { flashRef, reportRef, ...r } = useScanReport(ws)
  const { ctx, loadErr, flash } = r
  if (loadErr) return <div style={{ marginTop: 16 }}><Banner tone="err">{loadErr}</Banner></div>
  if (!ctx) return <div style={{ marginTop: 24, ...loadingText }}>Đang tải…</div>
  const w = ctx.workstation
  return (
    <div style={tabColumn}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{reportTitle(w)}</h2>
        <div style={{ fontSize: 14, color: 'var(--text2)' }} title={`Mã máy ${w.code}`}>{workstationSubtitle(w)}</div>
      </div>
      {w.kind === 'CUT' && ctx.machineWork && (
        <MachineWork work={ctx.machineWork} runningPiId={ctx.runningPi?.productionInvoiceId ?? null}
          selectedPiId={r.selectedPi ?? ctx.pi?.productionInvoiceId ?? null} onPick={r.pickPi} />
      )}
      {flash && (
        <div ref={flashRef} style={{ scrollMarginTop: 120 }}>
          <Banner tone={flash.tone} alert={flash.alert}>{flash.text}</Banner>
        </div>
      )}
      <ReportBody ctx={ctx} r={r} reportRef={reportRef} />
    </div>
  )
}
