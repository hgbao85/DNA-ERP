'use client';

export type DemoRole = 'dinh-muc' | 'ke-hoach' | 'kho';

export type DemoUser = {
  role: DemoRole;
  name: string;
  categoryCode: string | null; // SAT | DAY | PHU_KIEN | BAO_BI | null (không giới hạn)
};

type RoleCard = {
  id: DemoRole;
  label: string;
  sub: string;
  color: string;
  users: { name: string; badge: string; categoryCode: string | null }[];
};

const ROLES: RoleCard[] = [
  {
    id: 'dinh-muc',
    label: 'Quản lý định mức',
    sub: 'Mỗi người chỉ nhập vật tư + định mức thuộc category của mình',
    color: '#1565c0',
    users: [
      { name: 'Nguyễn Thanh Đức', badge: 'Sắt',    categoryCode: 'SAT' },
      { name: 'Đoàn Thị Hồng',    badge: 'Dây/Sơn', categoryCode: 'DAY' },
      { name: 'Trần Văn Nhơn',    badge: 'Phụ kiện', categoryCode: 'PHU_KIEN' },
    ],
  },
  {
    id: 'ke-hoach',
    label: 'Kế hoạch sản xuất',
    sub: 'Xem định mức đang chờ · Duyệt hoặc từ chối · Theo dõi trạng thái',
    color: '#6a1b9a',
    users: [
      { name: 'Dương Vũ Tổ Ngân', badge: 'Kế hoạch', categoryCode: null },
    ],
  },
  {
    id: 'kho',
    label: 'Thủ kho / Quản lý kho',
    sub: 'Xem tồn kho · Cập nhật số lượng nhập/xuất',
    color: '#2e7d32',
    users: [
      { name: 'Lê Trọng Thắng',     badge: 'Kho tổng',    categoryCode: null },
      { name: 'Bùi Thị Kiều Ngân',  badge: 'Kho phụ kiện', categoryCode: null },
      { name: 'Đặng Thị Thúy Hân',  badge: 'Kho TP',      categoryCode: null },
      { name: 'Lý Thị Thảo Trinh',  badge: 'Kho TP',      categoryCode: null },
    ],
  },
];

export default function LoginPage({ onLogin }: { onLogin: (user: DemoUser) => void }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--bg)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>
        Demo · Hệ thống Định mức
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Đăng nhập</div>
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 36 }}>Chọn tài khoản để vào demo</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 600 }}>
        {ROLES.map((r) => (
          <div key={r.id} style={{
            background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: r.color, marginBottom: 3 }}>{r.label}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{r.sub}</div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {r.users.map((u) => (
                <button
                  key={u.name}
                  onClick={() => onLogin({ role: r.id, name: u.name, categoryCode: u.categoryCode })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'var(--bg)', border: `1.5px solid ${r.color}`,
                    borderRadius: 8, padding: '7px 14px',
                    cursor: 'pointer', transition: 'background .15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = r.color + '18')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{u.name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: '#fff',
                    background: r.color, borderRadius: 4, padding: '2px 7px',
                  }}>{u.badge}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, fontSize: 12, color: 'var(--muted)' }}>
        Demo · Mock data · Không kết nối DB
      </div>
    </div>
  );
}
