import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { useBlogPosts } from '../hooks/useQueries';

export default function BlogPage() {
  const { data: posts, isLoading } = useBlogPosts();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="max-w-2xl mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-[#A65F3B] font-semibold mb-2">
          GÓC CHIA SẺ AURA COFFEE
        </p>
        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512]">
          Cẩm Nang &amp; Văn Hóa Cà Phê Việt
        </h1>
        <p className="text-sm text-[#777067] mt-2">
          Kiến thức về hạt cà phê rang mộc, hướng dẫn pha phin, pha máy và câu chuyện từ các vùng nguyên liệu.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-80 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts?.map((post) => (
            <article
              key={post.id}
              className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <Link to={`/blog/${post.slug}`} className="block aspect-video overflow-hidden bg-[#F7F2EA]">
                  <img
                    src={post.cover_image}
                    alt={post.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </Link>
                <div className="p-5">
                  <div className="flex items-center justify-between text-xs text-[#777067] mb-2">
                    <span className="font-semibold text-[#A65F3B] uppercase tracking-wider">
                      {post.category}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {post.reading_time}
                    </span>
                  </div>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="font-serif-display text-xl font-bold text-[#171512] hover:text-[#A65F3B] line-clamp-2"
                  >
                    {post.title}
                  </Link>
                  <p className="text-xs sm:text-sm text-[#777067] mt-2 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5">
                <Link
                  to={`/blog/${post.slug}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A2E24] hover:text-[#A65F3B]"
                >
                  <span>Đọc bài viết</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
