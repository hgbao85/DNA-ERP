'use client'
import { BookOpen, ChevronLeft } from 'lucide-react'
import { useIsCompact } from '../../../hooks/useMediaQuery'
import { useUrlState } from '../../../hooks/useUrlState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import type { GuideGroup } from './types'
import ArticleView from './ArticleView'

/**
 * Hướng dẫn NHÚNG trong 1 phân hệ (2026-10-12) - cho các vai trò có hướng dẫn tách riêng khỏi trang
 * /guide công khai: Admin (AdminGuidePage) và Quản lý vật tư (MaterialsManagerApp). /guide mở được
 * cho mọi vai trò và cả người chưa đăng nhập; nội dung đặt ở đây thì chỉ ai vào được phân hệ đó mới
 * đọc được. Bài viết vẫn là dữ liệu tĩnh trong Guide/content và vẫn hiển thị bằng ArticleView.
 *
 * Bài đang mở lưu ở query `a` (cùng khoá với /guide) để F5 không mất chỗ; `linkFor` cho nút "Sao
 * chép link" ra đúng đường dẫn mở lại bài trong phân hệ đang nhúng. Component gọi phải nằm trong
 * <Suspense> (useUrlState dùng useSearchParams) - mọi phân hệ dưới app/page.tsx đều đã có.
 */
interface Props {
  group: GuideGroup
  title: string
  /** Câu giải thích ai xem được phần này - nối sau mô tả của nhóm. */
  note: string
  linkFor: (id: string) => string
  accent?: string
}

export default function EmbeddedGuide({ group, title, note, linkFor, accent = 'var(--blue)' }: Props) {
  const isCompact = useIsCompact()
  const [urlId, setUrlId] = useUrlState('a')
  const articles = group.articles
  const index = articles.findIndex((a) => a.id === urlId)
  const active = index >= 0 ? articles[index] : null

  const open = (id: string) => {
    setUrlId(id)
    // Khung cuộn là vùng nội dung của phân hệ chứa - về đầu bài khi đổi bài.
    document.querySelector('.dna-embedded-guide')?.scrollIntoView({ block: 'start' })
  }

  const list = (
    <nav aria-label={`Danh sách bài: ${title}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {articles.map((a) => {
        const on = a.id === active?.id
        return (
          <button
            key={a.id}
            onClick={() => open(a.id)}
            style={{
              textAlign: 'left', padding: '8px 10px 8px 12px', fontSize: 13, lineHeight: 1.45, cursor: 'pointer',
              border: 'none', borderLeft: on ? '2px solid var(--blue)' : '2px solid transparent',
              borderRadius: '0 var(--radius) var(--radius) 0',
              background: on ? 'var(--surface2)' : 'transparent',
              color: on ? 'var(--text)' : 'var(--text2)', fontWeight: on ? 600 : 500,
            }}
          >
            {a.title}
          </button>
        )
      })}
    </nav>
  )

  const article = active && (
    <ArticleView article={active} group={group} prev={articles[index - 1]} next={articles[index + 1]} onNavigate={open} linkFor={linkFor} />
  )

  return (
    <div className="dna-embedded-guide">
      <style>{`
        @keyframes dnaEmbeddedGuideFade { from { opacity: 0; } to { opacity: 1; } }
        .dna-embedded-guide .dna-guide-tab-in { animation: dnaEmbeddedGuideFade 0.16s ease both; }
        /* Cột "Trong bài này" chỉ hiện khi đủ rộng cho cả danh sách bài + bài viết + cột này. */
        @media (max-width: 1500px) { .dna-embedded-guide .dna-guide-toc { display: none; } }
        @media (prefers-reduced-motion: reduce) { .dna-embedded-guide .dna-guide-tab-in { animation: none; } }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <BookOpen size={18} color={accent} />
        <h2 style={{ ...pageTitle, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        {group.description} {note}
      </div>

      {isCompact ? (
        active ? (
          <>
            <button
              onClick={() => setUrlId(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', marginBottom: 16, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}
            >
              <ChevronLeft size={13} /> Danh sách bài
            </button>
            {article}
          </>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 8 }}>{list}</div>
        )
      ) : (
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
          <div style={{ width: 250, flexShrink: 0, position: 'sticky', top: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '8px 8px 8px 0' }}>
            {list}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {article ?? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
                {articles.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => open(a.id)}
                    style={{ textAlign: 'left', padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>{a.title}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.purpose}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
