'use client';

import { useState } from 'react';

type StockItem = {
  id: number; quantity: number;
  matCode: string; matName: string; unit: string; catName: string;
  warehouseName: string;
};

const INIT_STOCK: StockItem[] = [
  { id: 1, matCode: 'SAT-V18',  matName: 'Sắt V18 6.2cm',      unit: 'cây', catName: 'Sắt',             warehouseName: 'Kho Sắt',      quantity: 120 },
  { id: 2, matCode: 'SAT-HOP',  matName: 'Sắt hộp 25×50×0.8',  unit: 'cây', catName: 'Sắt',             warehouseName: 'Kho Sắt',      quantity: 48  },
  { id: 3, matCode: 'SON-EPX',  matName: 'Sơn epoxy bóng',      unit: 'kg',  catName: 'Dây / Sơn',       warehouseName: 'Kho Mận',      quantity: 35  },
  { id: 4, matCode: 'DAY-PP3',  matName: 'Dây đan PP 3mm',      unit: 'm',   catName: 'Dây / Sơn',       warehouseName: 'Kho Hồng',     quantity: 0   },
  { id: 5, matCode: 'PAT-GAN',  matName: 'Pát gân M8',          unit: 'cái', catName: 'Vật tư phụ kiện', warehouseName: 'Kho Mận',      quantity: 300 },
  { id: 6, matCode: 'CHOT-KH',  matName: 'Chốt khóa nhựa',     unit: 'cái', catName: 'Vật tư phụ kiện', warehouseName: 'Kho Mận',      quantity: 0   },
  { id: 7, matCode: 'THUNG-CT', matName: 'Thùng carton 75×54',  unit: 'cái', catName: 'Bao bì đóng gói', warehouseName: 'Kho Hân',      quantity: 80  },
  { id: 8, matCode: 'XOP-PE',   matName: 'Xốp PE bọc góc',      unit: 'tờ',  catName: 'Bao bì đóng gói', warehouseName: 'Kho Hân',      quantity: 200 },
];

export default function StockTab(_props: { reloadKey?: number; onChanged?: () => void }) {
  const [items, setItems] = useState<StockItem[]>(INIT_STOCK);
  const [edit,  setEdit]  = useState<Record<number, string>>({});

  const save = (id: number) => {
    const v = edit[id];
    if (v == null || v === '') return;
    setItems(prev => prev.map(it => it.id === id ? { ...it, quantity: Number(v) } : it));
    setEdit(e => { const n = { ...e }; delete n[id]; return n; });
  };

  return (
    <div>
      <div className="flow-note">
        Tồn kho thực tế của từng kho xưởng. Thủ kho cập nhật số lượng sau khi nhập/xuất.
      </div>

      <div className="card">
        <h3>Tồn kho ({items.length} dòng)</h3>
        <table>
          <thead>
            <tr><th>Kho</th><th>Vật tư</th><th>Loại</th><th>Tồn</th><th>ĐV</th><th>Cập nhật tồn</th></tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td>{it.warehouseName}</td>
                <td><span className="mono">{it.matCode}</span> {it.matName}</td>
                <td><span className="chip">{it.catName}</span></td>
                <td style={{ fontWeight: 700, color: it.quantity > 0 ? '#1b5e20' : '#9aa0a8' }}>{it.quantity}</td>
                <td className="muted">{it.unit}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input className="input" style={{ minWidth: 70, padding: '4px 8px' }}
                      value={edit[it.id] ?? ''}
                      onChange={e => setEdit(s => ({ ...s, [it.id]: e.target.value }))}
                      placeholder={String(it.quantity)}
                      onKeyDown={e => e.key === 'Enter' && save(it.id)}
                    />
                    <button className="btn btn-sm" onClick={() => save(it.id)}>Lưu</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
