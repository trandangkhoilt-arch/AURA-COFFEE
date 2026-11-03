import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useCategoryBySlug, useCategories } from '../hooks/useQueries';
import { ProductCard } from '../components/ProductCard';

export default function CategoryPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data, isLoading, isError } = useCategoryBySlug(slug);
  const { data: allCategories } = useCategories();

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="h-32 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-96 bg-[#FFFDF9] border border-[#E6DED3] rounded-md animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data?.category) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif-display text-3xl font-bold text-[#171512] mb-3">
          Không tìm thấy danh mục
        </h1>
        <p className="text-sm text-[#777067] mb-6">
          Danh mục bạn đang tìm kiếm không tồn tại hoặc đã được thay đổi.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại Cửa hàng
        </Link>
      </div>
    );
  }

  const { category, products } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="bg-[#183B2D] text-[#FFFDF9] rounded-lg p-6 sm:p-10 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#E5B287] font-semibold mb-2">
            BỘ SƯU TẬP AURA COFFEE
          </p>
          <h1 className="font-serif-display text-3xl sm:text-4xl font-bold">
            {category.name}
          </h1>
          <p className="text-sm text-[#F7F2EA]/80 mt-2 max-w-2xl">
            {category.description}
          </p>
        </div>
        <Link
          to="/shop"
          className="px-4 py-2 rounded border border-white/25 text-xs font-medium hover:bg-white/10 shrink-0"
        >
          Xem toàn bộ cửa hàng
        </Link>
      </div>

      {/* Category Switcher */}
      {allCategories && allCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {allCategories.map((c) => (
            <Link
              key={c.id}
              to={`/category/${c.slug}`}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                c.slug === slug
                  ? 'bg-[#4A2E24] text-[#FFFDF9]'
                  : 'bg-[#FFFDF9] border border-[#E6DED3] text-[#171512] hover:bg-[#E6DED3]/60'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-12 text-center">
          <p className="text-sm text-[#777067]">Hiện chưa có sản phẩm nào trong danh mục này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
