'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Clock, Search, X } from 'lucide-react'
import { useIsCompact } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import type { GuideArticle, GuideGroup } from './types'
import ArticleView, { estimateReadMinutes } from './ArticleView'
import { searchArticles } from './search'
import { isVisited, markVisited } from './progress'

/**
 * Hướng dẫn NHÚNG trong 1 phân hệ (2026-10-12) - cho các vai trò có hướng dẫn tách riêng khỏi trang
 * /guide công khai: Admin (AdminGuidePage) và Quản lý vật tư (MaterialsManagerApp). /guide mở được
 * cho mọi vai trò và cả người chưa đăng nhập; nội dung đặt ở đây thì chỉ ai vào được phân hệ đó mới
 * đọc được. Bài viết vẫn là dữ liệu tĩnh trong Guide/content và vẫn hiển thị bằng ArticleView.
 *
 * Bố cục kiểu trang tài liệu: cột trái là mục lục có đánh số + tiến độ đã đọc + ô lọc, bên phải là
 * trang tổng quan (chưa chọn bài) hoặc bài viết đặt trong 1 khung nền riêng. Trên màn hẹp chuyển
 * thành 2 màn nối tiếp: mục lục -> bài.
 *
 * Bài đang mở lưu ở query `a` (cùng khoá với /guide) để F5 không mất chỗ; `linkFor` cho nút "Sao
 * chép link" ra đúng đường dẫn mở lại bài trong phân hệ đang nhúng. Component gọi phải nằm trong
 * <Suspense> (useUrlState dùng useSearchParams) - mọi phân hệ dưới app/page.tsx đều đã có.
 */
interface Props {
  group: GuideGroup
  title: string
  /** Câu giải thích ai xem được phần này - hiện ở trang tổng quan. */
  note: string
  linkFor: (id: string) => string
  accent?: string
  accentBg?: string
  /** Bề ngang cửa sổ tối thiểu để hiện cột "Trong bài này" - phân hệ có sidebar riêng cần rộng hơn. */
  tocMinWidth?: number
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function EmbeddedGuide({ group, title, note, linkFor, accent = 'var(--blue)', accentBg = 'var(--blue-bg)', tocMinWidth = 1620 }: Props) {
  const isCompact = useIsCompact()
  const rootRef = useRef<HTMLDivElement>(null)
  const [urlId, setUrlId] = useUrlState('a')
  const [query, setQuery] = useState('')
  // Dấu "đã đọc" đọc từ localStorage -> chỉ biết sau khi đã ở client; `tick` buộc tính lại sau mỗi lần mở bài.
  const [mounted, setMounted] = useState(false)
  const [tick, setTick] = useState(0)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true) }, [])

  const articles = group.articles
  const index = articles.findIndex((a) => a.id === urlId)
  const active = index >= 0 ? articles[index] : null

  // Mở thẳng 1 bài bằng link (hoặc F5) cũng tính là đã đọc.
  useEffect(() => {
    if (!active) return
    markVisited(active.id)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTick((t) => t + 1)
  }, [active])

  const visited = useMemo(
    () => new Set(mounted ? articles.filter((a) => isVisited(a.id)).map((a) => a.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tick` là tín hiệu "localStorage vừa đổi"
    [mounted, tick, articles],
  )
  const minutes = useMemo(() => new Map(articles.map((a) => [a.id, estimateReadMinutes(a)])), [articles])
  const totalMinutes = useMemo(() => [...minutes.values()].reduce((s, m) => s + m, 0), [minutes])
  const numberOf = useMemo(() => new Map(articles.map((a, i) => [a.id, i + 1])), [articles])

  const q = query.trim()
  const shown: GuideArticle[] = useMemo(
    () => (q ? searchArticles([group], q).map((h) => h.article) : articles),
    [q, group, articles],
  )
  const nextUnread = articles.find((a) => !visited.has(a.id))

  const open = (id: string | null) => {
    setUrlId(id)
    setQuery('')
    rootRef.current?.scrollIntoView({ block: 'start' })
  }

  const searchBox = (
    <div style={{ position: 'relative' }}>
      <Search size={14} color="var(--text3)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm trong hướng dẫn…"
        aria-label="Tìm trong hướng dẫn"
        style={{ width: '100%', padding: '8px 30px 8px 30px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)' }}
      />
      {query && (
        <button onClick={() => setQuery('')} aria-label="Xoá từ khoá" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', display: 'flex', padding: 3, border: 'none', background: 'transparent', cursor: 'pointer' }}>
          <X size={13} color="var(--text3)" />
        </button>
      )}
    </div>
  )

  const progress = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--text3)', marginBottom: 6 }}>
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tiến độ đọc</span>
        <span><b style={{ color: 'var(--text2)' }}>{visited.size}</b>/{articles.length} bài</span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${articles.length ? (visited.size / articles.length) * 100 : 0}%`, background: accent, borderRadius: 4, transition: 'width .25s ease' }} />
      </div>
    </div>
  )

  const navList = (
    <nav aria-label={`Mục lục: ${title}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {shown.map((a) => {
        const on = a.id === active?.id
        const done = visited.has(a.id)
        return (
          <button
            key={a.id}
            onClick={() => open(a.id)}
            aria-current={on ? 'page' : undefined}
            className="dna-eg-nav"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
              padding: '9px 10px', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer',
              background: on ? accentBg : 'transparent',
            }}
          >
            <span style={{
              flexShrink: 0, width: 22, height: 22, borderRadius: 6, marginTop: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              background: on ? accent : done ? accentBg : 'var(--surface2)', color: on ? '#fff' : done ? accent : 'var(--text3)',
            }}>
              {done && !on ? <Check size={13} strokeWidth={2.6} /> : pad2(numberOf.get(a.id) ?? 0)}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.45, fontWeight: on ? 700 : 500, color: on ? 'var(--text)' : 'var(--text2)' }}>
              {a.title}
            </span>
          </button>
        )
      })}
      {shown.length === 0 && (
        <div style={{ padding: '14px 10px', fontSize: 12.5, color: 'var(--text3)', lineHeight: 1.6 }}>Không bài nào khớp “{q}”.</div>
      )}
    </nav>
  )

  const sidebarInner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 34, height: 34, borderRadius: 9, background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BookOpen size={17} color={accent} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 1 }}>{articles.length} bài · khoảng {totalMinutes} phút đọc</div>
        </div>
      </div>
      {searchBox}
      <div style={{ margin: '14px 0 12px' }}>{progress}</div>
      <button
        onClick={() => open(null)}
        className="dna-eg-nav"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4,
          border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 13,
          background: !active && !isCompact ? accentBg : 'transparent',
          color: !active ? 'var(--text)' : 'var(--text2)', fontWeight: !active ? 700 : 500,
        }}
      >
        Tổng quan
      </button>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', padding: '8px 10px 6px' }}>
        {q ? `Kết quả (${shown.length})` : 'Các bài hướng dẫn'}
      </div>
      {/* Chỉ danh sách bài cuộn; tiêu đề, ô tìm và tiến độ đọc luôn đứng yên phía trên (mục lục của
         Admin dài 18 bài, trước đây cuộn xuống là mất ô tìm). */}
      <div className="dna-eg-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', margin: '0 -6px', padding: '0 6px 2px' }}>
        {navList}
      </div>
    </>
  )

  const overview = (
    <div style={{ maxWidth: 860 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: `3px solid ${accent}`, borderRadius: 'var(--radius-lg)', padding: isCompact ? '20px 18px' : '26px 30px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: accent, marginBottom: 8 }}>Tài liệu hướng dẫn</div>
        <h1 style={{ margin: '0 0 10px', fontSize: isCompact ? 22 : 26, fontWeight: 800, letterSpacing: '-0.015em', lineHeight: 1.25, color: 'var(--text)' }}>{title}</h1>
        <p style={{ margin: '0 0 6px', fontSize: 15, lineHeight: 1.7, color: 'var(--text2)', maxWidth: 640 }}>{group.description}</p>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text3)' }}>{note}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 18 }}>
          {articles[0] && (
            <button
              onClick={() => open((nextUnread ?? articles[0]).id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 700, border: 'none', borderRadius: 'var(--radius)', background: accent, color: '#fff', cursor: 'pointer' }}
            >
              {visited.size === 0 ? 'Bắt đầu đọc' : nextUnread ? 'Đọc tiếp' : 'Đọc lại từ đầu'}
              <ArrowRight size={14} />
            </button>
          )}
          <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
            {nextUnread && visited.size > 0
              ? <>Bài kế tiếp: <b style={{ color: 'var(--text2)' }}>{nextUnread.title}</b></>
              : visited.size === articles.length && articles.length > 0 ? 'Bạn đã đọc hết các bài.' : `${articles.length} bài · khoảng ${totalMinutes} phút đọc`}
          </span>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', margin: '0 2px 10px' }}>Nên đọc theo thứ tự</div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {articles.map((a, i) => {
          const done = visited.has(a.id)
          return (
            <li key={a.id}>
              <button
                onClick={() => open(a.id)}
                className="dna-eg-card"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%', textAlign: 'left', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', cursor: 'pointer' }}
              >
                <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', background: done ? accentBg : 'var(--surface2)', color: done ? accent : 'var(--text3)' }}>
                  {done ? <Check size={15} strokeWidth={2.6} /> : pad2(i + 1)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{a.title}</span>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: 3, fontSize: 13, lineHeight: 1.55, color: 'var(--text2)' }}>{a.purpose}</span>
                </span>
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)', marginTop: 5, whiteSpace: 'nowrap' }}>
                  <Clock size={12} /> {minutes.get(a.id)} phút
                  <ChevronRight size={14} style={{ marginLeft: 2 }} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )

  const articlePane = active && (
    <div className="dna-eg-article" style={{ maxWidth: 1028, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: isCompact ? '18px 16px 22px' : '28px 36px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text3)', marginBottom: 18, flexWrap: 'wrap' }}>
        <button onClick={() => open(null)} className="dna-eg-link" style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 12.5, color: 'var(--text3)' }}>{title}</button>
        <ChevronRight size={12} />
        <span style={{ color: 'var(--text2)', fontWeight: 600 }}>Bài {pad2(index + 1)}/{pad2(articles.length)}</span>
      </div>
      <ArticleView article={active} group={group} prev={articles[index - 1]} next={articles[index + 1]} onNavigate={open} linkFor={linkFor} />
    </div>
  )

  return (
    <div ref={rootRef} className="dna-embedded-guide" style={{ scrollMarginTop: 24 }}>
      <style>{`
        @keyframes dnaEmbeddedGuideFade { from { opacity: 0; } to { opacity: 1; } }
        .dna-embedded-guide .dna-guide-tab-in { animation: dnaEmbeddedGuideFade 0.16s ease both; }
        .dna-embedded-guide .dna-eg-scroll { scrollbar-width: thin; }
        .dna-embedded-guide .dna-eg-nav:hover { background: var(--surface2) !important; }
        .dna-embedded-guide .dna-eg-nav[aria-current="page"]:hover { background: ${accentBg} !important; }
        .dna-embedded-guide .dna-eg-card { transition: border-color .15s ease, box-shadow .15s ease; }
        .dna-embedded-guide .dna-eg-card:hover { border-color: ${accent}; box-shadow: 0 4px 14px rgba(15,23,42,0.07); }
        .dna-embedded-guide .dna-eg-link:hover { color: var(--text) !important; text-decoration: underline; }
        .dna-embedded-guide button:focus-visible, .dna-embedded-guide input:focus-visible { outline: 2px solid ${accent}; outline-offset: 2px; }
        .dna-embedded-guide input:focus { border-color: ${accent}; }
        /* Cột "Trong bài này" chỉ hiện khi đủ rộng cho cả mục lục + bài viết + cột này. */
        @media (max-width: ${tocMinWidth}px) { .dna-embedded-guide .dna-guide-toc { display: none; } .dna-embedded-guide .dna-eg-article { max-width: 794px !important; } }
        @media (prefers-reduced-motion: reduce) { .dna-embedded-guide .dna-guide-tab-in { animation: none; } .dna-embedded-guide .dna-eg-card { transition: none; } }
      `}</style>

      {isCompact ? (
        active ? (
          <>
            <button
              onClick={() => open(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '7px 12px', marginBottom: 14, fontSize: 12.5, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
            >
              <ChevronLeft size={14} /> Mục lục
            </button>
            {articlePane}
          </>
        ) : (
          <>
            {overview}
          </>
        )
      ) : (
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <aside style={{ width: 288, flexShrink: 0, position: 'sticky', top: 0, maxHeight: 'calc(100dvh - 120px)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14 }}>
            {sidebarInner}
          </aside>
          <div style={{ flex: 1, minWidth: 0 }}>
            {articlePane || overview}
          </div>
        </div>
      )}
    </div>
  )
}
