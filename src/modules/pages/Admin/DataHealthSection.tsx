'use client'
import { useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronRight, Play, ShieldCheck } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import {
  getDataHealthReport,
  runDataHealth,
  type DataHealthCheck,
  type DataHealthReport,
  type DataHealthSeverity,
} from '../../../services/data-health-api'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'

// "Kiểm tra dữ liệu" (2026-10-28, changelog BE 2026-09-25 mục 32.19-32.20): kết quả các phép kiểm CHỈ ĐỌC mà BE tự chạy mỗi
// ngày 1 lần (hẹn giờ trong app - lần đầu máy chủ chạy trong ngày, từ 32.24 thay lịch GitHub Actions) hoặc khi Admin bấm "Kiểm ngay". Bảng chi tiết dựng theo `columns` BE trả về - thêm phép kiểm mới ở BE
// không phải sửa FE.

const SEVERITY_META: Record<DataHealthSeverity, { label: string; color: string; bg: string }> = {
  HIGH: { label: 'Cao', color: 'var(--red)', bg: 'var(--red-bg)' },
  MEDIUM: { label: 'Trung bình', color: 'var(--amber)', bg: 'var(--amber-bg)' },
  LOW: { label: 'Thấp', color: 'var(--text2)', bg: 'var(--surface2)' },
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

function formatCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'number') return v.toLocaleString('vi-VN')
  if (typeof v === 'boolean') return v ? 'Có' : 'Không'
  return v
}

const chip = (color: string, bg: string): CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
  color, background: bg, whiteSpace: 'nowrap',
})

function CheckCard({ check, open, onToggle }: { check: DataHealthCheck; open: boolean; onToggle: () => void }) {
  const sev = SEVERITY_META[check.severity]
  const count = check.findings.length
  const newCount = check.findings.filter(f => f.isNew).length
  const failed = check.lastCount === -1
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', flexWrap: 'wrap' }}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span style={chip(sev.color, sev.bg)}>{sev.label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1, minWidth: 180 }}>{check.title}</span>
        {failed ? (
          <span style={chip('var(--red)', 'var(--red-bg)')}>Lỗi khi kiểm</span>
        ) : check.lastCount === null ? (
          <span style={chip('var(--text3)', 'var(--surface2)')}>Chưa kiểm</span>
        ) : count === 0 ? (
          <span style={chip('var(--green)', 'var(--green-bg)')}>Ổn</span>
        ) : (
          <>
            {newCount > 0 && <span style={chip('var(--red)', 'var(--red-bg)')}>{newCount} mới</span>}
            <span style={chip('var(--text)', 'var(--surface2)')}>{count} dòng</span>
          </>
        )}
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px 36px', fontSize: 12, color: 'var(--text2)' }}>
          <div style={{ marginBottom: 4 }}>{check.description}</div>
          <div style={{ marginBottom: count > 0 ? 10 : 0 }}><b>Cách xử lý:</b> {check.hint}</div>
          {count > 0 && (
            <div style={{ overflowX: 'auto', maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                    {check.columns.map(c => (
                      <th key={c.key} style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.label}</th>
                    ))}
                    <th style={{ textAlign: 'left', padding: '6px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>Thấy từ</th>
                  </tr>
                </thead>
                <tbody>
                  {check.findings.map(f => (
                    <tr key={f.id} style={{ borderTop: '1px solid var(--border)', background: f.isNew ? 'var(--red-bg)' : undefined }}>
                      {check.columns.map(c => (
                        <td key={c.key} style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: 'var(--text)' }}>{formatCell(f.detail[c.key])}</td>
                      ))}
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                        {formatDateTime(f.firstSeenAt)}{f.isNew && <span style={{ ...chip('var(--red)', 'transparent'), padding: '0 0 0 6px' }}>mới</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {check.truncated && (
            <div style={{ marginTop: 6, color: 'var(--amber)' }}>Lần kiểm gần nhất chạm trần số dòng - chỉ hiện phần đầu.</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function DataHealthSection() {
  const { data, isLoading, error, refetch } = useFetch<DataHealthReport>(getDataHealthReport)
  const [report, setReport] = useState<DataHealthReport | null>(null)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  // Mặc định mở các phép kiểm có dòng MỚI - người xem thấy ngay cái vừa phát sinh, phần cũ gọn lại.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  const current = report ?? data

  const handleRun = async () => {
    setRunning(true)
    setRunError(null)
    try {
      setReport(await runDataHealth())
      setToggled({})
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Không kiểm được')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <ShieldCheck size={16} color="var(--fg-3949ab)" />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', flex: 1 }}>Kiểm tra dữ liệu</span>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--fg-3949ab)', cursor: running ? 'default' : 'pointer', opacity: running ? 0.7 : 1 }}
        >
          <Play size={12} /> {running ? 'Đang kiểm...' : 'Kiểm ngay'}
        </button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
        Hệ thống tự kiểm tồn kho, hàng đang giữ, mốc thời gian và người mua phụ trách vật tư mỗi ngày 1 lần (chỉ đọc, không sửa gì). Có dòng bất thường mới hoặc phép kiểm bị lỗi thì Admin nhận thông báo.
      </div>

      {isLoading && !current ? (
        <LoadingState />
      ) : error && !current ? (
        <LoadErrorState error={error} onRetry={refetch} />
      ) : current ? (
        <>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
            {current.lastRun ? (
              <>
                Lần kiểm gần nhất: <b>{formatDateTime(current.lastRun.startedAt)}</b>{' '}
                ({current.lastRun.trigger === 'CRON' ? 'lịch tự chạy' : 'Admin bấm Kiểm ngay'})
                {' · '}
                {current.totalOpen === 0 ? (
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>không có bất thường</span>
                ) : (
                  <>
                    <b>{current.totalOpen}</b> dòng bất thường
                    {current.newCount > 0 && <>, trong đó <b style={{ color: 'var(--red)' }}>{current.newCount} mới</b></>}
                  </>
                )}
              </>
            ) : (
              'Chưa kiểm lần nào - bấm "Kiểm ngay".'
            )}
          </div>
          {runError && (
            <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>{runError}</div>
          )}
          {current.pendingRun && (
            // Lần mới hơn chưa xong: số trong các thẻ vẫn là của lần đã xong ở trên (BE 32.27 - trước đây lần dở làm mọi thẻ "Chưa kiểm").
            current.pendingRun.error ? (
              <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                Lần kiểm lúc {formatDateTime(current.pendingRun.startedAt)} dừng giữa chừng (báo kỹ thuật) - đang hiện kết quả lần trước:{'\n'}
                {current.pendingRun.error}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--amber)', background: 'var(--amber-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                Đang có lần kiểm chạy từ {formatDateTime(current.pendingRun.startedAt)} - đang hiện kết quả lần trước.
              </div>
            )
          )}
          {current.lastRun?.error && (
            <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
              Có phép kiểm bị lỗi ở lần kiểm gần nhất (báo kỹ thuật):{'\n'}{current.lastRun.error}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {current.checks.map(c => {
              const open = toggled[c.code] ?? c.findings.some(f => f.isNew)
              return (
                <CheckCard key={c.code} check={c} open={open} onToggle={() => setToggled(t => ({ ...t, [c.code]: !open }))} />
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
