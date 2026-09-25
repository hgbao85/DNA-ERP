import type { GuideMock } from './types';
import { List } from './icons';

/**
 * Sơ đồ minh hoạ bố cục màn hình — KHÔNG PHẢI ảnh chụp thật, chỉ dựng lại đúng tên
 * cột/trường/nút đã xác nhận qua code. Số liệu ví dụ trong bảng là bịa để minh hoạ hình dạng,
 * không phải dữ liệu thật — luôn có nhãn "Minh hoạ" để không ai nhầm là ảnh chụp màn hình.
 */
export default function ScreenMock({ mock }: { mock: GuideMock }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
        background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bg-e3a5a5)' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bg-e8cf9c)' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--bg-a8cfa0)' }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{mock.title}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>
          <List size={10} /> Minh hoạ bố cục — không phải ảnh chụp/số liệu thật
        </span>
      </div>

      <div style={{ padding: 16, background: 'var(--surface)' }}>
        {mock.formFields && mock.formFields.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: mock.buttons ? 14 : 0 }}>
            {mock.formFields.map((f, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 10.5, color: 'var(--text3)', fontWeight: 600 }}>{f}</span>
                <div style={{ height: 24, borderRadius: 6, background: 'var(--surface2)', border: '1px solid var(--border)' }} />
              </div>
            ))}
          </div>
        )}

        {mock.columns && mock.columns.length > 0 && (
          <div style={{ overflowX: 'auto', marginBottom: mock.buttons ? 14 : 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead>
                <tr>
                  {mock.columns.map((c, i) => (
                    <th key={i} style={{
                      textAlign: 'left', padding: '6px 10px', background: 'var(--surface2)',
                      color: 'var(--text2)', fontWeight: 700, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
                    }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(mock.rows && mock.rows.length > 0 ? mock.rows : [mock.columns.map(() => '···')]).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '7px 10px', color: 'var(--text2)', whiteSpace: 'nowrap',
                        borderBottom: ri === (mock.rows?.length ?? 1) - 1 ? 'none' : '1px solid var(--border)',
                      }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {mock.buttons && mock.buttons.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {mock.buttons.map((b, i) => {
              const isLast = i === mock.buttons!.length - 1;
              return (
                <span key={i} style={{
                  fontSize: 11.5, fontWeight: 600, padding: '6px 13px', borderRadius: 7,
                  background: isLast ? 'var(--blue)' : 'var(--surface2)',
                  color: isLast ? '#fff' : 'var(--text2)',
                  border: isLast ? 'none' : '1px solid var(--border2)',
                }}>{b}</span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
