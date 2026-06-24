'use client';
// Màn hình Dương Vũ Tố Ngân — Kế hoạch SX

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────
type CatStatus = 'pending' | 'approved' | 'rejected';

type Cat = {
  key: string;
  label: string;
  color: string;
  thoiGianNhap: string;
  status: CatStatus;
};

type BomItem = {
  id: number;
  maNhaMay: string;
  tenSP: string;
  thoiGianTao: string;
  cats: Cat[];
};

// ─── Mock data ────────────────────────────────────────────────────────
const makeCats = (base: string): Cat[] => [
  { key: 'sat',      label: 'Sắt',             color: '#1565c0', thoiGianNhap: base + ' 09:15', status: 'pending' },
  { key: 'day',      label: 'Dây',             color: '#00695c', thoiGianNhap: base + ' 10:30', status: 'pending' },
  { key: 'phu_kien', label: 'Vật tư phụ kiện', color: '#6a1b9a', thoiGianNhap: base + ' 11:00', status: 'pending' },
  { key: 'bao_bi',   label: 'Bao bì đóng gói', color: '#e65100', thoiGianNhap: base + ' 11:45', status: 'pending' },
];

const INIT_BOMS: BomItem[] = [
  { id: 1, maNhaMay: 'NM-J55-001', tenSP: 'Ghế J55 Goplus Mới',  thoiGianTao: '23/06/2026 08:00', cats: makeCats('23/06/2026') },
  { id: 2, maNhaMay: 'NM-BAN-002', tenSP: 'Bàn J55 Mặt Kính',    thoiGianTao: '22/06/2026 09:00', cats: makeCats('22/06/2026') },
  { id: 3, maNhaMay: 'NM-GHE-003', tenSP: 'Ghế xếp ngoài trời',  thoiGianTao: '21/06/2026 08:30', cats: makeCats('21/06/2026') },
];

// ─── Status helpers ───────────────────────────────────────────────────
const STATUS_META: Record<CatStatus, { label: string; bg: string; color: string }> = {
  pending:  { label: 'Chờ duyệt', bg: '#f5f5f5', color: '#888'    },
  approved: { label: 'Đã duyệt',  bg: '#e8f5e9', color: '#2e7d32' },
  rejected: { label: 'Từ chối',   bg: '#ffebee', color: '#c62828' },
};

function overallStatus(cats: Cat[]): CatStatus {
  if (cats.every(c => c.status === 'approved')) return 'approved';
  if (cats.some(c => c.status === 'rejected'))  return 'rejected';
  return 'pending';
}

// ─── Component ────────────────────────────────────────────────────────
export default function ScreenKeHoach() {
  const [boms,     setBoms]     = useState<BomItem[]>(INIT_BOMS);
  const [selected, setSelected] = useState<BomItem | null>(null);

  // reject note per cat
  const [rejectOpen, setRejectOpen] = useState<string | null>(null); // cat key
  const [rejectNote, setRejectNote] = useState('');

  const openItem = (item: BomItem) => {
    setSelected(boms.find(b => b.id === item.id) ?? item);
    setRejectOpen(null);
    setRejectNote('');
  };

  const updateCat = (bomId: number, catKey: string, status: CatStatus, note?: string) => {
    setBoms(prev => prev.map(b =>
      b.id !== bomId ? b : {
        ...b,
        cats: b.cats.map(c =>
          c.key !== catKey ? c : { ...c, status, ...(note !== undefined ? { rejectNote: note } : {}) }
        ),
      }
    ));
    // sync selected
    setSelected(prev => {
      if (!prev || prev.id !== bomId) return prev;
      return {
        ...prev,
        cats: prev.cats.map(c =>
          c.key !== catKey ? c : { ...c, status }
        ),
      };
    });
    setRejectOpen(null);
    setRejectNote('');
  };

  // ── List view ────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Kế hoạch sản xuất — Duyệt định mức</h3>
          <span className="hint">{boms.length} sản phẩm</span>
        </div>

        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '160px 1fr 160px 110px',
            padding: '10px 16px', background: '#f5f5f5',
            fontSize: 11, fontWeight: 700, color: '#888',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Mã Nhà máy</span>
            <span>Tên sản phẩm</span>
            <span>Thời gian tạo</span>
            <span>Trạng thái</span>
          </div>

          {boms.map((item, idx) => {
            const ov = overallStatus(item.cats);
            const sm = STATUS_META[ov];
            const approved = item.cats.filter(c => c.status === 'approved').length;
            return (
              <div key={item.id} onClick={() => openItem(item)}
                style={{
                  display: 'grid', gridTemplateColumns: '160px 1fr 160px 110px',
                  padding: '14px 16px', cursor: 'pointer',
                  borderBottom: idx < boms.length - 1 ? '1px solid var(--border)' : 'none',
                  background: '#fff', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#fafafa')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
              >
                <span style={{ fontWeight: 700, color: '#6a1b9a', fontFamily: 'monospace', fontSize: 13 }}>{item.maNhaMay}</span>
                <div>
                  <span style={{ fontWeight: 500 }}>{item.tenSP}</span>
                  {/* Mini progress dots */}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {item.cats.map(c => (
                      <span key={c.key} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: c.status === 'approved' ? '#4caf50' : c.status === 'rejected' ? '#ef5350' : '#e0e0e0',
                        display: 'inline-block',
                      }} title={c.label} />
                    ))}
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>{approved}/4</span>
                  </div>
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{item.thoiGianTao}</span>
                <span>
                  <span style={{
                    background: sm.bg, color: sm.color,
                    borderRadius: 12, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                  }}>
                    {ov === 'approved' ? '✓ ' : ov === 'rejected' ? '✗ ' : ''}{sm.label}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Detail view ──────────────────────────────────────────────────────
  const ov = overallStatus(selected.cats);

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setSelected(null)} style={{
          background: 'transparent', border: '1.5px solid var(--border)',
          borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: '#555',
        }}>← Quay lại</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 700, color: '#6a1b9a', fontFamily: 'monospace', fontSize: 15 }}>{selected.maNhaMay}</span>
            <span style={{ fontWeight: 600, fontSize: 16 }}>{selected.tenSP}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            Tạo lúc: {selected.thoiGianTao}
          </div>
        </div>
        {/* Overall badge */}
        <span style={{
          background: STATUS_META[ov].bg, color: STATUS_META[ov].color,
          borderRadius: 12, padding: '5px 14px', fontSize: 13, fontWeight: 700,
          border: `1.5px solid ${STATUS_META[ov].color}40`,
        }}>
          {ov === 'approved' ? '✓ Đã duyệt toàn bộ' : ov === 'rejected' ? '✗ Có mục bị từ chối' : `${selected.cats.filter(c => c.status === 'approved').length}/4 đã duyệt`}
        </span>
      </div>

      {/* 4 Cat cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {selected.cats.map((cat) => {
          const sm   = STATUS_META[cat.status];
          const isRejectOpen = rejectOpen === cat.key;

          return (
            <div key={cat.key} style={{
              background: '#fff',
              border: `1.5px solid ${cat.status === 'approved' ? '#a5d6a7' : cat.status === 'rejected' ? '#ef9a9a' : 'var(--border)'}`,
              borderRadius: 12, overflow: 'hidden',
              boxShadow: cat.status !== 'pending' ? `0 0 0 3px ${sm.bg}` : 'none',
            }}>
              {/* Cat header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
                {/* Color dot + label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: cat.color, display: 'inline-block', flexShrink: 0,
                  }} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: cat.color }}>{cat.label}</span>
                </div>

                {/* Thời gian nhập */}
                <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right', minWidth: 160 }}>
                  <div style={{ fontWeight: 600, color: '#555' }}>Thời gian nhập</div>
                  <div>{cat.thoiGianNhap}</div>
                </div>

                {/* Status badge */}
                <span style={{
                  background: sm.bg, color: sm.color,
                  borderRadius: 10, padding: '4px 12px',
                  fontSize: 12, fontWeight: 700, minWidth: 90, textAlign: 'center',
                }}>
                  {cat.status === 'approved' ? '✓ ' : cat.status === 'rejected' ? '✗ ' : '○ '}{sm.label}
                </span>

                {/* Action buttons */}
                {cat.status === 'pending' && !isRejectOpen && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => updateCat(selected.id, cat.key, 'approved')}
                      style={{
                        padding: '7px 18px', borderRadius: 8, border: 'none',
                        background: '#43a047', color: '#fff',
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#2e7d32')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#43a047')}
                    >
                      ✓ Approved
                    </button>
                    <button
                      onClick={() => { setRejectOpen(cat.key); setRejectNote(''); }}
                      style={{
                        padding: '7px 18px', borderRadius: 8, border: 'none',
                        background: '#ef5350', color: '#fff',
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#c62828')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ef5350')}
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}

                {/* Undo buttons when already decided */}
                {cat.status !== 'pending' && (
                  <button
                    onClick={() => updateCat(selected.id, cat.key, 'pending')}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      border: '1.5px solid var(--border)',
                      background: 'transparent', color: 'var(--muted)',
                      fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Hoàn tác
                  </button>
                )}
              </div>

              {/* Reject note form */}
              {isRejectOpen && (
                <div style={{
                  borderTop: '1px solid #ffcdd2',
                  padding: '12px 18px', background: '#fff8f8',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#c62828', marginBottom: 8 }}>
                    Ghi chú lý do từ chối (tuỳ chọn):
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <input className="input" style={{ flex: 1 }}
                      placeholder="VD: Thiếu quy cách sắt hộp 40×40, cần bổ sung…"
                      value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && updateCat(selected.id, cat.key, 'rejected', rejectNote)}
                    />
                    <button
                      onClick={() => updateCat(selected.id, cat.key, 'rejected', rejectNote)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, border: 'none',
                        background: '#ef5350', color: '#fff',
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Xác nhận từ chối
                    </button>
                    <button className="btn btn-sm"
                      onClick={() => { setRejectOpen(null); setRejectNote(''); }}>
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom summary */}
      <div style={{
        marginTop: 16, padding: '14px 18px',
        background: '#fff', border: '1px solid var(--border)', borderRadius: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          {selected.cats.filter(c => c.status === 'approved').length} mục đã duyệt ·{' '}
          {selected.cats.filter(c => c.status === 'rejected').length} mục từ chối ·{' '}
          {selected.cats.filter(c => c.status === 'pending').length} chờ duyệt
        </div>
        {ov === 'approved' && (
          <span style={{ fontWeight: 700, color: '#2e7d32', fontSize: 14 }}>
            ✓ Định mức hoàn tất — sẵn sàng SX
          </span>
        )}
        {ov === 'rejected' && (
          <span style={{ fontWeight: 700, color: '#c62828', fontSize: 14 }}>
            ✗ Cần chỉnh sửa trước khi duyệt
          </span>
        )}
      </div>
    </div>
  );
}
