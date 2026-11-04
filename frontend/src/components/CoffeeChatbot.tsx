import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  X,
  Send,
  Coffee,
  Sparkles,
  ShoppingBag,
  Package,
  RotateCcw,
  ChevronRight,
  Database,
} from 'lucide-react';
import { api, getMigratedStorageValue } from '../services/api';
import { useCart } from '../features/cart/CartContext';
import { useToast } from './ToastContext';
import { useCustomerAuth } from '../features/auth/CustomerAuthContext';
import {
  formatVND,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
} from '../../shared/constants';
import type { Order, Product, RagTraceInfo } from '../../shared/types';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  recommendedProducts?: Product[];
  matchedOrders?: Order[];
  rag?: RagTraceInfo;
}

const CHAT_STORAGE_KEY = 'aura_barista_chat_v2';

const DEFAULT_SUGGESTIONS = [
  '🫖 Tư vấn cà phê pha Phin đậm đà',
  '🌸 Cà phê Arabica thơm hương hoa quả',
  '🎁 Quyền lợi khách hàng & Đổi trả 7 ngày',
  '🏆 Khám phá AURA COFFEE',
  '📖 Hướng dẫn pha Phin chuẩn vị',
  '📦 Kiểm tra đơn hàng của tôi',
];

function formatRichMessage(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    // Parse **bold** and `code`
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
    return (
      <React.Fragment key={lineIdx}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={i} className="font-semibold text-[#171512]">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return (
              <code
                key={i}
                className="px-1.5 py-0.5 rounded bg-[#F7F2EA] border border-[#E6DED3] font-mono text-xs text-[#A65F3B]"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return (
              <em key={i} className="italic text-[#4A2E24]">
                {part.slice(1, -1)}
              </em>
            );
          }
          return <span key={i}>{part}</span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export function CoffeeChatbot() {
  const { customer } = useCustomerAuth();
  const { addToCart } = useCart();
  const { showToast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);

  const getInitialGreeting = (name?: string): UIMessage => ({
    id: 'welcome-msg',
    role: 'assistant',
    content: `Xin chào${name ? ` **${name}**` : ''}! 👋 Mình là **Trợ lý Barista AURA COFFEE**.\n\nBạn đang muốn tìm **hạt cà phê hợp gu** (Pha Phin, Sữa đá, Pha máy, Cold Brew), xem **công thức pha chế**, hay **tra cứu đơn hàng** ạ?`,
    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  });

  const [messages, setMessages] = useState<UIMessage[]>(() => {
    try {
      const saved = getMigratedStorageValue(sessionStorage, CHAT_STORAGE_KEY, '_barista_chat_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [getInitialGreeting()];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      // Ignore
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        inputRef.current?.focus();
      }, 80);
    }
  }, [isOpen, messages.length, isTyping]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend ?? input).trim();
    if (!content || isTyping) return;

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await api.chatWithBarista({
        message: content,
        history: historyPayload,
      });

      const botMsg: UIMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        recommendedProducts: res.recommendedProducts,
        matchedOrders: res.matchedOrders,
        rag: res.rag,
      };

      setMessages((prev) => [...prev, botMsg]);
      if (res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
      }
    } catch (err: any) {
      const fallbackMsg: UIMessage = {
        id: `bot-err-${Date.now()}`,
        role: 'assistant',
        content:
          err?.message ||
          'Xin lỗi bạn, kết nối tới quầy Barista đang gián đoạn nhẹ. Bạn vui lòng thử lại sau giây lát nhé!',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleResetChat = () => {
    const initial = [getInitialGreeting(customer?.full_name)];
    setMessages(initial);
    setSuggestions(DEFAULT_SUGGESTIONS);
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const handleQuickAddProduct = (product: Product) => {
    if (product.stock <= 0) {
      showToast('Sản phẩm này tạm hết hàng.', 'error');
      return;
    }
    addToCart(product, 1, 'Xay pha Phin truyền thống');
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Khung cửa sổ Chat */}
      {isOpen && (
        <div
          className="mb-3 w-[calc(100vw-2.5rem)] sm:w-[400px] h-[580px] max-h-[80vh] bg-[#FFFDF9] border border-[#E6DED3] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
          role="dialog"
          aria-label="Trợ lý Barista AURA COFFEE"
        >
          {/* Header */}
          <div className="bg-[#171512] text-[#FFFDF9] px-4 py-3.5 flex items-center justify-between border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-[#A65F3B] flex items-center justify-center text-white shadow-inner">
                <Coffee className="w-5 h-5" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#171512]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-serif font-semibold text-base tracking-wide text-[#FFFDF9]">
                    Barista AURA COFFEE
                  </h3>
                  <Sparkles className="w-3.5 h-3.5 text-[#D89B6C]" />
                </div>
                <p className="text-[11px] text-white/70">
                  Tư vấn hương vị & Tra cứu đơn hàng 24/7
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChat}
                title="Làm mới cuộc trò chuyện"
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Đóng cửa sổ chat"
                className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Nội dung tin nhắn */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F2EA]/60">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                      isUser
                        ? 'bg-[#4A2E24] text-[#FFFDF9] rounded-br-xs'
                        : 'bg-[#FFFDF9] text-[#171512] border border-[#E6DED3] rounded-bl-xs'
                    }`}
                  >
                    <div className={isUser ? 'text-[#FFFDF9]' : 'text-[#2C2621]'}>
                      {isUser ? msg.content : formatRichMessage(msg.content)}
                    </div>

                    {/* Danh sách sản phẩm gợi ý trực tiếp trong tin nhắn */}
                    {!isUser &&
                      msg.recommendedProducts &&
                      msg.recommendedProducts.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#E6DED3] space-y-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#777067]">
                            Sản phẩm gợi ý cho bạn:
                          </p>
                          {msg.recommendedProducts.map((prod) => {
                            const finalPrice = prod.sale_price ?? prod.price;
                            return (
                              <div
                                key={prod.id}
                                className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F7F2EA] border border-[#E6DED3] hover:border-[#A65F3B]/50 transition-colors"
                              >
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="w-14 h-14 rounded-lg object-cover bg-white shrink-0 border border-[#E6DED3]"
                                />
                                <div className="flex-1 min-w-0">
                                  <Link
                                    to={`/product/${prod.slug}`}
                                    onClick={() => setIsOpen(false)}
                                    className="font-semibold text-xs text-[#171512] hover:text-[#A65F3B] line-clamp-1"
                                  >
                                    {prod.name}
                                  </Link>
                                  <p className="text-[11px] text-[#777067] truncate">
                                    {prod.origin} • {prod.weight_grams}g
                                  </p>
                                  <div className="flex items-center justify-between mt-1.5 gap-2">
                                    <span className="font-bold text-xs text-[#A65F3B]">
                                      {formatVND(finalPrice)}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      <Link
                                        to={`/product/${prod.slug}`}
                                        onClick={() => setIsOpen(false)}
                                        className="px-2 py-1 rounded text-[11px] font-medium border border-[#E6DED3] bg-white text-[#4A2E24] hover:bg-[#EFE8DC]"
                                      >
                                        Xem
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAddProduct(prod)}
                                        className="px-2.5 py-1 rounded text-[11px] font-medium bg-[#183B2D] text-white hover:bg-[#122C21] flex items-center gap-1 cursor-pointer"
                                      >
                                        <ShoppingBag className="w-3 h-3" />
                                        +Giỏ
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                    {/* Danh sách đơn hàng tra cứu được trực tiếp trong tin nhắn */}
                    {!isUser && msg.matchedOrders && msg.matchedOrders.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#E6DED3] space-y-2">
                        {msg.matchedOrders.map((ord) => (
                          <div
                            key={ord.id}
                            className="p-2.5 rounded-xl bg-[#F7F2EA] border border-[#E6DED3] text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-[#171512] flex items-center gap-1">
                                <Package className="w-3.5 h-3.5 text-[#A65F3B]" />
                                #{ord.order_code}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                  ORDER_STATUS_COLORS[ord.status] ||
                                  'bg-stone-100 text-stone-700 border-stone-300'
                                }`}
                              >
                                {ORDER_STATUS_LABELS[ord.status] || ord.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#777067]">
                              Người nhận: <strong className="text-[#171512]">{ord.customer_name}</strong> • Tổng:{' '}
                              <strong className="text-[#A65F3B]">{formatVND(ord.total)}</strong>
                            </p>
                            <div className="pt-1 flex justify-end">
                              <Link
                                to={`/track-order?code=${encodeURIComponent(ord.order_code)}`}
                                onClick={() => setIsOpen(false)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#A65F3B] hover:underline"
                              >
                                Xem tiến trình chi tiết
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Thông tin truy xuất RAG Vector DB & LLM */}
                    {!isUser && msg.rag && msg.rag.topChunks && msg.rag.topChunks.length > 0 && (
                      <details className="mt-2.5 pt-2 border-t border-[#E6DED3]/70 text-[10px] text-[#777067] group">
                        <summary className="cursor-pointer select-none flex items-center gap-1 hover:text-[#A65F3B] transition-colors list-none">
                          <Database className="w-3 h-3 text-[#A65F3B] shrink-0" />
                          <span>
                            RAG Vector ({msg.rag.topChunks.length}/{msg.rag.totalChunksIndexed} chunks •{' '}
                            {msg.rag.llmModel})
                          </span>
                        </summary>
                        <div className="mt-1.5 space-y-1 pl-1 border-l-2 border-[#E6DED3]">
                          {msg.rag.topChunks.map((c) => (
                            <div key={c.chunk_key} className="flex items-center justify-between gap-2">
                              <span className="truncate text-[#4A2E24] font-medium">{c.title}</span>
                              <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-[#F7F2EA] border border-[#E6DED3] text-[#A65F3B] shrink-0">
                                {(c.score * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <span className="text-[10px] text-[#777067] mt-1 px-1">{msg.timestamp}</span>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-[#777067] bg-[#FFFDF9] border border-[#E6DED3] px-3.5 py-2.5 rounded-2xl w-fit">
                <span className="w-2 h-2 rounded-full bg-[#A65F3B] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[#A65F3B] animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-[#A65F3B] animate-bounce [animation-delay:300ms]" />
                <span className="ml-1">Barista đang pha câu trả lời...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Gợi ý câu hỏi nhanh (Quick Chips) */}
          <div className="px-3 py-2 bg-[#FFFDF9] border-t border-[#E6DED3] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(sug)}
                disabled={isTyping}
                className="shrink-0 px-2.5 py-1 rounded-full text-xs bg-[#F7F2EA] hover:bg-[#EBE2D5] text-[#4A2E24] border border-[#E6DED3] transition-colors cursor-pointer disabled:opacity-50"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Ô nhập tin nhắn */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-[#FFFDF9] border-t border-[#E6DED3] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi, gu cà phê hoặc SĐT tra đơn..."
              className="flex-1 px-3.5 py-2.5 text-sm bg-[#F7F2EA] border border-[#E6DED3] rounded-xl text-[#171512] placeholder:text-[#777067] focus:outline-none focus:border-[#A65F3B]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="p-2.5 rounded-xl bg-[#A65F3B] hover:bg-[#8E4F30] text-white disabled:opacity-40 transition-colors cursor-pointer shrink-0"
              aria-label="Gửi tin nhắn"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Nút bấm tròn mở Chatbot nổi góc phải dưới */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative w-14 h-14 rounded-full bg-[#171512] hover:bg-[#4A2E24] text-[#FFFDF9] shadow-2xl border border-[#A65F3B]/50 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
        aria-label={isOpen ? 'Đóng trợ lý Barista' : 'Mở trợ lý Barista Chatbot'}
        title="Chat với Barista AURA COFFEE"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-[#D89B6C] transition-transform duration-200" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6 text-[#D89B6C] transition-transform duration-200 group-hover:scale-110" />
            <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#171512]" />
          </>
        )}
      </button>
    </div>
  );
}
