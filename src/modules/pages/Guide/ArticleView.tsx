'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { GuideArticle, GuideGroup } from './types';
import { roleInfo } from './types';
import {
  AlertTriangle, CheckCircle2, FileWarning,
  GuideIcon, Link2, Check, ChevronLeft, ChevronRight, Clock, List,
} from './icons';
import ScreenMock from './ScreenMock';

interface TocSection { id: string; label: string }
export type TabKey = 'main' | 'errors' | 'statuses';
interface TabDef { key: TabKey; label: string; count?: number }

/** Cỡ chữ nội dung chính — đủ lớn để người dùng không quen máy tính đọc thoải mái. */
const BODY_FONT = 15.5;

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ margin: '36px 0 14px', fontSize: 19, fontWeight: 700, lineHeight: 1.35, color: 'var(--text)', scrollMarginTop: 84 }}>
      {children}
    </h2>
  );
}

function CopyLinkButton({ articleId }: { articleId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          const url = `${window.location.origin}${window.location.pathname}?a=${articleId}`;
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          // clipboard API có thể bị chặn (http/permissions) — bỏ qua, không phải lỗi nghiêm trọng
        }
      }}
      title="Sao chép đường dẫn tới bài này"
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', fontSize: 12,
        border: '1px solid var(--border)', borderRadius: 20, background: copied ? 'var(--green-bg)' : 'var(--surface)',
        color: copied ? 'var(--green)' : 'var(--text2)', cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {copied ? <Check size={12} /> : <Link2 size={12} />}
      {copied ? 'Đã sao chép' : 'Sao chép link'}
    </button>
  );
}

function estimateReadMinutes(article: GuideArticle): number {
  const steps = article.steps.map(s => (typeof s === 'string' ? s : s.text)).join(' ');
  const errs = (article.commonErrors ?? []).map(e => `${e.issue} ${e.cause} ${e.fix}`).join(' ');
  const text = [
    article.purpose, steps, article.result,
    (article.warnings ?? []).join(' '), errs,
    (article.statuses ?? []).map(s => s.meaning).join(' '),
  ].join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 160));
}

function TabBar({ tabs, activeTab, onSelect }: { tabs: TabDef[]; activeTab: TabKey; onSelect: (k: TabKey) => void }) {
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label="Các phần của bài viết" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
      {tabs.map(t => {
        const active = t.key === activeTab;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', marginBottom: -1,
              border: 'none', borderBottom: active ? '2px solid var(--text)' : '2px solid transparent',
              background: 'transparent', cursor: 'pointer',
              fontSize: 14.5, fontWeight: 600,
              color: active ? 'var(--text)' : 'var(--text3)',
            }}
          >
            {t.label}
            {t.count != null && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                background: 'var(--surface2)',
                color: 'var(--text2)',
              }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** `visible=false` khi đang ở tab khác "Cách làm" (Lỗi thường gặp/Trạng thái) — các mục lục này
 * chỉ trỏ tới nội dung của tab "Cách làm" nên không có gì để nhảy tới lúc đó. Vẫn giữ nguyên
 * chiều rộng cột (chỉ ẩn nội dung, không unmount cả cột) để layout của bài viết không bị nhảy
 * ngang mỗi lần đổi tab — trước đây cột này biến mất hẳn khi rời tab "Cách làm", khiến khối bài
 * viết bị recenter và giật sang một bên. */
function TocRail({ sections, activeSectionId, onJump, visible }: { sections: TocSection[]; activeSectionId: string | null; onJump: (id: string) => void; visible: boolean }) {
  if (sections.length < 2) return null;
  if (!visible) return <div className="dna-guide-toc" style={{ width: 190, flexShrink: 0 }} />;
  return (
    <div className="dna-guide-toc" style={{ width: 190, flexShrink: 0, position: 'sticky', top: 84, alignSelf: 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
        <List size={12} /> Trong bài này
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, borderLeft: '2px solid var(--border)' }}>
        {sections.map(s => {
          const active = s.id === activeSectionId;
          return (
            <button
              key={s.id}
              onClick={() => onJump(s.id)}
              style={{
                textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '5px 0 5px 12px', marginLeft: -2,
                borderLeft: active ? '2px solid var(--blue)' : '2px solid transparent',
                fontSize: 12.5, lineHeight: 1.5,
                color: active ? 'var(--blue-text)' : 'var(--text3)', fontWeight: active ? 700 : 500,
              }}
            >{s.label}</button>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  article: GuideArticle;
  group: GuideGroup;
  prev?: GuideArticle;
  next?: GuideArticle;
  onNavigate: (id: string) => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /** Tab muốn mở sẵn khi vào bài (vd đến từ trang "Tra cứu lỗi toàn hệ thống" — nhảy thẳng
   * vào tab "Lỗi thường gặp" thay vì luôn mặc định "Cách làm"). */
  initialTab?: TabKey;
}

export default function ArticleView({ article, group, prev, next, onNavigate, scrollContainerRef, initialTab }: Props) {
  const tabs = useMemo<TabDef[]>(() => {
    const list: TabDef[] = [{ key: 'main', label: 'Cách làm' }];
    if (article.commonErrors?.length) list.push({ key: 'errors', label: 'Lỗi thường gặp', count: article.commonErrors.length });
    if (article.statuses?.length) list.push({ key: 'statuses', label: 'Trạng thái' });
    return list;
  }, [article]);

  // Khởi tạo trực tiếp bằng initialTab (thay vì luôn 'main' rồi sửa lại ở effect bên dưới) để
  // không bị chớp tab sai ngay lần render đầu (vd mở bài từ link "Tra cứu lỗi" phải vào thẳng
  // tab Lỗi, không phải thấy tab Cách làm rồi mới nhảy sang).
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'main');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const rootElRef = useRef<HTMLDivElement>(null);

  // Effect này vẫn cần giữ dù đã có initial state ở trên: bắt trường hợp ĐỨNG YÊN ở cùng 1 bài
  // nhưng initialTab đổi (vd đang đọc bài A, bấm 1 link "Tra cứu lỗi" khác trỏ tới cùng bài A
  // nhưng tab khác) — lúc đó component không remount nên initial state không chạy lại được.
  // setState này CHÍNH LÀ việc effect cần làm (đồng bộ theo prop initialTab đổi), không phải
  // tác dụng phụ tách được ra ngoài.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActiveTab(initialTab ?? 'main'); }, [article.id, initialTab]);

  function selectTab(key: TabKey) {
    setActiveTab(key);
    rootElRef.current?.scrollIntoView({ block: 'start' });
  }

  // Không gate theo activeTab nữa: danh sách này quyết định luôn cả việc TocRail có chiếm
  // chỗ hay không (visible=false vẫn giữ nguyên chiều rộng cột) — nếu tính theo tab đang mở,
  // cột TOC sẽ đổi chiều rộng (190px + gap) mỗi lần chuyển tab, gây nhảy layout ngang.
  const sections = useMemo<TocSection[]>(() => {
    const list: TocSection[] = [{ id: 'sec-purpose', label: 'Giới thiệu' }];
    if (article.preconditions?.length) list.push({ id: 'sec-preconditions', label: 'Cần có trước khi làm' });
    list.push({ id: 'sec-steps', label: 'Các bước thực hiện' });
    list.push({ id: 'sec-result', label: 'Làm xong sẽ thấy gì' });
    if (article.warnings?.length) list.push({ id: 'sec-warnings', label: 'Cần lưu ý' });
    return list;
  }, [article]);

  const readMinutes = useMemo(() => estimateReadMinutes(article), [article]);

  useEffect(() => {
    // Giá trị mặc định trước khi IntersectionObserver bên dưới (phải setup trong effect,
    // không chạy được lúc render) tự cập nhật giá trị thật; tách riêng ra sẽ có 1 khung hình
    // TOC không highlight mục nào.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveSectionId(sections[0]?.id ?? null);
    const root = scrollContainerRef?.current ?? null;
    const els = sections
      .map(s => rootElRef.current?.querySelector<HTMLElement>(`#${s.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSectionId(visible[0].target.id);
      },
      { root, rootMargin: '0px 0px -65% 0px', threshold: 0 },
    );
    els.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [article.id, activeTab, sections, scrollContainerRef]);

  function jumpTo(id: string) {
    rootElRef.current?.querySelector(`#${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  return (
    // width:100% + maxWidth cố định (720 article + 44 gap + 190 toc) là phần mấu chốt: nếu bỏ
    // trống width, hàng flex này tự co theo kích thước NỘI DUNG bên trong (fit-content) — tab
    // "Cách làm" có ảnh chụp width:100% kéo max-content rất rộng nên article giãn hết cỡ 720px,
    // còn tab "Lỗi thường gặp" (chỉ có text ngắn) có max-content hẹp hơn nhiều, khiến cả khối
    // co lại và lệch tâm — đây mới là nguyên nhân thật của hiện tượng nhảy layout khi đổi tab,
    // không phải do TocRail ẩn/hiện (đã sửa riêng, xem TocRail). Có width tường minh thì flex-grow
    // của <article> luôn tính trên cùng một không gian sẵn có, bất kể tab nào đang mở.
    <div ref={rootElRef} style={{ display: 'flex', gap: 44, alignItems: 'flex-start', width: '100%', maxWidth: 954 }}>
      <article style={{ flex: '1 1 640px', minWidth: 0, maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>
            <GuideIcon name={group.icon} size={14} color="var(--text3)" />
            {group.title}
          </div>
          <div className="dna-guide-copylink" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text3)' }}>
              <Clock size={12} /> Khoảng {readMinutes} phút đọc
            </span>
            <CopyLinkButton articleId={article.id} />
          </div>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 10px', letterSpacing: '-0.01em', lineHeight: 1.3, color: 'var(--text)' }}>
          {article.title}
        </h1>

        {/* Vai trò hiển thị dạng 1 dòng chữ thường (không chip màu) — người đọc chỉ cần biết
           "bài này dành cho ai", màu riêng từng vai trò chỉ gây rối mắt. */}
        <p style={{ margin: '0 0 22px', fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
          Dành cho: <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{article.roles.map(r => roleInfo(r).label).join(', ')}</span>
        </p>

        <TabBar tabs={tabs} activeTab={activeTab} onSelect={selectTab} />

        {/* key={activeTab} ép remount mỗi lần đổi tab để animation fade chạy lại từ đầu —
           chỉ fade opacity (không dùng translateY) vì width đã cố định (xem rootElRef ở trên),
           tránh mọi thay đổi kích thước trong lúc animation đang chạy. */}
        <div key={activeTab} className="dna-guide-tab-in">
        {activeTab === 'main' && (
          <>
            <p id="sec-purpose" style={{ margin: '0 0 24px', fontSize: 17, lineHeight: 1.7, color: 'var(--text)', scrollMarginTop: 84 }}>
              {article.purpose}
            </p>

            {article.screenshot ? (
              <figure style={{ margin: '0 0 8px' }}>
                {/* aspect-ratio 1440/900 cố định — toàn bộ ảnh trong public/guide-screens/ đều
                   chụp cùng kích thước này, giữ chỗ đúng trước khi ảnh tải xong (tránh layout
                   nhảy khi cuộn), không cần biết kích thước riêng từng ảnh. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.screenshot}
                  alt={`Màn hình: ${article.title}`}
                  style={{
                    display: 'block', width: '100%', height: 'auto', aspectRatio: '1440 / 900',
                    background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                  }}
                />
                <figcaption style={{ marginTop: 8, fontSize: 12.5, color: 'var(--text3)', textAlign: 'center' }}>
                  Ảnh màn hình minh hoạ — số liệu trong ảnh là dữ liệu mẫu.
                </figcaption>
              </figure>
            ) : article.mock ? (
              <ScreenMock mock={article.mock} />
            ) : null}

            {article.preconditions && article.preconditions.length > 0 && (
              <>
                <SectionTitle id="sec-preconditions">Cần có trước khi làm</SectionTitle>
                <ul style={{ margin: 0, paddingLeft: 22, color: 'var(--text)', lineHeight: 1.75, fontSize: BODY_FONT }}>
                  {article.preconditions.map((p, i) => <li key={i} style={{ marginBottom: 6 }}>{p}</li>)}
                </ul>
              </>
            )}

            <SectionTitle id="sec-steps">Các bước thực hiện</SectionTitle>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {article.steps.map((s, i) => {
                const step = typeof s === 'string' ? { text: s, critical: false } : s;
                return (
                  <li key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: '50%', fontSize: 13, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '1.5px solid var(--border)', color: 'var(--text2)', background: 'var(--surface)',
                    }}>{i + 1}</span>
                    <div style={{ paddingTop: 2, fontSize: BODY_FONT, lineHeight: 1.75, color: 'var(--text)' }}>
                      {step.critical && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: 'var(--amber)', marginBottom: 2 }}>
                          <AlertTriangle size={13} /> Bước quan trọng
                        </div>
                      )}
                      <span style={{ fontWeight: step.critical ? 600 : 400 }}>{step.text}</span>
                    </div>
                  </li>
                );
              })}
            </ol>

            <SectionTitle id="sec-result">Làm xong sẽ thấy gì</SectionTitle>
            <p style={{ margin: 0, fontSize: BODY_FONT, lineHeight: 1.75, color: 'var(--text)' }}>
              <CheckCircle2 size={16} color="var(--green)" style={{ verticalAlign: '-3px', marginRight: 8 }} />
              {article.result}
            </p>

            {article.warnings && article.warnings.length > 0 && (
              <>
                <SectionTitle id="sec-warnings">Cần lưu ý</SectionTitle>
                {/* Gom mọi cảnh báo vào 1 khối duy nhất (thay vì mỗi dòng 1 hộp màu riêng) —
                   ít khung/màu hơn, người đọc lướt như 1 danh sách bình thường. */}
                <div style={{ padding: '14px 18px', background: 'var(--surface2)', borderLeft: '3px solid var(--amber)', borderRadius: 'var(--radius)' }}>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: BODY_FONT, lineHeight: 1.75, color: 'var(--text)' }}>
                    {article.warnings.map((w, i) => <li key={i} style={{ marginBottom: i === article.warnings!.length - 1 ? 0 : 8 }}>{w}</li>)}
                  </ul>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === 'errors' && article.commonErrors && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {article.commonErrors.map((e, i) => (
              <div key={i} style={{ padding: '18px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontWeight: 700, fontSize: 16, lineHeight: 1.5, color: 'var(--text)', marginBottom: 8 }}>
                  <FileWarning size={16} color="var(--text3)" style={{ flexShrink: 0, marginTop: 3 }} />
                  {e.issue}
                </div>
                <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6, fontSize: BODY_FONT, lineHeight: 1.7 }}>
                  <div style={{ color: 'var(--text2)' }}><strong style={{ color: 'var(--text)' }}>Nguyên nhân:</strong> {e.cause}</div>
                  <div style={{ color: 'var(--text2)' }}><strong style={{ color: 'var(--text)' }}>Cách xử lý:</strong> {e.fix}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'statuses' && article.statuses && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            {article.statuses.map((s, i) => (
              <div key={i} style={{
                display: 'flex', gap: 16, padding: '12px 16px', fontSize: BODY_FONT, lineHeight: 1.65,
                borderTop: i === 0 ? 'none' : '1px solid var(--border)', background: 'var(--surface)',
              }}>
                <span style={{ fontWeight: 700, color: 'var(--text)', minWidth: 170, flexShrink: 0 }}>{s.name}</span>
                <span style={{ color: 'var(--text2)' }}>{s.meaning}</span>
              </div>
            ))}
          </div>
        )}
        </div>

        {(prev || next) && (
          <div className="dna-guide-prevnext" style={{ display: 'flex', gap: 12, marginTop: 36, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            {prev ? (
              <button onClick={() => onNavigate(prev.id)} style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', padding: '12px 14px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', cursor: 'pointer',
              }}>
                <ChevronLeft size={15} color="var(--text3)" style={{ flexShrink: 0 }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bài trước</span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prev.title}</span>
                </span>
              </button>
            ) : <div style={{ flex: 1 }} />}
            {next ? (
              <button onClick={() => onNavigate(next.id)} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, textAlign: 'right', padding: '12px 14px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', cursor: 'pointer',
              }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bài tiếp theo</span>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.title}</span>
                </span>
                <ChevronRight size={15} color="var(--text3)" style={{ flexShrink: 0 }} />
              </button>
            ) : <div style={{ flex: 1 }} />}
          </div>
        )}
      </article>

      <TocRail sections={sections} activeSectionId={activeSectionId} onJump={jumpTo} visible={activeTab === 'main'} />
    </div>
  );
}
