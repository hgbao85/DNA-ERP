'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { PackagePlus } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { getOverReceiptStats } from '../../../services/purchase-receipts-api'
import EmptyState from '../../../components/EmptyState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'

const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)', textAlign: 'left' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13 }
const fmtQty = (n: number) => String(Math.round(n * 10_000) / 10_000)
const dayStr = (d: Date) => format(d, 'yyyy-MM-dd')

function GroupCard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div style={{ flex: '1 1 220px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>—</div>
      ) : rows.slice(0, 8).map(r => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '2px 0' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <b style={{ whiteSpace: 'nowrap' }}>{r.value}</b>
        </div>
      ))}
    </div>
  )
}

/**
 * "Nhận vượt" (Đợt 5e, bản v8 4.12): các lần Kho nhận vượt số còn lại của đơn đặt hàng, kèm lý do thủ kho ghi - gộp theo
 * NCC, vật tư, thủ kho. Phần vượt đã vào tồn chưa giữ; lần tính đề xuất mua sau tự trừ.
 */
export default function NhanVuotPage() {
  const [from, setFrom] = useState(() => dayStr(new Date(Date.now() - 30 * 86_400_000)))
  const [to, setTo] = useState(() => dayStr(new Date()))
  const { data, isLoading, error, refetch } = useFetch(() => getOverReceiptStats(from, to), [from, to])
  useRealtimeRefetch(['purchase-proposals'], refetch)

  const input: React.CSSProperties = { padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)', color: 'var(--text)' }

  return (
    <div>
      <h2 style={pageTitle}>Nhận vượt</h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Các lần Kho nhận nhiều hơn số còn chờ nhận của đơn đặt hàng. Phần vượt vào tồn chưa giữ cho lệnh nào, lần tính mua sau tự trừ.
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-4)', fontSize: 13 }}>
        Từ <input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} style={input} aria-label="Từ ngày" />
        đến <input type="date" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} style={input} aria-label="Đến ngày" />
        {data && <span style={{ color: 'var(--text3)' }}>{data.items.length} lần nhận vượt</span>}
      </div>

      {error && <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--fg-dc2626, #dc2626)' }}>{error}</div>}
      {isLoading && !data ? (
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Đang tải…</div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState icon={<PackagePlus size={28} />} message="Không có lần nhận vượt nào trong khoảng ngày này" />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 'var(--space-5)' }}>
            <GroupCard title="Theo nhà cung cấp (số lần)" rows={data.bySupplier.map(g => ({ label: g.name, value: String(g.count) }))} />
            <GroupCard title="Theo vật tư (số lần · tổng vượt)" rows={data.byMaterial.map(g => ({ label: `${g.code} ${g.name}`, value: `${g.count} · ${fmtQty(g.overQty)} ${g.unit}` }))} />
            <GroupCard title="Theo thủ kho (số lần)" rows={data.byUser.map(g => ({ label: g.name, value: String(g.count) }))} />
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  <th style={th}>Ngày</th>
                  <th style={th}>Đơn</th>
                  <th style={th}>Vật tư</th>
                  <th style={{ ...th, textAlign: 'right' }}>Thực nhận</th>
                  <th style={{ ...th, textAlign: 'right' }}>Vượt</th>
                  <th style={th}>Lý do</th>
                  <th style={th}>Thủ kho</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{format(new Date(r.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                    <td style={td}>{r.supplierName}{r.orderCode ? ` – Số ${r.orderCode}` : ''}</td>
                    <td style={td}><b>{r.materialCode}</b> {r.materialName}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtQty(r.receivedQty)} {r.unit}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--fg-d97706)' }}>+{fmtQty(r.overQty)} {r.unit}</td>
                    <td style={td}>
                      {r.overReason}
                      {r.overFileUrls.map((u, i) => (
                        <span key={u}> · <a href={u} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--fg-2563eb)' }}>ảnh{r.overFileUrls.length > 1 ? ` ${i + 1}` : ''}</a></span>
                      ))}
                    </td>
                    <td style={td}>{r.createdByName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
