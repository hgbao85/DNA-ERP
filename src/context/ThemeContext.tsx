'use client';

import React, { useCallback, useEffect, useSyncExternalStore } from 'react';

/** Chỉ 2 lựa chọn (2026-10-12, theo yêu cầu): đã bỏ 'system' (tự theo sáng/tối của hệ điều hành).
 *  Thiết bị chưa từng chọn gì LUÔN là giao diện sáng, kể cả khi hệ điều hành đang để tối. */
export type ThemeMode = 'light' | 'dark';
export type ResolvedTheme = ThemeMode;

export const THEME_STORAGE_KEY = 'dna-theme';

/** Chạy trong <head> TRƯỚC khi trang vẽ — đặt sẵn data-theme để người dùng chế độ tối không bị
 *  nháy trắng lúc tải trang (React hydrate xong mới chạy effect thì đã muộn). Phải tự chứa, không
 *  import được gì, nên logic đọc localStorage lặp lại với readMode() bên dưới. */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `document.documentElement.setAttribute('data-theme',m==='dark'?'dark':'light');}catch(e){}})();`;

/** Chưa lưu gì (thiết bị mới, hoặc người trước đây để "Theo hệ thống" - khi đó không lưu khoá nào)
 *  hay giá trị lạ đều về 'light'. */
function readMode(): ThemeMode {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

// Lựa chọn lưu ở localStorage; listeners báo cho mọi nơi dùng useTheme() trong tab hiện tại,
// sự kiện 'storage' đồng bộ sang tab khác (vd. tab Hướng dẫn mở riêng).
const listeners = new Set<() => void>();
function subscribeMode(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === THEME_STORAGE_KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

function writeMode(next: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch { /* chế độ riêng tư / chặn storage: không lưu được, bỏ qua */ }
  listeners.forEach(l => l());
}

export function useTheme() {
  // SSR không biết lựa chọn của người dùng nên trả 'light'; script chống nháy đã đặt đúng
  // data-theme từ trước nên giao diện không bị nháy trong lúc hydrate.
  const mode = useSyncExternalStore(subscribeMode, readMode, () => 'light' as ThemeMode);

  /** Sáng ↔ Tối. */
  const cycleMode = useCallback(() => writeMode(mode === 'dark' ? 'light' : 'dark'), [mode]);

  return { mode, resolved: mode as ResolvedTheme, setMode: writeMode, cycleMode };
}

/** Gắn data-theme lên <html> theo lựa chọn hiện tại — đặt một lần ở layout gốc. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolved } = useTheme();
  useEffect(() => {
    // Đọc lại giá trị thật thay vì dùng `resolved`: ở lần render hydrate, `resolved` còn là giá trị
    // server ('light') — gắn nó lên <html> sẽ làm người dùng chế độ tối nháy trắng một khung hình.
    document.documentElement.setAttribute('data-theme', readMode());
  }, [resolved]);
  return <>{children}</>;
}
