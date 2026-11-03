import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  User,
  Package,
  MapPin,
  Lock,
  LogOut,
  CheckCircle2,
  Clock,
  ShoppingBag,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Phone,
  Mail,
  LayoutDashboard,
  FolderTree,
  ShoppingCart,
  FileText,
  Crown,
  Shield,
  TrendingUp,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useCustomerAuth } from '../features/auth/CustomerAuthContext';
import { useAdminDashboard } from '../hooks/useQueries';
import { api, getLocalCachedOrders, saveOrderToLocalCache } from '../services/api';
import { useToast } from '../components/ToastContext';
import { useCart } from '../features/cart/CartContext';
import {
  formatVND,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  VIETNAMESE_PROVINCES,
} from '../../shared/constants';
import type { Order } from '../../shared/types';

export default function AccountPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab = searchParams.get('tab') || 'orders';

  const { customer, isAdmin, isLoading: authLoading, login, register, updateProfile, logout } =
    useCustomerAuth();

  // Tự động chuyển hướng thẳng vào Bảng điều khiển Quản trị (/admin) khi tài khoản là Admin
  useEffect(() => {
    if (customer && (customer.role === 'admin' || customer.role === 'staff')) {
      navigate('/admin', { replace: true });
    }
  }, [customer, navigate]);

  const { data: adminKpi } = useAdminDashboard(30);
  const { showToast } = useToast();
  const { openDrawer } = useCart();

  // Auth form mode ('login' | 'register')
  const [authMode, setAuthMode] = useState<'login' | 'register'>(
    searchParams.get('mode') === 'register' ? 'register' : 'login'
  );
  const [submittingAuth, setSubmittingAuth] = useState(false);

  // Login state
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regProvince, setRegProvince] = useState('TP. Hồ Chí Minh');
  const [regDistrict, setRegDistrict] = useState('');
  const [regWard, setRegWard] = useState('');
  const [regAddress, setRegAddress] = useState('');

  // Logged-in dashboard tab ('orders' | 'profile' | 'password')
  const [activeTab, setActiveTab] = useState<'orders' | 'profile' | 'password'>(
    initialTab === 'profile' || initialTab === 'password' ? initialTab : 'orders'
  );

  // Orders state
  const [serverOrders, setServerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState<string>('Đổi ý muốn chọn loại hạt / sản phẩm khác');
  const [cancelReasonCustom, setCancelReasonCustom] = useState<string>('');

  // Profile form state
  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profProvince, setProfProvince] = useState('TP. Hồ Chí Minh');
  const [profDistrict, setProfDistrict] = useState('');
  const [profWard, setProfWard] = useState('');
  const [profAddress, setProfAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Populate profile fields when customer changes
  useEffect(() => {
    if (customer) {
      setProfName(customer.full_name || '');
      setProfPhone(customer.phone || '');
      setProfProvince(customer.province || 'TP. Hồ Chí Minh');
      setProfDistrict(customer.district || '');
      setProfWard(customer.ward || '');
      setProfAddress(customer.shipping_address || '');
    }
  }, [customer]);

  const fetchMyOrders = async () => {
    if (!customer) return;
    setLoadingOrders(true);
    try {
      const list = await api.getCustomerOrders();
      setServerOrders(list);
    } catch {
      // Fallback to local cached orders if offline
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (customer) {
      fetchMyOrders();
    }
  }, [customer?.id, customer?.phone]);

  // Gộp đơn hàng từ Server D1 và LocalStorage của thiết bị để đảm bảo khách hàng luôn thấy 100% đơn đã đặt
  const mergedOrders = useMemo(() => {
    const localOrders = getLocalCachedOrders();
    const map = new Map<string, Order>();

    for (const o of serverOrders) {
      map.set(String(o.order_code).toUpperCase(), o);
    }

    for (const loc of localOrders) {
      const key = String(loc.order_code).toUpperCase();
      if (!map.has(key)) {
        if (!customer) {
          map.set(key, loc);
        } else if (
          loc.user_id === customer.id ||
          (customer.phone && loc.customer_phone === customer.phone) ||
          (loc.customer_email &&
            loc.customer_email.toLowerCase() === customer.email.toLowerCase())
        ) {
          map.set(key, loc);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      String(b.created_at || '').localeCompare(String(a.created_at || ''))
    );
  }, [serverOrders, customer]);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return mergedOrders;
    return mergedOrders.filter((o) => o.status === statusFilter);
  }, [mergedOrders, statusFilter]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !loginPassword) {
      showToast('Vui lòng nhập Email/Số điện thoại và mật khẩu.', 'error');
      return;
    }
    setSubmittingAuth(true);
    try {
      const user = await login({
        identifier: identifier.trim(),
        password: loginPassword,
      });
      if (user.role === 'admin' || user.role === 'staff') {
        showToast(
          'Đăng nhập Quản Trị Viên thành công! Đang chuyển vào Bảng điều khiển...',
          'success'
        );
        navigate('/admin', { replace: true });
        return;
      }
      showToast(`Chào mừng ${user.full_name} quay trở lại!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.', 'error');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAuth(true);
    try {
      const user = await register({
        full_name: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim(),
        password: regPassword,
        province: regProvince,
        district: regDistrict.trim(),
        ward: regWard.trim(),
        shipping_address: regAddress.trim(),
      });
      showToast(`Đăng ký thành công! Xin chào ${user.full_name}.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Không thể đăng ký tài khoản.', 'error');
    } finally {
      setSubmittingAuth(false);
    }
  };

  const fillDemoCustomer = () => {
    setAuthMode('login');
    setIdentifier('0901234567');
    setLoginPassword('MocCoffee@2026');
  };

  const fillDemoAdmin = () => {
    setAuthMode('login');
    setIdentifier('admin@moccoffee.vn');
    setLoginPassword('MocCoffee@2026');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        full_name: profName.trim(),
        phone: profPhone.trim(),
        province: profProvince,
        district: profDistrict.trim(),
        ward: profWard.trim(),
        shipping_address: profAddress.trim(),
      });
      showToast('Đã lưu thông tin tài khoản và địa chỉ mặc định!', 'success');
      fetchMyOrders();
    } catch (err: any) {
      showToast(err.message || 'Không thể cập nhật thông tin.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp.', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await api.updateCustomerPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Đã đổi mật khẩu thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Không thể đổi mật khẩu.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleOpenCancelModal = (order: Order) => {
    setOrderToCancel(order);
    setCancelReasonPreset('Đổi ý muốn chọn loại hạt / sản phẩm khác');
    setCancelReasonCustom('');
  };

  const handleConfirmCancelOrder = async () => {
    if (!orderToCancel) return;
    const order = orderToCancel;
    const finalReason =
      cancelReasonPreset === 'Khác'
        ? cancelReasonCustom.trim() || 'Khách hàng chủ động hủy đơn trong trang Tài khoản'
        : cancelReasonPreset;

    setCancellingId(order.id);
    try {
      const updated = await api.cancelCustomerOrder(order.id, finalReason);
      const cancelledOrder: Order = updated || { ...order, status: 'cancelled' };

      // 1. Cập nhật ngay lập tức LocalStorage để không còn trạng thái pending
      saveOrderToLocalCache(cancelledOrder);

      // 2. Cập nhật ngay state serverOrders trong React để giao diện chuyển sang 'Đã hủy' ngay lập tức
      setServerOrders((prev) =>
        prev.map((o) =>
          o.id === order.id || String(o.order_code).toUpperCase() === String(order.order_code).toUpperCase()
            ? { ...o, ...(updated || {}), status: 'cancelled' }
            : o
        )
      );

      // 3. Đóng modal xác nhận
      setOrderToCancel(null);

      // 4. Báo toast thành công
      showToast(`Đã hủy thành công đơn hàng ${order.order_code}.`, 'success');

      // 5. Tải lại từ server để đồng bộ đầy đủ
      try {
        await fetchMyOrders();
      } catch {
        // ignore
      }
    } catch (err: any) {
      showToast(err.message || 'Không thể hủy đơn hàng này.', 'error');
    } finally {
      setCancellingId(null);
    }
  };

  if (authLoading && !customer) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4A2E24] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Nếu là Quản trị viên, không hiển thị giao diện khách hàng mà chuyển hướng thẳng vào /admin
  if (customer && (customer.role === 'admin' || customer.role === 'staff')) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-[#4A2E24] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-[#777067]">
          Đang chuyển hướng sang Bảng Điều Khiển Quản Trị (Admin)...
        </p>
      </div>
    );
  }

  // ============================================================================
  // CHƯA ĐĂNG NHẬP: HIỂN THỊ ĐĂNG NHẬP / ĐĂNG KÝ + ĐƠN HÀNG TRÊN THIẾT BỊ NÀY
  // ============================================================================
  if (!customer) {
    const guestOrdersOnDevice = getLocalCachedOrders();

    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[#A65F3B] font-semibold mb-2">
            TÀI KHOẢN KHÁCH HÀNG AURA COFFEE
          </p>
          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
            Quản Lý Đơn Hàng &amp; Ưu Đãi Thành Viên
          </h1>
          <p className="text-sm text-[#777067] mt-2">
            Đăng nhập hoặc tạo tài khoản bằng Số điện thoại để xem toàn bộ lịch sử đơn hàng của bạn trên mọi thiết bị và lưu sẵn địa chỉ giao hàng nhanh.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Cột trái: Form Đăng nhập / Đăng ký */}
          <div className="lg:col-span-7 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F2EA] rounded-md mb-6 border border-[#E6DED3]">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`py-2.5 text-sm font-semibold rounded transition-colors cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-[#4A2E24] text-[#FFFDF9] shadow-xs'
                    : 'text-[#777067] hover:text-[#171512]'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`py-2.5 text-sm font-semibold rounded transition-colors cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-[#4A2E24] text-[#FFFDF9] shadow-xs'
                    : 'text-[#777067] hover:text-[#171512]'
                }`}
              >
                Đăng ký tài khoản
              </button>
            </div>

            {authMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                    Số điện thoại hoặc Email <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Nhập SĐT (VD: 0901234567) hoặc Email"
                    className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                    Mật khẩu <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full py-3 px-5 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {submittingAuth ? 'Đang đăng nhập...' : 'Đăng nhập vào tài khoản'}
                </button>

                <div className="pt-4 border-t border-[#E6DED3] space-y-2.5">
                  <div className="p-3 rounded bg-[#183B2D]/10 border border-[#183B2D]/20 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-semibold text-[#183B2D] flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        Tài khoản Khách hàng (Quyền giới hạn):
                      </span>
                      <span className="text-[#555] font-mono text-[11px] block mt-0.5">
                        SĐT: <strong>0901234567</strong> • MK: <strong>MocCoffee@2026</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={fillDemoCustomer}
                      className="px-2.5 py-1.5 rounded bg-[#183B2D] hover:bg-[#122C21] text-white text-xs font-semibold shrink-0 cursor-pointer shadow-xs"
                    >
                      Điền ngay
                    </button>
                  </div>

                  <div className="p-3 rounded bg-[#A65F3B]/10 border border-[#A65F3B]/25 flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-semibold text-[#A65F3B] flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5" />
                        Tài khoản Quản trị viên (Admin - Full Option):
                      </span>
                      <span className="text-[#555] font-mono text-[11px] block mt-0.5">
                        Email: <strong>admin@moccoffee.vn</strong> • MK: <strong>MocCoffee@2026</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={fillDemoAdmin}
                      className="px-2.5 py-1.5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-white text-xs font-semibold shrink-0 cursor-pointer shadow-xs"
                    >
                      Điền ngay
                    </button>
                  </div>

                  <p className="text-xs text-center text-[#777067]">
                    Bạn đã đặt hàng nhưng chưa có tài khoản?{' '}
                    <button
                      type="button"
                      onClick={() => setAuthMode('register')}
                      className="text-[#A65F3B] font-semibold underline cursor-pointer"
                    >
                      Đăng ký với cùng Số điện thoại
                    </button>{' '}
                    để tự động đồng bộ toàn bộ đơn đã đặt!
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="p-3 rounded bg-[#183B2D]/10 border border-[#183B2D]/20 text-xs text-[#183B2D] flex items-start gap-2">
                  <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Mọi đơn hàng bạn từng đặt bằng <strong>Số điện thoại</strong> hoặc{' '}
                    <strong>Email</strong> dưới đây sẽ tự động được liên kết vào tài khoản của bạn.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#171512] mb-1">
                      Họ và tên <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171512] mb-1">
                      Số điện thoại nhận hàng <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="0901234567"
                      className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#171512] mb-1">
                      Địa chỉ Email <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="ban@email.com"
                      className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#171512] mb-1">
                      Mật khẩu (tối thiểu 6 ký tự) <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E6DED3]">
                  <p className="text-xs font-semibold text-[#777067] mb-2.5">
                    Địa chỉ giao hàng mặc định (Tùy chọn — sẽ tự động điền khi thanh toán)
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <select
                      value={regProvince}
                      onChange={(e) => setRegProvince(e.target.value)}
                      className="px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-xs focus:outline-none focus:border-[#A65F3B]"
                    >
                      {VIETNAMESE_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={regDistrict}
                      onChange={(e) => setRegDistrict(e.target.value)}
                      placeholder="Quận / Huyện"
                      className="px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-xs focus:outline-none focus:border-[#A65F3B]"
                    />
                    <input
                      type="text"
                      value={regWard}
                      onChange={(e) => setRegWard(e.target.value)}
                      placeholder="Phường / Xã"
                      className="px-3 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-xs focus:outline-none focus:border-[#A65F3B]"
                    />
                  </div>
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Số nhà, tên đường cụ thể..."
                    className="w-full px-3.5 py-2 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-xs focus:outline-none focus:border-[#A65F3B]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingAuth}
                  className="w-full py-3 px-5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                >
                  {submittingAuth ? 'Đang tạo tài khoản...' : 'Hoàn tất đăng ký tài khoản'}
                </button>
              </form>
            )}
          </div>

          {/* Cột phải: Quyền lợi thành viên & Đơn hàng vừa đặt trên trình duyệt này */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-4">
              <h2 className="font-serif-display text-xl font-bold text-[#171512]">
                Quyền lợi Tài khoản AURA COFFEE
              </h2>
              <ul className="space-y-3 text-xs sm:text-sm text-[#777067]">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#183B2D] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#171512]">Đồng bộ đơn hàng tự động:</strong> Xem tất cả đơn hàng đã đặt theo Số điện thoại hoặc Email mà không sợ quên mã đơn.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#183B2D] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#171512]">Thanh toán 1 chạm:</strong> Tự động điền sẵn họ tên, SĐT và địa chỉ nhận hàng ở bước Checkout.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#183B2D] shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-[#171512]">Chủ động quản lý đơn:</strong> Theo dõi lịch sử đóng gói và hỗ trợ hủy đơn trực tiếp khi đơn đang chờ xác nhận.
                  </span>
                </li>
              </ul>

              <div className="pt-3 border-t border-[#E6DED3] flex items-center justify-between text-xs">
                <Link
                  to="/track-order"
                  className="text-[#A65F3B] hover:underline font-semibold inline-flex items-center gap-1"
                >
                  Tra cứu nhanh bằng Mã đơn / SĐT
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <span className="text-[#777067]">Hỗ trợ: [Cập nhật số điện thoại]</span>
              </div>
            </div>

            {/* Hiển thị ngay các đơn vừa đặt trên trình duyệt này nếu có */}
            {guestOrdersOnDevice.length > 0 && (
              <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif-display text-lg font-bold text-[#171512]">
                    Đơn hàng vừa đặt trên thiết bị này ({guestOrdersOnDevice.length})
                  </h3>
                </div>
                <p className="text-xs text-[#777067]">
                  Dưới đây là các đơn hàng bạn đã đặt trên trình duyệt này. Hãy đăng ký/đăng nhập với SĐT{' '}
                  <strong>{guestOrdersOnDevice[0]?.customer_phone}</strong> để lưu vĩnh viễn vào tài khoản!
                </p>
                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                  {guestOrdersOnDevice.map((ord) => (
                    <Link
                      key={ord.order_code}
                      to={`/track-order?code=${encodeURIComponent(ord.order_code)}`}
                      className="block p-3 rounded border border-[#E6DED3] bg-[#F7F2EA]/60 hover:border-[#A65F3B] transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-[#4A2E24]">{ord.order_code}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            ORDER_STATUS_COLORS[ord.status] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {ORDER_STATUS_LABELS[ord.status] || ord.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1.5 text-[#777067]">
                        <span>{ord.customer_name} • {ord.customer_phone}</span>
                        <strong className="text-[#171512]">{formatVND(ord.total)}</strong>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ĐÃ ĐĂNG NHẬP: TRANG QUẢN LÝ TÀI KHOẢN & LỊCH SỬ ĐƠN HÀNG CỦA TÔI
  // ============================================================================
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Top User Banner */}
      <div
        className={`rounded-lg p-6 sm:p-7 mb-8 border transition-all ${
          isAdmin
            ? 'bg-[#171512] text-[#FFFDF9] border-[#A65F3B]/40 shadow-xl'
            : 'bg-[#FFFDF9] text-[#171512] border-[#E6DED3]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center font-serif-display text-2xl font-bold shrink-0 ${
                isAdmin
                  ? 'bg-[#A65F3B] text-white ring-2 ring-[#E5B287]'
                  : 'bg-[#4A2E24] text-[#E5B287]'
              }`}
            >
              {customer.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className={`font-serif-display text-2xl font-bold ${
                    isAdmin ? 'text-[#FFFDF9]' : 'text-[#171512]'
                  }`}
                >
                  {customer.full_name}
                </h1>
                {isAdmin ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#A65F3B] text-white flex items-center gap-1.5 shadow-sm">
                    <Crown className="w-3.5 h-3.5 text-[#FFE3C8]" />
                    Quản Trị Viên (Full Option)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#183B2D]/10 text-[#183B2D]">
                    Thành viên AURA
                  </span>
                )}
              </div>
              <div
                className={`flex flex-wrap items-center gap-4 text-xs mt-1.5 ${
                  isAdmin ? 'text-[#F7F2EA]/75' : 'text-[#777067]'
                }`}
              >
                {customer.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone
                      className={`w-3.5 h-3.5 ${isAdmin ? 'text-[#E5B287]' : 'text-[#A65F3B]'}`}
                    />
                    {customer.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Mail
                    className={`w-3.5 h-3.5 ${isAdmin ? 'text-[#E5B287]' : 'text-[#A65F3B]'}`}
                  />
                  {customer.email}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {isAdmin && (
              <Link
                to="/admin"
                className="px-4 py-2.5 rounded-md bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <LayoutDashboard className="w-4 h-4 text-[#FFE3C8]" />
                Vào Bảng Điều Khiển Admin (Dashboard) →
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await logout();
                showToast('Đã đăng xuất tài khoản.');
              }}
              className={`px-3.5 py-2 rounded border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                isAdmin
                  ? 'border-white/20 text-white/80 hover:bg-white/10 hover:text-white'
                  : 'border-[#E6DED3] hover:bg-[#F7F2EA] text-[#777067] hover:text-[#171512]'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              Đăng xuất
            </button>
          </div>
        </div>

        {/* Admin Live Quick Access Strip */}
        {isAdmin && (
          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Link
              to="/admin"
              className="p-3 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex flex-col justify-between"
            >
              <span className="text-white/60">Doanh thu (30 ngày)</span>
              <strong className="text-base text-[#E5B287] font-semibold mt-1">
                {formatVND(adminKpi?.summary?.totalRevenue ?? 0)}
              </strong>
            </Link>
            <Link
              to="/admin/orders"
              className="p-3 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex flex-col justify-between"
            >
              <span className="text-white/60">Đơn hàng mới</span>
              <strong className="text-base text-white font-semibold mt-1">
                {adminKpi?.summary?.pendingOrders ?? 0} chờ duyệt
              </strong>
            </Link>
            <Link
              to="/admin/products"
              className="p-3 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex flex-col justify-between"
            >
              <span className="text-white/60">Tồn kho cảnh báo</span>
              <strong className="text-base text-amber-300 font-semibold mt-1">
                {adminKpi?.summary?.lowStockCount ?? 0} sản phẩm
              </strong>
            </Link>
            <Link
              to="/admin/content"
              className="p-3 rounded bg-white/5 hover:bg-white/10 border border-white/10 transition-colors flex flex-col justify-between"
            >
              <span className="text-white/60">Người đăng ký tin</span>
              <strong className="text-base text-emerald-400 font-semibold mt-1">
                {adminKpi?.summary?.subscribersCount ?? 0} thành viên
              </strong>
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3 space-y-2">
          {/* NẾU LÀ ADMIN: HIỂN THỊ ĐẦY ĐỦ CÁC CÔNG CỤ QUẢN TRỊ (FULL OPTION) */}
          {isAdmin && (
            <div className="bg-[#FFFDF9] border border-[#A65F3B]/30 rounded-lg p-3 space-y-1.5 shadow-sm mb-4">
              <div className="px-2 py-1 flex items-center justify-between text-xs font-bold text-[#A65F3B] uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" />
                  Quyền Quản Trị Viên
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#A65F3B]/10">Full Option</span>
              </div>
              <Link
                to="/admin"
                className="flex items-center justify-between px-3 py-2 rounded text-xs font-semibold text-[#171512] hover:bg-[#F7F2EA] transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4 text-[#A65F3B]" />
                  Dashboard Doanh Thu
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#777067]" />
              </Link>
              <Link
                to="/admin/orders"
                className="flex items-center justify-between px-3 py-2 rounded text-xs font-semibold text-[#171512] hover:bg-[#F7F2EA] transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-[#A65F3B]" />
                  Quản lý Đơn Toàn Shop
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#777067]" />
              </Link>
              <Link
                to="/admin/products"
                className="flex items-center justify-between px-3 py-2 rounded text-xs font-semibold text-[#171512] hover:bg-[#F7F2EA] transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#A65F3B]" />
                  Quản lý Sản Phẩm & Kho
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#777067]" />
              </Link>
              <Link
                to="/admin/categories"
                className="flex items-center justify-between px-3 py-2 rounded text-xs font-semibold text-[#171512] hover:bg-[#F7F2EA] transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-[#A65F3B]" />
                  Quản lý Danh Mục
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#777067]" />
              </Link>
              <Link
                to="/admin/content"
                className="flex items-center justify-between px-3 py-2 rounded text-xs font-semibold text-[#171512] hover:bg-[#F7F2EA] transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#A65F3B]" />
                  Nội Dung & Tải Ảnh Workers KV
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#777067]" />
              </Link>
            </div>
          )}

          {/* CÁC TAB CÁ NHÂN */}
          {isAdmin && (
            <p className="px-2 pt-1 text-[11px] font-bold text-[#777067] uppercase tracking-wider">
              Tài Khoản Cá Nhân
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab('orders');
              setSearchParams({ tab: 'orders' });
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'orders'
                ? 'bg-[#4A2E24] text-[#FFFDF9]'
                : 'bg-[#FFFDF9] border border-[#E6DED3] text-[#171512] hover:bg-[#F7F2EA]'
            }`}
          >
            <span className="inline-flex items-center gap-2.5">
              <Package className="w-4 h-4" />
              Đơn hàng của tôi
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'orders'
                  ? 'bg-white/20 text-white'
                  : 'bg-[#F7F2EA] text-[#4A2E24]'
              }`}
            >
              {mergedOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setSearchParams({ tab: 'profile' });
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-[#4A2E24] text-[#FFFDF9]'
                : 'bg-[#FFFDF9] border border-[#E6DED3] text-[#171512] hover:bg-[#F7F2EA]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            Thông tin &amp; Địa chỉ nhận hàng
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('password');
              setSearchParams({ tab: 'password' });
            }}
            className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-md text-sm font-semibold transition-colors cursor-pointer ${
              activeTab === 'password'
                ? 'bg-[#4A2E24] text-[#FFFDF9]'
                : 'bg-[#FFFDF9] border border-[#E6DED3] text-[#171512] hover:bg-[#F7F2EA]'
            }`}
          >
            <Lock className="w-4 h-4" />
            Đổi mật khẩu
          </button>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-9">
          {activeTab === 'orders' && (
            <div className="space-y-5">
              <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-serif-display text-xl font-bold text-[#171512]">
                    Lịch Sử Đơn Hàng Của Tôi ({mergedOrders.length})
                  </h2>
                  <p className="text-xs text-[#777067] mt-0.5">
                    Hiển thị tất cả đơn hàng gắn với tài khoản, số điện thoại{' '}
                    <strong>{customer.phone || 'của bạn'}</strong> hoặc email{' '}
                    <strong>{customer.email}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchMyOrders}
                  disabled={loadingOrders}
                  className="px-3 py-1.5 rounded border border-[#E6DED3] bg-[#F7F2EA] hover:bg-[#E6DED3]/60 text-xs font-semibold text-[#4A2E24] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>

              {/* Status Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'all', label: 'Tất cả đơn' },
                  { key: 'pending', label: 'Chờ xác nhận' },
                  { key: 'confirmed', label: 'Đã xác nhận' },
                  { key: 'processing', label: 'Đang đóng gói' },
                  { key: 'shipped', label: 'Đang giao' },
                  { key: 'delivered', label: 'Đã giao' },
                  { key: 'cancelled', label: 'Đã hủy' },
                ].map((st) => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setStatusFilter(st.key)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                      statusFilter === st.key
                        ? 'bg-[#4A2E24] text-[#FFFDF9] border-[#4A2E24]'
                        : 'bg-[#FFFDF9] text-[#777067] border-[#E6DED3] hover:text-[#171512]'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-12 text-center">
                  <ShoppingBag className="w-12 h-12 text-[#777067]/40 mx-auto mb-3" />
                  <h3 className="font-serif-display text-xl font-bold text-[#171512] mb-1">
                    Chưa có đơn hàng nào
                  </h3>
                  <p className="text-xs sm:text-sm text-[#777067] mb-5 max-w-md mx-auto">
                    {statusFilter === 'all'
                      ? 'Bạn chưa có đơn hàng nào được ghi nhận. Hãy khám phá những dòng cà phê tuyển chọn của AURA COFFEE nhé!'
                      : 'Không có đơn hàng nào ở trạng thái này.'}
                  </p>
                  <Link
                    to="/shop"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold"
                  >
                    Khám phá Cửa hàng
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.order_code}
                      className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5 sm:p-6 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#E6DED3]">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-base sm:text-lg font-bold text-[#4A2E24]">
                              {order.order_code}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                ORDER_STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {ORDER_STATUS_LABELS[order.status] || order.status}
                            </span>
                          </div>
                          <p className="text-xs text-[#777067] mt-0.5">
                            Ngày đặt: {order.created_at} • Người nhận:{' '}
                            <strong className="text-[#171512]">{order.customer_name}</strong> (
                            {order.customer_phone})
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs text-[#777067] block">Tổng thanh toán</span>
                          <strong className="text-lg font-bold text-[#171512]">
                            {formatVND(order.total)}
                          </strong>
                        </div>
                      </div>

                      {/* Danh sách sản phẩm trong đơn */}
                      {order.items && order.items.length > 0 && (
                        <div className="divide-y divide-[#E6DED3] border border-[#E6DED3] rounded bg-[#F7F2EA]/40">
                          {order.items.map((item, idx) => (
                            <div
                              key={item.id || idx}
                              className="p-3 flex items-center justify-between gap-3 text-xs sm:text-sm"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {item.image_url_snapshot && (
                                  <img
                                    src={item.image_url_snapshot}
                                    alt={item.product_name_snapshot}
                                    className="w-12 h-12 rounded object-cover border border-[#E6DED3] bg-white shrink-0"
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#171512] truncate">
                                    {item.product_name_snapshot}
                                  </p>
                                  <p className="text-xs text-[#777067]">
                                    {item.grind_type} • SL: {item.quantity} ×{' '}
                                    {formatVND(item.unit_price)}
                                  </p>
                                </div>
                              </div>
                              <span className="font-bold text-[#4A2E24] shrink-0">
                                {formatVND(item.line_total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Địa chỉ & Hành động */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                        <div className="text-[#777067]">
                          <strong className="text-[#171512]">Giao đến:</strong>{' '}
                          {order.shipping_address}, {order.ward}, {order.district}, {order.province}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <Link
                            to={`/track-order?code=${encodeURIComponent(order.order_code)}`}
                            className="px-3 py-1.5 rounded border border-[#E6DED3] bg-[#F7F2EA] hover:border-[#A65F3B] text-[#171512] font-semibold"
                          >
                            Chi tiết tiến độ
                          </Link>

                          {order.status === 'pending' && order.id && (
                            <button
                              type="button"
                              disabled={cancellingId === order.id}
                              onClick={() => handleOpenCancelModal(order)}
                              className="px-3 py-1.5 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {cancellingId === order.id ? 'Đang hủy...' : 'Hủy đơn'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <form
              onSubmit={handleSaveProfile}
              className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8 space-y-5"
            >
              <div>
                <h2 className="font-serif-display text-xl font-bold text-[#171512]">
                  Thông Tin Cá Nhân &amp; Địa Chỉ Nhận Hàng Mặc Định
                </h2>
                <p className="text-xs text-[#777067] mt-1">
                  Thông tin này sẽ được tự động điền sẵn mỗi khi bạn đặt hàng tại AURA COFFEE.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                    Họ và tên người nhận <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                    Số điện thoại liên hệ <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                  Email đăng nhập (Không thay đổi)
                </label>
                <input
                  type="email"
                  disabled
                  value={customer.email}
                  className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#E6DED3]/40 text-sm text-[#777067] cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                    Tỉnh / Thành phố
                  </label>
                  <select
                    value={profProvince}
                    onChange={(e) => setProfProvince(e.target.value)}
                    className="w-full px-3 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                  >
                    {VIETNAMESE_PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                    Quận / Huyện
                  </label>
                  <input
                    type="text"
                    value={profDistrict}
                    onChange={(e) => setProfDistrict(e.target.value)}
                    placeholder="VD: Quận 1"
                    className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                    Phường / Xã
                  </label>
                  <input
                    type="text"
                    value={profWard}
                    onChange={(e) => setProfWard(e.target.value)}
                    placeholder="VD: Phường Bến Nghé"
                    className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                  Số nhà, tên đường cụ thể
                </label>
                <input
                  type="text"
                  value={profAddress}
                  onChange={(e) => setProfAddress(e.target.value)}
                  placeholder="Số 123 Đường Nguyễn Huệ..."
                  className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="px-6 py-3 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                {savingProfile ? 'Đang lưu...' : 'Lưu thông tin & Đồng bộ đơn hàng'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form
              onSubmit={handleSavePassword}
              className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8 space-y-4 max-w-lg"
            >
              <div>
                <h2 className="font-serif-display text-xl font-bold text-[#171512]">
                  Đổi Mật Khẩu Tài Khoản
                </h2>
                <p className="text-xs text-[#777067] mt-1">
                  Sử dụng mật khẩu tối thiểu 6 ký tự để bảo vệ tài khoản của bạn.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                  Mật khẩu hiện tại <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                  Mật khẩu mới <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#171512] mb-1.5">
                  Nhập lại mật khẩu mới <span className="text-red-600">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
                />
              </div>

              <button
                type="submit"
                disabled={savingPassword}
                className="px-6 py-3 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                {savingPassword ? 'Đang cập nhật...' : 'Cập nhật mật khẩu mới'}
              </button>
            </form>
          )}
        </div>
      </div>
      {/* ====================================================================== */}
      {/* MODAL XÁC NHẬN HỦY ĐƠN HÀNG (Thay thế hoàn toàn popup trình duyệt) */}
      {/* ====================================================================== */}
      {orderToCancel && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => {
            if (cancellingId === null) setOrderToCancel(null);
          }}
        >
          <div
            className="bg-[#FFFDF9] border border-[#E6DED3] rounded-2xl max-w-md w-full shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 text-left relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="font-serif-display text-lg font-bold text-[#171512]">
                  Xác nhận hủy đơn hàng
                </h3>
                <p className="text-xs text-[#777067] mt-0.5">
                  Mã đơn: <strong className="font-mono text-[#4A2E24]">{orderToCancel.order_code}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (cancellingId === null) setOrderToCancel(null);
                }}
                disabled={cancellingId !== null}
                className="absolute top-5 right-5 p-1 rounded-md text-[#777067] hover:text-[#171512] hover:bg-[#F7F2EA] transition-colors cursor-pointer"
                aria-label="Đóng modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thông tin đơn hàng tóm tắt */}
            <div className="p-3.5 rounded-xl bg-[#F7F2EA]/80 border border-[#E6DED3] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#777067]">Thời gian đặt:</span>
                <span className="font-medium text-[#171512]">{orderToCancel.created_at}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777067]">Tổng thanh toán:</span>
                <span className="font-bold text-[#4A2E24] text-sm">{formatVND(orderToCancel.total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#777067]">Trạng thái hiện tại:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                  Chờ xác nhận
                </span>
              </div>
            </div>

            {/* Form chọn lý do hủy đơn */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#171512]">
                Lý do hủy đơn hàng <span className="text-red-600">*</span>
              </label>
              <select
                value={cancelReasonPreset}
                onChange={(e) => setCancelReasonPreset(e.target.value)}
                disabled={cancellingId !== null}
                className="w-full text-xs p-2.5 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-[#171512] focus:outline-none focus:border-[#A65F3B] cursor-pointer"
              >
                <option value="Đổi ý muốn chọn loại hạt / sản phẩm khác">Đổi ý muốn chọn loại hạt / sản phẩm khác</option>
                <option value="Muốn thay đổi địa chỉ hoặc số điện thoại nhận hàng">Muốn thay đổi địa chỉ hoặc số điện thoại nhận hàng</option>
                <option value="Thời gian giao hàng chưa phù hợp">Thời gian giao hàng chưa phù hợp</option>
                <option value="Đặt trùng đơn hàng">Đặt trùng đơn hàng</option>
                <option value="Khác">Lý do khác...</option>
              </select>

              {cancelReasonPreset === 'Khác' && (
                <textarea
                  value={cancelReasonCustom}
                  onChange={(e) => setCancelReasonCustom(e.target.value)}
                  disabled={cancellingId !== null}
                  placeholder="Vui lòng nhập lý do cụ thể..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-[#171512] focus:outline-none focus:border-[#A65F3B] mt-1.5"
                />
              )}
            </div>

            {/* Lưu ý chính sách hoàn kho */}
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed">
              <strong>Lưu ý:</strong> Đơn hàng sau khi hủy sẽ không thể hoàn tác. Số lượng tồn kho của các sản phẩm sẽ được tự động hoàn trả vào kho của hệ thống.
            </div>

            {/* Nút hành động */}
            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                disabled={cancellingId !== null}
                onClick={() => setOrderToCancel(null)}
                className="px-4 py-2 rounded-lg border border-[#E6DED3] text-xs font-semibold text-[#777067] hover:text-[#171512] hover:bg-[#F7F2EA] transition-colors cursor-pointer disabled:opacity-50"
              >
                Giữ lại đơn
              </button>
              <button
                type="button"
                disabled={cancellingId !== null}
                onClick={handleConfirmCancelOrder}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {cancellingId !== null ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang hủy đơn...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Xác nhận hủy đơn</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
