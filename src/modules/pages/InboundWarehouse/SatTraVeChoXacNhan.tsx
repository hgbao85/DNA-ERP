'use client'
// Nghiệp vụ trả lời 26/11 câu 2: sắt tổ cắt trả về kho Phôi khi QLSX "Ngưng cắt" SKU đã huỷ phải có thủ kho Phôi xác nhận số cây -
// QLSX ghi chưa đủ. Thủ kho đếm thực nhận rồi xác nhận, lúc đó mới vào tồn kho Phôi đúng chiều dài (cây lẻ dùng trước cho lệnh sau).
// Không có dòng chờ thì không hiện gì.
import { useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  confirmSteelReturn,
  getPendingSteelReturns,
  type PendingSteelReturn,
} from '../../../services/order-cancellations-api'
import LenhCode from '../../../components/LenhCode'
import { compactTh as th, compactTd as td, tableWrap } from '../../../styles/table'
import { errMsg } from '../../../utils/errors'

const btn: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer' }

export default function SatTraVeChoXacNhan() {
  const { data, refetch } = useFetch(() => getPendingSteelReturns(), [])
  useRealtimeRefetch(['production-orders'], refetch)
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<{ id: string; msg: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rows = data ?? []
  if (rows.length === 0 && !notice) return null

  const confirm = async (r: PendingSteelReturn) => {
    const raw = counted[r.id] ?? String(r.bars)
    const n = Number(raw)
    if (raw.trim() === '' || !Number.isInteger(n) || n < 0) {
      setError({ id: r.id, msg: 'Nhập số cây đếm được (số nguyên, 0 nếu không nhận được cây nào).' })
      return
    }
    if (n > r.bars) {
      setError({ id: r.id, msg: `Đếm được nhiều hơn số QLSX ghi trả (${r.bars} cây) - báo QLSX ghi lại.` })
      return
    }
    setBusyId(r.id)
    setError(null)
    try {
      await confirmSteelReturn(r.id, n)
      setNotice(
        n < r.bars
          ? `Đã xác nhận ${n}/${r.bars} cây ${r.materialCode} ${r.lengthMm.toLocaleString('vi-VN')} mm vào kho Phôi (thiếu ${r.bars - n} cây so với QLSX ghi).`
          : `Đã xác nhận ${n} cây ${r.materialCode} ${r.lengthMm.toLocaleString('vi-VN')} mm vào kho Phôi.`,
      )
      refetch()
    } catch (e) {
      setError({ id: r.id, msg: errMsg(e) })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="card" style={{ padding: 14, marginBottom: 'var(--space-5)', borderLeft: '4px solid var(--fg-e65100, #e65100)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <PackageCheck size={18} />
        <strong>Sắt tổ cắt trả về - chờ xác nhận ({rows.length})</strong>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text2)' }}>
        QLSX đã ngưng cắt SKU bị huỷ và ghi số cây tổ cắt trả về. Đếm số cây thực nhận rồi bấm Xác nhận - lúc đó cây mới vào tồn kho Phôi.
      </p>
      {notice && (
        <div style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-e8f5e9)', color: 'var(--fg-2e7d32)', fontSize: 12.5 }}>
          {notice}
        </div>
      )}
      {rows.length > 0 && (
        <div style={tableWrap}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={th}>Lệnh</th>
                <th style={th}>SKU</th>
                <th style={th}>Sắt</th>
                <th style={{ ...th, textAlign: 'right' }}>Dài (mm)</th>
                <th style={{ ...th, textAlign: 'right' }}>QLSX ghi trả</th>
                <th style={th}>Kho</th>
                <th style={th}>Người ghi</th>
                <th style={{ ...th, textAlign: 'right' }}>Đếm được</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={td}><LenhCode piCode={r.lenhCode} /></td>
                  <td style={td}>{r.factoryCode}</td>
                  <td style={td}>{r.materialCode} <span style={{ color: 'var(--text3)' }}>{r.materialName}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.lengthMm.toLocaleString('vi-VN')}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.bars} cây</td>
                  <td style={td}>{r.warehouseName}</td>
                  <td style={td}>{r.createdByName} <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>{new Date(r.createdAt).toLocaleString('vi-VN')}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input
                      type="number"
                      min={0}
                      max={r.bars}
                      value={counted[r.id] ?? String(r.bars)}
                      onChange={e => setCounted(c => ({ ...c, [r.id]: e.target.value }))}
                      style={{ width: 70, padding: 4, textAlign: 'right' }}
                      aria-label={`Số cây đếm được ${r.materialCode} ${r.lengthMm} mm`}
                    />
                  </td>
                  <td style={td}>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => void confirm(r)}
                      style={{ ...btn, border: 'none', background: 'var(--accent, #1565c0)', color: '#fff', fontWeight: 600, opacity: busyId === r.id ? 0.6 : 1 }}
                    >
                      {busyId === r.id ? 'Đang lưu...' : 'Xác nhận'}
                    </button>
                    {error?.id === r.id && <div style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{error.msg}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
