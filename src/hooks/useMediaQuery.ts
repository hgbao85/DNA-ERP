import { useEffect, useState } from 'react';

/** Mốc responsive dùng chung - gọn (drawer thay sidebar) và điện thoại (thẻ thay bảng). */
export const BREAKPOINT_COMPACT = 900;
export const BREAKPOINT_MOBILE = 640;

/** true khi viewport hẹp hơn `maxWidth` px. Render đầu (trước khi mount) luôn trả false = layout desktop. */
export function useMaxWidth(maxWidth: number): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${maxWidth - 0.02}px)`);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [maxWidth]);

  return matches;
}

export const useIsCompact = () => useMaxWidth(BREAKPOINT_COMPACT);
export const useIsMobile = () => useMaxWidth(BREAKPOINT_MOBILE);
