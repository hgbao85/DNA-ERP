'use client';

import { useEffect, useRef, useState } from 'react';
import { GUIDE_GROUPS } from './content';
import { searchArticles, type SearchHit } from './search';
import { GuideIcon, Search, X, Command, CornerDownLeft, ArrowUp, ArrowDown } from './icons';

interface Props {
  onSelect: (id: string) => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

const DEFAULT_SUGGESTIONS: SearchHit[] = GUIDE_GROUPS.flatMap(g => g.articles.slice(0, 1).map(a => ({ group: g, article: a, score: 0 })));
const CLOSE_ANIM_MS = 130;

/** Command palette kiểu Linear/Notion — Ctrl+K hoặc "/" để mở, gõ để tìm, mũi tên + Enter để chọn.
 * Có animation vào/ra (không chỉ hiện/biến mất tức thì) — giữ component mounted thêm một nhịp
 * ngắn khi đóng để kịp chạy hết hiệu ứng thoát. */
export default function CommandPalette({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results: SearchHit[] = query.trim() ? searchArticles(GUIDE_GROUPS, query) : DEFAULT_SUGGESTIONS;

  function requestClose() {
    if (!open || closing) return;
    setClosing(true);
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_ANIM_MS);
  }

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) requestClose(); else setOpen(true);
        return;
      }
      if (e.key === '/' && !isTypingTarget(document.activeElement) && !open) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing]);

  // Focus vào ô tìm khi mở, và trả focus lại đúng chỗ cũ khi đóng hẳn — hành vi chuẩn cho hộp
  // thoại modal (a11y): người dùng bàn phím không bị "lạc" ra ngoài trang sau khi đóng.
  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement as HTMLElement;
      // setQuery/setIndex ở đây gắn liền với việc mở dialog (cùng 1 sự kiện với focus + timeout
      // ngay dưới, phải nằm trong effect vì đụng DOM) — reset lại trạng thái ô tìm mỗi lần mở,
      // không phải tác dụng phụ tách rời được.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setIndex(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
    lastFocusedRef.current?.focus?.();
  }, [open]);

  if (!open) return null;

  function choose(id: string) {
    onSelect(id);
    requestClose();
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { requestClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); const hit = results[index]; if (hit) choose(hit.article.id); }
  }

  // Nhốt Tab bên trong hộp thoại (focus trap) — không cho Tab lọt ra nền phía sau khi đang mở.
  function onDialogKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])');
    if (!focusables || focusables.length === 0) return;
    const list = Array.from(focusables);
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  return (
    <div
      onClick={requestClose}
      className={closing ? 'dna-cp-overlay-out' : 'dna-cp-overlay-in'}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '12vh 16px 0',
      }}
    >
      <style>{`
        @keyframes dnaCpOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dnaCpOverlayOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes dnaCpDialogIn { from { opacity: 0; transform: translateY(-10px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes dnaCpDialogOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(-10px) scale(0.97); } }
        .dna-cp-overlay-in { animation: dnaCpOverlayIn 0.15s ease forwards; }
        .dna-cp-overlay-out { animation: dnaCpOverlayOut ${CLOSE_ANIM_MS}ms ease forwards; }
        .dna-cp-dialog-in { animation: dnaCpDialogIn 0.16s ease forwards; }
        .dna-cp-dialog-out { animation: dnaCpDialogOut ${CLOSE_ANIM_MS}ms ease forwards; }
        @media (prefers-reduced-motion: reduce) {
          .dna-cp-overlay-in, .dna-cp-overlay-out, .dna-cp-dialog-in, .dna-cp-dialog-out { animation: none !important; }
        }
      `}</style>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm nhanh trong hướng dẫn"
        onClick={e => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        className={closing ? 'dna-cp-dialog-out' : 'dna-cp-dialog-in'}
        style={{
          width: '100%', maxWidth: 560, background: 'var(--surface)', borderRadius: 14,
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)', overflow: 'hidden', border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={16} color="var(--text3)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setIndex(0); }}
            onKeyDown={onInputKeyDown}
            aria-label="Từ khoá tìm kiếm"
            placeholder="Tìm hướng dẫn, tên nút, thông báo lỗi..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, background: 'transparent', color: 'var(--text)' }}
          />
          <button onClick={requestClose} aria-label="Đóng ô tìm kiếm" style={{ border: 'none', background: 'var(--surface2)', borderRadius: 6, padding: 4, cursor: 'pointer', display: 'flex' }}>
            <X size={14} color="var(--text3)" />
          </button>
        </div>

        <div style={{ maxHeight: '52vh', overflow: 'auto', padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>
              Không tìm thấy kết quả cho &quot;{query}&quot;
            </div>
          ) : (
            <>
              {!query.trim() && (
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', padding: '8px 10px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Gợi ý nhanh — mỗi nhóm một bài
                </div>
              )}
              {results.map((h, i) => (
                <button
                  key={h.article.id}
                  onClick={() => choose(h.article.id)}
                  onMouseEnter={() => setIndex(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px',
                    border: 'none', borderRadius: 8, cursor: 'pointer',
                    background: i === index ? 'var(--surface2)' : 'transparent',
                  }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: 8, background: 'var(--surface2)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <GuideIcon name={h.group.icon} size={14} color="var(--text2)" />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.article.title}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{h.group.title}</span>
                  </span>
                  {i === index && <CornerDownLeft size={13} color="var(--text3)" style={{ flexShrink: 0 }} />}
                </button>
              ))}
            </>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '9px 16px', borderTop: '1px solid var(--border)',
          background: 'var(--surface2)', fontSize: 11, color: 'var(--text3)',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ArrowUp size={11} /><ArrowDown size={11} /> di chuyển</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CornerDownLeft size={11} /> chọn</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}><Command size={11} />K để mở lại</span>
        </div>
      </div>
    </div>
  );
}
