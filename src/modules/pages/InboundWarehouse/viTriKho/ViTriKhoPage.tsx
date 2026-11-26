'use client'

/**
 * Tab "Vị trí kho" của thủ kho Thành phẩm (25/11/2026, docs THIET-KE-VI-TRI-KHO-LOAD-CONT, V1-V4, V9) - chỉ khi BE bật VI_TRI_KHO_ENABLED:
 *  - Tồn kho thùng: mỗi lệnh · SKU · PO + dòng tổng, CHỈ phần còn lại (không có cột đã xuất), kèm "còn phải đóng" và ô đang giữ;
 *    hàng đã đóng gói chưa có ô (đóng trước khi bật / nhập tay) thì cất vào ô ngay ở đây.
 *  - Theo ô: ô nào đang chứa gì (1 ô chứa được nhiều lệnh / SKU / PO).
 *  - Chuyển ô: quét ô đi -> chọn hàng -> số -> quét ô đến; có lịch sử.
 *  - Khai ô & in tem: khai 1 ô hoặc hàng loạt (khu A, dãy 01-03, ô 01-10), tắt ô trống, in tem QR.
 * Số lượng tính theo BỘ (cùng đơn vị đóng gói / booking).
 */
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Printer } from 'lucide-react'
import { useFetch } from '../../../../hooks/useFetch'
import { useRetrySafeKey } from '../../../../hooks/useRetrySafeKey'
import {
  bulkCreateLocations, createLocation, getFgStock, getLocations, getMovements, lookupLocation, moveStock, putawayStock,
  setLocationActive, type VtkLocation, type VtkScannedLocation, type VtkStockRow,
} from '../../../../services/vi-tri-kho-api'
import LoadingState from '../../../../components/LoadingState'
import LoadErrorState from '../../../../components/LoadErrorState'
import { pageSubtitle, pageTitle } from '../../../../styles/typography'
import { errMsg } from '../../../../utils/errors'
import { printLocationTems } from '../../Floor/qrPrint'
import {
  bulkLocationCodes, matchesStock, moveCheck, normalizeZone, stockTotal, toQty, tripleText,
} from './viTriKhoModel'
import { box, btn, inputStyle, note, numStyle, panel, ScanInput, sub, tabBtn, td, tdR, th, thR } from './vtkUi'

type Sub = 'ton' | 'o' | 'chuyen' | 'khai' | 'lich-su'
const SUBS: [Sub, string][] = [['ton', 'Tồn kho thùng'], ['o', 'Theo ô'], ['chuyen', 'Chuyển ô'], ['khai', 'Khai ô & in tem'], ['lich-su', 'Lịch sử']]
type Flash = { tone: 'ok' | 'err' | 'warn'; text: string } | null
const when = (iso: string) => format(new Date(iso), 'dd/MM HH:mm')

export default function ViTriKhoPage() {
  const [tab, setTab] = useState<Sub>('ton')
  return (
    <div>
      <h2 style={{ ...pageTitle, margin: 0 }}>Vị trí kho</h2>
      <p style={{ ...pageSubtitle, marginBottom: 'var(--space-4)' }}>
        Thùng thành phẩm theo ô (khu - dãy - ô), luôn ghi đủ lệnh · SKU · PO. Công nhân đóng gói quét tem ô khi cất; xuất booking lấy hàng theo ô.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {SUBS.map(([k, label]) => <button key={k} type="button" style={tabBtn(tab === k)} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {tab === 'ton' && <StockTab />}
      {tab === 'o' && <LocationsTab />}
      {tab === 'chuyen' && <MoveTab />}
      {tab === 'khai' && <SetupTab />}
      {tab === 'lich-su' && <HistoryTab />}
    </div>
  )
}

// ─── Tồn kho thùng ──────────────────────────────────────────────────────────────────────────

function StockTab() {
  const { data, isLoading, error, refetch } = useFetch(getFgStock, [])
  const [q, setQ] = useState('')
  const [placing, setPlacing] = useState<VtkStockRow | null>(null)
  if (isLoading) return <LoadingState />
  if (error) return <LoadErrorState error={error} onRetry={refetch} />
  if (!data?.enabled) return null
  const rows = data.rows.filter((r) => matchesStock(r, q))
  const t = stockTotal(rows)
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm lệnh, SKU, PO, ô…" style={{ ...inputStyle, minWidth: 220 }} aria-label="Tìm tồn thùng" />
        <span style={sub}>{data.warehouse.name} · chỉ hiện phần còn lại (hàng đã xuất không hiện)</span>
      </div>
      {placing && <PutawayBox row={placing} onClose={() => setPlacing(null)} onDone={() => { setPlacing(null); void refetch() }} />}
      <div style={box}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--surface2)' }}>
            <th style={th}>Lệnh</th><th style={th}>SKU</th><th style={th}>PO</th>
            <th style={thR}>Ở ô</th><th style={thR} title="Đã lấy vào cont của booking chưa xuất">Đang load cont</th>
            <th style={thR} title="Đã đóng gói nhưng chưa cất vào ô">Chưa cất ô</th><th style={thR}>Còn phải đóng</th>
            <th style={th}>Đang nằm ở</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.itemId} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, fontFamily: 'monospace' }}>{r.lenhCode}</td>
                <td style={td}><b>{r.sku}</b><div style={sub}>{r.productName}</div></td>
                <td style={td}>{r.poCode ?? '—'}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{r.inStockQty}</td>
                <td style={tdR}>{r.loadingQty || ''}</td>
                <td style={{ ...tdR, color: r.unplacedQty > 0 ? 'var(--fg-b45309)' : undefined }}>{r.unplacedQty || ''}</td>
                <td style={tdR}>{r.toPackQty || ''}</td>
                <td style={td}>{r.locations.map((l) => `${l.code} (${l.qty})`).join(', ') || '—'}</td>
                <td style={td}>
                  {r.unplacedQty > 0 && <button type="button" style={btn(false)} onClick={() => setPlacing(r)}>Cất vào ô</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>Không có hàng nào còn trong kho</td></tr>}
            {rows.length > 0 && (
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)', fontWeight: 700 }}>
                <td style={td} colSpan={3}>Tổng ({rows.length} dòng)</td>
                <td style={tdR}>{t.inStockQty}</td><td style={tdR}>{t.loadingQty}</td><td style={tdR}>{t.unplacedQty}</td><td style={tdR}>{t.toPackQty}</td>
                <td style={td} colSpan={2}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Cất hàng đã đóng gói chưa có ô (đóng trước khi bật / nhập tay): quét ô + số. */
function PutawayBox({ row, onClose, onDone }: { row: VtkStockRow; onClose: () => void; onDone: () => void }) {
  const [loc, setLoc] = useState<{ token: string; code: string } | null>(null)
  const [qty, setQty] = useState(String(row.unplacedQty))
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)
  const retryKey = useRetrySafeKey()
  const n = toQty(qty)
  const scan = async (token: string) => {
    try {
      const r = await lookupLocation(token)
      if (r.enabled) setLoc({ token, code: r.location.code })
    } catch (e) { setFlash({ tone: 'err', text: errMsg(e) }) }
  }
  const save = async () => {
    if (!loc) return
    setBusy(true); setFlash(null)
    const body = { locationToken: loc.token, itemId: row.itemId, qty: n }
    try {
      const r = await putawayStock(body, retryKey.take(body))
      retryKey.settle()
      if (r.mixWarning) alert(r.mixWarning)
      onDone()
    } catch (e) { retryKey.settle(e); setFlash({ tone: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  const okToSave = !!loc && n > 0 && n <= row.unplacedQty && !busy
  return (
    <div style={{ ...panel, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <b>Cất vào ô: {tripleText(row)} · chưa cất {row.unplacedQty} bộ</b>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <ScanInput label="Quét ô" onToken={(t) => void scan(t)} />
        <span>{loc ? <>Ô <b>{loc.code}</b></> : 'Chưa quét ô'}</span>
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" aria-label="Số bộ cất" style={numStyle} />
        <button type="button" disabled={!okToSave} onClick={() => void save()} style={btn(true, !okToSave)}>{busy ? 'Đang lưu…' : 'Cất'}</button>
        <button type="button" onClick={onClose} style={btn(false)}>Đóng</button>
      </div>
      {flash && <div style={note(flash.tone)}>{flash.text}</div>}
    </div>
  )
}

// ─── Theo ô ─────────────────────────────────────────────────────────────────────────────────

function LocationsTab() {
  const { data, isLoading, error, refetch } = useFetch(getLocations, [])
  const [onlyFull, setOnlyFull] = useState(true)
  const [q, setQ] = useState('')
  if (isLoading) return <LoadingState />
  if (error) return <LoadErrorState error={error} onRetry={refetch} />
  if (!data?.enabled) return null
  const s = q.trim().toLowerCase()
  const rows = data.locations.filter((l) => (!onlyFull || l.totalQty > 0) &&
    (!s || l.code.toLowerCase().includes(s) || l.lines.some((x) => tripleText(x).toLowerCase().includes(s))))
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm ô, lệnh, SKU, PO…" style={{ ...inputStyle, minWidth: 220 }} aria-label="Tìm ô" />
        <label style={{ fontSize: 13 }}><input type="checkbox" checked={onlyFull} onChange={(e) => setOnlyFull(e.target.checked)} /> Chỉ ô có hàng</label>
        <span style={sub}>{data.locations.filter((l) => l.totalQty > 0).length}/{data.locations.length} ô đang có hàng</span>
      </div>
      <div style={box}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--surface2)' }}>
            <th style={th}>Ô</th><th style={thR}>Tổng bộ</th><th style={th}>Đang chứa (lệnh · SKU · PO)</th>
          </tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} style={{ borderTop: '1px solid var(--border)', opacity: l.isActive ? 1 : 0.5 }}>
                <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{l.code}{!l.isActive && <div style={sub}>đang tắt</div>}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{l.totalQty}</td>
                <td style={td}>
                  {l.lines.length === 0 ? <span style={sub}>Trống</span> : l.lines.map((x) => (
                    <div key={x.itemId}>{tripleText(x)}: <b>{x.qty}</b></div>
                  ))}
                  {l.lines.length > 1 && <div style={{ ...sub, color: 'var(--fg-b45309)' }}>Ô có {l.lines.length} loại - xếp riêng, dán nhãn rõ</div>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>Không có ô nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Chuyển ô ───────────────────────────────────────────────────────────────────────────────

function MoveTab() {
  const [from, setFrom] = useState<{ token: string; loc: VtkScannedLocation } | null>(null)
  const [to, setTo] = useState<{ token: string; loc: VtkScannedLocation } | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)
  const retryKey = useRetrySafeKey()
  const { data: hist, refetch } = useFetch(() => getMovements(), [])
  const line = from?.loc.lines.find((l) => l.itemId === itemId) ?? null
  const n = toQty(qty)
  const check = moveCheck({ fromCode: from?.loc.code ?? null, toCode: to?.loc.code ?? null, itemId, qty: n, available: line?.qty ?? 0, busy })
  const look = async (token: string, set: (v: { token: string; loc: VtkScannedLocation }) => void) => {
    setFlash(null)
    try {
      const r = await lookupLocation(token)
      if (r.enabled) set({ token, loc: r.location })
    } catch (e) { setFlash({ tone: 'err', text: errMsg(e) }) }
  }
  const save = async () => {
    if (!check.ok || !from || !to || !itemId) return
    setBusy(true); setFlash(null)
    const body = { fromToken: from.token, toToken: to.token, itemId, qty: n }
    try {
      const r = await moveStock(body, retryKey.take(body))
      retryKey.settle()
      setFlash(r.mixWarning
        ? { tone: 'warn', text: `Đã chuyển ${n} bộ ${from.loc.code} → ${to.loc.code}. ${r.mixWarning}` }
        : { tone: 'ok', text: `Đã chuyển ${n} bộ ${from.loc.code} → ${to.loc.code}` })
      setFrom(null); setTo(null); setItemId(null); setQty('')
      void refetch()
    } catch (e) { retryKey.settle(e); setFlash({ tone: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  const moves = hist?.enabled ? hist.movements.filter((m) => m.kind === 'MOVE').slice(0, 30) : []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ width: 70 }}>1. Ô đi</b>
          <ScanInput label="Quét ô đi" onToken={(t) => void look(t, (v) => { setFrom(v); setItemId(v.loc.lines.length === 1 ? v.loc.lines[0].itemId : null) })} />
          {from && <span>Ô <b>{from.loc.code}</b> · {from.loc.totalQty} bộ</span>}
        </div>
        {from && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 78 }}>
            {from.loc.lines.length === 0 && <span style={sub}>Ô trống</span>}
            {from.loc.lines.map((l) => (
              <button key={l.itemId} type="button" onClick={() => setItemId(l.itemId)} style={tabBtn(itemId === l.itemId)}>
                {tripleText(l)}: {l.qty} bộ
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ width: 70 }}>2. Số bộ</b>
          <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" aria-label="Số bộ chuyển" style={numStyle} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ width: 70 }}>3. Ô đến</b>
          <ScanInput label="Quét ô đến" onToken={(t) => void look(t, setTo)} />
          {to && <span>Ô <b>{to.loc.code}</b>{to.loc.lines.length > 0 ? ` · đang có ${to.loc.lines.map(tripleText).join('; ')}` : ' · trống'}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" disabled={!check.ok} onClick={() => void save()} style={btn(true, !check.ok)}>{busy ? 'Đang chuyển…' : 'Chuyển'}</button>
          {check.reason && <span style={sub}>{check.reason}</span>}
        </div>
        {flash && <div style={note(flash.tone)}>{flash.text}</div>}
      </div>
      <MovementTable rows={moves} empty="Chưa có lần chuyển ô nào" />
    </div>
  )
}

// ─── Khai ô & in tem ────────────────────────────────────────────────────────────────────────

function SetupTab() {
  const { data, isLoading, error, refetch } = useFetch(getLocations, [])
  const [zone, setZone] = useState('A')
  const [r, setR] = useState({ aisleFrom: '1', aisleTo: '1', slotFrom: '1', slotTo: '10' })
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<Flash>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const preview = useMemo(() => bulkLocationCodes({
    zone, aisleFrom: Number(r.aisleFrom), aisleTo: Number(r.aisleTo), slotFrom: Number(r.slotFrom), slotTo: Number(r.slotTo),
  }), [zone, r])
  if (isLoading) return <LoadingState />
  if (error) return <LoadErrorState error={error} onRetry={refetch} />
  if (!data?.enabled) return null
  const locs = data.locations
  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setFlash(null)
    try { setFlash({ tone: 'ok', text: await fn() }); void refetch() } catch (e) { setFlash({ tone: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }
  const createBulk = () => run(async () => {
    const res = await bulkCreateLocations({
      zone, aisleFrom: Number(r.aisleFrom), aisleTo: Number(r.aisleTo), slotFrom: Number(r.slotFrom), slotTo: Number(r.slotTo),
    })
    setPicked(new Set(res.created.map((c) => c.id)))
    return `Đã khai ${res.created.length} ô${res.skipped.length ? ` (bỏ qua ${res.skipped.length} ô đã có)` : ''} - các ô mới đã được chọn sẵn để in tem`
  })
  const createOne = () => run(async () => {
    const c = await createLocation({ zone, aisle: Number(r.aisleFrom), slot: Number(r.slotFrom) })
    setPicked(new Set([c.id]))
    return `Đã khai ô ${c.code}`
  })
  const toggle = (l: VtkLocation) => run(async () => {
    const x = await setLocationActive(l.id, !l.isActive)
    return `Ô ${x.code} ${x.isActive ? 'đã bật' : 'đã tắt'}`
  })
  const print = (list: VtkLocation[]) => printLocationTems(list.map((l) => ({ code: l.code, qrToken: l.qrToken, warehouseName: data.warehouse.name })))
    .catch((e) => setFlash({ tone: 'err', text: errMsg(e) }))
  const numIn = (k: keyof typeof r, aria: string) => (
    <input value={r[k]} aria-label={aria} inputMode="numeric" onChange={(e) => setR((p) => ({ ...p, [k]: e.target.value.replace(/\D/g, '').slice(0, 2) }))} style={{ ...numStyle, width: 56 }} />
  )
  const chosen = locs.filter((l) => picked.has(l.id))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Khu</span>
          <input value={zone} aria-label="Khu" onChange={(e) => setZone(e.target.value.toUpperCase().slice(0, 4))} style={{ ...inputStyle, width: 64 }} />
          <span>Dãy</span>{numIn('aisleFrom', 'Dãy từ')}<span>đến</span>{numIn('aisleTo', 'Dãy đến')}
          <span>Ô</span>{numIn('slotFrom', 'Ô từ')}<span>đến</span>{numIn('slotTo', 'Ô đến')}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" disabled={busy || typeof preview === 'string'} onClick={() => void createBulk()} style={btn(true, busy || typeof preview === 'string')}>
            Khai {typeof preview === 'string' ? '' : `${preview.length} ô`}
          </button>
          <button type="button" disabled={busy || !normalizeZone(zone)} onClick={() => void createOne()} style={btn(false, busy || !normalizeZone(zone))}>
            Chỉ khai 1 ô (dãy “từ”, ô “từ”)
          </button>
          <span style={sub}>{typeof preview === 'string' ? preview : `${preview[0]} … ${preview[preview.length - 1]}`}</span>
        </div>
        {flash && <div style={note(flash.tone)}>{flash.text}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={chosen.length === 0} onClick={() => void print(chosen)} style={btn(true, chosen.length === 0)}>
          <Printer size={14} /> In tem {chosen.length > 0 ? `${chosen.length} ô đã chọn` : ''}
        </button>
        <button type="button" onClick={() => setPicked(new Set(locs.filter((l) => l.isActive).map((l) => l.id)))} style={btn(false)}>Chọn tất cả ô đang dùng</button>
        <button type="button" onClick={() => setPicked(new Set())} style={btn(false)}>Bỏ chọn</button>
      </div>
      <div style={box}>
        <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--surface2)' }}>
            <th style={th}></th><th style={th}>Ô</th><th style={thR}>Tổng bộ</th><th style={th}>Trạng thái</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {locs.map((l) => (
              <tr key={l.id} style={{ borderTop: '1px solid var(--border)', opacity: l.isActive ? 1 : 0.55 }}>
                <td style={td}><input type="checkbox" aria-label={`Chọn ô ${l.code}`} checked={picked.has(l.id)}
                  onChange={(e) => setPicked((p) => { const s = new Set(p); if (e.target.checked) s.add(l.id); else s.delete(l.id); return s })} /></td>
                <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{l.code}</td>
                <td style={tdR}>{l.totalQty}</td>
                <td style={td}>{l.isActive ? 'Đang dùng' : 'Đã tắt'}</td>
                <td style={td}>
                  <button type="button" disabled={busy || (l.isActive && l.totalQty > 0)} onClick={() => void toggle(l)}
                    title={l.isActive && l.totalQty > 0 ? 'Ô còn hàng - chuyển hết đi rồi mới tắt' : undefined}
                    style={btn(false, busy || (l.isActive && l.totalQty > 0))}>{l.isActive ? 'Tắt ô' : 'Bật lại'}</button>
                </td>
              </tr>
            ))}
            {locs.length === 0 && <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>Chưa khai ô nào</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Lịch sử ────────────────────────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data, isLoading, error, refetch } = useFetch(() => getMovements(), [])
  if (isLoading) return <LoadingState />
  if (error) return <LoadErrorState error={error} onRetry={refetch} />
  if (!data?.enabled) return null
  return <MovementTable rows={data.movements} empty="Chưa có dịch chuyển nào" />
}

function MovementTable({ rows, empty }: { rows: Extract<Awaited<ReturnType<typeof getMovements>>, { enabled: true }>['movements']; empty: string }) {
  return (
    <div style={box}>
      <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: 'var(--surface2)' }}>
          <th style={th}>Giờ</th><th style={th}>Loại</th><th style={th}>Lệnh · SKU · PO</th><th style={thR}>Số bộ</th>
          <th style={th}>Từ ô</th><th style={th}>Đến</th><th style={th}>Người làm</th>
        </tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>{when(m.createdAt)}</td>
              <td style={td}>{m.kindLabel}{m.note && <div style={sub}>{m.note}</div>}</td>
              <td style={td}>{tripleText(m)}</td>
              <td style={{ ...tdR, fontWeight: 700 }}>{m.qty}</td>
              <td style={td}>{m.fromCode ?? '—'}</td>
              <td style={td}>{m.toCode ?? (m.bookingNo ? `Booking ${m.bookingNo}${m.containerNo ? ` · cont ${m.containerNo}` : ''}` : '—')}</td>
              <td style={td}>{m.actorName ?? '—'}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)' }}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
