'use client';

/**
 * DEMO — Quy trình chuẩn Giữ chỗ → Mua hàng → Nhập kho → Sản xuất (đa vật tư, theo BOM)
 * Hiện thực hoá docs/thiet-ke-giu-cho-khau-tru-ton-kho.md (mở rộng đủ vòng đời).
 * Hoàn toàn FE/mock — không gọi backend. Logic nằm trọn trong state của trang này.
 *
 * Luồng 5 bước:
 *  1) Tạo lệnh SX  → giữ chỗ min(cần, available) từ kho; phần thiếu sinh ĐỀ XUẤT MUA
 *  2) Đề xuất mua  → gom theo mã vật tư (đích danh nhiều lệnh)
 *  3) Đơn mua (PO) → chọn NCC + giá → đặt hàng (chờ về)
 *  4) Nhập kho     → hàng có chủ về: onHand➕ reserved➕ onOrder➖
 *  5) Sản xuất     → khi đủ mọi vật tư: xuất kho onHand➖ reserved➖
 */

import { useMemo, useState } from 'react';
import {
  Boxes, PackagePlus, Truck, Factory, RotateCcw, Sparkles, Trash2,
  ShoppingCart, ClipboardList, CheckCircle2,
} from 'lucide-react';

type Group = 'SAT' | 'PHU_KIEN' | 'DAY' | 'BAO_BI';
type UnitType = 'DISCRETE' | 'CONTINUOUS';
type Source = 'TU_KHO' | 'MUA_VE';
type ResStatus = 'DANG_GIU' | 'CHO_VE' | 'DA_XUAT';
type ReqStatus = 'OPEN' | 'ORDERED' | 'RECEIVED';
type PoStatus = 'ORDERED' | 'RECEIVED';

interface Material {
  id: number; name: string; spec: string; group: Group;
  unit: string; unitType: UnitType;
  onHand: number; reserved: number; onOrder: number;
}
interface BomLine { materialId: number; qtyPer: number; wastePct: number }
interface Product { id: string; name: string; bom: BomLine[] }
interface Order { id: number; code: string; productId: string; qty: number }
interface Reservation { id: number; orderId: number; materialId: number; qty: number; source: Source; status: ResStatus }
interface PurchaseRequest { id: number; reservationId: number; orderId: number; materialId: number; qty: number; status: ReqStatus; poId?: number }
interface Supplier { id: number; name: string; leadTimeDays: number; price: Record<number, number> }
interface PO { id: number; code: string; supplierId: number; materialId: number; status: PoStatus; expectedDate: string; requestIds: number[] }

const GROUP_LABEL: Record<Group, string> = { SAT: 'Sắt', PHU_KIEN: 'Phụ kiện', DAY: 'Dây/Sơn', BAO_BI: 'Bao bì' };

let _seq = 100;
const uid = () => _seq++;
const round1 = (n: number) => Math.round(n * 10) / 10;
const roundNeed = (raw: number, t: UnitType) => (t === 'DISCRETE' ? Math.ceil(raw) : round1(raw));
const addDays = (d: number) => new Date(Date.now() + d * 86400000).toLocaleDateString('vi-VN');
const vnd = (n: number) => n.toLocaleString('vi-VN') + 'đ';

function seedMaterials(): Material[] {
  const m = (id: number, name: string, spec: string, group: Group, unit: string, unitType: UnitType, onHand: number): Material =>
    ({ id, name, spec, group, unit, unitType, onHand, reserved: 0, onOrder: 0 });
  return [
    m(1, 'Sắt Vuông 6 zem', '40×40 · 660', 'SAT', 'cây', 'DISCRETE', 100),
    m(2, 'Sắt Vuông 6 zem', '30×30 · 660', 'SAT', 'cây', 'DISCRETE', 20),
    m(3, 'Pát bắt chân', '2.0mm', 'PHU_KIEN', 'cái', 'DISCRETE', 60),
    m(4, 'Chốt khóa', 'M8', 'PHU_KIEN', 'cái', 'DISCRETE', 30),
    m(5, 'Dây PE', 'Ø3mm', 'DAY', 'kg', 'CONTINUOUS', 8),
    m(6, 'Thùng carton', '60×40×30', 'BAO_BI', 'thùng', 'DISCRETE', 10),
  ];
}

const PRODUCTS: Product[] = [
  {
    id: 'JSE-55', name: 'Ghế J55 (khung 40×40)',
    bom: [
      { materialId: 1, qtyPer: 3, wastePct: 0 },
      { materialId: 3, qtyPer: 4, wastePct: 0 },
      { materialId: 4, qtyPer: 2, wastePct: 0 },
      { materialId: 5, qtyPer: 0.4, wastePct: 0.1 },
      { materialId: 6, qtyPer: 1, wastePct: 0 },
    ],
  },
  {
    id: 'IEA-3', name: 'Ghế IEA-3 (khung 30×30)',
    bom: [
      { materialId: 2, qtyPer: 2, wastePct: 0 },
      { materialId: 3, qtyPer: 4, wastePct: 0 },
      { materialId: 5, qtyPer: 0.6, wastePct: 0.1 },
      { materialId: 6, qtyPer: 1, wastePct: 0 },
    ],
  },
];

const SUPPLIERS: Supplier[] = [
  { id: 1, name: 'Thép Miền Nam', leadTimeDays: 5, price: { 1: 185000, 2: 150000 } },
  { id: 2, name: 'Kim khí Á Châu', leadTimeDays: 3, price: { 1: 190000, 2: 148000, 3: 1200, 4: 800, 5: 42000, 6: 15000 } },
  { id: 3, name: 'Bao bì Tân Tiến', leadTimeDays: 2, price: { 5: 40000, 6: 14000 } },
];
const suppliersFor = (mid: number) => SUPPLIERS.filter(s => s.price[mid] != null);
const cheapestFor = (mid: number) => suppliersFor(mid).sort((a, b) => a.price[mid] - b.price[mid])[0];

const STEPS = [
  { icon: ClipboardList, label: 'Tạo lệnh SX' },
  { icon: ShoppingCart, label: 'Đề xuất mua' },
  { icon: PackagePlus, label: 'Đơn mua (chọn NCC)' },
  { icon: Truck, label: 'Nhập kho' },
  { icon: Factory, label: 'Sản xuất' },
];

export default function DemoTonKhoPage() {
  const [materials, setMaterials] = useState<Material[]>(seedMaterials);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [productId, setProductId] = useState(PRODUCTS[0].id);
  const [qty, setQty] = useState<number | ''>(20);
  const [supplierSel, setSupplierSel] = useState<Record<number, number>>({}); // materialId -> supplierId
  const [log, setLog] = useState<string[]>([]);

  const matById = useMemo(() => Object.fromEntries(materials.map(m => [m.id, m])) as Record<number, Material>, [materials]);
  const avail = (m: Material) => round1(m.onHand - m.reserved);
  const pushLog = (msg: string) => setLog(l => [`${new Date().toLocaleTimeString('vi-VN')} — ${msg}`, ...l].slice(0, 80));

  const resetAll = () => {
    setMaterials(seedMaterials()); setOrders([]); setReservations([]); setRequests([]); setPos([]); setSupplierSel({});
    setLog(['Đặt lại toàn bộ về tồn đầu kỳ']);
  };

  // ── BƯỚC 1: Tạo lệnh SX → giữ chỗ + sinh đề xuất mua ─────────────
  const createOrder = (pid: string, q: number) => {
    if (q <= 0) return;
    const product = PRODUCTS.find(p => p.id === pid); if (!product) return;
    const orderId = uid();
    const code = `LSX-${orders.length + 1}`;
    const mats = materials.map(m => ({ ...m }));
    const newRes: Reservation[] = [];
    const newReq: PurchaseRequest[] = [];
    const lines: string[] = [];

    product.bom.forEach(line => {
      const m = mats.find(x => x.id === line.materialId); if (!m) return;
      const need = roundNeed(line.qtyPer * (1 + line.wastePct) * q, m.unitType);
      const a = m.onHand - m.reserved;
      const fromStock = Math.min(need, Math.max(a, 0));
      const toBuy = round1(need - fromStock);
      m.reserved = round1(m.reserved + fromStock);
      m.onOrder = round1(m.onOrder + toBuy);
      if (fromStock > 0) newRes.push({ id: uid(), orderId, materialId: m.id, qty: round1(fromStock), source: 'TU_KHO', status: 'DANG_GIU' });
      if (toBuy > 0) {
        const resId = uid();
        newRes.push({ id: resId, orderId, materialId: m.id, qty: toBuy, source: 'MUA_VE', status: 'CHO_VE' });
        newReq.push({ id: uid(), reservationId: resId, orderId, materialId: m.id, qty: toBuy, status: 'OPEN' });
      }
      lines.push(`${m.name} ${m.spec}: cần ${need}${m.unit} → giữ ${round1(fromStock)}, mua ${toBuy}`);
    });

    setMaterials(mats);
    setOrders(o => [...o, { id: orderId, code, productId: pid, qty: q }]);
    setReservations(r => [...r, ...newRes]);
    setRequests(r => [...r, ...newReq]);
    pushLog(`[1] ${code} · ${product.name} × ${q}: ${lines.join(' | ')}`);
  };

  // ── BƯỚC 3: Tạo đơn mua từ các đề xuất OPEN của 1 mã vật tư ───────
  const createPO = (materialId: number) => {
    const open = requests.filter(r => r.materialId === materialId && r.status === 'OPEN');
    if (open.length === 0) return;
    const supplierId = supplierSel[materialId] ?? cheapestFor(materialId)?.id;
    if (!supplierId) return;
    const sup = SUPPLIERS.find(s => s.id === supplierId)!;
    const poId = uid();
    const code = `PO-${pos.length + 1}`;
    const ids = open.map(r => r.id);
    setPos(p => [...p, { id: poId, code, supplierId, materialId, status: 'ORDERED', expectedDate: addDays(sup.leadTimeDays), requestIds: ids }]);
    setRequests(rs => rs.map(r => ids.includes(r.id) ? { ...r, status: 'ORDERED', poId } : r));
    const m = matById[materialId];
    const totalQty = round1(open.reduce((s, r) => s + r.qty, 0));
    pushLog(`[3] ${code} đặt ${sup.name}: ${m.name} ${m.spec} × ${totalQty}${m.unit} (gộp ${open.length} đề xuất) · dự kiến về ${addDays(sup.leadTimeDays)}`);
  };

  // ── BƯỚC 4: Nhập kho theo đơn mua ────────────────────────────────
  const receivePO = (poId: number) => {
    const po = pos.find(p => p.id === poId); if (!po || po.status !== 'ORDERED') return;
    const reqs = requests.filter(r => po.requestIds.includes(r.id));
    const resIds = reqs.map(r => r.reservationId);
    const mats = materials.map(m => ({ ...m }));
    reqs.forEach(req => {
      const m = mats.find(x => x.id === req.materialId); if (!m) return;
      m.onHand = round1(m.onHand + req.qty);
      m.reserved = round1(m.reserved + req.qty);   // hàng có chủ → đích danh đơn
      m.onOrder = round1(m.onOrder - req.qty);
    });
    setMaterials(mats);
    setReservations(rs => rs.map(r => resIds.includes(r.id) ? { ...r, status: 'DANG_GIU' } : r));
    setRequests(rs => rs.map(r => po.requestIds.includes(r.id) ? { ...r, status: 'RECEIVED' } : r));
    setPos(ps => ps.map(p => p.id === poId ? { ...p, status: 'RECEIVED' } : p));
    const m = matById[po.materialId];
    pushLog(`[4] Nhập kho ${po.code}: +${round1(reqs.reduce((s, r) => s + r.qty, 0))}${m.unit} ${m.name} (Tồn vật lý➕ Đã giữ➕ Chờ về➖)`);
  };

  // ── BƯỚC 5: Xuất kho sản xuất (chỉ khi đủ) ───────────────────────
  const produceOrder = (orderId: number) => {
    const rs = reservations.filter(r => r.orderId === orderId);
    if (rs.some(r => r.status === 'CHO_VE')) return;
    const holding = rs.filter(r => r.status === 'DANG_GIU'); if (holding.length === 0) return;
    const mats = materials.map(m => ({ ...m }));
    holding.forEach(r => {
      const m = mats.find(x => x.id === r.materialId); if (!m) return;
      m.onHand = round1(m.onHand - r.qty);
      m.reserved = round1(m.reserved - r.qty);
    });
    setMaterials(mats);
    setReservations(list => list.map(r => r.orderId === orderId && r.status === 'DANG_GIU' ? { ...r, status: 'DA_XUAT' } : r));
    pushLog(`[5] Xuất kho sản xuất ${orderCode(orderId)} (Tồn vật lý➖ Đã giữ➖)`);
  };

  const orderCode = (id: number) => orders.find(o => o.id === id)?.code ?? `#${id}`;

  const loadScenario = () => {
    resetAll();
    setTimeout(() => { createOrder('JSE-55', 20); setTimeout(() => createOrder('IEA-3', 15), 0); }, 0);
  };

  // ── View models ──────────────────────────────────────────────────
  const openReqGroups = useMemo(() => {
    const open = requests.filter(r => r.status === 'OPEN');
    const byMat = new Map<number, PurchaseRequest[]>();
    open.forEach(r => { const a = byMat.get(r.materialId) ?? []; a.push(r); byMat.set(r.materialId, a); });
    return [...byMat.entries()].map(([materialId, rs]) => ({
      m: matById[materialId],
      totalQty: round1(rs.reduce((s, r) => s + r.qty, 0)),
      fromOrders: rs.map(r => orderCode(r.orderId)),
    }));
  }, [requests, matById, orders]);

  const orderView = useMemo(() => orders.map(o => {
    const product = PRODUCTS.find(p => p.id === o.productId)!;
    const rs = reservations.filter(r => r.orderId === o.id);
    const lines = product.bom.map(b => {
      const m = matById[b.materialId];
      const lr = rs.filter(r => r.materialId === b.materialId);
      const fromStock = lr.filter(r => r.source === 'TU_KHO').reduce((s, r) => s + r.qty, 0);
      const toBuy = lr.filter(r => r.source === 'MUA_VE').reduce((s, r) => s + r.qty, 0);
      const waiting = lr.some(r => r.status === 'CHO_VE');
      return { m, need: round1(fromStock + toBuy), fromStock: round1(fromStock), toBuy: round1(toBuy), waiting };
    });
    const waiting = rs.some(r => r.status === 'CHO_VE');
    const allDone = rs.length > 0 && rs.every(r => r.status === 'DA_XUAT');
    return { o, product, lines, waiting, allDone };
  }), [orders, reservations, matById]);

  // Bước hiện hành để tô sáng thanh tiến trình
  const currentStep = pos.some(p => p.status === 'RECEIVED') || reservations.some(r => r.status === 'DA_XUAT')
    ? (orderView.some(v => !v.allDone && !v.waiting) ? 5 : reservations.some(r => r.status === 'DA_XUAT') ? 5 : 4)
    : pos.length ? 4 : openReqGroups.length ? 2 : orders.length ? 1 : 1;

  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '24px 28px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Boxes size={22} color="var(--blue)" />
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Demo · Quy trình Giữ chỗ → Mua hàng → Nhập kho → Sản xuất</h1>
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>
        Đa vật tư theo BOM · mỗi tổ hợp = 1 mã tồn riêng · mô phỏng FE, không backend
      </div>

      {/* Thanh tiến trình */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => {
          const n = i + 1; const active = n <= currentStep;
          const Icon = s.icon;
          return (
            <div key={n} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', borderRadius: 999,
              background: active ? 'var(--blue-bg)' : 'var(--surface2)',
              color: active ? 'var(--blue-text)' : 'var(--text3)',
              border: `1px solid ${active ? 'var(--blue)' : 'var(--border)'}`, fontSize: 12.5, fontWeight: 600,
            }}>
              <Icon size={14} /> {n}. {s.label}
            </div>
          );
        })}
      </div>

      {/* Danh mục tồn */}
      <Section title="Tồn kho theo mã vật tư">
        <table style={tbl}>
          <thead><tr style={trh}>
            <th style={th}>Mã</th><th style={th}>Nhóm</th><th style={th}>Tên · Quy cách</th><th style={th}>ĐVT</th>
            <th style={thR}>Tồn vật lý</th><th style={thR}>Đã giữ</th><th style={thR}>Khả dụng</th><th style={thR}>Chờ về</th>
          </tr></thead>
          <tbody>
            {materials.map(m => {
              const a = avail(m);
              return (
                <tr key={m.id} style={trb}>
                  <td style={{ ...td, fontWeight: 700 }}>MÃ-{m.id}</td>
                  <td style={td}><span className="chip">{GROUP_LABEL[m.group]}</span></td>
                  <td style={td}>{m.name} <span style={{ color: 'var(--text3)' }}>· {m.spec}</span></td>
                  <td style={td}>{m.unit}</td>
                  <td style={tdR}>{m.onHand}</td>
                  <td style={{ ...tdR, color: 'var(--amber)' }}>{m.reserved || '—'}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: a > 0 ? 'var(--green)' : a < 0 ? 'var(--red)' : 'var(--text3)' }}>{a}</td>
                  <td style={{ ...tdR, color: 'var(--blue)' }}>{m.onOrder || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* BƯỚC 1 + 2/3 — hai ô ngang nhau */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 18, alignItems: 'start' }}>
      {/* BƯỚC 1 — Tạo lệnh */}
      <Section title="① Tạo lệnh sản xuất" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={productId} onChange={e => setProductId(e.target.value)} style={{ width: 240 }}>
            {PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text2)' }}>SL</span>
            <input type="number" value={qty} onChange={e => setQty(e.target.value ? Number(e.target.value) : '')} style={{ width: 80 }} />
            <span style={{ fontSize: 13, color: 'var(--text3)' }}>cái</span>
          </div>
          <button className="primary" onClick={() => { if (qty) createOrder(productId, Number(qty)); }} style={btnPrimary}><PackagePlus size={14} /> Tạo lệnh</button>
          <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
          <button onClick={loadScenario} style={btn}><Sparkles size={14} /> Nạp kịch bản (J55×20 + IEA-3×15)</button>
          <button onClick={resetAll} style={btn}><RotateCcw size={14} /> Đặt lại</button>
        </div>

        <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
          {orderView.length === 0 && <Empty>Chưa có lệnh. Tạo lệnh hoặc “Nạp kịch bản”.</Empty>}
          {orderView.map(({ o, product, lines, waiting, allDone }) => (
            <div key={o.id} style={cardInner}>
              <div style={cardHead}>
                <div><b style={{ fontSize: 15 }}>{o.code}</b><span style={{ color: 'var(--text2)', marginLeft: 8 }}>{product.name} × {o.qty}</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {allDone ? <span className="badge green">Đã xuất xong</span> : waiting ? <span className="badge amber">Chờ hàng về</span> : <span className="badge blue">Đủ vật tư — sẵn sàng SX</span>}
                  {!waiting && !allDone && <button className="primary" onClick={() => produceOrder(o.id)} style={btnSm}><Factory size={13} /> Xuất SX</button>}
                </div>
              </div>
              <table style={tbl}>
                <thead><tr style={trh}><th style={th}>Vật tư</th><th style={thR}>Cần</th><th style={thR}>Giữ từ kho</th><th style={thR}>Phải mua</th><th style={th}>Dòng</th></tr></thead>
                <tbody>
                  {lines.map(({ m, need, fromStock, toBuy, waiting: lw }) => (
                    <tr key={m.id} style={trb}>
                      <td style={td}><b>MÃ-{m.id}</b> · {m.name} <span style={{ color: 'var(--text3)' }}>{m.spec}</span></td>
                      <td style={tdR}>{need} {m.unit}</td>
                      <td style={tdR}>{fromStock || '—'}</td>
                      <td style={{ ...tdR, color: toBuy > 0 ? 'var(--red)' : 'var(--text3)', fontWeight: toBuy > 0 ? 700 : 400 }}>{toBuy || '—'}</td>
                      <td style={td}>{lw ? <span className="badge amber">chờ mua về</span> : <span className="badge green">đủ trong kho</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>

      {/* BƯỚC 2+3 — Đề xuất mua → tạo đơn mua */}
      <Section title="② Đề xuất mua (gộp theo mã) → ③ Chọn NCC & tạo đơn mua" style={{ marginBottom: 0 }}>
        {openReqGroups.length === 0 ? <Empty>Không có vật tư thiếu cần mua.</Empty> : (
          <table style={tbl}>
            <thead><tr style={trh}>
              <th style={th}>Vật tư</th><th style={thR}>Tổng cần mua</th><th style={th}>Từ lệnh</th><th style={th}>Chọn NCC</th><th style={thR}>Đơn giá</th><th style={thR}>Thành tiền</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {openReqGroups.map(({ m, totalQty, fromOrders }) => {
                const sid = supplierSel[m.id] ?? cheapestFor(m.id)?.id;
                const sup = SUPPLIERS.find(s => s.id === sid);
                const price = sup?.price[m.id] ?? 0;
                return (
                  <tr key={m.id} style={trb}>
                    <td style={td}><b>MÃ-{m.id}</b> · {m.name} <span style={{ color: 'var(--text3)' }}>{m.spec}</span></td>
                    <td style={{ ...tdR, fontWeight: 700, color: 'var(--red)' }}>{totalQty} {m.unit}</td>
                    <td style={td}>{fromOrders.map((c, i) => <span key={i} className="chip">{c}</span>)}</td>
                    <td style={td}>
                      <select value={sid} onChange={e => setSupplierSel(s => ({ ...s, [m.id]: Number(e.target.value) }))} style={{ width: 180 }}>
                        {suppliersFor(m.id).map(s => (
                          <option key={s.id} value={s.id}>{s.name} · {s.leadTimeDays}d{cheapestFor(m.id)?.id === s.id ? ' · rẻ nhất' : ''}</option>
                        ))}
                      </select>
                    </td>
                    <td style={tdR}>{vnd(price)}</td>
                    <td style={{ ...tdR, fontWeight: 600 }}>{vnd(price * totalQty)}</td>
                    <td style={{ ...td, textAlign: 'right' }}><button className="primary" onClick={() => createPO(m.id)} style={btnSm}><ShoppingCart size={13} /> Tạo đơn mua</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      </div>{/* /lưới 2 ô */}

      {/* BƯỚC 4 — Đơn mua & nhập kho */}
      <Section title="④ Đơn mua hàng & nhập kho">
        {pos.length === 0 ? <Empty>Chưa có đơn mua nào.</Empty> : (
          <table style={tbl}>
            <thead><tr style={trh}>
              <th style={th}>Mã PO</th><th style={th}>NCC</th><th style={th}>Vật tư</th><th style={thR}>SL</th><th style={th}>Dự kiến về</th><th style={th}>Trạng thái</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {pos.map(po => {
                const m = matById[po.materialId];
                const sup = SUPPLIERS.find(s => s.id === po.supplierId)!;
                const totalQty = round1(requests.filter(r => po.requestIds.includes(r.id)).reduce((s, r) => s + r.qty, 0));
                return (
                  <tr key={po.id} style={trb}>
                    <td style={{ ...td, fontWeight: 700 }}>{po.code}</td>
                    <td style={td}>{sup.name}</td>
                    <td style={td}><b>MÃ-{m.id}</b> · {m.name}</td>
                    <td style={tdR}>{totalQty} {m.unit}</td>
                    <td style={td}>{po.expectedDate}</td>
                    <td style={td}>{po.status === 'RECEIVED' ? <span className="badge green">Đã nhập kho</span> : <span className="badge amber">Đã đặt — chờ về</span>}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{po.status === 'ORDERED' && <button className="primary" onClick={() => receivePO(po.id)} style={btnSm}><Truck size={13} /> Nhận & nhập kho</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* Nhật ký */}
      <Section title="Nhật ký quy trình" right={log.length > 0 ? <button onClick={() => setLog([])} style={{ ...btnSm, padding: '2px 8px' }}><Trash2 size={12} /></button> : undefined}>
        <div style={{ maxHeight: 280, overflow: 'auto' }}>
          {log.map((l, i) => <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '5px 0', borderTop: i ? '1px dashed var(--border)' : 'none' }}>{l}</div>)}
          {log.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có thao tác.</div>}
        </div>
      </Section>

      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, display: 'flex', gap: 6 }}>
        <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} color="var(--green)" />
        <span>
          <b>Vòng đời:</b> Tạo lệnh giữ <code>min(cần, Khả dụng)</code> + sinh đề xuất phần thiếu → gộp đề xuất theo mã, chọn NCC rẻ/nhanh → đặt hàng (Chờ về) →
          hàng về nhập kho (Tồn vật lý➕ Đã giữ➕ Chờ về➖, đích danh đơn) → khi mọi dòng đủ thì xuất SX (Tồn vật lý➖ Đã giữ➖).
        </span>
      </div>
    </div>
  );
}

function Section({ title, right, children, style }: { title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="card" style={{ marginBottom: 18, ...style }}>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>{title}</span>{right}
      </div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 20, fontSize: 13 }}>{children}</div>;
}

const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 };
const trh: React.CSSProperties = { background: 'var(--surface2)', textAlign: 'left' };
const trb: React.CSSProperties = { borderTop: '1px solid var(--border)' };
const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' };
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '9px 12px', color: 'var(--text)' };
const tdR: React.CSSProperties = { ...td, textAlign: 'right' };
const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 13 };
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', fontSize: 13, fontWeight: 600 };
const btnSm: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12 };
const cardInner: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' };
const cardHead: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' };
