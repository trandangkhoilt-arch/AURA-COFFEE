import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useProducts, useCategories } from '../hooks/useQueries';
import { ProductCard } from '../components/ProductCard';

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCategory = searchParams.get('category') || 'all';
  const initialQuery = searchParams.get('q') || '';

  const [q, setQ] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [priceRange, setPriceRange] = useState<'all' | 'under170' | '170to220' | 'over220'>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);

  const minPrice =
    priceRange === '170to220' ? 170000 : priceRange === 'over220' ? 220000 : undefined;
  const maxPrice =
    priceRange === 'under170' ? 170000 : priceRange === '170to220' ? 220000 : undefined;

  const { data: categories } = useCategories();
  const { data, isLoading, isError } = useProducts({
    page,
    limit: 8,
    q: q.trim() || undefined,
    category,
    minPrice,
    maxPrice,
    inStock: inStockOnly,
    sort,
  });

  const handleCategoryChange = (slug: string) => {
    setCategory(slug);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (slug === 'all') next.delete('category');
    else next.set('category', slug);
    setSearchParams(next);
  };

  const resetFilters = () => {
    setQ('');
    setCategory('all');
    setPriceRange('all');
    setInStockOnly(false);
    setSort('featured');
    setPage(1);
    setSearchParams({});
  };

  const products = data?.items || [];
  const pagination = data?.pagination;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      {/* Page Header */}
      <div className="border-b border-[#E6DED3] pb-8 mb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A65F3B] font-semibold mb-2">
          CỬA HÀNG TRỰC TUYẾN
        </p>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
          Cà Phê Rang Mộc Tuyển Chọn
        </h1>
        <p className="text-sm text-[#777067] mt-2 max-w-2xl">
          Khám phá những dòng cà phê được tuyển chọn kỹ lưỡng, đóng gói giữ hương và hỗ trợ xay theo dụng cụ pha của bạn.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-4 sm:p-5 mb-8 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3.5 justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#777067] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên hạt, vùng trồng (Cầu Đất, Buôn Ma Thuột)..."
              className="w-full pl-10 pr-4 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/50 text-sm focus:outline-none focus:border-[#A65F3B]"
            />
          </div>

          {/* Dropdown filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[#777067] font-medium">
              <SlidersHorizontal className="w-4 h-4 text-[#4A2E24]" />
              <span>Bộ lọc:</span>
            </div>

            <select
              aria-label="Lọc theo mức giá"
              value={priceRange}
              onChange={(e) => {
                setPriceRange(e.target.value as any);
                setPage(1);
              }}
              className="px-3 py-2 rounded border border-[#E6DED3] bg-[#FFFDF9] text-xs sm:text-sm text-[#171512] focus:outline-none focus:border-[#A65F3B]"
            >
              <option value="all">Mọi mức giá</option>
              <option value="under170">Dưới 170.000₫</option>
              <option value="170to220">170.000₫ – 220.000₫</option>
              <option value="over220">Trên 220.000₫</option>
            </select>

            <select
              aria-label="Sắp xếp sản phẩm"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded border border-[#E6DED3] bg-[#FFFDF9] text-xs sm:text-sm text-[#171512] focus:outline-none focus:border-[#A65F3B]"
            >
              <option value="featured">Sắp xếp: Nổi bật nhất</option>
              <option value="price_asc">Giá: Thấp đến Cao</option>
              <option value="price_desc">Giá: Cao đến Thấp</option>
              <option value="rating">Đánh giá cao nhất</option>
              <option value="newest">Mới nhất</option>
            </select>

            <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#171512] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked);
                  setPage(1);
                }}
                className="rounded border-[#E6DED3] text-[#4A2E24] focus:ring-[#A65F3B]"
              />
              <span>Chỉ hiện còn hàng</span>
            </label>

            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs text-[#A65F3B] hover:underline cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Đặt lại
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E6DED3]/70">
          <button
            type="button"
            onClick={() => handleCategoryChange('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              category === 'all'
                ? 'bg-[#4A2E24] text-[#FFFDF9]'
                : 'bg-[#F7F2EA] text-[#171512] hover:bg-[#E6DED3]'
            }`}
          >
            Tất cả danh mục
          </button>

          {categories?.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryChange(cat.slug)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                category === cat.slug
                  ? 'bg-[#4A2E24] text-[#FFFDF9]'
                  : 'bg-[#F7F2EA] text-[#171512] hover:bg-[#E6DED3]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div
              key={n}
              className="bg-[#FFFDF9] border border-[#E6DED3] rounded-md p-4 h-96 animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-10 text-center">
          <p className="text-sm text-red-700">Đã xảy ra lỗi khi tải danh sách sản phẩm.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-12 text-center">
          <p className="font-serif-display text-xl text-[#171512] mb-2">
            Không tìm thấy sản phẩm phù hợp
          </p>
          <p className="text-sm text-[#777067] mb-5">
            Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc của bạn.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-5 py-2.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-sm font-medium"
          >
            Xem tất cả sản phẩm
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded text-sm font-medium transition-colors cursor-pointer ${
                    p === pagination.page
                      ? 'bg-[#4A2E24] text-[#FFFDF9]'
                      : 'bg-[#FFFDF9] border border-[#E6DED3] text-[#171512] hover:bg-[#E6DED3]/50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
