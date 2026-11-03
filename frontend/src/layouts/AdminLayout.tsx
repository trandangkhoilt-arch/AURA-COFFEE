import React, { useState } from 'react';
import { Link, NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  FileText,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react';
import { useAdminMe } from '../hooks/useQueries';
import { useCustomerAuth } from '../features/auth/CustomerAuthContext';
import { api } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ToastContext';

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Sản phẩm', icon: Package },
  { to: '/admin/categories', label: 'Danh mục', icon: FolderTree },
  { to: '/admin/orders', label: 'Đơn hàng', icon: ShoppingCart },
  { to: '/admin/customers', label: 'Khách hàng', icon: Users },
  { to: '/admin/content', label: 'Nội dung & Workers KV', icon: FileText },
];

export function AdminLayout() {
  const { data, isLoading } = useAdminMe();
  const { customer, isAdmin, logout: customerLogout } = useCustomerAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const hasAdminAccess = Boolean(data?.user || isAdmin);

  if (!hasAdminAccess) {
    if (isLoading) {
      return (
        <div className="min-h-screen bg-[#F7F2EA] flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-[#4A2E24] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-[#777067]">Đang kiểm tra quyền quản trị...</p>
          </div>
        </div>
      );
    }
    return <Navigate to="/account" replace />;
  }

  const currentUserEmail = data?.user?.email || customer?.email || 'Email quản trị chưa cập nhật';

  const handleLogout = async () => {
    try {
      await api.adminLogout();
      await customerLogout();
      qc.clear();
      showToast('Đã đăng xuất khỏi phiên quản trị.');
      navigate('/account');
    } catch {
      navigate('/account');
    }
  };

  return (
    <div className="h-screen w-full bg-[#F7F2EA] text-[#171512] flex flex-col lg:flex-row overflow-hidden select-text">
      {/* Mobile Top Header */}
      <div className="lg:hidden bg-[#171512] text-[#FFFDF9] px-4 h-14 flex items-center justify-between shrink-0 border-b border-white/10 z-20">
        <Link to="/admin" className="font-serif-display font-bold text-lg tracking-wide">
          AURA <span className="text-[#E5B287] font-normal">Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
          aria-label="Mở menu quản trị"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Fixed 100vh on Desktop, Slide-over Drawer on Mobile */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] h-full flex flex-col justify-between bg-[#171512] text-[#F7F2EA] border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out
          lg:static lg:h-screen lg:w-64 lg:shrink-0 lg:translate-x-0 lg:shadow-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand & User Info (Pinned at top) */}
        <div className="p-5 sm:p-6 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between">
            <Link to="/admin" className="font-serif-display text-2xl font-bold text-[#FFFDF9] tracking-wide inline-block">
              AURA <span className="text-[#E5B287] font-normal">Admin</span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Đóng menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 bg-white/5 rounded-lg border border-white/5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-xs ring-2 ring-emerald-400/20" />
            <p className="text-xs text-[#F7F2EA]/70 truncate font-mono" title={currentUserEmail}>
              {currentUserEmail}
            </p>
          </div>
        </div>

        {/* Navigation Items (Independently scrollable if screen is short or items grow) */}
        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto overscroll-contain custom-scrollbar-dark">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#A65F3B] text-[#FFFDF9] shadow-sm font-semibold'
                      : 'text-[#F7F2EA]/75 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Actions Footer (ALWAYS PINNED AT BOTTOM OF SCREEN) */}
        <div className="p-4 border-t border-white/10 space-y-2 shrink-0 bg-[#171512]">
          <Link
            to="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#E5B287] hover:bg-white/5 hover:text-[#f3caa7] transition-colors"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            <span>Xem trang khách hàng</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-300 hover:text-rose-100 hover:bg-rose-500/15 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area: Independently scrollable right viewport */}
      <main className="flex-1 h-[calc(100vh-3.5rem)] lg:h-screen overflow-y-auto overflow-x-hidden min-w-0 bg-[#F7F2EA] custom-scrollbar flex flex-col">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
