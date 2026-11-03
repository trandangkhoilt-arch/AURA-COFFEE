import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import { api } from '../../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ToastContext';
import { useAdminMe } from '../../hooks/useQueries';
import { useCustomerAuth } from '../../features/auth/CustomerAuthContext';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { data: adminData } = useAdminMe();
  const { customer, isAdmin } = useCustomerAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminData?.user || isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [adminData, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.adminLogin(email.trim(), password);
      await qc.invalidateQueries({ queryKey: ['adminMe'] });
      showToast('Đăng nhập quản trị thành công!', 'success');
      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171512] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-[#E5B287] hover:underline mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Quay về trang chủ AURA COFFEE
        </Link>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#4A2E24] text-[#E5B287] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-serif-display text-2xl font-bold text-[#171512]">
                Quản Trị AURA COFFEE
              </h1>
              <p className="text-xs text-[#777067]">
                Xác thực phiên làm việc bảo mật qua Cloudflare D1
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                Email quản trị viên
              </label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email quản trị"
                className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? 'Đang xác thực...' : 'Đăng nhập hệ thống'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
