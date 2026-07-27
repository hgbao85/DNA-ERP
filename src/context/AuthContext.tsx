'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, logoutUser } from '../services/api';
import { SESSION_EXPIRED_EVENT } from '../services/core/http';
import { tokenStorage } from '../services/core/tokenStorage';
import { normalizeUser } from '../utils/normalizeUser';

export type MfgRole = 'PRODUCTION_MANAGER' | 'PHOI' | 'HAN' | 'SON' | 'KCS' | 'WEAVING_MANAGER' | 'WEAVING_EXPORT' | 'BOM_MANAGER' | 'SPEC_STEEL'| 'SPEC_WIRE_PAINT' | 'SPEC_ACCESSORY' | 'SPEC_PACKAGING';

export type PhoiOperation = 'CAT' | 'TOP_DAU' | 'UON' | 'DAP' | 'DUC_LO' | 'BAN_TAN';

// 5 nhóm kho cố định + kho thành phẩm phụ tạo động (id dạng 'thanh-pham-{n}') —
// tài khoản kho bị giới hạn vào đúng 1 nhóm (null = tổng kho, thấy hết). Giữ literal
// union cho gợi ý IDE nhưng vẫn nhận mọi chuỗi để hỗ trợ kho thành phẩm tạo thêm.
export type WarehouseScope = 'phu-kien' | 'bao-bi' | 'day' | 'sat' | 'thanh-pham' | 'vat-tu-tp' | 'phoi-son-han' | (string & {});

// ─── Interface segregation (documentation) ───────────────────────────────────
// Các interface dưới đây mô tả từng nhóm role; dùng làm type hint khi cần
// thu hẹp kiểu (type narrowing) trong code mới.

export interface BaseUser {
  id: number;
  name: string;
  email: string;
}

export interface BossUser extends BaseUser {
  role: 'BOSS';
}

/** Quản trị hệ thống — tách biệt khỏi Giám đốc, chỉ quản trị (không duyệt nghiệp vụ). */
export interface AdminUser extends BaseUser {
  role: 'ADMIN';
}

export interface MfgUser extends BaseUser {
  role: 'WAREHOUSE_STAFF';
  mfgRole: MfgRole;
  phoiOperation?: PhoiOperation | null;
}

export interface WarehouseUser extends BaseUser {
  role: 'WAREHOUSE_STAFF';
  mfgRole?: null;
  warehouseScope: WarehouseScope | null;
  isPurchaser?: boolean;
  isProductPlanner?: boolean;
  isSale?: boolean;
}

/**
 * Flat interface tương thích ngược với toàn bộ consumer code.
 * Dùng BossUser / MfgUser / WarehouseUser khi muốn narrowing chặt hơn.
 */
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'BOSS' | 'WAREHOUSE_STAFF' | 'ADMIN';
  mfgRole?: MfgRole | null;
  phoiOperation?: PhoiOperation | null;
  warehouseScope?: WarehouseScope | null;
  isPurchaser?: boolean;
  isProductPlanner?: boolean;
  isSale?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isBoss: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const storedToken = tokenStorage.getAccessToken();
      if (!storedToken) {
        setLoading(false);
        return;
      }

      setToken(storedToken);
      try {
        const profile = await getProfile();
        const freshUser = normalizeUser(profile);
        setUser(freshUser);
        tokenStorage.setUser(freshUser);
      } catch (e) {
        console.error('Không thể khôi phục phiên đăng nhập', e);
        tokenStorage.clear();
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  // core/http.ts phát event này khi access token hết hạn VÀ refresh cũng thất bại
  // (refresh token hết hạn/không hợp lệ) — tự đăng xuất + điều hướng về /login.
  useEffect(() => {
    const onSessionExpired = () => {
      setToken(null);
      setUser(null);
      router.replace('/login');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [router]);

  const login = (newToken: string, newUser: User) => {
    const normalized = normalizeUser(newUser);
    tokenStorage.setAccessToken(newToken);
    tokenStorage.setUser(normalized);
    setToken(newToken);
    setUser(normalized);
  };

  const logout = () => {
    // Best-effort: thu hồi refresh token ở BE, không chặn UI chờ kết quả — refreshToken
    // được đọc đồng bộ ngay khi gọi (trước dòng tokenStorage.clear() dưới đây) nên không
    // có race giữa việc đọc token và việc xoá token.
    void logoutUser().catch(() => {});
    tokenStorage.clear();
    setToken(null);
    setUser(null);
  };

  const isBoss = user?.role === 'BOSS';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isBoss, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được sử dụng bên trong AuthProvider');
  }
  return context;
};
