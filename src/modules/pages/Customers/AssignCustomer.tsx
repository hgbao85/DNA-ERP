import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext'
import { getRetailCustomers, getSalesUsers, assignRetailCustomerSales } from '../../../services/api';
import { Users, UserCheck, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function AssignCustomer() {
  const { user, isManager } = useAuth();
  const [customers, setCustomers] = useState<any[]>([]);
  const [salesUsers, setSalesUsers] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedSalesId, setSelectedSalesId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load danh sách ban đầu
  const loadData = async () => {
    try {
      setFetching(true);
      setError(null);
      
      const [customerList, salesList] = await Promise.all([
        getRetailCustomers(),
        getSalesUsers()
      ]);

      setCustomers(customerList);
      setSalesUsers(salesList);
    } catch (err: any) {
      console.error('Lỗi tải dữ liệu phân công:', err);
      setError('Không thể tải danh sách Khách hàng hoặc Nhân viên Sales');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (isManager) {
      loadData();
    }
  }, [isManager]);

  // Chặn truy cập nếu không phải MANAGER
  if (!isManager) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        textAlign: 'center',
        background: 'var(--surface)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        margin: '20px'
      }}>
        <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: 16 }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px 0' }}>
          TRUY CẬP BỊ TỪ CHỐI
        </h3>
        <p style={{ fontSize: 14, color: 'var(--text3)', margin: 0, maxWidth: 400 }}>
          Xin lỗi, chỉ có Giám đốc (MANAGER) mới được quyền truy cập tính năng phân công chăm sóc khách hàng này.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !selectedSalesId) {
      setError('Vui lòng chọn đầy đủ Khách hàng và Nhân viên Sales');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await assignRetailCustomerSales(+selectedCustomerId, +selectedSalesId);
      
      // Tìm tên khách hàng & sales để hiện thông báo chi tiết
      const cust = customers.find(c => c.id === +selectedCustomerId);
      const sale = salesUsers.find(s => s.id === +selectedSalesId);
      
      setSuccessMsg(`Đã phân công khách hàng "${cust?.name}" cho nhân viên "${sale?.name}" thành công!`);
      
      // Reset form lựa chọn
      setSelectedCustomerId('');
      setSelectedSalesId('');
      
      // Tải lại danh sách để cập nhật trạng thái mới nhất
      await loadData();
    } catch (err: any) {
      console.error('Lỗi phân công khách hàng:', err);
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi thực hiện phân công');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 0' }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to right, var(--surface), var(--surface2))',
          display: 'flex',
          alignItems: 'center',
          gap: 16
        }}>
          <div style={{
            background: 'var(--blue-bg)',
            padding: 12,
            borderRadius: 12,
            color: 'var(--blue)',
            display: 'flex'
          }}>
            <Users size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text)' }}>
              Phân Công Chăm Sóc Khách Hàng
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>
              Gán Khách hàng cho Nhân viên Sales chịu trách nhiệm chăm sóc trực tiếp
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: '32px' }}>
          {fetching ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
              <div style={{
                width: 32,
                height: 32,
                border: '3px solid var(--border)',
                borderTop: '3px solid var(--blue)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: 16
              }} />
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Đang tải danh sách...</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Thông báo thành công */}
              {successMsg && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  padding: '16px',
                  borderRadius: 'var(--radius)',
                  color: '#22c55e',
                  fontSize: 14,
                  fontWeight: 500,
                  animation: 'fadeIn 0.3s ease'
                }}>
                  <CheckCircle2 size={20} style={{ flexShrink: 0 }} />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Thông báo lỗi */}
              {error && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '16px',
                  borderRadius: 'var(--radius)',
                  color: '#ef4444',
                  fontSize: 14,
                  fontWeight: 500,
                  animation: 'fadeIn 0.3s ease'
                }}>
                  <ShieldAlert size={20} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Dropdown chọn Khách Hàng */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                  1. Chọn Khách Hàng cần phân công <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text)',
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customers.map((c) => {
                    const statusText = c.assignedSales 
                      ? `(Đang gán: ${c.assignedSales.name})` 
                      : '(Chưa gán ai)';
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} - {c.phone} {statusText}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Dropdown chọn Nhân viên Sales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>
                  2. Chọn Nhân Viên phụ trách <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedSalesId}
                  onChange={(e) => setSelectedSalesId(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    backgroundColor: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--text)',
                    fontSize: 14,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Chọn nhân viên sales --</option>
                  {salesUsers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !selectedCustomerId || !selectedSalesId}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: loading ? 'var(--blue-bg)' : 'var(--blue)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: (loading || !selectedCustomerId || !selectedSalesId) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.15)',
                  transition: 'all 0.2s ease',
                  marginTop: 8
                }}
              >
                {loading ? (
                  <div style={{
                    width: 18,
                    height: 18,
                    border: '2.5px solid rgba(255,255,255,0.3)',
                    borderTop: '2.5px solid #ffffff',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                ) : (
                  <>
                    <UserCheck size={18} />
                    <span>Xác Nhận Phân Công</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
