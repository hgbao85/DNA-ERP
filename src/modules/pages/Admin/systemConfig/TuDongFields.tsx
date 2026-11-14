'use client'

/** Ô riêng của MC Tự động: thông số số, "Hệ số bó" chung và bảng "Số cây/bó theo quy cách". */

import { Fragment, type ChangeEvent } from 'react'
import { describeSpecCode } from '../systemConfigUi'
import { HelpText, McInput, NumField, type ConfigForm } from './fieldParts'
import {
  MC_FACTORS_HELP, MC_FACTORS_LOCKED, MC_FACTORS_MORE, MC_NUM_FIELDS, MC_SPEC_HELP, MC_SPEC_MORE, type SpecRow,
} from './mcFields'
import { errBorder, errorStyle, FIELD_GRID, fullRow, helpStyle, inputStyle, labelStyle, outlineButton } from './systemConfigStyles'

export interface SpecTableProps {
  /** Bảng đang hiện: bản đang soạn, chưa sửa thì dựng từ dữ liệu đã lưu. */
  rows: SpecRow[]
  /** Lỗi từng dòng (khoá = key dòng). */
  rowErrors: Record<number, string>
  /** Lỗi chung của bảng (khi lưu mà có dòng sai). */
  error: string | undefined
  onEdit: (fn: (rows: SpecRow[]) => SpecRow[]) => void
  onAdd: () => void
}

function SpecRowCells({ r, i, err, onEdit }: {
  r: SpecRow; i: number; err: string | undefined; onEdit: SpecTableProps['onEdit']
}) {
  const meaning = describeSpecCode(r.code)
  const describedBy = err ? `mc-spec-${r.key}-error` : undefined
  const change = (field: 'code' | 'factors') => (e: ChangeEvent<HTMLInputElement>) =>
    onEdit((rows) => rows.map((x) => (x.key === r.key ? { ...x, [field]: e.target.value } : x)))
  return (
    <Fragment>
      <div>
        <input aria-label={`Mã quy cách, dòng ${i + 1}`} value={r.code} onChange={change('code')} placeholder="V20"
          aria-invalid={err ? true : undefined} aria-describedby={describedBy} style={{ ...inputStyle, ...errBorder(err) }} />
        {meaning && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{meaning}</div>}
      </div>
      <input aria-label={`Số cây/bó, dòng ${i + 1}`} value={r.factors} onChange={change('factors')} placeholder="60 64 68 72"
        aria-invalid={err ? true : undefined} aria-describedby={describedBy} style={{ ...inputStyle, ...errBorder(err) }} />
      <button type="button" onClick={() => onEdit((rows) => rows.filter((x) => x.key !== r.key))} aria-label={`Xoá dòng ${i + 1}`}
        style={outlineButton('8px 10px')}>
        Xoá
      </button>
      {err && (
        <div id={`mc-spec-${r.key}-error`} role="alert" style={{ ...errorStyle, ...fullRow, marginTop: -2 }}>{err}</div>
      )}
    </Fragment>
  )
}

function SpecTable({ p }: { p: SpecTableProps }) {
  return (
    <div style={fullRow}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Số cây/bó theo quy cách</div>
      <div style={{ marginBottom: 8 }}><HelpText id="mc-spec-help" text={MC_SPEC_HELP} more={MC_SPEC_MORE} /></div>
      {p.rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(70px, 110px) minmax(0, 1fr) auto', gap: 6, alignItems: 'start' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Mã quy cách</div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>Số cây/bó (cách nhau dấu cách hoặc phẩy)</div>
          <div />
          {p.rows.map((r, i) => <SpecRowCells key={r.key} r={r} i={i} err={p.rowErrors[r.key]} onEdit={p.onEdit} />)}
        </div>
      )}
      {p.error && <div role="alert" style={errorStyle}>{p.error}</div>}
      <button type="button" onClick={p.onAdd}
        style={{ ...outlineButton('7px 12px', 12.5), marginTop: 8, fontWeight: 600, color: 'var(--text)' }}>
        + Thêm quy cách
      </button>
    </div>
  )
}

/** Hệ số bó chung; bảng quy cách có dòng thì ô này khoá (bảng được ưu tiên, giá trị và cách lưu giữ nguyên). */
function BundleFactors({ form, locked }: { form: ConfigForm; locked: boolean }) {
  return (
    <div style={fullRow}>
      <label htmlFor="mc-solverBundleFactors" style={labelStyle}>Hệ số bó</label>
      <McInput
        k="solverBundleFactors" form={form} value={(form.values.solverBundleFactors ?? []).join(' ')}
        helpId="mc-solverBundleFactors-help" placeholder="14 16 18 20" disabled={locked}
        style={locked ? { opacity: 0.55, cursor: 'not-allowed', background: 'var(--surface2)' } : undefined}
      />
      {locked
        ? <div id="mc-solverBundleFactors-help" style={helpStyle}>{MC_FACTORS_LOCKED}</div>
        : <HelpText id="mc-solverBundleFactors-help" text={MC_FACTORS_HELP} more={MC_FACTORS_MORE} />}
    </div>
  )
}

export default function TuDongFields({ form, spec }: { form: ConfigForm; spec: SpecTableProps }) {
  return (
    <div style={FIELD_GRID}>
      {MC_NUM_FIELDS.map((f) => <NumField key={f.name} f={f} form={form} />)}
      <BundleFactors form={form} locked={spec.rows.length > 0} />
      <SpecTable p={spec} />
    </div>
  )
}
