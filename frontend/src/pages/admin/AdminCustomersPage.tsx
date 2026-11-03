import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ShoppingBag,
  TrendingUp,
  MapPin,
  Mail,
  Phone,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  CheckCircle2,
  Clock,
  Ban,
  Package,
} from 'lucide-react';
import { useAdminCustomers, useAdminCustomerDetail, useUpdateCustomerStatus } from '../../hooks/useQueries';
import { useToast } from '../../components/ToastContext';
import { formatVND, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../shared/constants';
import type { AdminCustomerItem, Order, OrderStatus } from '../../../shared/types';

export default function AdminCustomersPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('created_desc');

  // Modal xem chi tiết khách hàng
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  const { showToast } = useToast();
  const updateStatusMutation = useUpdateCustomerStatus();

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const queryParams = useMemo(
    () => ({
      page,
      limit,
      q: debouncedSearch,
      role,
      status,
      sort,
    }),
    [page, limit, debouncedSearch, role, status, sort]
  );

  const { data, isLoading, isFetching, refetch } = useAdminCustomers(queryParams);

  const customers = data?.items || [];
  const pagination = data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 };
  const total = pagination.total;
  const totalPages = Math.max(1, pagination.totalPages);

  // Tính toán chỉ số phạm vi đang hiển thị (phù hợp với ảnh mẫu: "Hiển thị 1 - 15 trong tổng số 83 khách hàng")
  const fromItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const toItem = Math.min(total, page * limit);

  // Thống kê nhanh từ danh sách
  const activeCount = customers.filter((c) => c.is_active === 1).length;
  const totalOrdersCount = customers.reduce((sum, c) => sum + (c.order_count || 0), 0);
  const totalSpentSum = customers.reduce((sum, c) => sum + (c.total_spent || 0), 0);

  const handleToggleStatus = async (customer: AdminCustomerItem) => {
    const nextStatus = customer.is_active === 1 ? false : true;
    try {
      await updateStatusMutation.mutateAsync({
        id: customer.id,
        isActive: nextStatus,
      });
      showToast(
        nextStatus
          ? `Đã kích hoạt lại tài khoản của ${customer.full_name}.`
          : `Đã tạm khóa tài khoản của ${customer.full_name}.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Không thể cập nhật trạng thái người dùng.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ====================================================================== */}
      {/* 1. TIÊU ĐỀ TRANG & TỔNG QUAN HỘI VIÊN */}
      {/* ====================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-5 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512]">
              Quản Lý Khách Hàng
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              {total} Người dùng
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#777067]">
            Theo dõi chi tiết hồ sơ tài khoản, lịch sử mua hàng và quản lý trạng thái hội viên AURA COFFEE.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] hover:bg-[#F7F2EA] text-[#777067] hover:text-[#171512] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[#4A2E24]' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 2. 4 THẺ METRIC THỐNG KÊ NHANH */}
      {/* ====================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#777067] font-semibold mb-1">
            <span>TỔNG KHÁCH HÀNG</span>
            <Users className="w-4 h-4 text-[#A65F3B]" />
          </div>
          <p className="font-serif-display text-2xl font-bold text-[#171512]">
            {total} <span className="text-xs font-normal text-[#777067]">tài khoản</span>
          </p>
        </div>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#777067] font-semibold mb-1">
            <span>ĐANG HOẠT ĐỘNG</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-serif-display text-2xl font-bold text-emerald-800">
            {activeCount} <span className="text-xs font-normal text-[#777067]">trên trang này</span>
          </p>
        </div>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#777067] font-semibold mb-1">
            <span>ĐƠN HÀNG PHÁT SINH</span>
            <ShoppingBag className="w-4 h-4 text-amber-600" />
          </div>
          <p className="font-serif-display text-2xl font-bold text-[#171512]">
            {totalOrdersCount} <span className="text-xs font-normal text-[#777067]">đơn hàng</span>
          </p>
        </div>

        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#777067] font-semibold mb-1">
            <span>DOANH SỐ HỘI VIÊN</span>
            <TrendingUp className="w-4 h-4 text-[#183B2D]" />
          </div>
          <p className="font-serif-display text-2xl font-bold text-[#4A2E24]">
            {formatVND(totalSpentSum)}
          </p>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 3. BỘ LỌC & TÌM KIẾM KHÁCH HÀNG */}
      {/* ====================================================================== */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777067]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, email, số điện thoại khách hàng..."
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-[#E6DED3] bg-[#F7F2EA]/40 text-xs sm:text-sm text-[#171512] placeholder-[#777067] focus:outline-none focus:ring-1 focus:ring-[#A65F3B] focus:bg-[#FFFDF9]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777067] hover:text-[#171512] p-0.5"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lọc theo Vai trò */}
          <div className="w-full sm:w-44">
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-xs sm:text-sm text-[#171512] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#A65F3B]"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="customer">Khách hàng (customer)</option>
              <option value="admin">Quản trị viên (admin)</option>
              <option value="staff">Nhân viên (staff)</option>
            </select>
          </div>

          {/* Lọc theo Trạng thái */}
          <div className="w-full sm:w-40">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-xs sm:text-sm text-[#171512] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#A65F3B]"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Đã tạm khóa</option>
            </select>
          </div>

          {/* Sắp xếp */}
          <div className="w-full sm:w-48">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="w-full py-2 px-3 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-xs sm:text-sm text-[#171512] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#A65F3B]"
            >
              <option value="created_desc">Mới đăng ký nhất</option>
              <option value="created_asc">Cũ nhất trước</option>
              <option value="spent_desc">Chi tiêu cao nhất</option>
              <option value="orders_desc">Đơn hàng nhiều nhất</option>
              <option value="name_asc">Tên (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 4. BẢNG DANH SÁCH KHÁCH HÀNG */}
      {/* ====================================================================== */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-[#4A2E24] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-[#777067]">Đang tải danh sách khách hàng từ cơ sở dữ liệu...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-[#F7F2EA]/30">
            <div className="w-12 h-12 rounded-full bg-[#E6DED3]/60 flex items-center justify-center text-[#777067] mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <p className="font-semibold text-sm text-[#171512]">Không tìm thấy khách hàng nào</p>
            <p className="text-xs text-[#777067] max-w-sm mx-auto">
              {search || role !== 'all' || status !== 'all'
                ? 'Thử thay đổi hoặc xóa bộ lọc tìm kiếm để xem các khách hàng khác.'
                : 'Chưa có tài khoản khách hàng nào được đăng ký trong hệ thống.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#F7F2EA] border-b border-[#E6DED3] text-[#777067] font-semibold">
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4">Liên hệ</th>
                  <th className="py-3 px-4">Khu vực / Địa chỉ</th>
                  <th className="py-3 px-4 text-center">Đơn hàng &amp; Chi tiêu</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4">Ngày tham gia</th>
                  <th className="py-3 px-4 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DED3]">
                {customers.map((c) => {
                  const initials = c.full_name
                    ? c.full_name
                        .split(' ')
                        .map((n: string) => n[0])
                        .slice(-2)
                        .join('')
                        .toUpperCase()
                    : 'KH';

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-[#F7F2EA]/40 transition-colors group"
                    >
                      {/* Cột Tên & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              c.role === 'admin'
                                ? 'bg-[#4A2E24] text-[#E5B287]'
                                : 'bg-[#E5B287]/30 text-[#4A2E24] border border-[#E5B287]/60'
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#171512] truncate">
                                {c.full_name}
                              </span>
                              {c.role === 'admin' && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  <ShieldCheck className="w-3 h-3 text-amber-700" />
                                  Admin
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#777067] font-mono">
                              ID: #{c.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Cột Liên hệ */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[#171512]">
                            <Mail className="w-3.5 h-3.5 text-[#777067] shrink-0" />
                            <span className="truncate max-w-[180px]">{c.email}</span>
                          </div>
                          {c.phone ? (
                            <div className="flex items-center gap-1.5 text-[#777067] text-[11px]">
                              <Phone className="w-3 h-3 shrink-0" />
                              <a
                                href={`tel:${c.phone}`}
                                className="hover:text-[#A65F3B] hover:underline"
                              >
                                {c.phone}
                              </a>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#A8A29E] italic">Chưa cập nhật SĐT</span>
                          )}
                        </div>
                      </td>

                      {/* Cột Địa chỉ */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-[200px]">
                          <p className="font-medium text-[#171512] truncate">
                            {c.province || 'Chưa cập nhật'}
                          </p>
                          <p className="text-[11px] text-[#777067] truncate">
                            {[c.ward, c.district].filter(Boolean).join(', ') || c.shipping_address || '—'}
                          </p>
                        </div>
                      </td>

                      {/* Cột Đơn hàng & Chi tiêu */}
                      <td className="py-3.5 px-4 text-center">
                        <div>
                          <span className="font-bold text-[#4A2E24] block">
                            {formatVND(c.total_spent || 0)}
                          </span>
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7F2EA] text-[#777067] border border-[#E6DED3]">
                            {c.order_count || 0} đơn hàng
                          </span>
                        </div>
                      </td>

                      {/* Cột Trạng thái & Toggle Switch */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(c)}
                          disabled={updateStatusMutation.isPending}
                          className="inline-flex items-center gap-1.5 cursor-pointer group/toggle"
                          title={c.is_active === 1 ? 'Bấm để tạm khóa tài khoản' : 'Bấm để kích hoạt lại'}
                        >
                          <div
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors relative ${
                              c.is_active === 1 ? 'bg-[#183B2D]' : 'bg-stone-300'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                                c.is_active === 1 ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </div>
                          <span
                            className={`text-[11px] font-semibold ${
                              c.is_active === 1 ? 'text-[#183B2D]' : 'text-stone-500'
                            }`}
                          >
                            {c.is_active === 1 ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </button>
                      </td>

                      {/* Cột Ngày tham gia */}
                      <td className="py-3.5 px-4 text-[11px] text-[#777067] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#A8A29E]" />
                          <span>{String(c.created_at || '').slice(0, 10)}</span>
                        </div>
                      </td>

                      {/* Cột Thao tác */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerId(c.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] hover:bg-[#F7F2EA] text-[#A65F3B] hover:text-[#8E4F30] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                          title="Xem thông tin chi tiết và lịch sử đơn hàng"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ====================================================================== */}
        {/* 5. PHÂN TRANG (CHÍNH XÁC NHƯ ẢNH MẪU YÊU CẦU) */}
        {/* ====================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-[#E6DED3] bg-[#FFFDF9] text-xs text-[#777067]">
          <div>
            Hiển thị <strong className="text-[#171512] font-bold">{fromItem} - {toItem}</strong> trong tổng số <strong className="text-[#171512] font-bold">{total}</strong> khách hàng
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="flex items-center gap-1.5">
              <span>Hiển thị:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-[#E6DED3] bg-[#FFFDF9] px-2.5 py-1 text-xs font-semibold text-[#171512] shadow-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#A65F3B]"
              >
                <option value={10}>10 / trang</option>
                <option value={15}>15 / trang</option>
                <option value={25}>25 / trang</option>
                <option value={50}>50 / trang</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-[#777067] hover:bg-[#F7F2EA] hover:text-[#171512] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-xs"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-xs">
                Trang <strong className="text-[#171512] font-bold">{page} / {totalPages}</strong>
              </span>

              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-[#777067] hover:bg-[#F7F2EA] hover:text-[#171512] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-xs"
                title="Trang tiếp theo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 6. MODAL XEM CHI TIẾT KHÁCH HÀNG & LỊCH SỬ ĐƠN HÀNG */}
      {/* ====================================================================== */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT: MODAL CHI TIẾT KHÁCH HÀNG & LỊCH SỬ ĐƠN HÀNG
// ============================================================================
function CustomerDetailModal({
  customerId,
  onClose,
}: {
  customerId: number;
  onClose: () => void;
}) {
  const { data, isLoading } = useAdminCustomerDetail(customerId);

  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-2xl p-8 max-w-lg w-full text-center space-y-4 shadow-xl">
          <div className="w-8 h-8 border-2 border-[#4A2E24] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#777067]">Đang tải hồ sơ khách hàng...</p>
        </div>
      </div>
    );
  }

  const { user, stats, orders } = data;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="p-5 sm:p-6 border-b border-[#E6DED3] bg-[#F7F2EA] flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#4A2E24] text-[#E5B287] flex items-center justify-center font-bold text-base shadow-xs">
              {user.full_name
                ? user.full_name
                    .split(' ')
                    .map((n: string) => n[0])
                    .slice(-2)
                    .join('')
                    .toUpperCase()
                : 'KH'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif-display text-lg sm:text-xl font-bold text-[#171512]">
                  {user.full_name}
                </h3>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    user.role === 'admin'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900'
                  }`}
                >
                  {user.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                    user.is_active === 1
                      ? 'bg-emerald-50 text-emerald-800'
                      : 'bg-rose-50 text-rose-800'
                  }`}
                >
                  {user.is_active === 1 ? 'Đang hoạt động' : 'Tạm khóa'}
                </span>
              </div>
              <p className="text-xs text-[#777067] mt-0.5">
                Mã hội viên: #{user.id} • Đăng ký ngày {String(user.created_at || '').slice(0, 10)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] text-[#777067] hover:text-[#171512] hover:bg-[#F7F2EA] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nội dung Modal */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* 4 Thẻ thống kê của riêng khách hàng này */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#F7F2EA]/50 border border-[#E6DED3] text-center">
              <span className="text-[10px] font-semibold text-[#777067] uppercase block">Tổng chi tiêu</span>
              <span className="font-bold text-sm text-[#4A2E24] mt-1 block">
                {formatVND(stats.totalSpent)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F2EA]/50 border border-[#E6DED3] text-center">
              <span className="text-[10px] font-semibold text-[#777067] uppercase block">Tổng đơn hàng</span>
              <span className="font-bold text-sm text-[#171512] mt-1 block">
                {stats.totalOrders} đơn
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F2EA]/50 border border-[#E6DED3] text-center">
              <span className="text-[10px] font-semibold text-[#777067] uppercase block">Giá trị TB / đơn</span>
              <span className="font-bold text-sm text-[#183B2D] mt-1 block">
                {formatVND(stats.avgOrderValue)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F7F2EA]/50 border border-[#E6DED3] text-center">
              <span className="text-[10px] font-semibold text-[#777067] uppercase block">Đơn gần nhất</span>
              <span className="font-bold text-xs text-[#777067] mt-1.5 block truncate">
                {stats.latestOrderAt ? String(stats.latestOrderAt).slice(0, 10) : 'Chưa có'}
              </span>
            </div>
          </div>

          {/* Thông tin liên hệ & Địa chỉ giao hàng mặc định */}
          <div className="bg-[#F7F2EA]/30 border border-[#E6DED3] rounded-xl p-4 space-y-3">
            <h4 className="font-serif-display text-sm font-bold text-[#171512]">
              Thông Tin Liên Hệ &amp; Sổ Địa Chỉ
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-[#777067] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[#777067] block text-[10px]">Email:</span>
                  <span className="font-semibold text-[#171512] select-all">{user.email}</span>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="w-3.5 h-3.5 text-[#777067] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[#777067] block text-[10px]">Điện thoại:</span>
                  <span className="font-semibold text-[#171512]">{user.phone || 'Chưa cung cấp'}</span>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:col-span-2">
                <MapPin className="w-3.5 h-3.5 text-[#777067] shrink-0 mt-0.5" />
                <div>
                  <span className="text-[#777067] block text-[10px]">Địa chỉ giao hàng:</span>
                  <span className="font-medium text-[#171512]">
                    {[user.shipping_address, user.ward, user.district, user.province]
                      .filter(Boolean)
                      .join(', ') || 'Chưa lưu địa chỉ'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Lịch sử các đơn hàng của khách */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-serif-display text-sm font-bold text-[#171512]">
                Lịch Sử Đặt Hàng ({orders.length} đơn)
              </h4>
            </div>

            {orders.length === 0 ? (
              <div className="p-6 text-center bg-[#F7F2EA]/40 rounded-xl border border-dashed border-[#E6DED3]">
                <Package className="w-6 h-6 text-[#777067] mx-auto mb-1.5 opacity-60" />
                <p className="font-semibold text-xs text-[#171512]">Chưa phát sinh đơn hàng nào</p>
                <p className="text-[11px] text-[#777067] mt-0.5">Khách hàng chưa thực hiện giao dịch mua cà phê trên website.</p>
              </div>
            ) : (
              <div className="border border-[#E6DED3] rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F7F2EA] border-b border-[#E6DED3] text-[#777067]">
                      <th className="py-2.5 px-3">Mã đơn</th>
                      <th className="py-2.5 px-3">Thời gian</th>
                      <th className="py-2.5 px-3">Tổng tiền</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                      <th className="py-2.5 px-3 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6DED3]">
                    {orders.map((o: Order) => (
                      <tr key={o.id} className="hover:bg-[#F7F2EA]/40 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-[#4A2E24]">
                          {o.order_code}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[#777067] whitespace-nowrap">
                          {String(o.created_at || '').slice(0, 16)}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#171512]">
                          {formatVND(o.total)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              (ORDER_STATUS_COLORS as Record<string, string>)[o.status] || ''
                            }`}
                          >
                            {(ORDER_STATUS_LABELS as Record<string, string>)[o.status] || o.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            to={`/admin/orders/${o.id}`}
                            onClick={onClose}
                            className="inline-flex items-center gap-1 font-semibold text-[#A65F3B] hover:text-[#8E4F30] hover:underline"
                          >
                            Xem đơn <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-[#E6DED3] bg-[#F7F2EA] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#E6DED3] bg-[#FFFDF9] hover:bg-[#F7F2EA] text-[#171512] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
