'use client';

import { useMemo, useState } from 'react';
import { allArticles } from './content';
import { normalize } from './search';
import { GuideIcon, Search, X, FileWarning, ArrowRight } from './icons';

interface ErrorRow {
  key: string;
  issue: string;
  cause: string;
  fix: string;
  articleId: string;
  articleTitle: string;
  groupId: string;
  groupTitle: string;
  groupIcon: string;
}

function buildRows(): ErrorRow[] {
  const rows: ErrorRow[] = [];
  for (const { group, article } of allArticles()) {
    (article.commonErrors ?? []).forEach((e, i) => {
      rows.push({
        key: `${article.id}-${i}`,
        issue: e.issue,
        cause: e.cause,
        fix: e.fix,
        articleId: article.id,
        articleTitle: article.title,
        groupId: group.id,
        groupTitle: group.title,
        groupIcon: group.icon,
      });
    });
  }
  return rows;
}

interface Props {
  onOpenArticle: (articleId: string) => void;
}

export default function ErrorsHub({ onOpenArticle }: Props) {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => buildRows(), []);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return rows;
    const terms = q.split(/\s+/).filter(Boolean);
    return rows.filter(r => {
      const haystack = normalize(`${r.issue} ${r.cause} ${r.fix} ${r.articleTitle} ${r.groupTitle}`);
      return terms.every(t => haystack.includes(t));
    });
  }, [rows, query]);

  return (
    <div style={{ maxWidth: 954, width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileWarning size={16} color="var(--red)" />
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--red)' }}>Tra cứu toàn hệ thống</span>
      </div>
      <h1 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, letterSpacing: '-0.015em', color: 'var(--text)' }}>
        Lỗi thường gặp
      </h1>
      <p style={{ margin: '0 0 20px', color: 'var(--text2)', fontSize: 14, lineHeight: 1.6 }}>
        Gõ đúng (hoặc gần đúng) câu thông báo lỗi bạn thấy trên màn hình để tìm nguyên nhân và cách xử lý — không cần biết trước lỗi đó thuộc bài hướng dẫn nào. Gộp từ toàn bộ {rows.length} lỗi đã ghi nhận trong {allArticles().length} bài viết.
      </p>

      <div style={{ position: 'relative', marginBottom: 22 }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Vd: vượt quá số lượng, chưa được QLSX bấm Bắt đầu, không đủ tồn kho..."
          style={{ width: '100%', paddingLeft: 34, paddingRight: 34, paddingTop: 11, paddingBottom: 11, fontSize: 13.5, border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
        />
        {query && (
          <button onClick={() => setQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', padding: 4, cursor: 'pointer', display: 'flex' }}>
            <X size={14} color="var(--text3)" />
          </button>
        )}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 10 }}>
        {filtered.length} kết quả{query ? ` cho "${query}"` : ''}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          Không tìm thấy lỗi nào khớp — thử rút ngắn từ khoá, hoặc mở đúng bài hướng dẫn của module để xem đầy đủ.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <div key={r.key} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '14px 16px 4px', color: 'var(--text)', fontWeight: 700, fontSize: 15.5, lineHeight: 1.5 }}>
                <FileWarning size={16} color="var(--text3)" style={{ flexShrink: 0, marginTop: 3 }} />
                {r.issue}
              </div>
              <div style={{ padding: '6px 16px 14px 40px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7 }}><strong style={{ color: 'var(--text)' }}>Nguyên nhân:</strong> {r.cause}</div>
                <div style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7 }}><strong style={{ color: 'var(--text)' }}>Cách xử lý:</strong> {r.fix}</div>
                <button
                  onClick={() => onOpenArticle(r.articleId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6,
                    padding: '5px 11px 5px 8px', fontSize: 13, fontWeight: 600, color: 'var(--blue-text)',
                    border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface2)', cursor: 'pointer',
                  }}
                >
                  <GuideIcon name={r.groupIcon} size={12} color="var(--text3)" />
                  {r.articleTitle}
                  <ArrowRight size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
