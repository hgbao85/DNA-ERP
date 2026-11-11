'use client'
import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { updateSkuContainerLoad } from '../services/sku-api'
import { getPlanningParams } from '../services/system-config-api'
import { computeContainerLoad, fmtM3 } from '../utils/containerLoad'
import type { ContainerLoad } from '../types/containerLoad'

/** Thể tích cont 40HC dự phòng khi chưa lấy được thông số kế hoạch - chỉ để xem trước, số chính thức là số BE trả về. */
const DEFAULT_CONTAINER_VOLUME_M3 = 68

// Giới hạn KHỚP BE `UpdateContainerLoadDto` (lệch thì người dùng gặp lỗi 400 khó hiểu thay vì thông báo ngay ở ô).
const MAX_DIM_CM = 1000
const MAX_BOXES_PER_SET = 20
const MAX_LOAD_CONT = 100_000
/** Kích thước tối đa 1 chữ số thập phân (BE lưu Decimal(7,1)). */
const hasAtMost1Decimal = (x: number) => Math.abs(Math.round(x * 10) - x * 10) < 1e-9

interface Props {
  /** id SKU/PlanForm như các route /skus khác. */
  skuId: string
  value: ContainerLoad | null
  /** false = chỉ xem (không có ô nhập, không có nút Lưu). */
  canEdit: boolean
  onSaved?: (cl: ContainerLoad) => void
}

interface FormState {
  length: string
  width: string
  height: string
  boxes: string
  manual: string
}

/** Số cm hiện trong ô: 90 -> "90", 60.5 -> "60,5" (dấu phẩy kiểu VN). */
const numText = (n: number | null | undefined): string => (n == null ? '' : String(n).replace('.', ','))

const toForm = (v: ContainerLoad | null): FormState => ({
  length: numText(v?.boxLengthCm),
  width: numText(v?.boxWidthCm),
  height: numText(v?.boxHeightCm),
  boxes: String(v?.boxesPerSet ?? 1),
  manual: numText(v?.loadContManual),
})

/** Ô trống -> null (hợp lệ); chữ không phải số -> NaN (sai). */
const parseNum = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  return Number(t)
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const cell: React.CSSProperties = { flex: '1 1 110px', minWidth: 0 }

export default function ContainerLoadEditor({ skuId, value, canEdit, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => toForm(value))
  const [containerVolumeM3, setContainerVolumeM3] = useState(DEFAULT_CONTAINER_VOLUME_M3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Lần lưu thành công gần nhất, gắn với SKU đã lưu (đổi SKU thì tự không hiện). Giữ tới khi sửa ô: trước đây chữ
  // "Đã lưu" tự tắt sau 2,5 giây, người dùng không kịp thấy, nút Lưu lại mờ đi nên tưởng chưa lưu (báo 11/11).
  const [lastSave, setLastSave] = useState<{ skuId: string; at: Date } | null>(null)
  const savedAt = lastSave?.skuId === skuId ? lastSave.at : null

  // Đổi SKU hoặc số liệu đã lưu thay đổi (vd vừa Lưu xong, hoặc tải lại) -> đổ lại vào ô.
  useEffect(() => {
    setForm(toForm(value))
    setError(null)
  }, [skuId, value])

  useEffect(() => {
    let alive = true
    getPlanningParams()
      .then((p) => { if (alive && p.containerVolumeM3 > 0) setContainerVolumeM3(p.containerVolumeM3) })
      .catch(() => { /* giữ mặc định 68 */ })
    return () => { alive = false }
  }, [])

  const parsed = useMemo(() => {
    const l = parseNum(form.length)
    const w = parseNum(form.width)
    const h = parseNum(form.height)
    const n = parseNum(form.boxes)
    const m = parseNum(form.manual)
    const badDim = (x: number | null) =>
      x !== null && (!Number.isFinite(x) || x <= 0 || x > MAX_DIM_CM || !hasAtMost1Decimal(x))
    const badInt = (x: number | null, max: number) => x !== null && (!Number.isInteger(x) || x < 1 || x > max)
    let err: string | null = null
    if (badDim(l) || badDim(w) || badDim(h)) err = `Dài / Rộng / Cao phải là số lớn hơn 0 (cm), tối đa ${MAX_DIM_CM.toLocaleString('vi-VN')}, tối đa 1 số lẻ`
    else if (n === null || badInt(n, MAX_BOXES_PER_SET)) err = `Số thùng / bộ phải là số nguyên từ 1 đến ${MAX_BOXES_PER_SET}`
    else if (badInt(m, MAX_LOAD_CONT)) err = `Load cont nhập tay phải là số nguyên từ 1 đến ${MAX_LOAD_CONT.toLocaleString('vi-VN')} (để trống = theo công thức)`
    return { l, w, h, n: n ?? 1, m, err }
  }, [form])

  const result = useMemo(
    () => computeContainerLoad(
      { boxLengthCm: parsed.l, boxWidthCm: parsed.w, boxHeightCm: parsed.h, boxesPerSet: parsed.n, loadContManual: parsed.m },
      containerVolumeM3,
    ),
    [parsed, containerVolumeM3],
  )

  const dirty = useMemo(() => {
    const base = toForm(value)
    return (Object.keys(base) as (keyof FormState)[]).some((k) => base[k] !== form[k].trim())
  }, [form, value])

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setLastSave(null)
    setError(null)
  }

  const save = async () => {
    if (parsed.err) { setError(parsed.err); return }
    setSaving(true)
    setError(null)
    try {
      const cl = await updateSkuContainerLoad(skuId, {
        boxLengthCm: parsed.l,
        boxWidthCm: parsed.w,
        boxHeightCm: parsed.h,
        boxesPerSet: parsed.n,
        loadContManual: parsed.m,
      })
      setLastSave({ skuId, at: new Date() })
      onSaved?.(cl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được load cont')
    } finally {
      setSaving(false)
    }
  }

  // Dòng kết quả cập nhật khi gõ.
  const volText = containerVolumeM3.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
  let summary: string
  if (parsed.err) {
    summary = 'Số nhập chưa hợp lệ - xem thông báo đỏ bên dưới'
  } else if (result.source === 'MANUAL') {
    summary = `Load cont nhập tay: ${result.loadCont} bộ/cont` +
      (result.loadContFormula !== null ? ` (theo công thức: ${result.loadContFormula})` : ' (chưa đủ kích thước để tính theo công thức)')
  } else if (result.source === 'FORMULA' && result.boxVolumeM3 !== null) {
    summary = `Thể tích thùng ${fmtM3(result.boxVolumeM3)} m³ · Load cont = ${volText} ÷ (${fmtM3(result.boxVolumeM3)} × ${parsed.n}) = ${result.loadCont} bộ/cont`
  } else {
    summary = 'Chưa đủ kích thước thùng - chưa tính được load cont'
  }
  const summaryMuted = result.source === null || parsed.err !== null

  const id = (k: string) => `cl-${skuId}-${k}`
  const readOnlyCell = (label: string, v: string) => (
    <div style={cell}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)' }}>{v || '—'}</div>
    </div>
  )

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Thùng &amp; load cont</div>

      {canEdit ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={cell}>
            <label htmlFor={id('l')} style={labelStyle}>Dài (cm)</label>
            <input id={id('l')} value={form.length} onChange={set('length')} inputMode="decimal" style={fieldStyle} />
          </div>
          <div style={cell}>
            <label htmlFor={id('w')} style={labelStyle}>Rộng (cm)</label>
            <input id={id('w')} value={form.width} onChange={set('width')} inputMode="decimal" style={fieldStyle} />
          </div>
          <div style={cell}>
            <label htmlFor={id('h')} style={labelStyle}>Cao (cm)</label>
            <input id={id('h')} value={form.height} onChange={set('height')} inputMode="decimal" style={fieldStyle} />
          </div>
          <div style={cell}>
            <label htmlFor={id('n')} style={labelStyle}>Số thùng / bộ</label>
            <input id={id('n')} value={form.boxes} onChange={set('boxes')} inputMode="numeric" style={fieldStyle} />
          </div>
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <label htmlFor={id('m')} style={labelStyle}>Load cont nhập tay (bộ/cont)</label>
            <input id={id('m')} value={form.manual} onChange={set('manual')} inputMode="numeric" style={fieldStyle} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Để trống = theo công thức</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {readOnlyCell('Dài (cm)', numText(value?.boxLengthCm))}
          {readOnlyCell('Rộng (cm)', numText(value?.boxWidthCm))}
          {readOnlyCell('Cao (cm)', numText(value?.boxHeightCm))}
          {readOnlyCell('Số thùng / bộ', String(value?.boxesPerSet ?? 1))}
        </div>
      )}

      <div style={{ fontSize: 12, marginTop: 10, lineHeight: 1.5, overflowWrap: 'anywhere', color: summaryMuted ? 'var(--text3)' : 'var(--text2)', fontWeight: summaryMuted ? 400 : 600 }}>
        {canEdit ? summary : (value?.loadCont != null ? `Load cont ${value.loadCont} bộ/cont${value.source === 'MANUAL' ? ' (nhập tay)' : ''}` : 'Chưa có load cont')}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty || parsed.err !== null}
            style={{
              padding: '7px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--bg-3949ab)',
              cursor: saving || !dirty || parsed.err !== null ? 'not-allowed' : 'pointer', opacity: saving || !dirty || parsed.err !== null ? 0.5 : 1,
            }}
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
          {savedAt && !dirty && (
            <span
              role="status"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: 'var(--fg-2e7d32)', background: 'var(--bg-e8f5e9)',
              }}
            >
              <CheckCircle2 size={15} aria-hidden />
              Đã lưu lúc {savedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      )}
      {canEdit && (error ?? parsed.err) && dirty && (
        <div role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 6 }}>{error ?? parsed.err}</div>
      )}
    </div>
  )
}
