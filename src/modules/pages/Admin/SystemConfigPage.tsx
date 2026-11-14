'use client'
import { useEffect, useRef, useState } from 'react'
import { Building2, CheckCircle2, ClipboardList, QrCode, Scissors, Settings } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useAuditLog } from '../../../context/AuditLogContext'
import { getSystemConfig, updateSystemConfig } from '../../../services/api'
import { getWorkshops } from '../../../services/workshops-api'
import type { Workshop } from '../../../types/workshop'
import type { SolverMachine, SystemConfig } from '../../../types/admin'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
// Tiền tố số LSX
import { parseLsxPrefixes } from '../../../utils/lenhCode'
import { invalidateLsxPrefixes } from '../../../hooks/useLsxPrefixes'
import { invalidatePlanningParams } from '../../../hooks/usePlanningParams'
import { FIELDS, fieldTab, type TabId } from './systemConfig/configFields'
import type { ConfigForm } from './systemConfig/fieldParts'
import IpAllowlist from './systemConfig/IpAllowlist'
import MachineTab from './systemConfig/MachineTab'
import { machineOfKey, tabOfKey, type McKey, type SpecRow } from './systemConfig/mcFields'
import { CapacityBlock, ContainerVolumeBlock, LsxPrefixBlock } from './systemConfig/PlanningBlocks'
import { helpStyle, inputStyle, labelStyle } from './systemConfig/systemConfigStyles'
import { lsxPrefixError, requiredFieldError, validateConfig, type McErrors, type McText } from './systemConfig/validate'

const TABS: { id: TabId; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'cong-ty', label: 'Công ty', icon: <Building2 size={15} />, desc: 'Thông tin chung của công ty, chỉ để tham khảo.' },
  {
    id: 'xuong', label: 'Xưởng & tem QR', icon: <QrCode size={15} />,
    desc: 'Địa chỉ in trên tem QR máy xưởng (màn Sản lượng xưởng đọc).',
  },
  { id: 'may-cat', label: 'Máy cắt', icon: <Scissors size={15} />, desc: 'Cấu hình thật của màn Tối ưu cắt sắt.' },
  {
    id: 'ke-hoach', label: 'Kế hoạch sản xuất', icon: <ClipboardList size={15} />,
    desc: 'Tiền tố số LSX, thể tích cont và năng lực sản xuất.',
  },
]

const LSX_ERROR_SUMMARY = 'Ô “Tiền tố số LSX” chưa hợp lệ — xem thông báo màu đỏ dưới ô.'
const FIELD_ERROR_SUMMARY = 'Có ô chưa hợp lệ — xem thông báo màu đỏ dưới từng ô (tab có chấm đỏ).'

function TabBar({ tab, errTabs, onTab }: { tab: TabId; errTabs: Set<TabId>; onTab: (t: TabId) => void }) {
  return (
    <div role="tablist" aria-label="Nhóm cấu hình" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, maxWidth: 720 }}>
      {TABS.map((t) => {
        const active = t.id === tab
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`cfg-tab-${t.id}`}
            aria-selected={active}
            aria-controls="cfg-tabpanel"
            onClick={() => onTab(t.id)}
            style={{
              position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13,
              fontWeight: 600,
              border: `1px solid ${active ? 'var(--fg-3949ab)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer',
              background: active ? 'var(--surface2)' : 'var(--surface)', color: active ? 'var(--fg-3949ab)' : 'var(--text2)',
            }}
          >
            {t.icon}{t.label}
            {errTabs.has(t.id) && (
              <span aria-label="có ô chưa hợp lệ" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fg-c62828)' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

function SaveBar({ saving, hasChanges, savedAt, onSave }: {
  saving: boolean; hasChanges: boolean; savedAt: Date | null; onSave: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)',
    }}>
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff',
          background: 'var(--bg-3949ab)',
          cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>
      {hasChanges ? (
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Có thay đổi chưa lưu</span>
      ) : savedAt && (
        <span role="status" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          color: 'var(--fg-2e7d32)', background: 'var(--bg-e8f5e9)',
        }}>
          <CheckCircle2 size={15} aria-hidden />
          Đã lưu lúc {savedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}

/** Các ô chữ của nhóm Công ty / Xưởng & tem QR thuộc tab đang mở. */
function CompanyFields({ form, tab }: { form: ConfigForm; tab: TabId }) {
  return (
    <>
      {FIELDS.filter((f) => fieldTab(f.name) === tab).map((f) => (
        <div key={f.name}>
          <label style={labelStyle}>
            {f.label}{f.required && <span style={{ color: 'var(--fg-c62828)' }}> *</span>}
          </label>
          <input
            value={form.values[f.name] ?? ''}
            onChange={(e) => form.patch({ [f.name]: e.target.value })}
            placeholder={f.placeholder}
            style={inputStyle}
          />
          {f.help && <div style={helpStyle}>{f.help}</div>}
        </div>
      ))}
    </>
  )
}

export default function SystemConfigPage() {
  const { data, isLoading, error: loadError, refetch } = useFetch<SystemConfig>(getSystemConfig)
  const { logAction } = useAuditLog()
  // Chỉnh sửa được giữ dưới dạng "draft" đè lên dữ liệu đã fetch, thay vì đồng bộ qua useEffect+setState (dễ gây render lồng) -
  // draft reset về rỗng sau mỗi lần lưu thành công.
  const [draft, setDraft] = useState<Partial<SystemConfig>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Giờ lưu thành công gần nhất - giữ tới khi sửa tiếp (chữ "Đã lưu" cũ tự tắt sau 2,5 giây, dễ tưởng chưa lưu).
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [tab, setTab] = useState<TabId>('cong-ty')
  // Máy đang xem thông số ở tab Máy cắt; null = theo máy mặc định đã lưu.
  const [mcView, setMcView] = useState<SolverMachine | null>(null)
  // Chữ đang gõ của nhóm "Máy cắt" (khoá = tên field). Lỗi kiểm tra hiện NGAY dưới ô sai, không chỉ một dòng chung ở cuối form.
  const [mcText, setMcText] = useState<McText>({})
  const [mcErrors, setMcErrors] = useState<McErrors>({})
  // Danh sách xưởng cho khối "Số cỡ đoạn tối đa trên 1 cây theo xưởng". Đọc lỗi thì khối báo không tải được, phần còn lại vẫn dùng.
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [workshopsError, setWorkshopsError] = useState<string | null>(null)
  // Bảng số cây/bó theo quy cách đang soạn (null = chưa sửa, hiện theo dữ liệu đã lưu) + lỗi từng dòng (khoá = key dòng).
  const [specRows, setSpecRows] = useState<SpecRow[] | null>(null)
  const [specRowErrors, setSpecRowErrors] = useState<Record<number, string>>({})
  const specKeySeq = useRef(1000)
  // Chữ đang gõ ở ô "Tiền tố số LSX" (undefined = chưa sửa).
  const [lsxText, setLsxText] = useState<string | undefined>(undefined)
  useEffect(() => {
    getWorkshops()
      .then(setWorkshops)
      .catch((e) => setWorkshopsError(e instanceof Error ? e.message : 'Không tải được danh sách xưởng'))
  }, [])

  const values: SystemConfig | null = data ? { ...data, ...draft } : null

  /** Lưu xong: mọi bản nháp về rỗng, nạp lại cho các màn khác dùng tiền tố LSX / thông số kế hoạch mới. */
  const resetAfterSave = (companyName: string) => {
    logAction('system-config', 'system-config', 'system_config.updated', companyName)
    setSavedAt(new Date())
    setDraft({})
    setMcText({})
    setMcErrors({})
    setSpecRows(null)
    setSpecRowErrors({})
    setLsxText(undefined)
    invalidateLsxPrefixes()
    invalidatePlanningParams()
  }

  /** Ô sai đang ở tab đang mở thì ở lại; không thì chuyển sang tab của ô sai đầu tiên (và sang thẻ máy có ô sai). */
  const revealErrors = (errKeys: McKey[]) => {
    if (!errKeys.some((k) => tabOfKey(k) === tab)) setTab(tabOfKey(errKeys[0]))
    const viewing = mcView ?? data?.solverMachine ?? 'laser'
    const errMachines = errKeys.map(machineOfKey).filter((m): m is SolverMachine => m !== null)
    if (errMachines.length > 0 && !errMachines.includes(viewing)) setMcView(errMachines[0])
  }

  const handleSave = async () => {
    if (!values) return
    const missing = requiredFieldError(values)
    if (missing) { setTab('cong-ty'); setError(missing); return }
    // Đổi chữ đang gõ thành số, báo lỗi ngay tại ô thay vì để BE trả 400.
    const { next, errs, specRowErrors } = validateConfig({ values, mcText, specRows, workshops })
    if (specRowErrors) setSpecRowErrors(specRowErrors)
    if (lsxText !== undefined) {
      if (lsxPrefixError(lsxText)) { setTab('ke-hoach'); setError(LSX_ERROR_SUMMARY); return }
      next.lsxPrefixes = parseLsxPrefixes(lsxText)
    }
    setMcErrors(errs)
    const errKeys = Object.keys(errs) as McKey[]
    if (errKeys.length > 0) { revealErrors(errKeys); setError(FIELD_ERROR_SUMMARY); return }
    setError(null)
    setSaving(true)
    try {
      await updateSystemConfig(next)
      resetAfterSave(values.companyName)
      await refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu cấu hình')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <LoadingState />
  if (loadError || !values) return <LoadErrorState error={loadError ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  const form: ConfigForm = {
    values,
    text: mcText,
    errors: mcErrors,
    setText: (key, value) => {
      setMcText((t) => ({ ...t, [key]: value }))
      setMcErrors((er) => ({ ...er, [key]: undefined }))
    },
    patch: (p) => setDraft((d) => ({ ...d, ...p })),
  }
  const hasChanges = Object.keys(draft).length > 0 || Object.keys(mcText).length > 0 || specRows !== null || lsxText !== undefined
  // Tab đang có ô sai (chấm đỏ trên nút tab) - để thấy ngay lỗi nằm ở nhóm nào khi đang đứng ở tab khác.
  const errTabs = new Set<TabId>((Object.keys(mcErrors) as McKey[]).filter((k) => mcErrors[k]).map(tabOfKey))
  const lsxShown = lsxText ?? (values.lsxPrefixes ?? []).join(', ')
  const lsxError = lsxPrefixError(lsxShown)
  if (lsxText !== undefined && lsxError) errTabs.add('ke-hoach')
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0]
  // Bảng quy cách đang hiện: bản đang soạn, chưa sửa thì dựng từ dữ liệu đã lưu (sắp theo mã).
  const savedSpecRows: SpecRow[] = Object.entries(values.solverBundleFactorsBySpec ?? {})
    .sort(([a], [b]) => a.localeCompare(b, 'vi', { numeric: true }))
    .map(([code, f], i) => ({ key: i + 1, code, factors: f.join(' ') }))
  const editSpecRows = (fn: (rows: SpecRow[]) => SpecRow[]) => {
    setSpecRows(fn(specRows ?? savedSpecRows))
    setMcErrors((er) => ({ ...er, solverBundleFactorsBySpec: undefined }))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={18} color="var(--fg-3949ab)" />
        <h2 style={{ ...pageTitle, margin: 0 }}>Cấu hình hệ thống</h2>
      </div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-4)' }}>
        Chọn nhóm cần sửa ở các nút bên dưới. Nút “Lưu thay đổi” lưu mọi nhóm cùng lúc.
      </div>

      <TabBar tab={tab} errTabs={errTabs} onTab={setTab} />

      <div
        id="cfg-tabpanel" role="tabpanel" aria-labelledby={`cfg-tab-${tab}`} className="card"
        style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{activeTab.desc}</div>
        <CompanyFields form={form} tab={tab} />

        {tab === 'ke-hoach' && <LsxPrefixBlock text={lsxShown} error={lsxError} onChange={setLsxText} />}
        {tab === 'xuong' && (data?.floorAllowedIps?.length ?? 0) > 0 && (
          <IpAllowlist form={form} savedCount={data?.floorAllowedIps?.length ?? 0} />
        )}
        {tab === 'may-cat' && (
          <MachineTab
            form={form} savedMachine={data?.solverMachine} view={mcView} onView={setMcView}
            workshops={workshops} workshopsError={workshopsError} specDirty={specRows !== null}
            spec={{
              rows: specRows ?? savedSpecRows, rowErrors: specRowErrors, error: mcErrors.solverBundleFactorsBySpec,
              onEdit: editSpecRows, onAdd: () => editSpecRows((rows) => [...rows, { key: ++specKeySeq.current, code: '', factors: '' }]),
            }}
          />
        )}
        {tab === 'ke-hoach' && <ContainerVolumeBlock form={form} />}
        {tab === 'ke-hoach' && <CapacityBlock form={form} />}

        {error && <div style={{ color: 'var(--fg-c62828)', fontSize: 12 }}>{error}</div>}
        <SaveBar saving={saving} hasChanges={hasChanges} savedAt={savedAt} onSave={handleSave} />
      </div>
    </div>
  )
}
