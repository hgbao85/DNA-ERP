import type { User } from '../context/AuthContext';

/** Mỗi strategy định nghĩa điều kiện khớp và module tương ứng. */
interface ModuleStrategy {
  matches: (user: User) => boolean;
  module: string;
}

const MODULE_STRATEGIES: ModuleStrategy[] = [
  { matches: (u) => !!u.mfgRole,                             module: 'production'        },
  { matches: (u) => !!u.isProductPlanner,                    module: 'production_plan'   },
  { matches: (u) => !!u.isPurchaser,                         module: 'purchasing'        },
  { matches: (u) => u.role === 'WAREHOUSE_STAFF',            module: 'inbound_warehouse' },
  { matches: (u) => u.role === 'MANAGER' && !u.mfgRole,     module: 'manager'           },
];

/** Phân hệ mặc định sau đăng nhập — tài khoản chuyên biệt bị khóa vào 1 phân hệ. */
export function resolveDefaultModule(user: User | null): string | null {
  if (!user) return null;
  return MODULE_STRATEGIES.find((s) => s.matches(user))?.module ?? null;
}

export function isDirector(user: User | null): boolean {
  return user?.role === 'MANAGER' && !user?.mfgRole;
}
