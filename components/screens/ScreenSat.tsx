'use client';

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────
type ManChild = { id: number; loaiSat: string; soLuong: string };
type Manh = { id: number; maNhaMay: string; tenManh: string; children: ManChild[] };

type BomItem = {
  id: number; maNhaMay: string; ten: string;
  thoiGian: string; status: 'dang_nhap' | 'da_xac_nhan';
};

const MOCK_LIST: BomItem[] = [
  { id: 1, maNhaMay: 'NM-J55-001', ten: 'Ghế J55 Goplus Mới',   thoiGian: '23/06/2026 08:30', status: 'dang_nhap'  },
  { id: 2, maNhaMay: 'NM-BAN-002', ten: 'Bàn J55 Mặt Kính',      thoiGian: '22/06/2026 14:15', status: 'dang_nhap'  },
  { id: 3, maNhaMay: 'NM-GHE-003', ten: 'Ghế xếp ngoài trời',    thoiGian: '21/06/2026 09:00', status: 'da_xac_nhan'},
];

const STEEL_CATALOG = [
  'Sắt V18 6.2cm', 'Sắt V18 6.2cm — 262mm', 'Sắt V10 6.2cm',
  'Sắt hộp 20×20', 'Sắt hộp 25×50×0.8', 'Sắt hộp 40×40×1.2',
  'Sắt ống tròn Ø25', 'Sắt ống tròn Ø32', 'Sắt dẹp 30×3',
  'Thép phi 6', 'Thép phi 8', 'Thép F14', 'Tan rút',
];

// ─── SteelSearch: inline search dropdown ──────────────────────────────
function SteelSearch({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [search,  setSearch]  = useState('');
  const [focused, setFocused] = useState(false);

  const filtered = STEEL_CATALOG.filter((s) =>
    s.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        placeholder="Tìm loại sắt…"
        value={value || search}
        onFocus={() => { setFocused(true); if (value) { setSearch(''); onChange(''); } }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={(e) => { setSearch(e.target.value); onChange(''); }}
        style={{ width: '100%' }}
      />
      {focused && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1.5px solid #90caf9', borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0,0,0,.12)', maxHeight: 200, overflowY: 'auto',
          marginTop: 4,
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '10px 14px', color: 'var(--muted)', fontSize: 13 }}>Không tìm thấy.</div>
          )}
          {filtered.map((s) => (
            <div key={s}
              onClick={() => { onChange(s); setSearch(''); setFocused(false); }}
              style={{
                padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                fontWeight: s === value ? 700 : 400,
                background: s === value ? '#e3f2fd' : '#fff',
                borderBottom: '1px solid #f0f0f0',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = s === value ? '#e3f2fd' : '#fff')}
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
export default function ScreenSat() {
  const [selected,  setSelected]  = useState<BomItem | null>(null);
  const [manhs,     setManhs]     = useState<Manh[]>([]);
  const [nextId,    setNextId]    = useState(1);
  const [confirmed, setConfirmed] = useState(false);

  // Form: tạo mảnh mới (parent)
  const [showManhForm, setShowManhForm] = useState(false);
  const [formMaNM,     setFormMaNM]     = useState('');
  const [formTenManh,  setFormTenManh]  = useState('');

  // Form: thêm loại sắt cho 1 mảnh cụ thể
  const [addingTo,    setAddingTo]    = useState<number | null>(null); // mảnh id đang mở form con
  const [childSat,    setChildSat]    = useState('');
  const [childSoLuong, setChildSoLuong] = useState('');

  const openItem = (item: BomItem) => {
    setSelected(item); setManhs([]); setConfirmed(false);
    setShowManhForm(false); setFormMaNM(''); setFormTenManh('');
    setAddingTo(null); setChildSat(''); setChildSoLuong('');
  };

  // Thêm mảnh (parent)
  const addManh = () => {
    if (!formMaNM.trim() || !formTenManh.trim()) return;
    const newManh: Manh = {
      id: nextId,
      maNhaMay: formMaNM.trim(),
      tenManh:  formTenManh.trim(),
      children: [],
    };
    setManhs((m) => [...m, newManh]);
    setNextId((n) => n + 1);
    setShowManhForm(false);
    setFormMaNM(''); setFormTenManh('');
    // Không auto-open child form — để user thấy parent card rõ ràng
    setAddingTo(null);
  };

  // Thêm loại sắt (child)
  const addChild = (manhId: number) => {
    if (!childSat) return;
    setManhs((ms) => ms.map((m) =>
      m.id === manhId
        ? { ...m, children: [...m.children, { id: Date.now(), loaiSat: childSat, soLuong: childSoLuong }] }
        : m,
    ));
    setChildSat(''); setChildSoLuong('');
  };

  const deleteChild = (manhId: number, childId: number) =>
    setManhs((ms) => ms.map((m) =>
      m.id === manhId ? { ...m, children: m.children.filter((c) => c.id !== childId) } : m,
    ));

  const deleteManh = (manhId: number) =>
    setManhs((ms) => ms.filter((m) => m.id !== manhId));

  const openChildForm = (manhId: number) => {
    setAddingTo(manhId); setChildSat(''); setChildSoLuong('');
  };

  // ── List view ────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Danh sách form định mức — Sắt</h3>
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
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <span style={{ fontWeight: 700, color: '#1565c0', fontFamily: 'monospace', fontSize: 13 }}>{item.maNhaMay}</span>
              <span style={{ fontWeight: 500 }}>{item.ten}</span>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>{item.thoiGian}</span>
              <span>
                {item.status === 'da_xac_nhan'
                  ? <span style={{ background: '#e8f5e9', color: '#2e7d32', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✓ Xong</span>
                  : <span style={{ background: '#e3f2fd', color: '#1565c0', borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Đang nhập</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────
  const totalChildren = manhs.reduce((s, m) => s + m.children.length, 0);

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setSelected(null)} style={{
          background: 'transparent', border: '1.5px solid var(--border)',
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#555',
        }}>← Quay lại</button>
        <div>
          <span style={{ fontWeight: 700, color: '#1565c0', fontFamily: 'monospace', fontSize: 15 }}>{selected.maNhaMay}</span>
          <span style={{ marginLeft: 10, fontWeight: 600, fontSize: 16 }}>{selected.ten}</span>
          <span className="hint" style={{ marginLeft: 8 }}>{selected.thoiGian}</span>
        </div>
      </div>

      <div className="card" style={{ borderLeft: '4px solid #1565c0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>
            Danh sách mảnh sắt
            {manhs.length > 0 && (
              <span className="hint" style={{ fontWeight: 400, marginLeft: 8 }}>
                {manhs.length} mảnh · {totalChildren} loại sắt
              </span>
            )}
          </h3>
          {!confirmed && (
            <button className="btn btn-primary" onClick={() => { setShowManhForm(true); setAddingTo(null); }}
              disabled={showManhForm}>
              + Nhập mảnh
            </button>
          )}
        </div>

        {/* Form tạo mảnh (parent) */}
        {showManhForm && (
          <div style={{
            background: '#e3f2fd', border: '1.5px solid #90caf9',
            borderRadius: 10, padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ fontWeight: 700, color: '#1565c0', marginBottom: 10, fontSize: 14 }}>Nhập thông tin mảnh</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="field" style={{ margin: 0, minWidth: 160 }}>
                <label>Mã Nhà máy</label>
                <input className="input" placeholder="NM-001" value={formMaNM}
                  onChange={(e) => setFormMaNM(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManh()} />
              </div>
              <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
                <label>Tên mảnh</label>
                <input className="input" placeholder="Mảnh tựa, Mảnh tay…" value={formTenManh}
                  onChange={(e) => setFormTenManh(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addManh()} />
              </div>
              <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
                <button className="btn btn-primary" onClick={addManh}
                  disabled={!formMaNM.trim() || !formTenManh.trim()}>
                  Tạo mảnh →
                </button>
                <button className="btn btn-sm" onClick={() => { setShowManhForm(false); setFormMaNM(''); setFormTenManh(''); }}>
                  Hủy
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {manhs.length === 0 && !showManhForm && (
          <div style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '12px 0', marginBottom: 12 }}>
            Chưa có mảnh nào — bấm "+ Nhập mảnh" để bắt đầu.
          </div>
        )}

        {/* Mảnh list với children */}
        {manhs.map((m) => (
          <div key={m.id} style={{
            border: '1.5px solid #bbdefb', borderRadius: 10,
            marginBottom: 12, overflow: 'hidden',
          }}>
            {/* Parent row — header của mảnh */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#e3f2fd', padding: '10px 16px',
              borderBottom: m.children.length > 0 || addingTo === m.id ? '1px solid #bbdefb' : 'none',
            }}>
              <span style={{ fontWeight: 700, color: '#1565c0', fontFamily: 'monospace', fontSize: 13 }}>{m.maNhaMay}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: '#1a237e' }}>{m.tenManh}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#888' }}>{m.children.length} loại sắt</span>
                {!confirmed && (
                  <>
                    <button
                      onClick={() => addingTo === m.id ? setAddingTo(null) : openChildForm(m.id)}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', border: '2px solid #1565c0',
                        background: addingTo === m.id ? '#1565c0' : '#fff',
                        color: addingTo === m.id ? '#fff' : '#1565c0',
                        cursor: 'pointer', fontWeight: 900, fontSize: 18, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="Thêm loại sắt"
                    >
                      {addingTo === m.id ? '−' : '+'}
                    </button>
                    <button className="btn btn-sm btn-red" style={{ padding: '3px 10px', fontSize: 12 }}
                      onClick={() => { deleteManh(m.id); if (addingTo === m.id) setAddingTo(null); }}>
                      Xóa mảnh
                    </button>
                  </>
                )}
              </span>
            </div>

            {/* Children rows */}
            {m.children.length > 0 && (
              <table style={{ margin: 0, borderRadius: 0, fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ width: 36, textAlign: 'center' }}>#</th>
                    <th>Loại sắt</th>
                    <th style={{ width: 110, textAlign: 'right' }}>Số lượng</th>
                    {!confirmed && <th style={{ width: 44 }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {m.children.map((c, i) => (
                    <tr key={c.id}>
                      <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{c.loaiSat}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{c.soLuong || '—'}</td>
                      {!confirmed && (
                        <td style={{ textAlign: 'center' }}>
                          <button className="btn btn-sm btn-red" style={{ padding: '2px 8px' }}
                            onClick={() => deleteChild(m.id, c.id)}>×</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Inline form thêm loại sắt */}
            {addingTo === m.id && (
              <div style={{
                padding: '10px 14px', background: '#f0f7ff',
                borderTop: m.children.length > 0 ? '1px dashed #90caf9' : 'none',
              }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="field" style={{ flex: 1, minWidth: 200, margin: 0 }}>
                    <label>Loại sắt</label>
                    <SteelSearch value={childSat} onChange={setChildSat} />
                  </div>
                  <div className="field" style={{ minWidth: 120, margin: 0 }}>
                    <label>Số lượng</label>
                    <input className="input" placeholder="1332" value={childSoLuong}
                      onChange={(e) => setChildSoLuong(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addChild(m.id)} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => addChild(m.id)}
                      disabled={!childSat}>
                      + Thêm
                    </button>
                    <button className="btn btn-sm" onClick={() => setAddingTo(null)}>Đóng</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Nút thêm mảnh mới — chỉ hiện khi có ít nhất 1 mảnh và không đang mở form */}
        {!confirmed && manhs.length > 0 && !showManhForm && (
          <button
            onClick={() => { setShowManhForm(true); setAddingTo(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '10px 16px', marginBottom: 14,
              background: '#f8f9ff', border: '1.5px dashed #90caf9',
              borderRadius: 10, cursor: 'pointer',
              color: '#1565c0', fontWeight: 600, fontSize: 13,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#e3f2fd')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#f8f9ff')}
          >
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '2px solid #1565c0', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 18, lineHeight: 1, fontWeight: 900,
            }}>+</span>
            Thêm mảnh mới
          </button>
        )}

        {/* Confirm */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: confirmed ? '#2e7d32' : 'var(--muted)' }}>
            {confirmed
              ? '✓ Đã xác nhận phần Sắt'
              : `${manhs.length} mảnh, ${totalChildren} loại sắt — kiểm tra trước khi xác nhận.`}
          </div>
          {confirmed
            ? <button className="btn btn-sm" onClick={() => setConfirmed(false)}>Bỏ xác nhận (để sửa)</button>
            : <button className="btn btn-green" style={{ minWidth: 160 }}
                disabled={manhs.length === 0 || totalChildren === 0}
                onClick={() => setConfirmed(true)}>Xác nhận phần Sắt ✓</button>
          }
        </div>
      </div>
    </div>
  );
}
