'use client'
import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useAuditLog } from '../../../context/AuditLogContext'
import { getNetworkInfo, getSystemConfig, updateSystemConfig } from '../../../services/api'
import type { NetworkInfo } from '../../../services/system-config-api'
import type { SystemConfig } from '../../../types/admin'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'

/** Card này là form nhập chữ — chỉ nhận các field chữ của SystemConfig, không nhận field boolean
 *  (vd solverAllowCustomLength, thuộc nghiệp vụ cắt sắt chứ không phải thông tin công ty). */
type TextField = {
  [K in keyof SystemConfig]-?: SystemConfig[K] extends string | undefined ? K : never
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
    setError(null)
    setSaving(true)
    try {
      await updateSystemConfig(values)
      logAction('system-config', 'system-config', 'system_config.updated', values.companyName)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      setDraft({})
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
        Thông tin chung của công ty — hiển thị mang tính tham khảo. Riêng “Địa chỉ ERP dùng cho tem QR” được màn Sản lượng xưởng đọc để in tem.
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
