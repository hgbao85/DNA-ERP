import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { ClipboardList, AlertCircle, RefreshCw } from 'lucide-react'
import VatTuCanMuaPage from './VatTuCanMuaPage'

interface Command {
  id: number; code: string; source: string; status: string; createdAt: string
  piCode?: string | null; poNumber?: string | null; productLabel?: string | null; itemCount: number
}

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])

const STEPS = [
  { key: 'QUOTING', label: 'Chờ báo giá' },
  { key: 'ORDERED', label: 'Đã đặt hàng' },
  { key: 'DONE',    label: 'Hoàn thành' },
]
const stepIndex = (s: string) => STEPS.findIndex(x => x.key === s)

function Progress({ status }: { status: string }) {
  const idx = stepIndex(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {STEPS.map((s, i) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div title={s.label} style={{
            width: 11, height: 11, borderRadius: '50%',
            background: i <= idx ? '#4527a0' : 'var(--border)',
          }} />
          {i < STEPS.length - 1 && <div style={{ width: 16, height: 2, background: i < idx ? '#4527a0' : 'var(--border)' }} />}
        </div>
      ))}
      <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 600, color: idx === 2 ? '#2e7d32' : '#4527a0' }}>
        {STEPS[idx]?.label ?? status}
      </span>
    </div>
  )
}

const sourceBadge = (src: string) => src === 'PI'
  ? { label: 'PI tự động', bg: '#ede7f6', fg: '#4527a0' }
  : { label: 'Đề xuất', bg: '#fff3e0', fg: '#e65100' }

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px', color: 'var(--text)' }

export default function TongQuanPage() {
  const { data: commands, isLoading, refetch } = useFetch<Command[]>(() => api.getPurchaseCommands())
  const list = safeArr(commands)

  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Phân loại: "Cần xử lý" = QUOTING có items (itemCount > 0); còn lại xếp sau
  const urgent   = list.filter(c => c.status === 'QUOTING' && c.itemCount > 0)
  const inProgress = list.filter(c => c.status === 'ORDERED')
  const done     = list.filter(c => c.status === 'DONE')
  const noItems  = list.filter(c => c.status === 'QUOTING' && c.itemCount === 0)

  const ordered = [...urgent, ...inProgress, ...noItems, ...done]

  if (selectedId !== null) {
    return (
      <div>
        <button onClick={() => setSelectedId(null)} style={{ marginBottom: 14, fontSize: 13, color: '#4527a0', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          ← Quay lại danh sách
        </button>
        <VatTuCanMuaPage commandId={selectedId} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Mã lệnh mua hàng</h2>
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 4 }}>
            Tự sinh khi tạo PI, hoặc khi thủ kho / Kế hoạch SX gửi đề xuất mua.
          </div>
        </div>
        <button onClick={refetch} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      {/* Banner cần xử lý */}
      {urgent.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff3e0', border: '1px solid #ffcc80', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13 }}>
          <AlertCircle size={16} color="#e65100" />
          <span><strong>{urgent.length} lệnh</strong> đang chờ báo giá &amp; chọn nhà cung cấp — xử lý sớm để không chậm tiến độ SX.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Chờ xử lý', count: urgent.length, bg: '#fff3e0', fg: '#e65100' },
          { label: 'Đang mua', count: inProgress.length, bg: '#e3f2fd', fg: '#1565c0' },
          { label: 'Hoàn thành', count: done.length, bg: '#e8f5e9', fg: '#2e7d32' },
        ].map(s => (
          <div key={s.label} style={{ padding: '6px 14px', background: s.bg, borderRadius: 20, fontSize: 12, fontWeight: 700, color: s.fg }}>
            {s.count} · {s.label}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <ClipboardList size={14} /> {isLoading ? 'Đang tải…' : `${list.length} mã lệnh`}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
            <th style={th}>Mã lệnh</th>
            <th style={th}>Nguồn</th>
            <th style={th}>Sản phẩm / PO</th>
            <th style={th}>Vật tư</th>
            <th style={th}>Tiến trình</th>
            <th style={th}>Ngày tạo</th>
            <th style={th} />
          </tr></thead>
          <tbody>
            {ordered.map(c => {
              const sb = sourceBadge(c.source)
              const isUrgent = c.status === 'QUOTING' && c.itemCount > 0
              return (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)', background: isUrgent ? '#fffdf7' : undefined }}>
                  <td style={{ ...td, fontWeight: 700 }}>
                    {isUrgent && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#e65100', marginRight: 6 }} />}
                    {c.code}
                    {c.piCode && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}> · {c.piCode}</span>}
                  </td>
                  <td style={td}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: sb.bg, color: sb.fg, fontWeight: 600 }}>{sb.label}</span>
                  </td>
                  <td style={td}>
                    <div>{c.productLabel || '—'}</div>
                    {c.poNumber && <div style={{ fontSize: 11, color: 'var(--text3)' }}>PO: {c.poNumber}</div>}
                  </td>
                  <td style={td}>
                    {c.itemCount > 0
                      ? <span style={{ fontWeight: 600, color: '#4527a0' }}>{c.itemCount} loại</span>
                      : <span style={{ color: 'var(--text3)', fontSize: 12 }}>Chưa có</span>}
                  </td>
                  <td style={td}><Progress status={c.status} /></td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{new Date(c.createdAt).toLocaleDateString('vi-VN')}</td>
                  <td style={td}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      style={{ padding: '4px 12px', background: '#ede7f6', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, color: '#4527a0', cursor: 'pointer' }}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              )
            })}
            {!isLoading && list.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>
                Chưa có mã lệnh nào. Tạo PI ở Sản xuất → mã lệnh sẽ tự xuất hiện.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
