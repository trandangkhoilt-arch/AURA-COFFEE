import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  ShoppingBag,
  Menu,
  X,
  Sprout,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  PackageSearch,
  Shield,
} from 'lucide-react';
import { useCart } from '../features/cart/CartContext';
import { useCustomerAuth } from '../features/auth/CustomerAuthContext';
import { CoffeeChatbot } from '../components/CoffeeChatbot';
import { formatVND } from '../../shared/constants';

const NAV_LINKS = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/shop', label: 'Cửa hàng' },
  { to: '/category/ca-phe-dac-san', label: 'Bộ sưu tập' },
  { to: '/about', label: 'Câu chuyện' },
  { to: '/blog', label: 'Blog' },
  { to: '/contact', label: 'Liên hệ' },
];

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');

  const { customer } = useCustomerAuth();

  const {
    items,
    totalItems,
    subtotal,
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    updateQuantity,
    removeFromCart,
  } = useCart();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 32);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuery.trim()) return;
    setSearchModalOpen(false);
    navigate(`/search?q=${encodeURIComponent(quickQuery.trim())}`);
    setQuickQuery('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F2EA] text-[#171512]">
      {/* Header */}
      <header
        className={`fixed top-0 inset-x-0 z-40 transition-all duration-300 ${
          isHome && !scrolled && !mobileMenuOpen
            ? 'bg-gradient-to-b from-[#171512]/85 via-[#171512]/45 to-transparent text-[#FFFDF9]'
            : 'bg-[#171512]/95 backdrop-blur-md text-[#FFFDF9] border-b border-white/10 shadow-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group focus:outline-none">
            <span className="w-8 h-8 rounded-full bg-[#A65F3B]/20 border border-[#A65F3B]/50 flex items-center justify-center text-[#E5B287]">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M17.5 4.5C13 2 6.5 5 4.5 11.5C2.5 18 6 22 10.5 22.5C15 23 20.5 18.5 20.5 12C20.5 8 19.2 5.4 17.5 4.5ZM16 5.5C11.5 9.5 10.5 15.5 8 21.5" />
              </svg>
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-serif-display text-xl sm:text-2xl font-bold tracking-tight text-[#FFFDF9]">
                AURA
              </span>
              <span className="text-[9px] sm:text-[10px] font-semibold tracking-[0.22em] text-[#E5B287]">
                COFFEE
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-7" aria-label="Menu chính">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors py-1 border-b-2 ${
                    isActive
                      ? 'text-[#E5B287] border-[#A65F3B]'
                      : 'text-[#F7F2EA]/85 border-transparent hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setSearchModalOpen(true)}
              className="p-2 rounded-full text-[#F7F2EA]/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Tìm kiếm sản phẩm"
              title="Tìm kiếm"
            >
              <Search className="w-5 h-5" />
            </button>

            <Link
              to="/track-order"
              className="hidden sm:inline-flex p-2 rounded-full text-[#F7F2EA]/90 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Tra cứu đơn hàng"
              title="Tra cứu đơn hàng"
            >
              <PackageSearch className="w-5 h-5" />
            </Link>

            <Link
              to={customer && (customer.role === 'admin' || customer.role === 'staff') ? '/admin' : '/account'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[#F7F2EA]/90 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
              aria-label={customer && (customer.role === 'admin' || customer.role === 'staff') ? 'Bảng điều khiển Quản trị' : 'Tài khoản & Đơn hàng của tôi'}
              title={customer ? (customer.role === 'admin' || customer.role === 'staff' ? `Admin: ${customer.full_name}` : `Tài khoản: ${customer.full_name}`) : 'Đăng nhập / Đơn hàng của tôi'}
            >
              <User className="w-4 h-4 text-[#E5B287]" />
              <span className="hidden md:inline text-xs font-medium max-w-[110px] truncate">
                {customer ? (customer.role === 'admin' || customer.role === 'staff' ? 'Quản trị' : customer.full_name.split(' ').slice(-2).join(' ')) : 'Tài khoản'}
              </span>
            </Link>

            {customer && (customer.role === 'admin' || customer.role === 'staff') && (
              <Link
                to="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#183B2D] hover:bg-[#122C21] text-[#FFFDF9] text-xs font-semibold shadow-sm transition-colors border border-[#74C69D]/30"
                title="Vào Bảng Điều Khiển Quản Trị Viên (Full Option)"
              >
                <Shield className="w-3.5 h-3.5 text-[#74C69D]" />
                <span>Quản trị</span>
              </Link>
            )}

            <button
              type="button"
              onClick={openDrawer}
              className="relative p-2 rounded-full text-[#F7F2EA]/90 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label={`Giỏ hàng (${totalItems} sản phẩm)`}
              title="Giỏ hàng"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#A65F3B] text-[#FFFDF9] text-[11px] font-bold flex items-center justify-center">
                {totalItems}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-md text-[#F7F2EA] hover:bg-white/10 transition-colors"
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#171512] border-t border-white/10 px-4 pt-3 pb-6 space-y-2">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `block px-3 py-2.5 rounded-md text-base font-medium ${
                    isActive
                      ? 'bg-[#4A2E24] text-[#FFFDF9]'
                      : 'text-[#F7F2EA]/85 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              <Link
                to={customer && (customer.role === 'admin' || customer.role === 'staff') ? '/admin' : '/account'}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm text-[#E5B287] font-semibold flex items-center gap-2"
              >
                <User className="w-4 h-4" />
                {customer && (customer.role === 'admin' || customer.role === 'staff')
                  ? 'Bảng điều khiển Quản Trị (Admin)'
                  : customer
                  ? `Tài khoản: ${customer.full_name}`
                  : 'Tài khoản & Đơn hàng của tôi'}
              </Link>
              <Link
                to="/track-order"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm text-[#F7F2EA]/85 flex items-center gap-2"
              >
                <PackageSearch className="w-4 h-4" />
                Tra cứu đơn hàng
              </Link>
              {customer && (customer.role === 'admin' || customer.role === 'staff') && (
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-3 py-2.5 rounded-md bg-[#183B2D] text-[#FFFDF9] text-sm font-semibold flex items-center gap-2 mt-1"
                >
                  <Shield className="w-4 h-4 text-[#74C69D]" />
                  <span>Vào Bảng Điều Khiển Quản Trị (Admin)</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Quick Search Modal */}
      {searchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-24 px-4">
          <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg max-w-lg w-full p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-serif-display text-lg font-semibold text-[#171512]">
                Tìm kiếm sản phẩm AURA COFFEE
              </h2>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="p-1 text-[#777067] hover:text-[#171512]"
                aria-label="Đóng khung tìm kiếm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleQuickSearch} className="flex gap-2">
              <input
                type="search"
                autoFocus
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="Nhập tên cà phê (Robusta, Arabica Cầu Đất, Phin...)"
                className="flex-1 px-3.5 py-2.5 rounded border border-[#E6DED3] bg-[#F7F2EA]/60 text-sm focus:outline-none focus:border-[#A65F3B]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-sm font-medium hover:bg-[#3A231B] transition-colors cursor-pointer"
              >
                Tìm kiếm
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-out Cart Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            onClick={closeDrawer}
            className="fixed inset-0 bg-black/55 backdrop-blur-xs transition-opacity"
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-[#FFFDF9] shadow-2xl flex flex-col justify-between">
              <div className="p-5 border-b border-[#E6DED3] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-[#4A2E24]" />
                  <h2 className="font-serif-display text-xl font-semibold text-[#171512]">
                    Giỏ hàng ({totalItems})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="p-1.5 rounded-full hover:bg-[#F7F2EA] text-[#777067]"
                  aria-label="Đóng giỏ hàng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 divide-y divide-[#E6DED3]">
                {items.length === 0 ? (
                  <div className="py-16 text-center">
                    <ShoppingBag className="w-12 h-12 text-[#777067]/50 mx-auto mb-3" />
                    <p className="text-[#777067] text-sm mb-4">
                      Giỏ hàng của bạn đang trống.
                    </p>
                    <Link
                      to="/shop"
                      onClick={closeDrawer}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#A65F3B] text-[#FFFDF9] text-sm font-medium hover:bg-[#8E4F30]"
                    >
                      Khám phá cà phê
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                ) : (
                  items.map((item) => {
                    const unitPrice =
                      item.sale_price && item.sale_price > 0 && item.sale_price < item.price
                        ? item.sale_price
                        : item.price;
                    return (
                      <div
                        key={`${item.productId}-${item.grind_type}`}
                        className="py-4 flex gap-3.5"
                      >
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-20 h-20 rounded object-cover bg-[#F7F2EA] border border-[#E6DED3] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/product/${item.slug}`}
                            onClick={closeDrawer}
                            className="font-semibold text-sm text-[#171512] hover:text-[#A65F3B] line-clamp-1"
                          >
                            {item.name}
                          </Link>
                          <p className="text-xs text-[#777067] mt-0.5">
                            {item.grind_type} • {item.weight_grams}g
                          </p>
                          <p className="text-sm font-bold text-[#4A2E24] mt-1">
                            {formatVND(unitPrice)}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <div className="inline-flex items-center border border-[#E6DED3] rounded bg-[#F7F2EA]">
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.productId, item.grind_type, item.quantity - 1)
                                }
                                className="p-1 text-[#171512] hover:bg-black/5"
                                aria-label="Giảm số lượng"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2.5 text-xs font-semibold">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateQuantity(item.productId, item.grind_type, item.quantity + 1)
                                }
                                className="p-1 text-[#171512] hover:bg-black/5"
                                aria-label="Tăng số lượng"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.productId, item.grind_type)}
                              className="text-xs text-red-700 hover:text-red-900 inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Xóa
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {items.length > 0 && (
                <div className="p-5 bg-[#F7F2EA] border-t border-[#E6DED3] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#777067]">Tạm tính:</span>
                    <span className="text-lg font-bold text-[#171512]">
                      {formatVND(subtotal)}
                    </span>
                  </div>
                  <p className="text-xs text-[#777067]">
                    Miễn phí vận chuyển cho đơn hàng từ 500.000₫.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <Link
                      to="/cart"
                      onClick={closeDrawer}
                      className="py-2.5 px-4 rounded border border-[#4A2E24] text-[#4A2E24] text-center text-sm font-medium hover:bg-[#4A2E24]/5"
                    >
                      Xem giỏ hàng
                    </Link>
                    <Link
                      to="/checkout"
                      onClick={closeDrawer}
                      className="py-2.5 px-4 rounded bg-[#A65F3B] text-[#FFFDF9] text-center text-sm font-medium hover:bg-[#8E4F30]"
                    >
                      Thanh toán
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 ${isHome ? '' : 'pt-16 sm:pt-20'}`}>
        <Outlet />
      </main>

      {/* Footer matching reference image dark espresso footer */}
      <footer className="bg-[#171512] text-[#F7F2EA]/85 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
            {/* Col 1: Brand */}
            <div className="lg:col-span-1 space-y-3">
              <Link to="/" className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-[#A65F3B]/25 border border-[#A65F3B]/60 flex items-center justify-center text-[#E5B287]">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                    <path d="M17.5 4.5C13 2 6.5 5 4.5 11.5C2.5 18 6 22 10.5 22.5C15 23 20.5 18.5 20.5 12C20.5 8 19.2 5.4 17.5 4.5Z" />
                  </svg>
                </span>
                <span className="font-serif-display text-xl font-bold text-[#FFFDF9]">
                  AURA <span className="font-normal text-[#E5B287]">COFFEE</span>
                </span>
              </Link>
              <p className="text-xs text-[#F7F2EA]/70 leading-relaxed">
                Đậm vị nguyên bản – Trọn từng khoảnh khắc.
              </p>
              <p className="text-xs text-[#F7F2EA]/60 leading-relaxed">
                Địa chỉ: [Cập nhật địa chỉ doanh nghiệp]
              </p>
              <div className="flex items-center gap-3 pt-2 text-[#F7F2EA]/70">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="hover:text-[#E5B287] text-xs border border-white/15 px-2.5 py-1 rounded"
                >
                  IG
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="hover:text-[#E5B287] text-xs border border-white/15 px-2.5 py-1 rounded"
                >
                  FB
                </a>
                <a
                  href="https://youtube.com"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="YouTube"
                  className="hover:text-[#E5B287] text-xs border border-white/15 px-2.5 py-1 rounded"
                >
                  YT
                </a>
              </div>
            </div>

            {/* Col 2: Cửa hàng */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FFFDF9] mb-4">
                Sản Phẩm
              </h3>
              <ul className="space-y-2.5 text-xs text-[#F7F2EA]/70">
                <li>
                  <Link to="/shop" className="hover:text-white transition-colors">
                    Tất cả cà phê
                  </Link>
                </li>
                <li>
                  <Link to="/category/ca-phe-phin" className="hover:text-white transition-colors">
                    Cà Phê Phin Truyền Thống
                  </Link>
                </li>
                <li>
                  <Link to="/category/ca-phe-dac-san" className="hover:text-white transition-colors">
                    Cà Phê Hạt Đặc Sản
                  </Link>
                </li>
                <li>
                  <Link to="/category/ca-phe-pha-may" className="hover:text-white transition-colors">
                    Cà Phê Pha Máy (Espresso)
                  </Link>
                </li>
                <li>
                  <Link to="/category/qua-tang-phu-kien" className="hover:text-white transition-colors">
                    Hộp Quà Tặng Cao Cấp
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Về AURA COFFEE */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FFFDF9] mb-4">
                Về AURA COFFEE
              </h3>
              <ul className="space-y-2.5 text-xs text-[#F7F2EA]/70">
                <li>
                  <Link to="/about" className="hover:text-white transition-colors">
                    Câu chuyện thương hiệu
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="hover:text-white transition-colors">
                    Cẩm nang pha chế
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-white transition-colors">
                    Liên hệ &amp; Hợp tác đại lý
                  </Link>
                </li>
                <li>
                  <Link to="/admin" className="hover:text-white transition-colors">
                    Cổng Quản trị viên
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Hỗ trợ & Chính sách */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FFFDF9] mb-4">
                Hỗ Trợ Khách Hàng
              </h3>
              <ul className="space-y-2.5 text-xs text-[#F7F2EA]/70">
                <li>
                  <Link to="/track-order" className="hover:text-white transition-colors">
                    Tra cứu đơn hàng
                  </Link>
                </li>
                <li>
                  <Link to="/policies/chinh-sach-giao-hang" className="hover:text-white transition-colors">
                    Chính sách giao hàng
                  </Link>
                </li>
                <li>
                  <Link to="/policies/chinh-sach-doi-tra" className="hover:text-white transition-colors">
                    Chính sách đổi trả
                  </Link>
                </li>
                <li>
                  <Link to="/policies/chinh-sach-bao-mat" className="hover:text-white transition-colors">
                    Chính sách bảo mật
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 5: Sustainability message matching reference footer */}
            <div className="flex flex-col justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-[#183B2D] text-[#74C69D] shrink-0">
                  <Sprout className="w-5 h-5" />
                </div>
                <p className="text-xs text-[#F7F2EA]/75 leading-relaxed">
                  Gìn giữ hương vị nguyên bản từ những nông hộ trồng cà phê Tây Nguyên &amp; Cầu Đất.
                </p>
              </div>
              <p className="text-[11px] text-[#F7F2EA]/50 mt-6 lg:mt-0">
                © {new Date().getFullYear()} AURA COFFEE. Bảo lưu mọi quyền.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Trợ lý Barista Chatbot nổi toàn trang */}
      <CoffeeChatbot />
    </div>
  );
}
