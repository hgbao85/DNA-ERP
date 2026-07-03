'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getProfile } from '../services/api';
import { normalizeUser } from '../utils/normalizeUser';

export type MfgRole = 'PRODUCTION_MANAGER' | 'FACTORY_SALES' | 'PHOI' | 'HAN' | 'SON' | 'QC' | 'WEAVING_MANAGER' | 'WEAVING_EXPORT' | 'BOM_MANAGER' | 'SPEC_STEEL'| 'SPEC_WIRE_PAINT' | 'SPEC_ACCESSORY' | 'SPEC_PACKAGING';

export type PhoiOperation = 'CAT' | 'TOP_DAU' | 'UON' | 'DAP' | 'DUC_LO' | 'BAN_TAN';

// 5 nhóm kho — tài khoản kho bị giới hạn vào đúng 1 nhóm (null = tổng kho, thấy hết)
export type WarehouseScope = 'phu-kien' | 'bao-bi' | 'day' | 'sat' | 'thanh-pham' | 'bao-bi-tp';

// ─── Interface segregation (documentation) ───────────────────────────────────
// Các interface dưới đây mô tả từng nhóm role; dùng làm type hint khi cần
// thu hẹp kiểu (type narrowing) trong code mới.

export interface BaseUser {
  id: number;
  name: string;
  email: string;
}

export interface ManagerUser extends BaseUser {
  role: 'MANAGER';
}

export interface SalesUser extends BaseUser {
  role: 'SALES';
  salesType: 'RETAIL' | 'WHOLESALE' | null;
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
}

/**
 * Flat interface tương thích ngược với toàn bộ consumer code.
 * Dùng ManagerUser / SalesUser / MfgUser / WarehouseUser khi muốn narrowing chặt hơn.
 */
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'MANAGER' | 'SALES' | 'WAREHOUSE_STAFF';
  salesType?: 'RETAIL' | 'WHOLESALE' | null;
  mfgRole?: MfgRole | null;
  phoiOperation?: PhoiOperation | null;
  warehouseScope?: WarehouseScope | null;
  isPurchaser?: boolean;
  isProductPlanner?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isManager: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('access_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      setToken(storedToken);
      try {
        const profile = await getProfile();
        const freshUser = normalizeUser(profile as unknown as Record<string, unknown>);
        setUser(freshUser);
        localStorage.setItem('user_info', JSON.stringify(freshUser));
      } catch (e) {
        console.error('Không thể khôi phục phiên đăng nhập', e);
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, []);

  const login = (newToken: string, newUser: User) => {
    const normalized = normalizeUser(newUser as unknown as Record<string, unknown>);
    localStorage.setItem('access_token', newToken);
    localStorage.setItem('user_info', JSON.stringify(normalized));
    setToken(newToken);
    setUser(normalized);
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_info');
    setToken(null);
    setUser(null);
  };

  const isManager = user?.role === 'MANAGER';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isManager, loading }}>
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
