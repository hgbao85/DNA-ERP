'use client'

/**
 * Cấp 3 (chi tiết mảnh của 1 SKU) — dùng chung cho "Theo dõi xuất đan" (khovttp@demo.com, phần
 * "Chi tiết theo điểm đan"), "Theo dõi nhập đan" (khotp@demo.com) và công đoạn "Đan" bên KHSX
 * (ThongKePagePlan.tsx). 3 ô tổng quan (Tổng/Đã hoàn thành/Còn lại) + bảng theo từng (mảnh, điểm đan).
 *
 * variant='view'  → chỉ xem, cột cuối là thanh tiến độ nhận (dùng cho trang xuất đan + KHSX).
 * variant='nhap'  → có ô nhập số lượng + nút xác nhận nhận hàng (dùng cho trang nhập đan).
 */

import { useState } from 'react'
import ProgressBar from '../../../components/ProgressBar'
import { listTh as thStyle, listTd as tdStyle, emptyBox } from '../../../styles/table'
import type { ManhLine } from '../../../types/manh'

function Tile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--text)' }}>{value.toLocaleString('vi-VN')}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

/**
 * 3 ô tổng quan (Tổng/Đã hoàn thành/Còn lại) — tách riêng để đặt ở đầu trang, tách khỏi bảng chi
 * tiết bên dưới. "Tổng" là số lượng SKU (thành phẩm) đặt hàng, KHÔNG phải số lượng mảnh (1 SKU cấu
 * tạo từ nhiều loại mảnh, mỗi loại x số lượng riêng — cộng dồn totalQty các mảnh không ra số SKU).
 * "Đã hoàn thành"/"Còn lại" suy ra từ tỉ lệ mảnh đã nhận về trên tổng số mảnh cần, áp vào số lượng SKU.
 */
export function ManhSkuTiles({ lines, skuQty }: { lines: ManhLine[]; skuQty: number }) {
  const totalPieces    = lines.reduce((s, l) => s + l.totalQty, 0)
  const receivedPieces = lines.reduce((s, l) => s + l.allocations.reduce((a, x) => a + x.nhapQty, 0), 0)
  const hoanThanh = totalPieces > 0 ? Math.round(skuQty * receivedPieces / totalPieces) : 0
  const conLai    = Math.max(0, skuQty - hoanThanh)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
      <Tile label="Tổng" value={skuQty} />
      <Tile label="Đã hoàn thành" value={hoanThanh} color="#16a34a" />
      <Tile label="Còn lại" value={conLai} color="#d97706" />
    </div>
  )
}

export default function ManhSkuDetail({
  lines, skuQty, pointLabel, variant, onNhap, busyAllocId, msgFor, hideTiles,
}: {
  lines: ManhLine[]
  /** Số lượng SKU đặt hàng — dùng cho ô "Tổng" của `ManhSkuTiles`. Bỏ qua khi `hideTiles`. */
  skuQty?: number
  pointLabel: (id: number) => string
  variant: 'view' | 'nhap'
  /** variant='nhap': xác nhận đã nhận `qty` mảnh của dòng `lineId` từ điểm đan `weavingPointId` (ứng với allocation `allocId`). */
  onNhap?: (lineId: number, weavingPointId: number, allocId: number, qty: number) => void
  busyAllocId?: number | null
  msgFor?: (allocId: number) => string | undefined
  /** Bỏ 3 ô tổng quan khi trang đã tự hiện `ManhSkuTiles` riêng ở vị trí khác (vd đầu trang). */
  hideTiles?: boolean
}) {
  const [qty, setQty] = useState<Record<number, string>>({})

  const rows = lines.flatMap(l => l.allocations.filter(a => a.xuatQty > 0).map(a => ({ line: l, alloc: a })))

  const submit = (lineId: number, weavingPointId: number, allocId: number, max: number) => {
    const q = Number(qty[allocId])
    if (!q || q <= 0 || q > max) return
    onNhap?.(lineId, weavingPointId, allocId, q)
    setQty(p => ({ ...p, [allocId]: '' }))
  }

  return (
    <div>
      {!hideTiles && <ManhSkuTiles lines={lines} skuQty={skuQty ?? 0} />}

      {rows.length === 0 ? (
        <div style={emptyBox}>Chưa xuất đan cho điểm đan nào</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col /><col /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 80 }} /><col style={{ width: variant === 'nhap' ? 190 : 150 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>Tên mảnh</th>
                <th style={thStyle}>Điểm đan</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL tổng</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã nhập</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Còn lại</th>
                <th style={thStyle}>{variant === 'nhap' ? 'Nhập' : 'Tiến độ nhận'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ line, alloc }) => {
                const remaining = alloc.xuatQty - alloc.nhapQty
                const done = remaining <= 0
                return (
                  <tr key={alloc.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{line.name}</td>
                    <td style={tdStyle}>{pointLabel(alloc.weavingPointId)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{line.totalQty}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#d97706' }}>{alloc.xuatQty}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: alloc.nhapQty > 0 ? '#16a34a' : 'var(--text3)' }}>{alloc.nhapQty}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: done ? 'var(--text3)' : '#d97706' }}>{remaining}</td>
                    <td style={tdStyle}>
                      {variant === 'view' ? (
                        <ProgressBar value={alloc.nhapQty} max={alloc.xuatQty} />
                      ) : done ? (
                        <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Đã nhận đủ</span>
                      ) : (
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input
                              type="number" min={1} max={remaining}
                              value={qty[alloc.id] ?? ''}
                              onChange={e => setQty(p => ({ ...p, [alloc.id]: e.target.value }))}
                              placeholder="SL"
                              style={{ width: 64, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                            />
                            <button
                              onClick={() => submit(line.id, alloc.weavingPointId, alloc.id, remaining)}
                              disabled={busyAllocId === alloc.id}
                              style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 6, background: '#166534', color: '#fff', cursor: busyAllocId === alloc.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                            >
                              {busyAllocId === alloc.id ? 'Đang lưu...' : 'Nhập'}
                            </button>
                          </div>
                          {msgFor?.(alloc.id) && <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{msgFor(alloc.id)}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
