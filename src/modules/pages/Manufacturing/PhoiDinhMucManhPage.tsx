'use client'

/**
 * Màn DANH SÁCH ĐỊNH MỨC MẢNH — dùng cho Phôi / Hàn / Sơn (theo công đoạn), xem MfgApp.tsx.
 *  - Phôi / Hàn: định mức theo SẮT (loại sắt, quy cách, chiều dài cắt, đơn vị cây) — đọc từ
 *    Sku.manhData.pieces (tái dựng thật từ PieceBom+SegmentSpec mỗi lần GET /skus, xem
 *    skus.service.ts#reconstructQuotaBatch).
 *  - Sơn: định mức theo SƠN (loại sơn, mã sơn, đơn vị lít) — đọc từ
 *    Sku.quotaManagement.materialType.daySon qua combinedDaySon() (utils/manhMaterials.ts), tính
 *    theo SKU. Khác mock cũ: dữ liệu thật không gắn sơn với 1 "mảnh" cụ thể (định mức sơn không
 *    theo từng mảnh) nên tab Sơn không có cột "Tên mảnh".
 */

import { useMemo, useState } from 'react'
import { Layers, Search } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { Sku } from '../../../types/sku'
import { combinedDaySon } from '../../../utils/manhMaterials'
import LoadingState from '../../../components/LoadingState'

const ACCENT = '#e65100'

export type DinhMucStage = 'PHOI' | 'HAN' | 'SON'

interface SteelRow {
  id: string
  tenManh: string
  sku: string
  sanPham: string
  loaiSat: string
  spec: string
  cutLengthMm: number
  unit: string
}

interface PaintRow {
  id: string
  sku: string
  sanPham: string
  sonName: string
  sonCode: string
  sonUnit: string
}

function buildSteelRows(skus: Sku[]): SteelRow[] {
  const rows: SteelRow[] = []
  for (const pf of skus) {
    const sku = pf.mfgProduct?.factoryCode ?? '—'
    const sanPham = pf.mfgProduct?.name ?? '—'
    for (const piece of pf.manhData?.pieces ?? []) {
      for (const child of piece.children.filter(c => c.group === 'sat')) {
        rows.push({
          id: `${pf.id}-${piece.id}-${child.id}`,
          tenManh: piece.name,
          sku, sanPham,
          loaiSat: child.name,
          spec: child.specs ?? '—',
          cutLengthMm: child.length ? Number(child.length) || 0 : 0,
          unit: child.unit ?? 'cây',
        })
      }
    }
  }
  return rows
}

function buildPaintRows(skus: Sku[]): PaintRow[] {
  const rows: PaintRow[] = []
  for (const pf of skus) {
    const sku = pf.mfgProduct?.factoryCode ?? '—'
    const sanPham = pf.mfgProduct?.name ?? '—'
    combinedDaySon(pf).forEach((item, i) => {
      rows.push({
        id: `${pf.id}-son-${i}`,
        sku, sanPham,
        sonName: item.name,
        sonCode: item.materialId ?? '—',
        sonUnit: item.unit ?? 'lít',
      })
    })
  }
  return rows
}

export default function PhoiDinhMucManhPage({ stage = 'PHOI' }: { stage?: DinhMucStage }) {
  const isSon = stage === 'SON'
  const [q, setQ] = useState('')
  const [sku, setSku] = useState('ALL')

  const { data: skusData, isLoading } = useFetch(() => api.getSkus(), [])
  const skus = ((skusData ?? []) as Sku[]).filter(pf => pf.status !== 'DRAFT')

  const steelRows = useMemo(() => buildSteelRows(skus), [skus])
  const paintRows = useMemo(() => buildPaintRows(skus), [skus])

  const skuOptions = useMemo(
    () => ['ALL', ...Array.from(new Set((isSon ? paintRows : steelRows).map(r => r.sku)))],
    [isSon, steelRows, paintRows],
  )

  const steelFiltered = useMemo(() => steelRows.filter(d => {
    if (sku !== 'ALL' && d.sku !== sku) return false
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return `${d.sku} ${d.tenManh} ${d.loaiSat}`.toLowerCase().includes(s)
  }), [steelRows, q, sku])

  const paintFiltered = useMemo(() => paintRows.filter(d => {
    if (sku !== 'ALL' && d.sku !== sku) return false
    if (!q.trim()) return true
    const s = q.toLowerCase()
    return `${d.sku} ${d.sonName} ${d.sonCode}`.toLowerCase().includes(s)
  }), [paintRows, q, sku])

  const rows = isSon ? paintFiltered : steelFiltered

  const subtitle = isSon
    ? 'Định mức sơn theo từng SKU: loại sơn, mã sơn, đơn vị'
    : 'Định mức cắt theo từng mảnh: loại sắt, quy cách, chiều dài cắt, đơn vị'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 34, height: 34, borderRadius: 'var(--radius)', background: '#fff3e0', color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Layers size={18} />
        </div>
        <div>
          <h2 style={{ fontSize: 19, fontWeight: 800 }}>Danh sách định mức mảnh</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input placeholder={isSon ? 'Tìm SKU, loại sơn…' : 'Tìm SKU, tên mảnh, loại sắt…'} value={q} onChange={e => setQ(e.target.value)} style={{ padding: '7px 10px 7px 32px' }} />
        </div>
        <select value={sku} onChange={e => setSku(e.target.value)} style={{ width: 200 }}>
          {skuOptions.map(s => <option key={s} value={s}>{s === 'ALL' ? '— Tất cả SKU —' : s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} dòng</span>
      </div>

      {isLoading ? <LoadingState /> : (
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={tbl}>
          {isSon ? (
            <>
              <thead><tr style={trh}>
                <th style={th}>SKU</th><th style={th}>Sản phẩm</th><th style={th}>Loại sơn</th><th style={th}>Mã sơn</th><th style={th}>ĐVT</th>
              </tr></thead>
              <tbody>
                {paintFiltered.map(d => (
                  <tr key={d.id} style={trb}>
                    <td style={{ ...td, fontWeight: 700 }}>{d.sku}</td>
                    <td style={td}>{d.sanPham}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{d.sonName}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{d.sonCode}</td>
                    <td style={td}>{d.sonUnit}</td>
                  </tr>
                ))}
                {paintFiltered.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Không tìm thấy dữ liệu phù hợp.</td></tr>
                )}
              </tbody>
            </>
          ) : (
            <>
              <thead><tr style={trh}>
                <th style={th}>SKU</th><th style={th}>Tên mảnh</th><th style={th}>Loại sắt</th><th style={th}>Quy cách</th><th style={th}>Chiều dài cắt (mm)</th><th style={th}>ĐVT</th>
              </tr></thead>
              <tbody>
                {steelFiltered.map(d => (
                  <tr key={d.id} style={trb}>
                    <td style={{ ...td, fontWeight: 700 }}>{d.sku}</td>
                    <td style={td}>{d.tenManh}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{d.loaiSat}</td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{d.spec}</td>
                    <td style={td}>{fmt(d.cutLengthMm)}</td>
                    <td style={td}>{d.unit}</td>
                  </tr>
                ))}
                {steelFiltered.length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Không tìm thấy mảnh phù hợp.</td></tr>
                )}
              </tbody>
            </>
          )}
        </table>
      </div>
      )}
    </div>
  )
}

const fmt = (n: number) => n.toLocaleString('vi-VN')
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' }
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)' }
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
