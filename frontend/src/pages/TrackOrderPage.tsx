import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { PackageSearch, Clock, MapPin, Phone, User } from 'lucide-react';
import { api, getLocalCachedOrders } from '../services/api';
import type { Order } from '../../shared/types';
import { formatVND, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../shared/constants';

export default function TrackOrderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const initialPhone = searchParams.get('phone') || '';

  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [phoneOrderList, setPhoneOrderList] = useState<Order[]>([]);

  const lookupOrder = async (targetCode: string, targetPhone?: string) => {
    const cleanCode = targetCode.trim();
    const cleanPhone = (targetPhone || '').trim();
    if (!cleanCode && !cleanPhone) {
      setError('Vui lòng nhập Mã đơn hàng hoặc Số điện thoại đặt hàng của bạn.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.trackOrder(cleanCode, cleanPhone);
      setOrder(res);
      if (res.allOrdersByPhone && res.allOrdersByPhone.length > 0) {
        setPhoneOrderList(res.allOrdersByPhone);
      } else {
        setPhoneOrderList([]);
      }
    } catch (err: any) {
      // Nếu không tìm thấy trên server, kiểm tra thêm trong bộ nhớ trình duyệt
      const localMatches = getLocalCachedOrders().filter(
        (o) =>
          (cleanCode && o.order_code.toUpperCase() === cleanCode.toUpperCase()) ||
          (cleanPhone && o.customer_phone === cleanPhone)
      );
      if (localMatches.length > 0) {
        setOrder(localMatches[0]);
        setPhoneOrderList(localMatches.length > 1 ? localMatches : []);
      } else {
        setOrder(null);
        setPhoneOrderList([]);
        setError(err.message || 'Không tìm thấy đơn hàng với thông tin này.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialCode || initialPhone) {
      lookupOrder(initialCode, initialPhone);
    }
  }, [initialCode, initialPhone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Record<string, string> = {};
    if (code.trim()) params.code = code.trim().toUpperCase();
    if (phone.trim()) params.phone = phone.trim();
    setSearchParams(params);
    lookupOrder(code, phone);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="text-center max-w-xl mx-auto mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A65F3B] font-semibold mb-2">
          THEO DÕI ĐƠN HÀNG
        </p>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
          Tra Cứu Trạng Thái Đơn Hàng
        </h1>
        <p className="text-sm text-[#777067] mt-2">
          Nhập <strong>Mã đơn hàng</strong> (VD: <code className="font-mono text-[#4A2E24]">AURA-261104-4829</code>) hoặc chỉ cần nhập <strong>Số điện thoại đặt hàng</strong> để xem tất cả đơn của bạn.
        </p>
        <p className="text-xs text-[#777067] mt-2">
          Hoặc{' '}
          <Link to="/account" className="text-[#A65F3B] font-semibold underline">
            đăng nhập Tài khoản của bạn
          </Link>{' '}
          để quản lý toàn bộ lịch sử đơn hàng tự động.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5 sm:p-6 mb-8 grid grid-cols-1 sm:grid-cols-12 gap-3"
      >
        <div className="sm:col-span-5">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Mã đơn hàng (VD: AURA-261104-xxxx)"
            className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm font-mono uppercase focus:outline-none focus:border-[#A65F3B]"
          />
        </div>
        <div className="sm:col-span-4">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Số điện thoại đặt hàng (09...)"
            className="w-full px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
          />
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full h-full py-2.5 px-4 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <PackageSearch className="w-4 h-4" />
            <span>{loading ? 'Đang tìm...' : 'Tra cứu'}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 text-center text-sm text-red-800 mb-6">
          {error}
        </div>
      )}

      {phoneOrderList.length > 1 && (
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-5 mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#777067] mb-3">
            Tìm thấy {phoneOrderList.length} đơn hàng với số điện thoại này (Chọn để xem chi tiết):
          </h3>
          <div className="flex flex-wrap gap-2">
            {phoneOrderList.map((o) => (
              <button
                key={o.order_code}
                type="button"
                onClick={() => setOrder(o)}
                className={`px-3.5 py-2 rounded border text-xs font-mono font-bold transition-colors cursor-pointer ${
                  order?.order_code === o.order_code
                    ? 'bg-[#4A2E24] text-[#FFFDF9] border-[#4A2E24]'
                    : 'bg-[#F7F2EA] text-[#171512] border-[#E6DED3] hover:border-[#A65F3B]'
                }`}
              >
                {o.order_code} ({formatVND(o.total)})
              </button>
            ))}
          </div>
        </div>
      )}

      {order && (
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E6DED3]">
            <div>
              <span className="text-xs text-[#777067] block">Mã đơn hàng</span>
              <h2 className="font-mono text-xl font-bold text-[#171512]">{order.order_code}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  ORDER_STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {ORDER_STATUS_LABELS[order.status] || order.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs sm:text-sm bg-[#F7F2EA] p-4 rounded border border-[#E6DED3]">
            <div className="flex items-start gap-2.5">
              <User className="w-4 h-4 text-[#A65F3B] shrink-0 mt-0.5" />
              <div>
                <span className="text-[#777067] block text-xs">Người nhận</span>
                <strong className="text-[#171512]">{order.customer_name}</strong>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <Phone className="w-4 h-4 text-[#A65F3B] shrink-0 mt-0.5" />
              <div>
                <span className="text-[#777067] block text-xs">Số điện thoại</span>
                <strong className="text-[#171512]">{order.customer_phone}</strong>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-[#A65F3B] shrink-0 mt-0.5" />
              <div>
                <span className="text-[#777067] block text-xs">Khu vực giao</span>
                <strong className="text-[#171512]">
                  {order.district}, {order.province}
                </strong>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-serif-display text-lg font-bold text-[#171512] mb-3">
              Sản phẩm trong đơn
            </h3>
            <div className="divide-y divide-[#E6DED3] border border-[#E6DED3] rounded">
              {order.items?.map((item) => (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-[#171512]">{item.product_name_snapshot}</p>
                    <p className="text-xs text-[#777067]">
                      {item.grind_type} • Số lượng: {item.quantity} × {formatVND(item.unit_price)}
                    </p>
                  </div>
                  <span className="font-bold text-[#4A2E24]">{formatVND(item.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end items-baseline gap-4 text-sm">
              <span className="text-[#777067]">
                Phí vận chuyển: {formatVND(order.shipping_fee)}
              </span>
              <span className="text-base font-bold text-[#171512]">
                Tổng thanh toán: {formatVND(order.total)}
              </span>
            </div>
          </div>

          {/* Status History */}
          {order.history && order.history.length > 0 && (
            <div className="pt-4 border-t border-[#E6DED3]">
              <h3 className="font-serif-display text-lg font-bold text-[#171512] mb-3">
                Lịch sử trạng thái đơn hàng
              </h3>
              <div className="space-y-2.5">
                {order.history.map((h) => (
                  <div key={h.id} className="flex items-start gap-3 text-xs">
                    <Clock className="w-4 h-4 text-[#A65F3B] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[#171512]">
                        {ORDER_STATUS_LABELS[h.new_status] || h.new_status}
                      </span>{' '}
                      — <span className="text-[#777067]">{h.note}</span>
                      <span className="block text-[11px] text-[#777067]">{h.created_at}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
