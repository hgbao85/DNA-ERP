'use client'

/** Tab "Kế hoạch sản xuất": tiền tố số LSX, thể tích cont 40HC (mẫu số của load cont) và năng lực sản xuất (chỉ cảnh báo). */

import { NumField, type ConfigForm } from './fieldParts'
import { CAPACITY_DEFAULTS, CAPACITY_FIELDS, CONTAINER_VOLUME_FIELD } from './mcFields'
import { errBorder, errorStyle, helpStyle, inputStyle, labelStyle, sectionDivider } from './systemConfigStyles'

/** Nhóm "Lệnh sản xuất": tiền tố số LSX nhà máy (MY-313, GP-176). `error` = lỗi kiểm tra chữ đang gõ (null = hợp lệ). */
export function LsxPrefixBlock({ text, error, onChange }: { text: string; error: string | null; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Lệnh sản xuất</div>
      <label htmlFor="lsx-prefixes" style={labelStyle}>Tiền tố số LSX</label>
      <input
        id="lsx-prefixes"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="MY, GP"
        spellCheck={false}
        aria-invalid={!!error}
        aria-describedby="lsx-prefixes-help"
        style={{ ...inputStyle, ...errBorder(error ?? undefined) }}
      />
      {error && <div role="alert" style={errorStyle}>{error}</div>}
      <div id="lsx-prefixes-help" style={helpStyle}>
        Nhập nhiều tiền tố, cách nhau dấu phẩy (vd MY, GP). Để trống = chấp nhận mọi tiền tố.
        Số LSX có dạng TIỀN TỐ-SỐ, vd MY-313.
      </div>
    </div>
  )
}

/** Thể tích cont 40HC: mẫu số của load cont mọi SKU. */
export function ContainerVolumeBlock({ form }: { form: ConfigForm }) {
  return (
    <div style={sectionDivider}>
      <NumField f={CONTAINER_VOLUME_FIELD} form={form} fallback={68} style={{ maxWidth: 230 }} />
    </div>
  )
}

/** Năng lực sản xuất: chỉ để CẢNH BÁO, không khoá việc nào. */
export function CapacityBlock({ form }: { form: ConfigForm }) {
  return (
    <div style={sectionDivider}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Năng lực sản xuất (chỉ cảnh báo)</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)', alignItems: 'start',
      }}>
        {CAPACITY_FIELDS.map((f) => <NumField key={f.name} f={f} form={form} fallback={CAPACITY_DEFAULTS[f.name]} />)}
      </div>
    </div>
  )
}
