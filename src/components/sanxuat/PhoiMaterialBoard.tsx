/**
 * Bảng "Tiến độ Phôi theo loại sắt" (Cắt + công đoạn phụ × cỡ đoạn) - tách từ ThongKePagePlan.tsx (2026-10-19, changelog BE
 * 10-08 mục 48) để màn "Tổng hợp lệnh SX" và ngăn "còn thiếu gì" của thẻ PI ở "Sản lượng xưởng" dùng CHUNG một bảng, một
 * cách tính (progressModel.ts) - số không lệch giữa 2 màn.
 */

import type { CSSProperties } from 'react'
import LenhSanXuatBoard, { type BoardColumn } from './LenhSanXuatBoard'
import { PROCESS_STEP_LABELS } from '../../constants/processSteps'
import type { ProcessStep } from '../../types/sku'
import type { BePhoiProgressItem, BePhoiProgressOrderSegment } from '../../services/steel-issues-api'
import { bucketLine, remainingQty } from '../../modules/pages/Floor/progressModel'

// Phôi (2026-09-19, audit N3/N4): đo bằng ĐOẠN đã cắt / ĐỊNH MỨC theo từng loại sắt → cỡ đoạn - đúng nguồn
// (getPhoiProgress) mà màn Phôi thật đang dùng - thay cho "số cây kho đã xuất" trước đây (sai khái niệm, và
// coi mỗi đợt xuất của cùng 1 loại sắt là 1 loại sắt riêng nên báo "lệch" giả). Mỗi loại sắt = 1 dòng.
// 2026-10-19 (changelog BE 10-08 mục 47): số theo định nghĩa chung `progressModel.ts` (cùng công thức với thẻ PI của tổ
// ở "Sản lượng xưởng"): `good` = min(Đã báo − Lỗi, Cần) = passed + awaiting + open (đã chặn trần).
export interface PhoiSegmentView {
  cutLengthMm: number; required: number; done: number; failed: number; good: number; remaining: number
  /** KCS đã chấm, còn được tính / đã gửi KCS chờ chấm / chưa gửi KCS - đều đã chặn trần ở `required`. */
  passed: number; awaiting: number; open: number
}
/** Tổng các ngăn số của nhiều dòng (công đoạn / loại sắt). */
export interface PhoiBucketTotals { passed: number; awaiting: number; open: number; failed: number }
/** 1 công đoạn của Phôi cho 1 loại sắt: Cắt hoặc công đoạn phụ (Uốn/Dập/...). */
export interface PhoiStepView extends PhoiBucketTotals { step: 'CAT' | ProcessStep; label: string; segments: PhoiSegmentView[]; need: number; done: number }
export interface PhoiMaterialView extends PhoiBucketTotals {
  materialId: string; materialCode: string; materialName: string; issuedBarCount: number
  /** Đối chiếu sắt vào - đoạn ra CẢ PI (2026-10-12) - null = Phôi chưa nhận đợt nào. */
  steelBalance: BePhoiProgressItem['steelBalance'] | null
  /** Cắt + các công đoạn phụ loại sắt này cần đi qua. */
  steps: PhoiStepView[]
  /** Σ các công đoạn: mỗi đoạn tính 1 lần cho MỖI công đoạn nó phải qua (Cắt, Uốn, ...). */
  need: number; done: number
}

// Phôi = Cắt + MỌI công đoạn phụ (Uốn/Dập/Đục lỗ/Tán/Tóp đầu/Xẻ) của từng loại sắt, theo từng cỡ đoạn (2026-09-21).
// orderId = SKU cần xem (số THẬT theo SKU, từ đợt ghi kèm SKU); null = gộp cả PI (dùng cho lớp PI, gồm cả phần đợt
// CŨ chưa gắn SKU). Đợt cũ chưa gắn SKU KHÔNG tính vào SKU nào (trừ PI chỉ 1 SKU - BE đã tự gán).
function mapPhoiSegments(segs: BePhoiProgressItem['segments'], orderId: string | null): PhoiSegmentView[] {
  const out: PhoiSegmentView[] = []
  for (const s of segs) {
    const src: BePhoiProgressOrderSegment | BePhoiProgressItem['segments'][number] | null = orderId === null
      ? s
      : (s.byOrder ?? []).find(o => o.productionOrderId === orderId) ?? null
    if (!src || (orderId !== null && src.required <= 0 && src.done <= 0 && src.failed <= 0)) continue
    // Được tính = đã làm trừ lỗi KCS (lỗi cộng dồn, Phôi bù bằng cách làm thêm); chặn trần theo định mức để làm dư ở
    // cỡ này không bù cho cỡ khác còn thiếu. Tách thành đạt / chờ KCS / chưa gửi (progressModel).
    const line = { required: src.required, done: src.done, failed: src.failed, open: src.openQty ?? 0, awaiting: src.awaitingQcQty ?? 0 }
    const b = bucketLine(line)
    out.push({
      cutLengthMm: s.cutLengthMm, required: src.required, done: src.done, failed: src.failed,
      good: b.reported, remaining: remainingQty(line), passed: b.passed, awaiting: b.awaiting, open: b.open,
    })
  }
  return out
}

const sumBucketsOf = (rows: PhoiBucketTotals[]): PhoiBucketTotals => ({
  passed: rows.reduce((a, r) => a + r.passed, 0),
  awaiting: rows.reduce((a, r) => a + r.awaiting, 0),
  open: rows.reduce((a, r) => a + r.open, 0),
  failed: rows.reduce((a, r) => a + r.failed, 0),
})

export function mapPhoiProgress(items: BePhoiProgressItem[], orderId: string | null): PhoiMaterialView[] {
  const views: PhoiMaterialView[] = []
  for (const it of items) {
    const rawSteps: { step: 'CAT' | ProcessStep; segments: BePhoiProgressItem['segments'] }[] = [
      { step: 'CAT', segments: it.segments },
      ...(it.steps ?? []),
    ]
    const steps: PhoiStepView[] = []
    for (const rs of rawSteps) {
      const segments = mapPhoiSegments(rs.segments, orderId)
      if (segments.length === 0) continue
      steps.push({
        step: rs.step,
        label: rs.step === 'CAT' ? 'Cắt' : PROCESS_STEP_LABELS[rs.step],
        segments,
        need: segments.reduce((a, s) => a + s.required, 0),
        done: segments.reduce((a, s) => a + s.good, 0),
        ...sumBucketsOf(segments),
      })
    }
    if (steps.length === 0) continue
    views.push({
      materialId: it.materialId, materialCode: it.materialCode, materialName: it.materialName, issuedBarCount: it.issuedBarCount,
      steelBalance: it.steelBalance ?? null,
      steps,
      need: steps.reduce((a, st) => a + st.need, 0),
      done: steps.reduce((a, st) => a + st.done, 0),
      ...sumBucketsOf(steps),
    })
  }
  return views
}


export function PhoiMaterialBoard({ materials, title = 'Tiến độ Phôi theo loại sắt', subtitle }: {
  materials: PhoiMaterialView[]
  title?: string
  /** Bỏ trống = câu giải thích cách đọc số mặc định. */
  subtitle?: string
}) {
  const n = (v: number) => v.toLocaleString('vi-VN')
  // Số nhỏ màu nhạt khi bằng 0 để mắt chỉ dừng ở ô có số (Chưa gửi/Chờ KCS/Lỗi thường là 0).
  const quiet = (v: number, color?: string) => <span style={{ color: v > 0 ? (color ?? 'inherit') : 'var(--text3)', fontWeight: v > 0 && color ? 700 : 400 }}>{v > 0 ? n(v) : '—'}</span>
  const remainCell = (need: number, good: number) => {
    const r = Math.max(0, need - good)
    return <span style={{ color: r > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>{n(r)}</span>
  }
  // 2026-10-19 (người dùng chốt mục 45.9-2: tách đủ cột) - "Đã báo" = Chưa gửi + Chờ KCS + KCS đã chấm; "Đạt" = KCS đã
  // chấm và còn được tính; "Còn thiếu" = Cần − (Đã báo − Lỗi). Mọi số đã chặn trần theo từng cỡ đoạn (progressModel).
  // Cột số hẹp (74px đủ cho "12.345", tiêu đề tự xuống dòng) để ở khung ~800px cột "Loại sắt" vẫn còn ≥ 130px.
  const W = { issued: 112, num: 74, failed: 58 }
  const cols: BoardColumn<PhoiMaterialView>[] = [
    { key: 'mat', header: 'Loại sắt', cell: m => (
      <div>
        <div style={{ fontWeight: 700 }}>{m.materialName}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.materialCode}</div>
        {/* Công đoạn để dưới tên (không thành cột riêng) - bảng 8 cột vẫn đọc được ở màn ~800px */}
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{m.steps.map(st => st.label).join(' → ')}</div>
      </div>
    ) },
    { key: 'issued', header: 'Kho đã xuất cả PI (cây)', align: 'right', width: W.issued, cell: m => {
      const b = m.steelBalance
      return (
        <div>
          <div>{n(m.issuedBarCount)}</div>
          {/* Phôi chưa nhận đợt sắt nào của loại này - đoạn còn thiếu chưa thể cắt */}
          {!b && m.need > m.done && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)' }}>Phôi chưa nhận sắt</div>}
          {/* Phôi đếm thực nhận khác số kho xuất (2026-10-12) */}
          {b && b.receivedBarCount !== m.issuedBarCount && (
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Phôi đã nhận {n(b.receivedBarCount)}</div>
          )}
          {/* Đoạn đã báo vượt lượng sắt đã nhận: chỉ cảnh báo - có thể do cắt bù bằng sắt thừa dưới xưởng */}
          {b && b.overMm > 0 && (
            <div title={`Đoạn đã báo cần ${(b.reportedMm / 1000).toLocaleString('vi-VN')} m sắt (tính cả mạch cắt), Phôi mới nhận ${(b.usableMm / 1000).toLocaleString('vi-VN')} m dùng được (đã trừ tề đầu). Kiểm lại số báo hoặc hỏi Phôi có cắt bù bằng sắt ngoài không.`}
              style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', cursor: 'help' }}>
              ⚠ Đoạn báo vượt sắt nhận {(b.overMm / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m
            </div>
          )}
        </div>
      )
    } },
    { key: 'need', header: 'Cần', align: 'right', width: W.num, cell: m => n(m.need) },
    { key: 'open', header: 'Chưa gửi', align: 'right', width: W.num, cell: m => quiet(m.open) },
    { key: 'awaiting', header: 'Chờ KCS', align: 'right', width: W.num, cell: m => quiet(m.awaiting) },
    { key: 'passed', header: 'Đạt', align: 'right', width: W.num, cell: m => <span style={{ fontWeight: 700 }}>{n(m.passed)}</span> },
    { key: 'failed', header: 'Lỗi', align: 'right', width: W.failed, cell: m => quiet(m.failed, 'var(--red)') },
    { key: 'remain', header: 'Còn thiếu', align: 'right', width: W.num, cell: m => remainCell(m.need, m.done) },
  ]
  const th: CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textAlign: 'right', textTransform: 'uppercase' }
  const td: CSSProperties = { padding: '6px 10px', fontSize: 12, textAlign: 'right', borderTop: '1px solid var(--border)' }
  return (
    <LenhSanXuatBoard
      title={title}
      subtitle={subtitle ?? "Phôi gồm Cắt và các công đoạn phụ (Uốn, Dập…) tùy loại sắt; mỗi đoạn tính 1 lần cho mỗi công đoạn nó phải qua. Đã báo = Chưa gửi KCS + Chờ KCS + KCS đã chấm; “Đạt” = KCS đã chấm đạt; Còn thiếu = Cần − (Đã báo − Lỗi). Chi tiết từng công đoạn và cỡ đoạn hiện bên dưới mỗi loại sắt"}
      columns={cols} rows={materials} rowKey={m => m.materialId} fixedLayout fullHeight
      expandedRow={m => (
        <div style={{ padding: '4px 14px 14px', background: 'var(--surface2)' }}>
          {m.steps.map(st => (
            <div key={st.step} style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                {st.label} · {n(st.done)}/{n(st.need)} đoạn
              </div>
              {/* Cùng cấu trúc cột với bảng cha (cột 2 để trống = "Kho đã xuất") để thẳng hàng */}
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                <colgroup>
                  <col /><col style={{ width: W.issued }} />
                  <col style={{ width: W.num }} /><col style={{ width: W.num }} /><col style={{ width: W.num }} /><col style={{ width: W.num }} /><col style={{ width: W.failed }} /><col style={{ width: W.num }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left' }}>Cỡ đoạn</th><th style={th} />
                    <th style={th}>Cần</th><th style={th}>Chưa gửi</th><th style={th}>Chờ KCS</th><th style={th}>Đạt</th><th style={th}>Lỗi</th><th style={th}>Còn thiếu</th>
                  </tr>
                </thead>
                <tbody>
                  {st.segments.map(s => (
                    <tr key={s.cutLengthMm}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{n(s.cutLengthMm)} mm</td>
                      <td style={td} />
                      <td style={td}>{n(s.required)}</td>
                      <td style={td}>{quiet(s.open)}</td>
                      <td style={td}>{quiet(s.awaiting)}</td>
                      <td style={td}>{n(s.passed)}</td>
                      <td style={td}>{quiet(s.failed, 'var(--red)')}</td>
                      <td style={td}>{remainCell(s.required, s.good)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    />
  )
}

