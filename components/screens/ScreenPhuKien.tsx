'use client';
// Màn hình Trần Văn Nhơn — Phụ kiện (Bao bì + Đóng gói)

import { useState } from 'react';
import { MOCK_BOMS, MockLine } from '@/lib/mockData';

const STAGES = [
  { type: 'BAO_BI',   label: 'Bao bì',   color: '#e65100', bg: '#fff3e0', desc: 'Logo, nhãn, nút, bulon, london, HDLR…' },
  { type: 'DONG_GOI', label: 'Đóng gói', color: '#bf360c', bg: '#fbe9e7', desc: 'Thùng carton, xốp, foam, gỗ, màng PE, đai…' },
];
const UNITS = ['cái', 'con', 'bộ', 'tờ', 'gói', 'cuộn', 'kg', 'lít', 'lon', 'cm', 'bo'];

type FormState = { name: string; specs: string; unit: string; qty: string };
const empty = (): FormState => ({ name: '', specs: '', unit: 'cái', qty: '' });

export default function ScreenPhuKien() {
  const bom = MOCK_BOMS[0];
  const [lines, setLines] = useState<Record<string, MockLine[]>>({
    BAO_BI:   bom.stages.find((s) => s.stageType === 'BAO_BI')?.lines   ?? [],
    DONG_GOI: bom.stages.find((s) => s.stageType === 'DONG_GOI')?.lines ?? [],
  });
  const [forms,     setForms]     = useState<Record<string, FormState>>({ BAO_BI: empty(), DONG_GOI: empty() });
  const [confirmed, setConfirmed] = useState(false);
  const [nextId,    setNextId]    = useState(3000);

  const setForm = (stage: string, patch: Partial<FormState>) =>
    setForms((f) => ({ ...f, [stage]: { ...f[stage], ...patch } }));

  const addLine = (stage: string) => {
    const f = forms[stage];
    if (!f.name.trim() || !f.qty) return;
    setLines((l) => ({ ...l, [stage]: [...l[stage], { id: nextId, name: f.name.trim(), specs: f.specs.trim(), unit: f.unit, qty: Number(f.qty) }] }));
    setNextId((n) => n + 1);
    setForms((fm) => ({ ...fm, [stage]: empty() }));
  };

  const deleteLine = (stage: string, id: number) =>
    setLines((l) => ({ ...l, [stage]: l[stage].filter((x) => x.id !== id) }));

  const totalLines = Object.values(lines).reduce((s, a) => s + a.length, 0);

  return (
    <div>
      <div className="card" style={{ borderLeft: '4px solid #e65100', marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{bom.productCode} — {bom.productName}</div>
            <div className="hint">Phiên bản {bom.version} · Kế hoạch: {bom.createdBy} · {totalLines} dòng vật tư</div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {[{ cat: 'SAT', done: true }, { cat: 'DAY', done: false }, { cat: 'PHU_KIEN', done: confirmed }].map((s) => (
              <div key={s.cat} style={{
                width: 34, height: 34, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: s.done ? '#e8f5e9' : s.cat === 'PHU_KIEN' ? '#fff3e0' : '#f5f5f5',
                border: `2px solid ${s.done ? '#4caf50' : s.cat === 'PHU_KIEN' ? '#e65100' : '#ddd'}`,
                color: s.done ? '#2e7d32' : s.cat === 'PHU_KIEN' ? '#e65100' : '#bbb',
              }}>{s.done ? '✓' : s.cat[0]}</div>
            ))}
            <span style={{ fontSize: 12, color: '#888', marginLeft: 4 }}>{1 + (confirmed ? 1 : 0)}/3</span>
          </div>
        </div>
      </div>

      <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '8px 14px', marginBottom: 10, fontSize: 13, color: '#2e7d32' }}>
        ✓ Nguyễn Thanh Đức (Sắt) đã xác nhận xong phần Phôi + Hàn.
      </div>

      {STAGES.map((cfg) => {
        const stageLines = lines[cfg.type] ?? [];
        const f = forms[cfg.type] ?? empty();
        return (
          <div key={cfg.type} style={{ border: `1px solid ${cfg.color}30`, borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ background: cfg.bg, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ background: cfg.color, color: '#fff', fontWeight: 700, borderRadius: 6, padding: '3px 14px', fontSize: 13 }}>{cfg.label}</span>
              <span style={{ fontSize: 12, color: '#555' }}>{cfg.desc}</span>
              <span style={{ marginLeft: 'auto', color: cfg.color, fontWeight: 600, fontSize: 12 }}>{stageLines.length} dòng</span>
            </div>

            <table style={{ margin: 0, borderRadius: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: 36, textAlign: 'center' }}>STT</th>
                  <th>Tên vật tư</th>
                  <th>Quy cách</th>
                  <th style={{ width: 60, textAlign: 'center' }}>ĐVT</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Định mức/bộ</th>
                  {!confirmed && <th style={{ width: 40 }}></th>}
                </tr>
              </thead>
              <tbody>
                {stageLines.length === 0 && (
                  <tr><td colSpan={6} style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '12px 16px' }}>Chưa có dòng nào.</td></tr>
                )}
                {stageLines.map((l, i) => (
                  <tr key={l.id}>
                    <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{l.name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{l.specs || '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: 13 }}>{l.unit}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{l.qty}</td>
                    {!confirmed && (
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-sm btn-red" style={{ padding: '2px 8px' }} onClick={() => deleteLine(cfg.type, l.id)}>×</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {!confirmed && (
              <div style={{ padding: '10px 14px', background: '#fafafa', borderTop: '1px dashed #e0e0e0' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="field" style={{ flex: 2, minWidth: 140 }}>
                    <label>Tên vật tư *</label>
                    <input className="input" placeholder="Thùng carton" value={f.name}
                      onChange={(e) => setForm(cfg.type, { name: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addLine(cfg.type)} />
                  </div>
                  <div className="field" style={{ flex: 1, minWidth: 100 }}>
                    <label>Quy cách</label>
                    <input className="input" placeholder="75×54×44cm" value={f.specs}
                      onChange={(e) => setForm(cfg.type, { specs: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addLine(cfg.type)} />
                  </div>
                  <div className="field" style={{ minWidth: 80 }}>
                    <label>ĐVT *</label>
                    <select value={f.unit} onChange={(e) => setForm(cfg.type, { unit: e.target.value })}>
                      {UNITS.map((u) => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ minWidth: 100 }}>
                    <label>Định mức/bộ *</label>
                    <input className="input" placeholder="1" value={f.qty}
                      onChange={(e) => setForm(cfg.type, { qty: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && addLine(cfg.type)} />
                  </div>
                  <button className="btn btn-sm btn-primary" style={{ marginBottom: 2 }} onClick={() => addLine(cfg.type)}>+ Thêm</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: confirmed ? '#2e7d32' : 'var(--muted)' }}>
          {confirmed ? '✓ Đã xác nhận định mức Bao bì + Đóng gói' : 'Kiểm tra lại trước khi xác nhận.'}
        </div>
        {confirmed
          ? <button className="btn btn-sm" onClick={() => setConfirmed(false)}>Bỏ xác nhận (để sửa)</button>
          : <button className="btn btn-green" style={{ minWidth: 200 }} onClick={() => setConfirmed(true)}>Xác nhận phần Phụ kiện ✓</button>
        }
      </div>
    </div>
  );
}
