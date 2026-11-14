'use client'

/**
 * Tab "Máy cắt": máy mặc định cho mọi đợt tính + thông số riêng từng máy, luật theo xưởng, bộ giải và gộp đơn.
 * KHSX vẫn chọn máy khác cho TỪNG đợt ở màn Tối ưu cắt sắt.
 */

import type { ReactNode } from 'react'
import { Scissors } from 'lucide-react'
import type { SolverMachine } from '../../../../types/admin'
import type { Workshop } from '../../../../types/workshop'
import { MACHINE_LABEL } from '../../../../utils/cutMachine'
import { HelpText, McInput, NumField, type ConfigForm } from './fieldParts'
import {
  MERGE_FIELDS, SHARED_LENGTH_FIELDS, SHARED_WASTE_FIELDS, STOCK_LENGTHS_HELP, STOCK_LENGTHS_MORE, WS_SIZES_PREFIX, type McKey,
} from './mcFields'
import MachinePicker from './MachinePicker'
import {
  colGap4, errorStyle, FIELD_GRID, fullRow, helpStyle, inputStyle, labelStyle, MACHINE_PANEL_STYLE,
} from './systemConfigStyles'
import type { SpecTableProps } from './TuDongFields'

export interface MachineTabProps {
  form: ConfigForm
  /** Máy mặc định đã lưu trên BE: chưa bấm thẻ nào thì xem thông số máy này. */
  savedMachine: SolverMachine | undefined
  view: SolverMachine | null
  onView: (m: SolverMachine) => void
  workshops: Workshop[]
  workshopsError: string | null
  spec: SpecTableProps
  specDirty: boolean
}

/** Khung + đầu khung dùng chung cho ba nhóm của tab. */
function Group({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div style={MACHINE_PANEL_STYLE}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, marginBottom: 12, lineHeight: 1.5 }}>{desc}</div>
      {children}
    </div>
  )
}

function SubHead({ title, first = false }: { title: string; first?: boolean }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginTop: first ? 0 : 16, marginBottom: 6 }}>{title}</div>
}

const WS_SIZES_HELP = 'Áp khi KHSX chọn xưởng lúc Tính. Để trống = không giới hạn riêng (theo máy).'
const WS_SIZES_MORE = 'Bộ giải giữ cây chuẩn (và chiều dài đang có trong kho) trước, thử mức này rồi nới thêm cỡ nếu chưa đạt '
  + 'ngưỡng hao hụt; chỉ khi vẫn không đạt mới dò cây đặt riêng. Lý do ghi ở dòng loại sắt.'

/** Nhóm "Theo xưởng": số cỡ đoạn tối đa trên 1 cây và máy cắt bắt buộc của từng xưởng. */
function WorkshopGroup({ form, workshops, error }: { form: ConfigForm; workshops: Workshop[]; error: string | null }) {
  const setMachineByWorkshop = (code: string, m: SolverMachine | '') => {
    const map = { ...(form.values.solverMachineByWorkshop ?? {}) }
    if (m === '') delete map[code]; else map[code] = m
    form.patch({ solverMachineByWorkshop: map })
  }
  return (
    <Group title="Theo xưởng" desc="Mỗi xưởng có thể có giới hạn riêng; xưởng nào để trống thì theo thông số của máy.">
      <SubHead title="Số cỡ đoạn tối đa trên 1 cây" first />
      <HelpText id="mc-ws-sizes-help" text={WS_SIZES_HELP} more={WS_SIZES_MORE} />
      <div style={{ marginTop: 8 }}>
        {error ? (
          <div role="alert" style={{ ...errorStyle, marginTop: 0 }}>Không tải được danh sách xưởng: {error}</div>
        ) : (
          <div style={FIELD_GRID}>
            {workshops.map((w) => {
              const saved = form.values.solverMaxSizesPerBarByWorkshop?.[w.code]
              return (
                <div key={w.id}>
                  <label htmlFor={`mc-${WS_SIZES_PREFIX}${w.code}`} style={labelStyle}>{w.name}</label>
                  <McInput k={`${WS_SIZES_PREFIX}${w.code}` as McKey} form={form} value={saved == null ? '' : String(saved)}
                    inputMode="numeric" placeholder="Không giới hạn" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <SubHead title="Máy cắt bắt buộc" />
      <div style={{ ...helpStyle, marginTop: 0, marginBottom: 8 }}>
        Xưởng có máy bắt buộc thì mọi lượt tính của xưởng đó dùng máy này, KHSX không đổi được.
      </div>
      {!error && (
        <div style={FIELD_GRID}>
          {workshops.map((w) => (
            <div key={w.id}>
              <label htmlFor={`mc-machine-${w.code}`} style={labelStyle}>{w.name}</label>
              <select
                id={`mc-machine-${w.code}`}
                aria-label={`Máy cắt bắt buộc — ${w.name}`}
                value={form.values.solverMachineByWorkshop?.[w.code] ?? ''}
                onChange={(e) => setMachineByWorkshop(w.code, e.target.value as SolverMachine | '')}
                style={inputStyle}
              >
                <option value="">Không bắt buộc</option>
                <option value="laser">{MACHINE_LABEL.laser}</option>
                <option value="tu_dong">{MACHINE_LABEL.tu_dong}</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </Group>
  )
}

const CHECK_LABEL: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer',
}

/** Cây chuẩn + ô "Cho đặt cây riêng" (bật/tắt). */
function StockLengthCells({ form }: { form: ConfigForm }) {
  return (
    <>
      <div style={fullRow}>
        <label htmlFor="mc-solverStockLengths" style={labelStyle}>Cây chuẩn (mm)</label>
        <McInput k="solverStockLengths" form={form} value={(form.values.solverStockLengths ?? []).join(' ')}
          helpId="mc-solverStockLengths-help" placeholder="6000" inputMode="numeric" />
        <HelpText id="mc-solverStockLengths-help" text={STOCK_LENGTHS_HELP} more={STOCK_LENGTHS_MORE} />
      </div>
      <div style={fullRow}>
        <label style={CHECK_LABEL}>
          <input
            type="checkbox"
            checked={form.values.solverAllowCustomLength ?? true}
            onChange={(e) => form.patch({ solverAllowCustomLength: e.target.checked })}
            aria-describedby="mc-solverAllowCustomLength-help"
            style={{ width: 15, height: 15, accentColor: 'var(--fg-3949ab)' }}
          />
          Cho đặt cây riêng (ngoài cây chuẩn)
        </label>
        <HelpText
          id="mc-solverAllowCustomLength-help"
          text="Bật thì bộ giải được chọn cây dài khác cây chuẩn (cây “đặt riêng”, phải đặt NCC cán) trong khoảng dưới đây."
          more="Từng đợt cắt KHSX vẫn đổi được ở màn Tối ưu cắt sắt."
        />
      </div>
    </>
  )
}

/** Nhóm "Bộ giải và gộp đơn": áp cho cả hai máy. */
function SolverGroup({ form }: { form: ConfigForm }) {
  return (
    <Group title="Bộ giải và gộp đơn" desc="Áp cho cả hai máy: dùng cho mọi đợt tính phương án cắt, dù chọn máy nào.">
      <SubHead title="Cây sắt" first />
      <div style={FIELD_GRID}>
        <StockLengthCells form={form} />
        {SHARED_LENGTH_FIELDS.map((f) => <NumField key={f.name} f={f} form={form} />)}
      </div>
      <SubHead title="Hao hụt và thời gian giải" />
      <div style={FIELD_GRID}>{SHARED_WASTE_FIELDS.map((f) => <NumField key={f.name} f={f} form={form} />)}</div>
      <SubHead title="Gộp đơn" />
      <div style={FIELD_GRID}>{MERGE_FIELDS.map((f) => <NumField key={f.name} f={f} form={form} />)}</div>
    </Group>
  )
}

export default function MachineTab(p: MachineTabProps) {
  return (
    <div style={colGap4}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
          <Scissors size={15} color="var(--fg-3949ab)" /> Máy cắt
        </div>
        <div style={{ ...helpStyle, marginTop: 4 }}>
          Áp cho màn <b>Tối ưu cắt sắt</b>. Mỗi đợt cắt KHSX vẫn chọn máy khác được ngay trên màn đó; đợt nào không chọn thì dùng
          máy mặc định dưới đây.
        </div>
      </div>
      <Group title="Theo máy" desc="Chọn máy để xem và sửa thông số riêng của máy đó. Bấm thẻ chỉ để xem, không đổi máy mặc định.">
        <MachinePicker form={p.form} view={p.view ?? p.savedMachine ?? 'laser'} onView={p.onView} spec={p.spec} specDirty={p.specDirty} />
      </Group>
      <WorkshopGroup form={p.form} workshops={p.workshops} error={p.workshopsError} />
      <SolverGroup form={p.form} />
    </div>
  )
}
