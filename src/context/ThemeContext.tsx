'use client';

import React, { useCallback, useEffect, useSyncExternalStore } from 'react';

/** 'system' = theo cài đặt sáng/tối của hệ điều hành (và tự đổi khi hệ điều hành đổi). */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'dna-theme';
const MODES: ThemeMode[] = ['light', 'dark', 'system'];
const DARK_QUERY = '(prefers-color-scheme: dark)';

/** Chạy trong <head> TRƯỚC khi trang vẽ — đặt sẵn data-theme để người dùng chế độ tối không bị
 *  nháy trắng lúc tải trang (React hydrate xong mới chạy effect thì đã muộn). Phải tự chứa, không
 *  import được gì, nên logic đọc localStorage/matchMedia lặp lại với readMode() bên dưới. */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_STORAGE_KEY}');` +
  `var d=m==='dark'||((m!=='light')&&window.matchMedia('${DARK_QUERY}').matches);` +
  `document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
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

function subscribeSystem(cb: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function writeMode(next: ThemeMode) {
  try {
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch { /* chế độ riêng tư / chặn storage: không lưu được, bỏ qua */ }
  listeners.forEach(l => l());
}

export function useTheme() {
  // SSR không biết lựa chọn của người dùng nên trả 'system'/light; script chống nháy đã đặt đúng
  // data-theme từ trước nên giao diện không bị nháy trong lúc hydrate.
  const mode = useSyncExternalStore(subscribeMode, readMode, () => 'system' as ThemeMode);
  const systemDark = useSyncExternalStore(subscribeSystem, () => window.matchMedia(DARK_QUERY).matches, () => false);
  const resolved: ResolvedTheme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  /** Sáng → Tối → Theo hệ thống → Sáng... */
  const cycleMode = useCallback(() => writeMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]), [mode]);

  return { mode, resolved, setMode: writeMode, cycleMode };
}

/** Gắn data-theme lên <html> theo lựa chọn hiện tại — đặt một lần ở layout gốc. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { resolved } = useTheme();
  useEffect(() => {
    // Đọc lại giá trị thật thay vì dùng `resolved`: ở lần render hydrate, `resolved` còn là giá trị
    // server ('light') — gắn nó lên <html> sẽ làm người dùng chế độ tối nháy trắng một khung hình.
    const mode = readMode();
    const dark = mode === 'dark' || (mode === 'system' && window.matchMedia(DARK_QUERY).matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [resolved]);
  return <>{children}</>;
}
