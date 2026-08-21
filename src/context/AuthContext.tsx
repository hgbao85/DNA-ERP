'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, logoutUser } from '../services/api';
import { SESSION_EXPIRED_EVENT } from '../services/core/http';
import { tokenStorage } from '../services/core/tokenStorage';
import { normalizeUser } from '../utils/normalizeUser';

export type MfgRole = 'PRODUCTION_MANAGER' | 'PHOI' | 'HAN' | 'SON' | 'KCS' | 'SPEC_STEEL' | 'SPEC_ACCESSORY' | 'SPEC_PACKAGING';

// 3 nhóm kho thật + kho thành phẩm phụ tạo động (id dạng 'thanh-pham-{n}') —
// tài khoản kho bị giới hạn vào đúng 1 nhóm (null = tổng kho, thấy hết). Giữ literal
// union cho gợi ý IDE nhưng vẫn nhận mọi chuỗi để hỗ trợ kho thành phẩm tạo thêm.
export type WarehouseScope = 'phoi-son-han' | 'vat-tu-tp' | 'thanh-pham' | (string & {});

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
  warehouseScope?: WarehouseScope | null;
  isPurchaser?: boolean;
  isProductPlanner?: boolean;
  isSale?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  isBoss: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Khôi phục phiên đăng nhập. Access token nằm trong cookie httpOnly (JS không đọc được) nên
 * không còn cách nào "check trước" - luôn gọi thẳng getProfile(), coi 401 là chưa đăng nhập.
 * Trả về Promise<User | null> thay vì set state trực tiếp - CHỈ resolve với giá trị cuối cùng đã
 * xác minh qua getProfile(), không có đường nào để "lộ" 1 phiên chưa xác minh ra ngoài (khác cách
 * cũ: set token ngay rồi rollback nếu verify thất bại, khiến trong lúc chờ verify, mọi consumer
 * khác đọc context tưởng đã đăng nhập xong và gọi API luôn - gây 401 hàng loạt ngay trên /login).
 */
export async function restoreSession(): Promise<User | null> {
  try {
    const profile = await getProfile();
    const freshUser = normalizeUser(profile);
    tokenStorage.setUser(freshUser);
    return freshUser;
  } catch (e) {
    console.error('Không thể khôi phục phiên đăng nhập', e);
    tokenStorage.clearUser();
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    restoreSession().then((restoredUser) => {
      if (restoredUser) {
        setIsAuthenticated(true);
        setUser(restoredUser);
      }
      setLoading(false);
    });
  }, []);

  // core/http.ts phát event này khi access token hết hạn VÀ refresh cũng thất bại
  // (refresh token hết hạn/không hợp lệ) — tự đăng xuất + điều hướng về /login.
  useEffect(() => {
    const onSessionExpired = () => {
      setIsAuthenticated(false);
      setUser(null);
      router.replace('/login');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [router]);

  const login = (newUser: User) => {
    const normalized = normalizeUser(newUser);
    tokenStorage.setUser(normalized);
    setIsAuthenticated(true);
    setUser(normalized);
  };

  const logout = () => {
    // Best-effort: thu hồi refresh token ở BE (cookie tự đính kèm), không chặn UI chờ kết quả.
    void logoutUser().catch(() => {});
    tokenStorage.clearUser();
    setIsAuthenticated(false);
    setUser(null);
  };

  const isBoss = user?.role === 'BOSS';

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, isBoss, loading }}>
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
