'use client';

import { useState } from 'react';

type Cat = { code: string; name: string };
type Mat = {
  id: number; code: string; name: string; unit: string; categoryCode: string;
  specifications: string; thickness: string; categoryName: string;
};

const CATS: Cat[] = [
  { code: 'SAT',      name: 'Sắt'             },
  { code: 'DAY',      name: 'Dây / Sơn'       },
  { code: 'PHU_KIEN', name: 'Vật tư phụ kiện' },
  { code: 'BAO_BI',   name: 'Bao bì đóng gói' },
];

const INIT_MATS: Mat[] = [
  { id: 1, code: 'SAT-V18',  name: 'Sắt V18 6.2cm',       unit: 'cây', categoryCode: 'SAT',      specifications: 'V18 × 620cm',    thickness: '1.8', categoryName: 'Sắt'             },
  { id: 2, code: 'SAT-HOP',  name: 'Sắt hộp 25×50×0.8',   unit: 'cây', categoryCode: 'SAT',      specifications: '25×50×0.8mm',    thickness: '0.8', categoryName: 'Sắt'             },
  { id: 3, code: 'SAT-ONG',  name: 'Sắt ống tròn Ø25',    unit: 'cây', categoryCode: 'SAT',      specifications: 'Ø25 × 600cm',    thickness: '1.2', categoryName: 'Sắt'             },
  { id: 4, code: 'SON-EPX',  name: 'Sơn epoxy bóng',       unit: 'kg',  categoryCode: 'DAY',      specifications: '2 lít / thùng',  thickness: '',    categoryName: 'Dây / Sơn'       },
  { id: 5, code: 'DAY-PP3',  name: 'Dây đan PP 3mm',       unit: 'm',   categoryCode: 'DAY',      specifications: 'PP, cuộn 500m',  thickness: '',    categoryName: 'Dây / Sơn'       },
  { id: 6, code: 'PAT-GAN',  name: 'Pát gân M8',           unit: 'cái', categoryCode: 'PHU_KIEN', specifications: 'M8 × 30mm',      thickness: '',    categoryName: 'Vật tư phụ kiện' },
  { id: 7, code: 'CHOT-KH',  name: 'Chốt khóa nhựa',      unit: 'cái', categoryCode: 'PHU_KIEN', specifications: 'PP, màu đen',    thickness: '',    categoryName: 'Vật tư phụ kiện' },
  { id: 8, code: 'THUNG-CT', name: 'Thùng carton 75×54',   unit: 'cái', categoryCode: 'BAO_BI',   specifications: '75×54×44cm',     thickness: '',    categoryName: 'Bao bì đóng gói' },
  { id: 9, code: 'XOP-PE',   name: 'Xốp PE bọc góc',       unit: 'tờ',  categoryCode: 'BAO_BI',   specifications: '5mm, trắng',     thickness: '',    categoryName: 'Bao bì đóng gói' },
];

export default function MaterialsTab({
  categoryCode,
}: {
  reloadKey?: number;
  onChanged?: () => void;
  categoryCode: string | null;
}) {
  const [mats, setMats] = useState<Mat[]>(INIT_MATS);
  const [nextId, setNextId] = useState(100);

  const [code,      setCode]      = useState('');
  const [name,      setName]      = useState('');
  const [unit,      setUnit]      = useState('cm');
  const [catCode,   setCatCode]   = useState(categoryCode ?? '');
  const [specs,     setSpecs]     = useState('');
  const [thickness, setThickness] = useState('');
  const [err,       setErr]       = useState('');

  const cats = categoryCode
    ? CATS.filter(c => c.code === categoryCode)
    : CATS;

  const activeCat = CATS.find(c => c.code === catCode);
  const isSat = catCode === 'SAT';

  const visibleMats = categoryCode
    ? mats.filter(m => m.categoryCode === categoryCode)
    : mats;

  const submit = () => {
    setErr('');
    if (!code.trim() || !name.trim() || !unit.trim() || !catCode) {
      setErr('Nhập đủ mã, tên, đơn vị, loại vật tư'); return;
    }
    setMats(prev => [...prev, {
      id: nextId,
      code: code.trim(), name: name.trim(), unit: unit.trim(),
      categoryCode: catCode, specifications: specs.trim(),
      thickness: thickness.trim(),
      categoryName: activeCat?.name ?? catCode,
    }]);
    setNextId(n => n + 1);
    setCode(''); setName(''); setSpecs(''); setThickness('');
    if (!categoryCode) setCatCode('');
  };

  return (
    <div>
      <div className="flow-note">
        {categoryCode
          ? <>Bạn chỉ thấy và thêm được vật tư loại <b>{cats[0]?.name ?? categoryCode}</b>.</>
          : <>Mỗi loại vật tư có form khác nhau (Sắt có độ dày) — tất cả lưu chung vào <b>1 catalog</b>.</>}
      </div>

      <div className="card">
        <h3>Thêm vật tư vào catalog</h3>
        <div className="row">
          <div className="field"><label>Mã</label><input className="input" value={code} onChange={e => setCode(e.target.value)} placeholder="SAT-20" /></div>
          <div className="field"><label>Tên</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ống sắt 20×20" /></div>
          <div className="field">
            <label>Loại</label>
            {categoryCode && cats.length === 1 ? (
              <div style={{ padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}>
                {cats[0].name}
              </div>
            ) : (
              <select value={catCode} onChange={e => setCatCode(e.target.value)}>
                <option value="">— chọn —</option>
                {cats.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div className="field"><label>Đơn vị</label><input className="input" style={{ minWidth: 80 }} value={unit} onChange={e => setUnit(e.target.value)} placeholder="cm / kg / cái" /></div>
        </div>

        {catCode && (
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>Quy cách</label><input className="input" style={{ width: '100%' }} value={specs} onChange={e => setSpecs(e.target.value)} placeholder="20×20×1.2mm" /></div>
            {isSat && <div className="field"><label>Độ dày (mm)</label><input className="input" style={{ minWidth: 80 }} value={thickness} onChange={e => setThickness(e.target.value)} placeholder="1.2" /></div>}
          </div>
        )}

        {err && <div className="err">{err}</div>}
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={submit}>+ Thêm vật tư</button>
        </div>
      </div>

      <div className="card">
        <h3>Catalog vật tư ({visibleMats.length})</h3>
        {visibleMats.length === 0 ? (
          <div className="empty">Chưa có vật tư.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Mã</th><th>Tên</th><th>Loại</th><th>ĐV</th><th>Quy cách</th><th>Đặc thù</th></tr>
            </thead>
            <tbody>
              {visibleMats.map(m => (
                <tr key={m.id}>
                  <td className="mono">{m.code}</td>
                  <td>{m.name}</td>
                  <td><span className="chip">{m.categoryName}</span></td>
                  <td>{m.unit}</td>
                  <td className="muted">{m.specifications || '—'}</td>
                  <td className="muted">{m.thickness ? `dày ${m.thickness}mm` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
