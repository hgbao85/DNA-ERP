'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAuth, type User } from '../../../context/AuthContext';
import { GUIDE_GROUPS, allArticles } from './content';
import type { GuideGroup, GuideRole } from './types';
import { roleInfo, GUIDE_VERIFIED_DATE } from './types';
import { searchArticles } from './search';
import { markVisited, isVisited, getLastVisited } from './progress';
import ArticleView, { type TabKey } from './ArticleView';
import ErrorsHub from './ErrorsHub';
import CommandPalette from './CommandPalette';
import {
  GuideIcon, Search, X, ChevronDown, ChevronRight, ArrowLeft, ArrowRight,
  BookOpen, Menu, Compass, Home, Command, Check, Sparkles, FileWarning, AlertTriangle,
} from './icons';

interface Props {
  onBack?: () => void;
}

const ARTICLE_QUERY_KEY = 'a';
const TAB_QUERY_KEY = 't';
const VIEW_QUERY_KEY = 'v';

/** Suy ra (các) vai trò Hướng dẫn của người đang đăng nhập — chỉ để làm nổi bật nội dung liên
 * quan trước, KHÔNG dùng để chặn xem — mọi người xem được toàn bộ tài liệu. */
function guideRolesOf(user: User | null): GuideRole[] {
  if (!user) return [];
  const roles: GuideRole[] = [];
  if (user.role === 'ADMIN') roles.push('admin');
  if (user.role === 'BOSS' && !user.mfgRole) roles.push('boss');
  if (user.isSale) roles.push('sales');
  if (user.isProductPlanner) roles.push('khsx');
  if (user.isPurchaser) roles.push('purchasing');
  switch (user.mfgRole) {
    case 'PRODUCTION_MANAGER': roles.push('qlsx'); break;
    case 'PHOI': roles.push('phoi'); break;
    case 'HAN': roles.push('han'); break;
    case 'SON': roles.push('son'); break;
    case 'KCS': roles.push('kcs'); break;
    case 'SPEC_STEEL': roles.push('spec_steel'); break;
    case 'SPEC_ACCESSORY':
    case 'SPEC_PACKAGING':
      roles.push('spec_detail');
      break;
  }
  if (user.role === 'WAREHOUSE_STAFF' && !user.mfgRole && !user.isPurchaser && !user.isProductPlanner && !user.isSale) {
    roles.push('warehouse');
  }
  return roles;
}

/** Đọc thẳng tham số `a` trên URL, KHÔNG kiểm tra tồn tại — việc phân biệt "không có tham số"
 * với "có tham số nhưng không khớp bài nào" (link cũ/hỏng) do nơi gọi tự xử lý, để còn báo
 * cho người dùng biết thay vì âm thầm rơi về Trang chủ. */
function readArticleIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(ARTICLE_QUERY_KEY);
}

function readTabFromUrl(): TabKey | undefined {
  if (typeof window === 'undefined') return undefined;
  const t = new URLSearchParams(window.location.search).get(TAB_QUERY_KEY);
  return t === 'errors' || t === 'statuses' ? t : undefined;
}

function readErrorsHubFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get(VIEW_QUERY_KEY) === 'errors';
}

function GroupCard({ group, onOpen, delayMs = 0 }: { group: GuideGroup; onOpen: () => void; delayMs?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="dna-guide-card-in"
      style={{
        textAlign: 'left', padding: '17px 18px 16px', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)', borderTop: `3px solid ${group.color}`,
        background: 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 9,
        boxShadow: hover ? '0 10px 24px rgba(15,23,42,0.09)' : '0 1px 2px rgba(15,23,42,0.04)',
        transform: hover ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease',
        animationDelay: `${delayMs}ms`,
      }}
    >
      <span style={{
        width: 36, height: 36, borderRadius: 10, background: group.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <GuideIcon name={group.icon} size={18} color={group.color} />
      </span>
      <span style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--text)' }}>{group.title}</span>
      <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55 }}>{group.description}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: group.color, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
        {group.articles.length} bài viết <ArrowRight size={11} />
      </span>
    </button>
  );
}

function ContinueReadingCard({ onOpen }: { onOpen: (id: string) => void }) {
  const [found, setFound] = useState<{ id: string; title: string; group: GuideGroup } | null>(null);

  useEffect(() => {
    const id = getLastVisited();
    if (!id) return;
    const hit = allArticles().find(x => x.article.id === id);
    // Đọc localStorage (hệ thống ngoài React, không có trên server) rồi mới setState được —
    // không có cách nào tính giá trị này trong lúc render mà không gây lệch hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hit) setFound({ id: hit.article.id, title: hit.article.title, group: hit.group });
  }, []);

  if (!found) return null;
  return (
    <button
      onClick={() => onOpen(found.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
        padding: '14px 18px', marginBottom: 24, border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        background: 'var(--surface)', cursor: 'pointer',
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 10, background: found.group.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Sparkles size={16} color={found.group.color} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tiếp tục đọc</span>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{found.title}</span>
      </span>
      <ArrowRight size={16} color="var(--text3)" style={{ flexShrink: 0 }} />
    </button>
  );
}

function BrokenLinkBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', marginBottom: 20,
      background: 'var(--amber-bg)', border: '1px solid #f0d9a8', borderRadius: 'var(--radius-lg)',
    }}>
      <AlertTriangle size={16} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ margin: 0, flex: 1, fontSize: 13, lineHeight: 1.6, color: '#6b4a12' }}>
        Không tìm thấy bài viết này — đường link có thể đã cũ vì tài liệu vừa được cập nhật. Dưới đây là toàn bộ danh mục.
      </p>
      <button onClick={onDismiss} aria-label="Đóng thông báo" style={{ border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', display: 'flex', flexShrink: 0 }}>
        <X size={14} color="#6b4a12" />
      </button>
    </div>
  );
}

function WelcomePane({ myRoles, onOpenArticle }: { myRoles: GuideRole[]; onOpenArticle: (id: string) => void }) {
  const forMe = GUIDE_GROUPS.filter(g => myRoles.length === 0 || g.roles.some(r => myRoles.includes(r)));
  const totalArticles = useMemo(() => GUIDE_GROUPS.reduce((n, g) => n + g.articles.length, 0), []);
  const journeyFirst = GUIDE_GROUPS[0]?.articles[0];

  return (
    <div style={{ maxWidth: 900, width: '100%' }}>
      <div style={{
        borderRadius: 'var(--radius-lg)', padding: '30px 32px 26px',
        background: 'var(--surface)', border: '1px solid var(--border)', borderTop: '3px solid var(--blue)',
        marginBottom: 20, boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={16} color="var(--blue)" />
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--blue-text)' }}>Trung tâm hướng dẫn</span>
        </div>
        <h1 style={{ margin: '0 0 12px', fontSize: 29, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.22 }}>
          Hướng dẫn sử dụng DNA-ERP
        </h1>
        <p style={{ color: 'var(--text2)', fontSize: 14.5, lineHeight: 1.7, margin: '0 0 22px', maxWidth: 600 }}>
          Viết theo đúng những gì phần mềm thực sự làm — không mô tả tính năng chưa có.
          Nhấn <kbd style={{ fontFamily: 'inherit', fontSize: 12, fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: 'var(--surface2)', border: '1px solid var(--border)' }}>Ctrl K</kbd> để tìm nhanh, hoặc bắt đầu với hành trình tổng quan bên dưới.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
          {journeyFirst && (
            <button
              onClick={() => onOpenArticle(journeyFirst.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontSize: 13.5, fontWeight: 700,
                background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(24,95,165,0.25)',
              }}
            >
              <Compass size={15} /> Bắt đầu: Hành trình một đơn hàng <ArrowRight size={14} />
            </button>
          )}
          <div style={{ display: 'flex', gap: 22, fontSize: 12.5, color: 'var(--text2)' }}>
            <span><strong style={{ color: 'var(--text)', fontSize: 15 }}>{GUIDE_GROUPS.length}</strong> nhóm</span>
            <span style={{ borderLeft: '1px solid var(--border)', paddingLeft: 22 }}>
              <strong style={{ color: 'var(--text)', fontSize: 15 }}>{totalArticles}</strong> bài viết
            </span>
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text3)' }}>
          Xác minh theo mã nguồn ngày {GUIDE_VERIFIED_DATE} — nghiệp vụ có thể đã thay đổi sau đó, ưu tiên tin theo phần mềm đang chạy nếu khác.
        </div>
      </div>

      <ContinueReadingCard onOpen={onOpenArticle} />

      {myRoles.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 13 }}>
            Dành cho bạn ({myRoles.map(r => roleInfo(r).label).join(', ')})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
            {forMe.map((g, i) => (
              <GroupCard key={g.id} group={g} onOpen={() => g.articles[0] && onOpenArticle(g.articles[0].id)} delayMs={i * 30} />
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text3)', marginBottom: 13 }}>
        Toàn bộ nhóm hướng dẫn
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
        {GUIDE_GROUPS.map((g, i) => (
          <GroupCard key={g.id} group={g} onOpen={() => g.articles[0] && onOpenArticle(g.articles[0].id)} delayMs={(myRoles.length > 0 ? forMe.length : 0) * 30 + i * 30} />
        ))}
      </div>
    </div>
  );
}

function GroupSection({
  group, activeId, onSelect, open, onToggle, mounted,
}: { group: GuideGroup; activeId: string | null; onSelect: (id: string) => void; open: boolean; onToggle: () => void; mounted: boolean }) {
  const containsActive = group.articles.some(a => a.id === activeId);

  return (
    <div style={{ marginBottom: 2 }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 10px',
        border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: 'var(--radius)',
        color: 'var(--text)', fontSize: 12.5, fontWeight: 700, textAlign: 'left',
      }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ display: 'flex', transition: 'transform 0.15s ease', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          <ChevronDown size={13} color="var(--text3)" />
        </span>
        <span style={{
          width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: containsActive ? group.bg : 'transparent',
        }}>
          <GuideIcon name={group.icon} size={14} color={group.color} />
        </span>
        <span style={{ flex: 1 }}>{group.title}</span>
        <span style={{
          fontSize: 10, color: 'var(--text3)', fontWeight: 600, background: 'var(--surface2)',
          borderRadius: 10, padding: '1px 6px', minWidth: 16, textAlign: 'center',
        }}>{group.articles.length}</span>
      </button>
      {open && (
        <div className="dna-guide-tab-in" style={{ paddingLeft: 19, display: 'flex', flexDirection: 'column', gap: 1, marginTop: 2, marginBottom: 6 }}>
          {group.articles.map(a => {
            const active = a.id === activeId;
            const visited = mounted && isVisited(a.id);
            return (
              <button key={a.id} data-guide-article={a.id} onClick={() => onSelect(a.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '7px 10px 7px 12px', fontSize: 12.5,
                border: 'none', borderLeft: active ? `2px solid ${group.color}` : '2px solid transparent',
                borderRadius: '0 var(--radius) var(--radius) 0', cursor: 'pointer',
                background: active ? group.bg : 'transparent', color: active ? group.color : 'var(--text2)',
                fontWeight: active ? 600 : 400, lineHeight: 1.4,
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface2)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                {visited && !active && <Check size={11} color="var(--text3)" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GuideApp({ onBack }: Props) {
  const { user } = useAuth();
  const myRoles = useMemo(() => guideRolesOf(user), [user]);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [invalidArticleId, setInvalidArticleId] = useState<string | null>(null);
  const [pendingTab, setPendingTab] = useState<TabKey | undefined>(undefined);
  const [errorsHubOpen, setErrorsHubOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<string | null>(GUIDE_GROUPS[0]?.id ?? null);
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(0);
  const navRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarLastFocusedRef = useRef<HTMLElement | null>(null);

  // Cờ hydration chuẩn cho Next.js: phải đợi qua 1 lượt effect mới biết đã ở client, dùng để
  // tránh SSR/client render lệch nhau khi đọc localStorage (isVisited) — không có giá trị nào
  // tính được sẵn lúc render đầu tiên.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);

  // Đóng drawer mobile bằng phím Escape — tương tự mọi overlay/modal chuẩn khác trong app.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  // Drawer mobile là một dialog thật (che nội dung phía sau bằng overlay) — cần quản lý focus
  // như mọi modal chuẩn: nhớ lại chỗ đang focus trước khi mở, đưa focus vào trong drawer, và
  // trả lại đúng chỗ cũ khi đóng. Cùng pattern đã dùng cho CommandPalette.
  useEffect(() => {
    if (mobileOpen) {
      sidebarLastFocusedRef.current = document.activeElement as HTMLElement;
      const t = setTimeout(() => {
        sidebarRef.current?.querySelector<HTMLElement>('.dna-guide-drawer-close')?.focus();
      }, 20);
      return () => clearTimeout(t);
    }
    sidebarLastFocusedRef.current?.focus?.();
  }, [mobileOpen]);

  // Nhốt Tab bên trong drawer khi đang mở trên mobile (focus trap) — chỉ áp dụng khi mobileOpen,
  // vì ở desktop sidebar này luôn hiện sẵn và không phải overlay, không được chặn Tab bình thường.
  function onSidebarKeyDown(e: React.KeyboardEvent) {
    if (!mobileOpen || e.key !== 'Tab') return;
    const focusables = sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, [href], [tabindex]:not([tabindex="-1"])');
    if (!focusables || focusables.length === 0) return;
    const list = Array.from(focusables);
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // Đồng bộ bài đang xem với URL (?a=<id>&t=<tab>, hoặc ?v=errors cho trang Tra cứu lỗi) —
  // cho phép chia sẻ link trực tiếp tới 1 bài/1 tab cụ thể, dùng nút Back/Forward của trình
  // duyệt để đi lại giữa các bài đã xem.
  useEffect(() => {
    const sync = () => {
      const rawId = readArticleIdFromUrl();
      const found = rawId ? allArticles().some(x => x.article.id === rawId) : false;
      setActiveId(found ? rawId : null);
      setInvalidArticleId(rawId && !found ? rawId : null);
      setPendingTab(found ? readTabFromUrl() : undefined);
      setErrorsHubOpen(!rawId && readErrorsHubFromUrl());
    };
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const hits = useMemo(() => searchArticles(GUIDE_GROUPS, query), [query]);
  const active = activeId ? allArticles().find(x => x.article.id === activeId) : null;

  // Tiêu đề tab trình duyệt đổi theo bài đang đọc — như mọi trang tài liệu chuyên nghiệp khác,
  // thay vì luôn hiện tên chung chung dù đang ở bài nào.
  // CỐ Ý chỉ liệt kê field nguyên thuỷ (title) trong deps, không liệt kê cả `active`:
  // allArticles() tạo object {group,article} MỚI mỗi lần render (Array.flatMap), nên đưa
  // `active` vào deps sẽ làm effect chạy lại ở MỌI render dù đang xem cùng 1 bài.
  useEffect(() => {
    const desired = active
      ? `${active.article.title} — Hướng dẫn DNA-ERP`
      : errorsHubOpen ? 'Lỗi thường gặp — Hướng dẫn DNA-ERP' : 'Hướng dẫn sử dụng — DNA-ERP';
    document.title = desired;

    // Next.js (App Router) tự set lại <title> theo metadata gốc của root layout đúng 1 lần,
    // NGAY SAU khi effect này đã chạy — chỉ xảy ra ở lần tải trang đầu tiên (metadata resolve
    // bất đồng bộ), đè mất tiêu đề đúng vừa set. Dùng MutationObserver để tự sửa lại bất cứ khi
    // nào <title> bị đổi khác `desired` trong lúc effect này vẫn đang có hiệu lực — tự dừng
    // ngay khi document.title đã khớp lại (không có vòng lặp vô hạn).
    const titleEl = document.querySelector('title');
    if (!titleEl) return;
    const observer = new MutationObserver(() => {
      if (document.title !== desired) document.title = desired;
    });
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.article.title, errorsHubOpen]);

  // Sidebar là accordion 1-nhóm-mở-tại-1-thời-điểm — tự mở đúng nhóm chứa bài đang xem
  // (kể cả khi vào thẳng qua link chia sẻ) và tự cuộn bài đó vào khung nhìn. Lý do bỏ `active`
  // khỏi deps giống effect đổi tiêu đề tab ở trên (object mới mỗi render).
  useEffect(() => {
    if (!active) return;
    // setState này gắn liền với scrollIntoView ngay dưới (phải nằm trong effect vì DOM API
    // không gọi được lúc render) — cả hai cùng phản ứng với 1 sự kiện "đổi bài đang xem".
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenGroupId(active.group.id);
    const el = navRef.current?.querySelector<HTMLElement>(`[data-guide-article="${active.article.id}"]`);
    el?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.article.id, active?.group.id]);

  // Thanh tiến độ đọc — theo % cuộn của CHÍNH khung nội dung (không phải window, vì layout
  // dùng div nội bộ overflow:auto, cửa sổ trình duyệt không hề cuộn).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const max = el.scrollHeight - el.clientHeight;
        setProgress(max > 0 ? Math.min(100, (el.scrollTop / max) * 100) : 0);
      });
    };
    el.addEventListener('scroll', onScroll);
    onScroll();
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [activeId]);

  const siblings = active ? active.group.articles : [];
  const activeIndex = active ? siblings.findIndex(a => a.id === active.article.id) : -1;
  const prevArticle = activeIndex > 0 ? siblings[activeIndex - 1] : undefined;
  const nextArticle = activeIndex >= 0 && activeIndex < siblings.length - 1 ? siblings[activeIndex + 1] : undefined;

  const selectArticle = useCallback((id: string, tab?: TabKey) => {
    setActiveId(id);
    setInvalidArticleId(null);
    setPendingTab(tab);
    setErrorsHubOpen(false);
    setQuery('');
    setMobileOpen(false);
    markVisited(id);
    const qs = tab ? `?${ARTICLE_QUERY_KEY}=${id}&${TAB_QUERY_KEY}=${tab}` : `?${ARTICLE_QUERY_KEY}=${id}`;
    window.history.pushState(null, '', qs);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const goHome = useCallback(() => {
    setActiveId(null);
    setInvalidArticleId(null);
    setPendingTab(undefined);
    setErrorsHubOpen(false);
    setQuery('');
    setMobileOpen(false);
    window.history.pushState(null, '', window.location.pathname);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const openErrorsHub = useCallback(() => {
    setActiveId(null);
    setInvalidArticleId(null);
    setPendingTab(undefined);
    setErrorsHubOpen(true);
    setQuery('');
    setMobileOpen(false);
    window.history.pushState(null, '', `?${VIEW_QUERY_KEY}=errors`);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const totalErrors = useMemo(() => allArticles().reduce((n, { article }) => n + (article.commonErrors?.length ?? 0), 0), []);

  return (
    <div className="dna-guide-shell" style={{ display: 'flex', overflow: 'hidden' }}>
      <style>{`
        /* height: 100vh trước rồi 100dvh sau — trình duyệt không hiểu dvh (Safari cũ) sẽ bỏ qua
           dòng này và giữ 100vh, trình duyệt hiểu dvh sẽ ghi đè bằng giá trị "viewport động"
           thật, tránh bị cắt nội dung khi thanh địa chỉ mobile ẩn/hiện làm đổi chiều cao. */
        .dna-guide-shell { height: 100vh; height: 100dvh; }
        .dna-guide-shell .dna-guide-sidebar { width: 300px; flex-shrink: 0; }
        .dna-guide-shell .dna-guide-menu-btn { display: none; }
        .dna-guide-shell .dna-guide-drawer-close { display: none; }
        .dna-guide-shell .dna-guide-kbd-hint { display: flex; }
        .dna-guide-shell .dna-guide-toc { display: block; }
        @media (max-width: 1180px) {
          .dna-guide-shell .dna-guide-toc { display: none; }
        }
        @media (max-width: 860px) {
          .dna-guide-shell .dna-guide-sidebar {
            position: fixed; inset: 0 18% 0 0; z-index: 40; width: auto;
            transform: translateX(-100%); transition: transform 0.2s ease;
            box-shadow: 0 0 32px rgba(0,0,0,0.25);
          }
          .dna-guide-shell .dna-guide-sidebar.open { transform: translateX(0); }
          .dna-guide-shell .dna-guide-menu-btn { display: flex; }
          .dna-guide-shell .dna-guide-overlay { display: block; }
          .dna-guide-shell .dna-guide-drawer-close { display: flex; }
          .dna-guide-shell .dna-guide-kbd-hint { display: none; }
        }
        .dna-guide-shell .dna-guide-overlay { display: none; }
        .dna-guide-shell input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--blue-bg); }
        .dna-guide-shell button:focus-visible,
        .dna-guide-shell a:focus-visible,
        .dna-guide-shell input:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .dna-guide-shell * { transition: none !important; animation: none !important; scroll-behavior: auto !important; }
        }
        @media print {
          .dna-guide-sidebar, .dna-guide-topbar, .dna-guide-toc, .dna-guide-copylink, .dna-guide-prevnext { display: none !important; }
          .dna-guide-shell, .dna-guide-scrollarea { height: auto !important; overflow: visible !important; display: block !important; }
        }
        .dna-guide-details > summary { list-style: none; cursor: pointer; }
        .dna-guide-details > summary::-webkit-details-marker { display: none; }
        .dna-guide-details > summary .dna-guide-details-chevron { transition: transform 0.15s ease; }
        .dna-guide-details[open] > summary .dna-guide-details-chevron { transform: rotate(180deg); }
        .dna-guide-details > summary:hover h3 { color: var(--text2); }
        @media print {
          .dna-guide-details > summary .dna-guide-details-chevron { display: none; }
          .dna-guide-details > div { display: block !important; }
        }
        .dna-guide-shell button { transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease; }
        @keyframes dnaFadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dnaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dnaOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .dna-guide-content-in { animation: dnaFadeInUp 0.22s ease both; }
        /* Chỉ animate opacity (không animate transform) ở đây — GroupCard còn dùng transform
           inline riêng cho hiệu ứng hover, animate transform ở cả 2 nơi sẽ đá nhau sau khi
           animation-fill-mode:forwards giữ nguyên giá trị animation, làm mất hiệu ứng hover. */
        .dna-guide-card-in { opacity: 0; animation: dnaFadeIn 0.3s ease forwards; }
        .dna-guide-overlay-in { animation: dnaOverlayIn 0.15s ease; }
        /* Nhanh hơn dna-guide-content-in (đổi cả bài) vì đây chỉ đổi 1 tab trong cùng 1 bài —
           chỉ fade, không kèm translateY để không làm rung phần TOC đang bám theo scroll. */
        .dna-guide-tab-in { animation: dnaFadeIn 0.16s ease both; }
      `}</style>

      <CommandPalette onSelect={selectArticle} />

      {mobileOpen && (
        <div
          className="dna-guide-overlay dna-guide-overlay-in"
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 30 }}
        />
      )}

      <div
        ref={sidebarRef}
        className={`dna-guide-sidebar${mobileOpen ? ' open' : ''}`}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label={mobileOpen ? 'Danh mục hướng dẫn' : undefined}
        onKeyDown={onSidebarKeyDown}
        style={{
          background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            {onBack && (
              <button onClick={onBack} aria-label="Trở về trang chủ" title="Trở về trang chủ" style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', display: 'flex', cursor: 'pointer' }}>
                <ArrowLeft size={15} color="var(--text)" />
              </button>
            )}
            <button onClick={goHome} style={{
              display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, flex: 1,
            }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BookOpen size={14} color="#fff" />
              </span>
              <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>Hướng dẫn sử dụng</span>
            </button>
            <button
              className="dna-guide-drawer-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng danh mục"
              style={{ padding: 6, background: 'var(--surface2)', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}
            >
              <X size={15} color="var(--text)" />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Tìm hướng dẫn..."
              style={{ width: '100%', paddingLeft: 30, paddingRight: 48, paddingTop: 8, paddingBottom: 8, fontSize: 12.5, border: '1px solid var(--border)', borderRadius: 8 }}
            />
            {query ? (
              <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', padding: 2, cursor: 'pointer', display: 'flex' }}>
                <X size={13} color="var(--text3)" />
              </button>
            ) : (
              <span className="dna-guide-kbd-hint" style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', alignItems: 'center', gap: 2,
                fontSize: 10, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 5, padding: '2px 5px', pointerEvents: 'none',
              }}>
                <Command size={9} />K
              </span>
            )}
          </div>
          <button
            onClick={openErrorsHub}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, width: '100%', marginTop: 8,
              padding: '8px 10px', fontSize: 12, fontWeight: 600, textAlign: 'left',
              border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer',
              background: errorsHubOpen ? 'var(--red-bg)' : 'var(--surface)',
              color: errorsHubOpen ? 'var(--red)' : 'var(--text2)',
            }}
          >
            <FileWarning size={13} color={errorsHubOpen ? 'var(--red)' : 'var(--text3)'} />
            <span style={{ flex: 1 }}>Tra cứu lỗi toàn hệ thống</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
              background: errorsHubOpen ? 'rgba(220,38,38,0.12)' : 'var(--surface2)', color: errorsHubOpen ? 'var(--red)' : 'var(--text3)',
            }}>{totalErrors}</span>
          </button>
        </div>

        <nav ref={navRef} style={{ flex: 1, overflow: 'auto', padding: '8px 8px' }}>
          {/* key theo việc đang gõ tìm kiếm hay không — ép remount để fade lại mỗi lần chuyển
             qua lại giữa danh sách kết quả tìm kiếm và cây danh mục nhóm, tránh đổi nội dung
             đột ngột giống lỗi từng gặp ở tab trong bài viết. */}
          <div key={query.trim() ? 'search' : 'groups'} className="dna-guide-tab-in">
          {query.trim() ? (
            hits.length === 0 ? (
              <div style={{ padding: '24px 12px', fontSize: 12.5, color: 'var(--text3)', textAlign: 'center', lineHeight: 1.6 }}>
                Không tìm thấy kết quả cho &quot;{query}&quot;
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', padding: '4px 10px 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{hits.length} kết quả</div>
                {hits.map(h => (
                  <button key={h.article.id} onClick={() => selectArticle(h.article.id)} style={{
                    display: 'flex', flexDirection: 'column', gap: 3, width: '100%', textAlign: 'left', padding: '9px 10px',
                    border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'transparent',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{h.article.title}</span>
                    <span style={{ fontSize: 10.5, color: h.group.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <GuideIcon name={h.group.icon} size={11} color={h.group.color} />{h.group.title}
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : (
            GUIDE_GROUPS.map(g => (
              <GroupSection
                key={g.id}
                group={g}
                activeId={activeId}
                onSelect={selectArticle}
                open={g.id === openGroupId}
                onToggle={() => setOpenGroupId(prev => (prev === g.id ? null : g.id))}
                mounted={mounted}
              />
            ))
          )}
          </div>
        </nav>

        {user && (
          <div style={{ padding: '11px 14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--blue-bg)', color: 'var(--blue-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>
                {user.name?.split(' ').pop()?.substring(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)' }}>{myRoles.map(r => roleInfo(r).short).join(', ') || '—'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="dna-guide-topbar" style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '13px 28px', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)', position: 'relative', flexShrink: 0,
        }}>
          <button
            className="dna-guide-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở danh mục hướng dẫn"
            style={{ alignItems: 'center', gap: 6, fontSize: 12.5, padding: '6px 10px', marginRight: 4 }}
          >
            <Menu size={14} />
          </button>
          <button onClick={goHome} style={{
            display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer',
            padding: '4px 6px', fontSize: 12.5, color: (active || errorsHubOpen) ? 'var(--text3)' : 'var(--text)', fontWeight: (active || errorsHubOpen) ? 500 : 700,
          }}>
            <Home size={13} /> Trang chủ
          </button>
          {errorsHubOpen && (
            <>
              <ChevronRight size={12} color="var(--text3)" style={{ flexShrink: 0 }} />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--red)', fontWeight: 700 }}>
                <FileWarning size={12} /> Tra cứu lỗi toàn hệ thống
              </span>
            </>
          )}
          {active && (
            <>
              <ChevronRight size={12} color="var(--text3)" style={{ flexShrink: 0 }} />
              <button onClick={() => setOpenGroupId(active.group.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '4px 6px', fontSize: 12.5, color: 'var(--text3)', fontWeight: 500, flexShrink: 0,
              }}>
                <GuideIcon name={active.group.icon} size={12} color={active.group.color} />
                {active.group.title}
              </button>
              <ChevronRight size={12} color="var(--text3)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {active.article.title}
              </span>
            </>
          )}
          {active && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, background: 'var(--border)' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--blue)', transition: 'width 0.1s linear' }} />
            </div>
          )}
        </div>

        <div ref={scrollRef} className="dna-guide-scrollarea" style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
          <div key={activeId ?? (errorsHubOpen ? 'errors-hub' : 'home')} className="dna-guide-content-in" style={{ width: '100%', padding: '26px 28px 70px', display: 'flex', justifyContent: 'center' }}>
            {active
              ? <ArticleView article={active.article} group={active.group} prev={prevArticle} next={nextArticle} onNavigate={selectArticle} scrollContainerRef={scrollRef} initialTab={pendingTab} />
              : errorsHubOpen
                ? <ErrorsHub onOpenArticle={id => selectArticle(id, 'errors')} />
                : (
                  <div style={{ maxWidth: 900, width: '100%' }}>
                    {invalidArticleId && <BrokenLinkBanner onDismiss={() => setInvalidArticleId(null)} />}
                    <WelcomePane myRoles={myRoles} onOpenArticle={selectArticle} />
                  </div>
                )
            }
          </div>
        </div>
      </div>
    </div>
  );
}
