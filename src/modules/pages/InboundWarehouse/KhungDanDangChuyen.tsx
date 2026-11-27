'use client'
// Nhân trả lời 26/11 câu 1: khung đã đan của SKU huỷ - lệnh ở kho thành phẩm KHÁC cũng tự lấy được, nhưng phải chuyển giữa 2 xưởng.
// Dòng lấy khác kho ở trạng thái "đang chuyển": kho nguồn đã trừ, lệnh nhận không phải xuất đan phần đó; thủ kho thành phẩm nơi nhận
// nhận khung + phiếu chuyển đã ký thì bấm "Đã nhận" (kèm ảnh phiếu) - lúc đó Chuyền kiểm mới đếm. Không có dòng chờ thì không hiện gì.
import { useRef, useState } from 'react'
import { Paperclip, Truck } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { uploadDocument } from '../../../services/uploads-api'
import {
  confirmWovenReceived,
  getWovenInTransit,
  type WovenInTransit,
} from '../../../services/order-cancellations-api'
import LenhCode from '../../../components/LenhCode'
import { compactTh as th, compactTd as td, tableWrap } from '../../../styles/table'
import { errMsg } from '../../../utils/errors'

const btn: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, fontSize: 12.5, cursor: 'pointer' }

export default function KhungDanDangChuyen() {
  const { data, refetch } = useFetch(() => getWovenInTransit(), [])
  useRealtimeRefetch(['production-orders'], refetch)
  const [files, setFiles] = useState<Record<string, File[]>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<{ id: string; msg: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const uploaded = useRef(new WeakMap<File, string>())

  const rows = data ?? []
  if (rows.length === 0 && !notice) return null

  const receive = async (r: WovenInTransit) => {
    const mine = files[r.id] ?? []
    if (mine.length === 0) {
      setError({ id: r.id, msg: 'Cần ảnh phiếu chuyển đã ký' })
      return
    }
    setBusyId(r.id)
    setError(null)
    try {
      const urls: string[] = []
      for (const f of mine) {
        let u = uploaded.current.get(f)
        if (!u) {
          u = await uploadDocument(f)
          uploaded.current.set(f, u)
        }
        urls.push(u)
      }
      await confirmWovenReceived(r.id, urls)
      setNotice(`Đã nhận ${r.qty} khung ${r.pieceCode} cho SKU ${r.targetFactoryCode}. Chuyền kiểm đếm được số khung này.`)
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
        <Truck size={18} />
        <strong>Khung đan chuyển từ kho khác - chờ nhận ({rows.length})</strong>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--text2)' }}>
        Khung đã đan của SKU bị huỷ ở kho thành phẩm xưởng khác được cấp cho lệnh của kho này. Nhận đủ khung và phiếu chuyển đã ký thì tải
        ảnh phiếu rồi bấm Đã nhận - lúc đó Chuyền kiểm mới đếm số khung này.
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
                <th style={th}>Mảnh</th>
                <th style={{ ...th, textAlign: 'right' }}>Số khung</th>
                <th style={th}>Từ kho</th>
                <th style={th}>Về kho</th>
                <th style={th}>Cho lệnh</th>
                <th style={th}>Của SKU đã huỷ</th>
                <th style={th}>Ảnh phiếu ký</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.pieceCode} <span style={{ color: 'var(--text3)' }}>{r.pieceName}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.qty}</td>
                  <td style={td}>{r.fromWarehouseName}</td>
                  <td style={td}>{r.toWarehouseName}</td>
                  <td style={td}><LenhCode piCode={r.targetLenhCode} /> · {r.targetFactoryCode}</td>
                  <td style={td}><LenhCode piCode={r.sourceLenhCode} /> · {r.sourceFactoryCode}</td>
                  <td style={td}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 12 }}>
                      <Paperclip size={14} />
                      {(files[r.id]?.length ?? 0) > 0 ? `${files[r.id]!.length} ảnh` : 'Chọn ảnh'}
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        style={{ display: 'none' }}
                        onChange={e => {
                          const list = Array.from(e.target.files ?? [])
                          setFiles(f => ({ ...f, [r.id]: list }))
                        }}
                      />
                    </label>
                  </td>
                  <td style={td}>
                    <button
                      disabled={busyId === r.id}
                      onClick={() => void receive(r)}
                      style={{ ...btn, border: 'none', background: 'var(--accent, #1565c0)', color: '#fff', fontWeight: 600, opacity: busyId === r.id ? 0.6 : 1 }}
                    >
                      {busyId === r.id ? 'Đang lưu...' : 'Đã nhận'}
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
