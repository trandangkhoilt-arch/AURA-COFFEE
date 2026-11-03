import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCart } from '../features/cart/CartContext';
import { formatVND } from '../../shared/constants';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeFromCart, clearCart } = useCart();

  const freeShippingThreshold = 500000;
  const shippingFee = items.length === 0 ? 0 : subtotal >= freeShippingThreshold ? 0 : 30000;
  const total = subtotal + shippingFee;

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-10 sm:p-14">
          <ShoppingBag className="w-14 h-14 text-[#777067]/50 mx-auto mb-4" />
          <h1 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#171512] mb-2">
            Giỏ hàng của bạn đang trống
          </h1>
          <p className="text-sm text-[#777067] mb-6">
            Hãy khám phá những dòng cà phê được tuyển chọn cho gu thưởng thức của bạn tại AURA COFFEE.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold transition-colors"
          >
            <span>Khám phá cửa hàng</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
            Giỏ Hàng Của Bạn
          </h1>
          <p className="text-sm text-[#777067] mt-1">
            Kiểm tra lại sản phẩm, cỡ xay và số lượng trước khi tiến hành đặt hàng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (window.confirm('Bạn có chắc muốn xóa toàn bộ sản phẩm trong giỏ hàng?')) {
              clearCart();
            }
          }}
          className="text-xs text-red-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Xóa toàn bộ giỏ hàng
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Cart Items Table / Cards */}
        <div className="lg:col-span-8 space-y-4">
          {items.map((item) => {
            const unitPrice =
              item.sale_price && item.sale_price > 0 && item.sale_price < item.price
                ? item.sale_price
                : item.price;
            const lineTotal = unitPrice * item.quantity;

            return (
              <div
                key={`${item.productId}-${item.grind_type}`}
                className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <Link to={`/product/${item.slug}`} className="shrink-0">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-20 h-20 sm:w-24 sm:h-24 rounded object-cover bg-[#F7F2EA] border border-[#E6DED3]"
                    />
                  </Link>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[#777067]">
                      {item.origin}
                    </p>
                    <Link
                      to={`/product/${item.slug}`}
                      className="font-semibold text-base text-[#171512] hover:text-[#A65F3B]"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-[#4A2E24] font-medium mt-0.5">
                      Phân loại: {item.grind_type} • Gói {item.weight_grams}g
                    </p>
                    <p className="text-sm font-bold text-[#171512] mt-1">
                      Đơn giá: {formatVND(unitPrice)}
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E6DED3]">
                  <div className="inline-flex items-center border border-[#E6DED3] rounded bg-[#F7F2EA]">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.productId, item.grind_type, item.quantity - 1)
                      }
                      className="p-1.5 text-[#171512] hover:bg-black/5"
                      aria-label="Giảm số lượng"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-sm font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuantity(item.productId, item.grind_type, item.quantity + 1)
                      }
                      className="p-1.5 text-[#171512] hover:bg-black/5"
                      aria-label="Tăng số lượng"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-base font-bold text-[#4A2E24]">
                      {formatVND(lineTotal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId, item.grind_type)}
                      className="text-xs text-red-700 hover:text-red-900 p-1 cursor-pointer"
                      aria-label="Xóa sản phẩm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#4A2E24] hover:text-[#A65F3B]"
            >
              <ArrowLeft className="w-4 h-4" />
              Tiếp tục mua sắm
            </Link>
          </div>
        </div>

        {/* Order Summary Box */}
        <div className="lg:col-span-4">
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-6 sticky top-24 space-y-4">
            <h2 className="font-serif-display text-xl font-bold text-[#171512] pb-3 border-b border-[#E6DED3]">
              Tóm Tắt Đơn Hàng
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-[#777067]">Tạm tính:</span>
                <span className="font-semibold text-[#171512]">{formatVND(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#777067]">Phí vận chuyển (tạm tính):</span>
                <span className="font-semibold text-[#171512]">
                  {shippingFee === 0 ? 'Miễn phí' : formatVND(shippingFee)}
                </span>
              </div>
              {shippingFee > 0 && (
                <p className="text-xs text-[#A65F3B] bg-[#F7F2EA] p-2.5 rounded">
                  Mua thêm <strong>{formatVND(freeShippingThreshold - subtotal)}</strong> để được Miễn phí vận chuyển toàn quốc!
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-[#E6DED3] flex justify-between items-baseline">
              <span className="text-base font-bold text-[#171512]">Tổng cộng:</span>
              <span className="text-2xl font-bold text-[#4A2E24]">{formatVND(total)}</span>
            </div>

            <Link
              to="/checkout"
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded bg-[#A65F3B] hover:bg-[#8E4F30] text-[#FFFDF9] text-sm font-semibold transition-colors"
            >
              <span>Tiến hành đặt hàng</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
