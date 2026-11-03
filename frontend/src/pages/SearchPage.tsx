import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useSearchProducts } from '../hooks/useQueries';
import { ProductCard } from '../components/ProductCard';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [input, setInput] = useState(initialQ);

  useEffect(() => {
    setInput(searchParams.get('q') || '');
  }, [searchParams]);

  const { data: results, isLoading } = useSearchProducts(initialQ);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(input.trim() ? { q: input.trim() } : {});
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="max-w-2xl mx-auto text-center mb-10">
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512] mb-3">
          Tìm Kiếm Cà Phê AURA
        </h1>
        <p className="text-sm text-[#777067] mb-6">
          Nhập tên hạt cà phê, vùng nguyên liệu (Buôn Ma Thuột, Cầu Đất) hoặc gu hương vị bạn yêu thích.
        </p>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#777067] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ví dụ: Robusta, Arabica Cầu Đất, Phin, Espresso..."
              className="w-full pl-10 pr-4 py-3 rounded border border-[#E6DED3] bg-[#FFFDF9] text-sm focus:outline-none focus:border-[#A65F3B]"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 rounded bg-[#4A2E24] text-[#FFFDF9] text-sm font-semibold hover:bg-[#3A231B] cursor-pointer"
          >
            Tìm kiếm
          </button>
        </form>
      </div>

      {!initialQ ? (
        <div className="text-center py-8">
          <p className="text-sm text-[#777067]">
            Gợi ý từ khóa phổ biến:{' '}
            {['Robusta', 'Arabica Cầu Đất', 'Phin Việt', 'Espresso', 'Quà tặng'].map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => setSearchParams({ q: kw })}
                className="mx-1 px-3 py-1 rounded-full bg-[#FFFDF9] border border-[#E6DED3] text-xs font-medium text-[#4A2E24] hover:border-[#A65F3B] cursor-pointer"
              >
                {kw}
              </button>
            ))}
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-96 bg-[#FFFDF9] border border-[#E6DED3] rounded-md animate-pulse" />
          ))}
        </div>
      ) : !results || results.length === 0 ? (
        <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg p-12 text-center max-w-lg mx-auto">
          <p className="font-serif-display text-xl text-[#171512] mb-2">
            Không tìm thấy kết quả cho &ldquo;{initialQ}&rdquo;
          </p>
          <p className="text-sm text-[#777067] mb-5">
            Bạn có thể tham khảo toàn bộ danh mục sản phẩm của AURA COFFEE tại cửa hàng.
          </p>
          <Link
            to="/shop"
            className="inline-block px-5 py-2.5 rounded bg-[#A65F3B] text-[#FFFDF9] text-sm font-medium"
          >
            Xem toàn bộ sản phẩm
          </Link>
        </div>
      ) : (
        <div>
          <p className="text-sm text-[#777067] mb-5">
            Tìm thấy <strong className="text-[#171512]">{results.length}</strong> sản phẩm cho từ khóa &ldquo;{initialQ}&rdquo;:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {results.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
