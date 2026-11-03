import React from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, PackageSearch, ShoppingBag, Copy } from 'lucide-react';
import { formatVND } from '../../shared/constants';
import { useToast } from '../components/ToastContext';
import type { Order } from '../../shared/types';

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { showToast } = useToast();

  const orderFromState = (location.state as { order?: Order } | null)?.order;
  const orderCode = searchParams.get('code') || orderFromState?.order_code || '';

  const copyCode = () => {
    if (!orderCode) return;
    navigator.clipboard.writeText(orderCode);
    showToast(`Đã sao chép mã đơn hàng ${orderCode}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-14 sm:py-20">
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sm:p-10 text-center shadow-xs">
        <div className="w-16 h-16 rounded-full bg-[#183B2D] text-[#E5B287] flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <p className="text-xs uppercase tracking-[0.2em] text-[#A65F3B] font-semibold mb-1.5">
          ĐẶT HÀNG THÀNH CÔNG
        </p>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
          Cảm ơn bạn đã chọn AURA COFFEE!
        </h1>
        <p className="text-sm text-[#777067] mt-2.5 max-w-md mx-auto leading-relaxed">
          Đơn hàng của bạn đã được ghi nhận vào hệ thống và đang chờ bộ phận rang xay xác nhận đóng gói.
        </p>

        {orderCode && (
          <div className="mt-6 inline-flex items-center gap-3 bg-[#F7F2EA] border border-[#E6DED3] px-5 py-3 rounded-md">
            <div className="text-left">
              <span className="text-[11px] uppercase tracking-wider text-[#777067] block">
                Mã đơn hàng của bạn
              </span>
              <strong className="text-lg font-mono font-bold text-[#4A2E24]">
                {orderCode}
              </strong>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="p-2 rounded hover:bg-black/5 text-[#4A2E24] cursor-pointer"
              title="Sao chép mã đơn hàng"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}

        {orderFromState && (
          <div className="mt-6 text-left bg-[#F7F2EA]/70 border border-[#E6DED3] rounded-md p-5 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-[#777067]">Người nhận:</span>
              <span className="font-semibold text-[#171512]">{orderFromState.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#777067]">Số điện thoại:</span>
              <span className="font-semibold text-[#171512]">{orderFromState.customer_phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#777067]">Địa chỉ nhận hàng:</span>
              <span className="font-semibold text-[#171512] text-right">
                {orderFromState.shipping_address}, {orderFromState.ward}, {orderFromState.district},{' '}
                {orderFromState.province}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-[#E6DED3]">
              <span className="font-bold text-[#171512]">Tổng thanh toán (COD):</span>
              <span className="font-bold text-[#4A2E24] text-base">
                {formatVND(orderFromState.total)}
              </span>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/account"
            className="inline-flex items-center gap-2 px-5 py-3 rounded bg-[#4A2E24] hover:bg-[#3A231B] text-[#FFFDF9] text-sm font-semibold"
          >
            <PackageSearch className="w-4 h-4" />
            Quản lý Đơn hàng của tôi
          </Link>

          <Link
            to={`/track-order${orderCode ? `?code=${encodeURIComponent(orderCode)}` : ''}`}
            className="inline-flex items-center gap-2 px-5 py-3 rounded border border-[#4A2E24] text-[#4A2E24] hover:bg-[#4A2E24]/5 text-sm font-semibold"
          >
            Tra cứu mã đơn
          </Link>

          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-5 py-3 rounded border border-[#E6DED3] bg-[#FFFDF9] hover:bg-[#F7F2EA] text-[#171512] text-sm font-medium"
          >
            <ShoppingBag className="w-4 h-4" />
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    </div>
  );
}
