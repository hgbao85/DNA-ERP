'use client'
import { useState } from 'react'
import { Scissors, Settings } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useAuditLog } from '../../../context/AuditLogContext'
import { getNetworkInfo, getSystemConfig, updateSystemConfig } from '../../../services/api'
import type { NetworkInfo } from '../../../services/system-config-api'
import type { SolverMachine, SystemConfig } from '../../../types/admin'
import { MACHINE_LABEL } from '../../../utils/cutMachine'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'

/** Card này là form nhập chữ — chỉ nhận các field chữ của SystemConfig, không nhận field boolean
 *  (vd solverAllowCustomLength, thuộc nghiệp vụ cắt sắt chứ không phải thông tin công ty). */
type TextField = {
  [K in keyof SystemConfig]-?: SystemConfig[K] extends string | undefined ? (string extends SystemConfig[K] ? K : never) : never
}[keyof SystemConfig]

const FIELDS: { name: TextField | 'floorPublicUrl'; label: string; required?: boolean; help?: string; placeholder?: string }[] = [
  { name: 'companyName', label: 'Tên công ty', required: true },
  { name: 'companyAddress', label: 'Địa chỉ' },
  { name: 'companyPhone', label: 'Điện thoại' },
  { name: 'companyEmail', label: 'Email' },
  { name: 'taxCode', label: 'Mã số thuế' },
  { name: 'defaultCurrency', label: 'Đơn vị tiền tệ mặc định', required: true },
  {
    name: 'floorPublicUrl',
    label: 'Địa chỉ ERP dùng cho tem QR máy xưởng',
    placeholder: 'https://erpdna.vercel.app',
    help: 'Mã QR dán ở máy xưởng là link tới trang báo sản lượng của công nhân - địa chỉ này là phần đầu của link. Điền địa chỉ thật mà điện thoại ở xưởng mở được; ' +
      'để trống = dùng địa chỉ đang mở khi QLSX in tem. Mỗi hệ thống (thử/thật) tự đặt riêng - máy thử để trống. ' +
      'ĐÃ DÁN TEM rồi thì đừng đổi: tem cũ chỉ còn quét được nếu địa chỉ cũ vẫn hoạt động.',
  },
]

/** Nhóm "Máy cắt" - cấu hình thật cho bộ giải Đề xuất thanh sắt (màn Tối ưu cắt sắt đọc). Các tham số số nhập dạng
 *  chữ (giữ được lúc đang gõ dở "2,"), chỉ đổi thành số + kiểm tra khi bấm Lưu. */
type McNumName = 'solverMctdBladeWidthMm' | 'solverMctdTrimStartMm' | 'solverMaxManualCuts' | 'solverMaxSizesPerPattern' | 'solverMergeWindowDays' | 'solverMergeMaxSkus'
type McKey = McNumName | 'solverBundleFactors'
const MC_NUM_FIELDS: { name: McNumName; label: string; help: string; integer: boolean; min: number; max: number }[] = [
  {
    name: 'solverMctdBladeWidthMm', label: 'Lưỡi cắt (mm)', integer: false, min: 0, max: 10,
    help: 'Bề dày lưỡi cắt: mỗi nhát cắt mất đi chừng này trên cây sắt. Mặc định 2,5.',
  },
  {
    name: 'solverMctdTrimStartMm', label: 'Tề đầu (mm)', integer: true, min: 0, max: 100,
    help: 'Phần đầu cây cắt bỏ trước khi cắt đoạn đầu tiên, tính bằng mm nguyên. Mặc định 0 (không tề).',
  },
  {
    name: 'solverMaxManualCuts', label: 'Số cây cắt tay tối đa', integer: true, min: 0, max: 100,
    help: 'Phần lẻ không đủ một bó thì cắt từng cây (cắt tay). Mỗi loại sắt được cắt tay tối đa chừng này cây. Mặc định 5; nhập 0 = không cho cắt tay.',
  },
  {
    name: 'solverMaxSizesPerPattern', label: 'Số cỡ đoạn tối đa mỗi kiểu cắt', integer: true, min: 1, max: 10,
    help: 'Một kiểu cắt (cách cắt chung của một bó) có tối đa chừng này cỡ đoạn khác nhau. Mặc định 5.',
  },
]
/** Gợi ý gộp đơn ở màn Tối ưu cắt sắt (2026-10-24) - áp cho cả hai máy nên đứng riêng, không nằm trong "Thông số MC Tự động".
 *  Cùng khối với trần số SKU mỗi lệnh gộp: hai con số này cùng định ra "một lệnh gộp được to đến đâu". */
const MERGE_WINDOW_FIELD: (typeof MC_NUM_FIELDS)[number] = {
  name: 'solverMergeWindowDays', label: 'Gộp lệnh có mốc cần sắt trong khung (ngày)', integer: true, min: 1, max: 365,
  // 2026-10-24 (Sếp chốt): từ gợi ý mềm thành LUẬT CỨNG, mặc định 7 -> 3. "Mốc cần sắt" = ngày Mua hàng của SKU (chưa có thì ngày Khung cơ khí).
  // Làm rõ cùng ngày: khung tính CẢ HAI ĐẦU (3 = ngày 1 gộp được ngày 3, không gộp ngày 4) nên chênh tối đa N-1 ngày; min 1 (không còn 0).
  help: 'Luật cứng của lệnh gộp: các SKU gộp chung phải có “mốc cần sắt” (ngày Mua hàng, chưa có thì ngày Khung cơ khí) nằm trong một khung chừng này ngày, tính cả ngày đầu và ngày cuối. ' +
    'Ví dụ khung 3 ngày: ngày 1 gộp được với ngày 2 và ngày 3, KHÔNG gộp được với ngày 4 (chênh tối đa 2 ngày). ' +
    'Vi phạm thì KHSX không tính được phương án, không gộp được và không lưu được mốc thời gian — phải dời mốc hoặc tách SKU ra lệnh riêng. ' +
    'Màn Tối ưu cắt sắt cũng chỉ gợi ý gộp trong khung này. SKU chưa có mốc không bị chặn. Mặc định 3; nhập 1 = chỉ gộp SKU cùng ngày.',
}
const MERGE_MAX_SKUS_FIELD: (typeof MC_NUM_FIELDS)[number] = {
  name: 'solverMergeMaxSkus', label: 'Số SKU gộp tối đa mỗi lệnh', integer: true, min: 1, max: 50,
  help: 'Một lệnh gộp (và một đợt tính phương án cắt) có tối đa chừng này SKU. Mặc định 2.',
}
const MERGE_FIELDS = [MERGE_WINDOW_FIELD, MERGE_MAX_SKUS_FIELD]
const MC_FACTORS_HELP = 'Số cây cắt cùng lúc trong một bó. Nhập các số cách nhau bằng dấu cách, vd: 14 16 18 20. Mỗi số là số nguyên lớn hơn 1, tối đa 8 số. Mặc định 14 16 18 20.'
const fmtMcNum = (n: number | undefined) => (n == null ? '' : String(n).replace('.', ','))

const inputStyle = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }

export default function SystemConfigPage() {
  const { data, isLoading, error: loadError, refetch } = useFetch<SystemConfig>(getSystemConfig)
  const { logAction } = useAuditLog()
  // Chỉnh sửa được giữ dưới dạng "draft" đè lên dữ liệu đã fetch, thay vì đồng bộ qua
  // useEffect+setState (dễ gây render lồng) — draft reset về rỗng sau mỗi lần lưu thành công.
  const [draft, setDraft] = useState<Partial<SystemConfig>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // IP mà BE thấy của người đang mở màn này (nút "Thêm IP hiện tại của tôi")
  const [netInfo, setNetInfo] = useState<NetworkInfo | null>(null)
  const [netBusy, setNetBusy] = useState(false)
  const [netError, setNetError] = useState<string | null>(null)
  const [netNote, setNetNote] = useState('')
  // Chữ đang gõ của nhóm "Máy cắt" (khoá = tên field; hệ số bó dùng khoá solverBundleFactors). Về rỗng sau mỗi lần lưu thành công.
  const [mcText, setMcText] = useState<Partial<Record<McKey, string>>>({})
  // Lỗi kiểm tra hiện NGAY dưới ô sai (kèm aria-invalid/aria-describedby), không chỉ một dòng chung ở cuối form.
  const [mcErrors, setMcErrors] = useState<Partial<Record<McKey, string>>>({})

  const values: SystemConfig | null = data ? { ...data, ...draft } : null

  const ipLines = values?.floorAllowedIps ?? []
  const addMyIp = async () => {
    setNetBusy(true); setNetError(null)
    try {
      const info = await getNetworkInfo()
      setNetInfo(info)
      // IP nội bộ/loopback: BE chưa thấy IP thật (local, hoặc chưa khai TRUST_PROXY_HOPS) - thêm vào chỉ vô ích, nên không tự thêm.
      const have = ipLines.map((l) => l.split('#')[0].trim())
      if (info.ip && !info.isPrivate && !have.includes(info.ip)) {
        const note = netNote.trim().replace(/\s+/g, ' ')
        const line = note ? `${info.ip} # ${note}` : info.ip
        setDraft(d => ({ ...d, floorAllowedIps: [...ipLines.filter((l) => l.trim()), line] }))
        setNetNote('')
      }
    } catch (e) {
      setNetError(e instanceof Error ? e.message : 'Không lấy được IP hiện tại')
    } finally {
      setNetBusy(false)
    }
  }

  const handleSave = async () => {
    if (!values) return
    if (!values.companyName.trim()) { setError('Tên công ty là bắt buộc'); return }
    if (!values.defaultCurrency.trim()) { setError('Đơn vị tiền tệ là bắt buộc'); return }
    // Nhóm "Máy cắt": đổi chữ đang gõ thành số, báo lỗi ngay tại đây thay vì để BE trả 400.
    const next: SystemConfig = { ...values }
    const errs: Partial<Record<McKey, string>> = {}
    for (const f of [...MC_NUM_FIELDS, ...MERGE_FIELDS]) {
      const raw = mcText[f.name]
      if (raw === undefined) continue
      const n = Number(raw.trim().replace(',', '.'))
      if (raw.trim() === '' || !Number.isFinite(n) || n < f.min || n > f.max || (f.integer && !Number.isInteger(n))) {
        errs[f.name] = `Phải là ${f.integer ? 'số nguyên' : 'số'} từ ${f.min} đến ${f.max}`
        continue
      }
      next[f.name] = n
    }
    if (mcText.solverBundleFactors !== undefined) {
      const parts = mcText.solverBundleFactors.split(/[\s,;]+/).filter(Boolean).map(Number)
      if (parts.length < 1 || parts.length > 8 || parts.some((n) => !Number.isInteger(n) || n <= 1)) {
        errs.solverBundleFactors = 'Gồm 1 đến 8 số nguyên lớn hơn 1, cách nhau bằng dấu cách (vd 14 16 18 20)'
      } else {
        next.solverBundleFactors = [...new Set(parts)].sort((a, b) => a - b)
      }
    }
    setMcErrors(errs)
    if (Object.keys(errs).length > 0) {
      setError('Nhóm “Máy cắt” có ô chưa hợp lệ — xem thông báo màu đỏ dưới từng ô.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await updateSystemConfig(next)
      logAction('system-config', 'system-config', 'system_config.updated', values.companyName)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      setDraft({})
      setMcText({})
      setMcErrors({})
      await refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu cấu hình')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <LoadingState />
  if (loadError || !values) return <LoadErrorState error={loadError ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={18} color="var(--fg-3949ab)" />
        <h2 style={{ ...pageTitle, margin: 0 }}>Cấu hình hệ thống</h2>
      </div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Thông tin chung của công ty — hiển thị mang tính tham khảo. Riêng “Địa chỉ ERP dùng cho tem QR” được màn Sản lượng xưởng đọc để in tem, còn nhóm “Máy cắt” là cấu hình thật của màn Tối ưu cắt sắt.
      </div>

      <div className="card" style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {FIELDS.map(f => (
          <div key={f.name}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              {f.label}{f.required && <span style={{ color: 'var(--fg-c62828)' }}> *</span>}
            </label>
            <input
              value={values[f.name] ?? ''}
              onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
              placeholder={f.placeholder}
              style={inputStyle}
            />
            {f.help && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>}
          </div>
        ))}

        <div>
          <label htmlFor="allowed-ips" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
            Mạng công ty được phép đăng nhập (công nhân)
          </label>
          <textarea
            id="allowed-ips"
            rows={4}
            value={ipLines.join('\n')}
            onChange={e => setDraft(d => ({ ...d, floorAllowedIps: e.target.value.split('\n') }))}
            placeholder={'203.0.113.5 # Văn phòng Quy Nhơn\n198.51.100.7 # Xưởng Tây Sơn'}
            spellCheck={false}
            style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <input
              value={netNote}
              onChange={e => setNetNote(e.target.value)}
              maxLength={60}
              placeholder="Tên mạng (vd Văn phòng Quy Nhơn)"
              aria-label="Tên mạng ghi chú cho IP sắp thêm"
              style={{ ...inputStyle, width: 240 }}
            />
            <button type="button" onClick={() => void addMyIp()} disabled={netBusy}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: netBusy ? 'default' : 'pointer' }}>
              {netBusy ? 'Đang kiểm tra...' : 'Thêm IP hiện tại của tôi'}
            </button>
            {netInfo && (
              <span style={{ fontSize: 12, color: netInfo.isPrivate ? 'var(--amber)' : 'var(--text2)' }}
                title={`Chuỗi X-Forwarded-For BE nhận: ${netInfo.forwardedFor ?? '(không có)'} · BE đang tin ${netInfo.trustProxyHops} lớp proxy (TRUST_PROXY_HOPS)`}>
                Máy chủ thấy IP của bạn là <b>{netInfo.ip ?? 'không rõ'}</b>
                {netInfo.isPrivate ? ' - đây là IP nội bộ, chưa phải IP công cộng của công ty (đang chạy thử, hoặc máy chủ chưa khai số lớp proxy TRUST_PROXY_HOPS) nên chưa thêm.' : ''}
              </span>
            )}
          </div>
          {netInfo && !netInfo.isPrivate && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Kiểm tra: mở trang “what is my ip” trên cùng máy này - phải ra <b>đúng IP trên</b>. Khác (vd ra IP của Cloudflare/máy chủ) thì chỉnh biến TRUST_PROXY_HOPS
              của máy chủ (đang là {netInfo.trustProxyHops}; chuỗi nhận được: {netInfo.forwardedFor ?? 'không có'}) rồi bấm lại.
            </div>
          )}
          {netError && <div style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{netError}</div>}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
            Mỗi dòng 1 IP công cộng của công ty (vd 203.0.113.5) hoặc dải IPv4 (vd 203.0.113.0/24), có thể ghi chú sau dấu # để biết là địa điểm nào
            (văn phòng và xưởng ở 2 nơi sẽ có 2 IP khác nhau - thêm cả hai). <b>Để trống = không giới hạn.</b> Khi có IP, công nhân
            và tài khoản tổ Phôi/Hàn/Sơn chỉ đăng nhập và làm việc được khi nối mạng công ty - dùng 4G hoặc mạng ngoài sẽ bị chặn (người đang mở cũng bị
            chặn ngay). Sếp, QLSX, KCS, Admin không bị giới hạn. Công ty cần IP công cộng cố định; mở màn này từ mạng công ty rồi bấm “Thêm IP hiện tại của tôi”.
            {(data?.floorAllowedIps?.length ?? 0) > 0
              ? <> <b style={{ color: 'var(--amber)' }}>Đang BẬT ({data?.floorAllowedIps?.length} mục).</b></>
              : <> Đang tắt.</>}
          </div>
        </div>

        {/* Máy cắt: máy mặc định cho mọi đợt tính + thông số riêng của MC Tự động. KHSX vẫn chọn máy khác cho TỪNG đợt ở Tối ưu cắt sắt. */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              <Scissors size={15} color="var(--fg-3949ab)" /> Máy cắt
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
              Áp cho màn <b>Tối ưu cắt sắt</b>. Mỗi đợt cắt KHSX vẫn chọn máy khác được ngay trên màn đó; đợt nào không chọn thì dùng máy mặc định dưới đây.
            </div>
          </div>

          <div>
            <div id="solver-machine-label" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Máy cắt mặc định</div>
            <div role="radiogroup" aria-labelledby="solver-machine-label" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['laser', 'tu_dong'] as SolverMachine[]).map((m) => {
                const active = (values.solverMachine ?? 'laser') === m
                return (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 200px', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text)', border: `1px solid ${active ? 'var(--fg-3949ab)' : 'var(--border)'}`, background: active ? 'var(--surface2)' : 'var(--surface)' }}>
                    <input
                      type="radio"
                      name="solverMachine"
                      checked={active}
                      onChange={() => setDraft(d => ({ ...d, solverMachine: m }))}
                      style={{ width: 15, height: 15, flexShrink: 0, accentColor: 'var(--fg-3949ab)' }}
                    />
                    <span>
                      {MACHINE_LABEL[m]}
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>
                        {m === 'laser' ? 'Cắt từng cây' : 'Cắt theo bó nhiều cây một lần, phần lẻ cắt tay'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Thông số MC Tự động</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)' }}>
              {MC_NUM_FIELDS.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`mc-${f.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    id={`mc-${f.name}`}
                    value={mcText[f.name] ?? fmtMcNum(values[f.name])}
                    onChange={e => { setMcText(t => ({ ...t, [f.name]: e.target.value })); setMcErrors(er => ({ ...er, [f.name]: undefined })) }}
                    inputMode={f.integer ? 'numeric' : 'decimal'}
                    aria-invalid={mcErrors[f.name] ? true : undefined}
                    aria-describedby={`mc-${f.name}-help${mcErrors[f.name] ? ` mc-${f.name}-error` : ''}`}
                    style={{ ...inputStyle, ...(mcErrors[f.name] ? { borderColor: 'var(--fg-c62828)' } : null) }}
                  />
                  {mcErrors[f.name] && <div id={`mc-${f.name}-error`} role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors[f.name]}</div>}
                  <div id={`mc-${f.name}-help`} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="mc-solverBundleFactors" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Hệ số bó</label>
                <input
                  id="mc-solverBundleFactors"
                  value={mcText.solverBundleFactors ?? (values.solverBundleFactors ?? []).join(' ')}
                  onChange={e => { setMcText(t => ({ ...t, solverBundleFactors: e.target.value })); setMcErrors(er => ({ ...er, solverBundleFactors: undefined })) }}
                  placeholder="14 16 18 20"
                  aria-invalid={mcErrors.solverBundleFactors ? true : undefined}
                  aria-describedby={`mc-solverBundleFactors-help${mcErrors.solverBundleFactors ? ' mc-solverBundleFactors-error' : ''}`}
                  style={{ ...inputStyle, ...(mcErrors.solverBundleFactors ? { borderColor: 'var(--fg-c62828)' } : null) }}
                />
                {mcErrors.solverBundleFactors && <div id="mc-solverBundleFactors-error" role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors.solverBundleFactors}</div>}
                <div id="mc-solverBundleFactors-help" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{MC_FACTORS_HELP}</div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Gợi ý gộp đơn (cả hai máy)</div>
            {/* Hai ô đứng cạnh nhau trên màn rộng, tự xếp chồng trên điện thoại (auto-fit, cùng kiểu lưới "Thông số MC Tự động"). */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)', alignItems: 'start' }}>
              {MERGE_FIELDS.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`mc-${f.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    id={`mc-${f.name}`}
                    value={mcText[f.name] ?? fmtMcNum(values[f.name])}
                    onChange={e => { setMcText(t => ({ ...t, [f.name]: e.target.value })); setMcErrors(er => ({ ...er, [f.name]: undefined })) }}
                    inputMode="numeric"
                    aria-invalid={mcErrors[f.name] ? true : undefined}
                    aria-describedby={`mc-${f.name}-help${mcErrors[f.name] ? ` mc-${f.name}-error` : ''}`}
                    style={{ ...inputStyle, ...(mcErrors[f.name] ? { borderColor: 'var(--fg-c62828)' } : null) }}
                  />
                  {mcErrors[f.name] && <div id={`mc-${f.name}-error`} role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors[f.name]}</div>}
                  <div id={`mc-${f.name}-help`} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'var(--fg-c62828)', fontSize: 12 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--bg-3949ab)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>Đã lưu</span>}
        </div>
      </div>
    </div>
  )
}
