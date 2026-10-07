'use client';

import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { realtime } from './realtimeClient';

/**
 * Mở/đóng kết nối realtime theo phiên đăng nhập. Đặt bên trong AuthProvider (cần token).
 * Không có state riêng - trạng thái và sự kiện đi qua singleton `realtime` và hooks.ts.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  useEffect(() => {
    if (token) realtime.start();
    else realtime.stop();
  }, [token]);

  useEffect(() => () => realtime.stop(), []);

  return <>{children}</>;
}
