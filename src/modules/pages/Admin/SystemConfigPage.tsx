'use client'
import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useAuditLog } from '../../../context/AuditLogContext'
import { getSystemConfig, updateSystemConfig } from '../../../services/api'
import type { SystemConfig } from '../../../types/admin'
import LoadingState from '../../../components/LoadingState'

const FIELDS: { name: keyof SystemConfig; label: string; required?: boolean }[] = [
  { name: 'companyName', label: 'Tên công ty', required: true },
  { name: 'companyAddress', label: 'Địa chỉ' },
  { name: 'companyPhone', label: 'Điện thoại' },
  { name: 'companyEmail', label: 'Email' },
  { name: 'taxCode', label: 'Mã số thuế' },
  { name: 'defaultCurrency', label: 'Đơn vị tiền tệ mặc định', required: true },
]

const inputStyle = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }

export default function SystemConfigPage() {
  const { data, isLoading, refetch } = useFetch<SystemConfig>(getSystemConfig)
  const { logAction } = useAuditLog()
  // Chỉnh sửa được giữ dưới dạng "draft" đè lên dữ liệu đã fetch, thay vì đồng bộ qua
  // useEffect+setState (dễ gây render lồng) — draft reset về rỗng sau mỗi lần lưu thành công.
  const [draft, setDraft] = useState<Partial<SystemConfig>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const values: SystemConfig | null = data ? { ...data, ...draft } : null

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
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !values) return <LoadingState />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Settings size={18} color="#3949ab" />
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Cấu hình hệ thống</h2>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 18 }}>
        Thông tin chung của công ty — hiển thị mang tính tham khảo, chưa có nghiệp vụ nào tự động đọc các giá trị này.
      </div>

      <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        {FIELDS.map(f => (
          <div key={f.name}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              {f.label}{f.required && <span style={{ color: '#c62828' }}> *</span>}
            </label>
            <input
              value={values[f.name] ?? ''}
              onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
              style={inputStyle}
            />
          </div>
        ))}

        {error && <div style={{ color: '#c62828', fontSize: 12 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#3949ab', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>Đã lưu</span>}
        </div>
      </div>
    </div>
  )
}
