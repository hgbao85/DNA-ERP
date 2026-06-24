'use client';
// Màn hình Đoàn Thị Hồng — Dây / Sơn

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────
type VatTu = {
  id: number;
  ten: string;
  dvt: string;
  mau: string;
  quyCach: string;
  dinhMuc: string;
};

type BomItem = {
  id: number; maNhaMay: string; ten: string;
  thoiGian: string; status: 'dang_nhap' | 'da_xac_nhan';
};

const MOCK_LIST: BomItem[] = [
  { id: 1, maNhaMay: 'NM-J55-001', ten: 'Ghế J55 Goplus Mới',  thoiGian: '23/06/2026 08:30', status: 'dang_nhap'  },
  { id: 2, maNhaMay: 'NM-BAN-002', ten: 'Bàn J55 Mặt Kính',     thoiGian: '22/06/2026 14:15', status: 'dang_nhap'  },
  { id: 3, maNhaMay: 'NM-GHE-003', ten: 'Ghế xếp ngoài trời',   thoiGian: '21/06/2026 09:00', status: 'da_xac_nhan'},
];

const STAGES = [
  { type: 'SON', label: 'Sơn', color: '#00695c', bg: '#e0f2f1', desc: 'Photphat, gas, sơn đệm, dung môi…' },
];

const DVT_OPTIONS = ['kg', 'm', 'lít', 'lon', 'cuộn', 'cái', 'con', 'bộ', 'cm', 'tờ', 'gói', 'túi', 'chai', 'thùng'];

// Catalog vật tư Sơn — dùng cho search dropdown
const SON_CATALOG = [
  'Photphat nano',
  'Gas đốt mỏ hàn',
  'Sơn đệm epoxy',
  'Sơn bóng topcoat',
  'Dung môi pha sơn',
  'Hardener đóng rắn',
  'Bột màu đen',
  'Bột màu trắng',
  'Bột màu xanh',
  'Súng phun sơn HVLP',
  'Giấy nhám 240',
  'Giấy nhám 400',
  'Băng keo che phủ',
  'Que hàn điện',
  'Que hàn CO2',
];

type FormState = { ten: string; dvt: string; mau: string; quyCach: string; dinhMuc: string };
const emptyForm = (): FormState => ({ ten: '', dvt: 'kg', mau: '', quyCach: '', dinhMuc: '' });

// ─── VatTuSearch — search dropdown cho Tên vật tư ─────────────────────
function VatTuSearch({
  catalog, value, onChange,
}: { catalog: string[]; value: string; onChange: (v: string) => void }) {
  const [search,  setSearch]  = useState('');
  const [focused, setFocused] = useState(false);

  const filtered = catalog.filter((s) =>
    s.toLowerCase().includes((value || search).toLowerCase()),
  );

  const displayValue = value || search;

  return (
    <div style={{ position: 'relative', flex: 2, minWidth: 180 }}>
      <input
        className="input"
        placeholder="Tìm vật tư…"
        value={displayValue}
        onFocus={() => { setFocused(true); if (value) { setSearch(value); onChange(''); } }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={(e) => { setSearch(e.target.value); onChange(''); }}
        style={{ width: '100%' }}
      />
      {focused && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1.5px solid #80cbc4', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto',
          marginTop: 4,
        }}>
          {/* Cho phép nhập tự do nếu không khớp catalog */}
          {search.trim() && !catalog.includes(search.trim()) && (
            <div
              onClick={() => { onChange(search.trim()); setFocused(false); }}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                borderBottom: '1px solid #f0f0f0',
                background: '#fffde7', color: '#f57f17', fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fff9c4')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fffde7')}
            >
              + Nhập thủ công: &ldquo;{search.trim()}&rdquo;
            </div>
          )}
          {filtered.length === 0 && !search.trim() && (
            <div style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 13 }}>Gõ để tìm kiếm.</div>
          )}
          {filtered.map((s) => (
            <div key={s}
              onClick={() => { onChange(s); setSearch(''); setFocused(false); }}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                fontWeight: s === value ? 700 : 400,
                background: s === value ? '#e0f2f1' : '#fff',
                borderBottom: '1px solid #f0f0f0',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdfb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = s === value ? '#e0f2f1' : '#fff')}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────
export default function ScreenDay() {
  const [selected,  setSelected]  = useState<BomItem | null>(null);
  const [vatTus,    setVatTus]    = useState<Record<string, VatTu[]>>({ SON: [], DAN: [] });
  const [nextId,    setNextId]    = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  const [showForm, setShowForm] = useState<Record<string, boolean>>({ SON: false, DAN: false });
  const [forms,    setForms]    = useState<Record<string, FormState>>({ SON: emptyForm(), DAN: emptyForm() });

  const openItem = (item: BomItem) => {
    setSelected(item);
    setVatTus({ SON: [], DAN: [] });
    setConfirmed(false);
    setShowForm({ SON: false, DAN: false });
    setForms({ SON: emptyForm(), DAN: emptyForm() });
  };

  const setFormField = (stage: string, patch: Partial<FormState>) =>
    setForms((f) => ({ ...f, [stage]: { ...f[stage], ...patch } }));

  const addVatTu = (stage: string) => {
    const f = forms[stage];
    if (!f.ten.trim() || !f.dinhMuc.trim()) return;
    setVatTus((v) => ({
      ...v,
      [stage]: [...v[stage], {
        id: nextId,
        ten: f.ten.trim(), dvt: f.dvt,
        mau: f.mau.trim(), quyCach: f.quyCach.trim(),
        dinhMuc: f.dinhMuc.trim(),
      }],
    }));
    setNextId((n) => n + 1);
    setShowForm((s) => ({ ...s, [stage]: false }));
    setForms((f) => ({ ...f, [stage]: emptyForm() }));
  };

  const deleteVatTu = (stage: string, id: number) =>
    setVatTus((v) => ({ ...v, [stage]: v[stage].filter((x) => x.id !== id) }));

  const totalLines = Object.values(vatTus).reduce((s, a) => s + a.length, 0);

  // ── List view ────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Danh sách form định mức — Dây / Sơn</h3>
          <span className="hint">{MOCK_LIST.length} form đang mở</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '160px 1fr 160px 100px',
            padding: '10px 16px', background: '#f5f5f5',
            fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase',
            letterSpacing: '0.05em', borderBottom: '1px solid var(--border)',
          }}>
            <span>Mã Nhà máy</span><span>Tên sản phẩm</span>
            <span>Thời gian</span><span>Trạng thái</span>
          </div>

          {MOCK_LIST.map((item, idx) => (
            <div key={item.id} onClick={() => openItem(item)}
              style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 160px 100px',
                padding: '14px 16px', cursor: 'pointer',
                borderBottom: idx < MOCK_LIST.length - 1 ? '1px solid var(--border)' : 'none',
                background: '#fff', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fff8')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <span style={{ fontWeight: 700, color: '#00695c', fontFamily: 'monospace', fontSize: 13 }}>{item.maNhaMay}</span>
              <span style={{ fontWeight: 500 }}>{item.ten}</span>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{item.thoiGian}</span>
              <span>
                {item.status === 'da_xac_nhan'
                  ? <span style={{ background: '#e8f5e9', color: '#2e7d32', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✓ Xong</span>
                  : <span style={{ background: '#e0f2f1', color: '#00695c', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Đang nhập</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setSelected(null)} style={{
          background: 'transparent', border: '1.5px solid var(--border)',
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#555',
        }}>← Quay lại</button>
        <div>
          <span style={{ fontWeight: 700, color: '#00695c', fontFamily: 'monospace', fontSize: 15 }}>{selected.maNhaMay}</span>
          <span style={{ marginLeft: 10, fontWeight: 600, fontSize: 16 }}>{selected.ten}</span>
          <span className="hint" style={{ marginLeft: 8 }}>{selected.thoiGian}</span>
        </div>
      </div>

      <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#2e7d32' }}>
        ✓ Nguyễn Thanh Đức (Sắt) đã xác nhận xong phần Phôi + Hàn.
      </div>

      {STAGES.map((cfg) => {
        const items  = vatTus[cfg.type] ?? [];
        const f      = forms[cfg.type]  ?? emptyForm();
        const isOpen = showForm[cfg.type];

        return (
          <div key={cfg.type} style={{
            border: `1.5px solid ${cfg.color}35`, borderRadius: 12,
            marginBottom: 14, overflow: 'hidden',
          }}>
            {/* Stage header */}
            <div style={{ background: cfg.bg, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ background: cfg.color, color: '#fff', fontWeight: 700, borderRadius: 6, padding: '3px 14px', fontSize: 13 }}>{cfg.label}</span>
              <span style={{ fontSize: 12, color: '#555' }}>{cfg.desc}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: cfg.color, fontWeight: 600 }}>{items.length} dòng</span>
                {!confirmed && items.length === 0 && !isOpen && (
                  <button className="btn btn-sm" style={{ background: cfg.color, color: '#fff', border: 'none', fontSize: 12 }}
                    onClick={() => setShowForm((s) => ({ ...s, [cfg.type]: true }))}>
                    + Nhập vật tư
                  </button>
                )}
              </span>
            </div>

            {/* Items table */}
            {items.length > 0 && (
              <table style={{ margin: 0, borderRadius: 0, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    <th style={{ width: 34, textAlign: 'center' }}>#</th>
                    <th>Tên vật tư</th>
                    <th style={{ width: 70, textAlign: 'center' }}>ĐVT</th>
                    <th style={{ width: 90 }}>Màu</th>
                    <th style={{ width: 150 }}>Quy cách</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Định mức/bộ</th>
                    {!confirmed && <th style={{ width: 40 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{item.ten}</td>
                      <td style={{ textAlign: 'center', color: '#555' }}>{item.dvt}</td>
                      <td style={{ color: '#555' }}>{item.mau || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>—</span>}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{item.quyCach || <span style={{ fontStyle: 'italic' }}>—</span>}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{item.dinhMuc}</td>
                      {!confirmed && (
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-sm btn-red" style={{ padding: '2px 8px' }}
                            onClick={() => deleteVatTu(cfg.type, item.id)}>×</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {items.length === 0 && !isOpen && (
              <div style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '12px 16px', fontSize: 13 }}>
                Chưa có dòng nào.
              </div>
            )}

            {/* Inline add form */}
            {isOpen && !confirmed && (
              <div style={{
                padding: '12px 16px',
                background: '#f0fdfb',
                borderTop: items.length > 0 ? `1px dashed ${cfg.color}60` : 'none',
              }}>
                <div style={{ fontWeight: 700, color: cfg.color, marginBottom: 10, fontSize: 13 }}>
                  Nhập vật tư — {cfg.label}
                </div>

                {/* Row 1: Tên (search) + ĐVT + Định mức */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="field" style={{ flex: 2, minWidth: 180, margin: 0 }}>
                    <label>Tên vật tư *</label>
                    <VatTuSearch
                      catalog={SON_CATALOG}
                      value={f.ten}
                      onChange={(v) => setFormField(cfg.type, { ten: v })}
                    />
                  </div>
                  <div className="field" style={{ minWidth: 90, margin: 0 }}>
                    <label>Đơn vị tính *</label>
                    <select value={f.dvt} onChange={(e) => setFormField(cfg.type, { dvt: e.target.value })}>
                      {DVT_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ minWidth: 100, margin: 0 }}>
                    <label>Định mức/bộ *</label>
                    <input className="input" placeholder="0.5" value={f.dinhMuc}
                      onChange={(e) => setFormField(cfg.type, { dinhMuc: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addVatTu(cfg.type)} />
                  </div>
                </div>

                {/* Row 2: Màu + Quy cách + Buttons */}
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="field" style={{ minWidth: 120, margin: 0 }}>
                    <label>Màu</label>
                    <input className="input" placeholder="Đen, Xanh…" value={f.mau}
                      onChange={(e) => setFormField(cfg.type, { mau: e.target.value })} />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 140, margin: 0 }}>
                    <label>Quy cách</label>
                    <input className="input" placeholder="2 lít / thùng, Ø3mm…" value={f.quyCach}
                      onChange={(e) => setFormField(cfg.type, { quyCach: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addVatTu(cfg.type)} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
                    <button className="btn btn-primary" onClick={() => addVatTu(cfg.type)}
                      disabled={!f.ten.trim() || !f.dinhMuc.trim()}>
                      + Thêm
                    </button>
                    <button className="btn btn-sm" onClick={() => {
                      setShowForm((s) => ({ ...s, [cfg.type]: false }));
                      setForms((fm) => ({ ...fm, [cfg.type]: emptyForm() }));
                    }}>Hủy</button>
                  </div>
                </div>
              </div>
            )}

            {/* Dashed "+ Thêm vật tư mới" */}
            {!confirmed && items.length > 0 && !isOpen && (
              <button
                onClick={() => setShowForm((s) => ({ ...s, [cfg.type]: true }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 16px',
                  background: '#f0fdfb', border: 'none',
                  borderTop: `1px dashed ${cfg.color}50`,
                  cursor: 'pointer', color: cfg.color, fontWeight: 600, fontSize: 13,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = cfg.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f0fdfb')}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: `2px solid ${cfg.color}`, display: 'inline-flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, lineHeight: 1, fontWeight: 900,
                }}>+</span>
                Thêm vật tư mới
              </button>
            )}
          </div>
        );
      })}

      {/* Confirm */}
      <div style={{
        background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
        padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 13, color: confirmed ? '#2e7d32' : 'var(--muted)' }}>
          {confirmed ? '✓ Đã xác nhận định mức Sơn' : `${totalLines} dòng — kiểm tra lại trước khi xác nhận.`}
        </div>
        {confirmed
          ? <button className="btn btn-sm" onClick={() => setConfirmed(false)}>Bỏ xác nhận (để sửa)</button>
          : <button className="btn btn-green" style={{ minWidth: 180 }}
              disabled={totalLines === 0}
              onClick={() => setConfirmed(true)}>Xác nhận phần Dây / Sơn ✓</button>
        }
      </div>
    </div>
  );
}
