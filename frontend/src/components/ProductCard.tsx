import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Star, Eye } from 'lucide-react';
import type { Product } from '../../shared/types';
import { formatVND } from '../../shared/constants';
import { useCart } from '../features/cart/CartContext';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();

  const hasSale =
    Boolean(product.sale_price) &&
    Number(product.sale_price) > 0 &&
    Number(product.sale_price) < product.price;
  const displayPrice = hasSale ? Number(product.sale_price) : product.price;
  const inStock = product.stock > 0;

  return (
    <article className="group bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-3 sm:p-3.5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#4A2E24]/10">
      <div>
        <div className="relative aspect-[4/4.5] w-full overflow-hidden rounded-lg bg-[#F7F2EA] mb-3.5">
          <Link to={`/product/${product.slug}`} className="block w-full h-full">
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            />
          </Link>

          {product.badge_text && (
            <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase rounded bg-[#171512]/85 text-[#FFFDF9] backdrop-blur-xs">
              {product.badge_text}
            </span>
          )}

          <span
            className={`absolute top-2.5 right-2.5 px-2 py-0.5 text-[11px] font-medium rounded ${
              inStock
                ? 'bg-[#183B2D]/90 text-[#FFFDF9]'
                : 'bg-red-800/90 text-white'
            }`}
          >
            {inStock ? `Còn ${product.stock} gói` : 'Hết hàng'}
          </span>
        </div>

        <div className="px-0.5">
          <p className="text-[11px] uppercase tracking-wider text-[#777067] font-medium mb-0.5 truncate">
            {product.origin}
          </p>

          <Link
            to={`/product/${product.slug}`}
            className="block font-semibold text-sm sm:text-[15px] text-[#171512] uppercase tracking-tight hover:text-[#A65F3B] transition-colors line-clamp-2 min-h-10"
          >
            {product.name}
          </Link>

          <p className="text-xs text-[#777067] mt-1 line-clamp-1">
            {product.tasting_notes}
          </p>

          {product.reviews_count > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center text-[#D99B26]" aria-label={`Đánh giá ${product.rating_avg} trên 5 sao`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className="w-3.5 h-3.5 fill-[#D99B26] text-[#D99B26]"
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-[#171512]">
                {Number(product.rating_avg).toFixed(1)}
              </span>
              <span className="text-xs text-[#777067]">
                ({product.reviews_count})
              </span>
            </div>
          )}

          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-base sm:text-lg font-bold text-[#171512]">
              {formatVND(displayPrice)}
            </span>
            {hasSale && (
              <span className="text-xs text-[#777067] line-through">
                {formatVND(product.price)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3.5 pt-1 flex items-center gap-1.5">
        <button
          type="button"
          disabled={!inStock}
          onClick={() => addToCart(product, 1, 'Nguyên hạt')}
          style={{
            backgroundColor: inStock ? product.button_color || '#4A2E24' : '#9CA3AF',
          }}
          className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded text-xs sm:text-sm font-medium text-[#FFFDF9] hover:opacity-95 active:scale-[0.99] transition-all disabled:cursor-not-allowed cursor-pointer"
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          <span>{inStock ? 'Thêm vào giỏ' : 'Tạm hết hàng'}</span>
        </button>

        <Link
          to={`/product/${product.slug}`}
          title="Xem chi tiết sản phẩm"
          aria-label={`Xem chi tiết ${product.name}`}
          className="p-2.5 rounded border border-[#E6DED3] text-[#4A2E24] hover:bg-[#F7F2EA] transition-colors"
        >
          <Eye className="w-4 h-4" />
        </Link>
      </div>
    </article>
  );
}
