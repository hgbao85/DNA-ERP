'use client';

import React, { useState } from 'react';
import { useAuth, type User } from '../context/AuthContext';
import { loginUser } from '../services/api';
import { useRouter } from 'next/navigation';
import { Shield, Mail, Lock, Ship, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const data = await loginUser({ username, password });
      login(data.user as unknown as User);
      router.push('/');
    } catch (err: unknown) {
      console.error('Đăng nhập thất bại:', err);
      setError(err instanceof Error ? err.message : 'Tên đăng nhập hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#f8fafc'
    }}>
      {/* Cột trái: branding */}
      <div style={{
        flex: 1.2,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px',
        overflow: 'hidden',
        background: 'url("/bg_loginPage.png") center/cover no-repeat',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to right, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.4) 100%)',
          zIndex: 1,
        }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            padding: 10, borderRadius: 12,
            boxShadow: '0 8px 24px rgba(2, 132, 199, 0.4)',
          }}>
            <Ship size={24} color="#f8fafc" />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '0.05em', color: '#38bdf8' }}>
              ĐÔNG NAM Á
            </h2>
            <p style={{ fontSize: 11, margin: 0, opacity: 0.8, color: '#94a3b8' }}>
              EXPORT - IMPORT SERVICES
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2, maxWidth: 500, marginBottom: 80 }}>
          <h1 style={{
            fontSize: 40, fontWeight: 800, lineHeight: 1.2, marginBottom: 20,
            background: 'linear-gradient(to right, #ffffff, #94a3b8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Kết Nối Toàn Cầu, <br />Vươn Tầm Xa Hơn
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#94a3b8', margin: 0 }}>
            Hệ thống Quản lý Logistics, Tồn kho & Chăm sóc khách hàng CRM tích hợp cho Công Ty TNHH Dịch Vụ Xuất Nhập Khẩu Đông Nam Á.
          </p>
        </div>

        <div style={{ position: 'relative', zIndex: 2, fontSize: 12, color: '#64748b' }}>
          © 2026 Dong Nam A Co., Ltd. All rights reserved.
        </div>
      </div>

      {/* Cột phải: form đăng nhập */}
      <div style={{
        flex: 0.9, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '40px', backgroundColor: '#0f172a',
        borderLeft: '1px solid #1e293b',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', margin: '0 0 8px 0' }}>Xin chào!</h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Đăng nhập để vào hệ thống vận hành.</p>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '12px 16px', borderRadius: 12,
              color: '#f87171', fontSize: 13, fontWeight: 500,
              marginBottom: 24, animation: 'fadeIn 0.3s ease',
            }}>
              <Shield size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Tên đăng nhập</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="text"
                  placeholder="Tên đăng nhập"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px 14px 14px 44px',
                    backgroundColor: '#1e293b', border: '1px solid #334155',
                    borderRadius: 12, color: '#ffffff', fontSize: 14,
                    outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#0284c7'; e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.2)'; }}
                  onBlur={e => { e.target.style.borderColor = '#334155'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Mật Khẩu</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px 14px 14px 44px',
                    backgroundColor: '#1e293b', border: '1px solid #334155',
                    borderRadius: 12, color: '#ffffff', fontSize: 14,
                    outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#0284c7'; e.target.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.2)'; }}
                  onBlur={e => { e.target.style.borderColor = '#334155'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                backgroundColor: loading ? '#0369a1' : '#0284c7',
                border: 'none', borderRadius: 12, color: '#ffffff',
                fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                transition: 'all 0.2s ease', marginTop: 8,
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#0369a1'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#0284c7'; e.currentTarget.style.transform = 'translateY(0)'; } }}
            >
              {loading ? (
                <div style={{
                  width: 20, height: 20,
                  border: '3px solid rgba(255,255,255,0.3)',
                  borderTop: '3px solid #ffffff',
                  borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                }} />
              ) : (
                <>
                  <span>Đăng Nhập</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
