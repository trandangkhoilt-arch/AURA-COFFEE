import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem, Product } from '../../../shared/types';
import { useToast } from '../../components/ToastContext';

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addToCart: (product: Product, quantity?: number, grindType?: string) => void;
  updateQuantity: (productId: number, grindType: string, quantity: number) => void;
  removeFromCart: (productId: number, grindType: string) => void;
  clearCart: () => void;
  syncCartWithServerProducts: (latestProducts: Product[]) => void;
}

const STORAGE_KEY = 'aura_coffee_cart_v1';

function loadSavedCart(): CartItem[] {
  const isCart = (value: unknown): value is CartItem[] =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.productId === 'number' &&
        typeof item.quantity === 'number' &&
        typeof item.grind_type === 'string'
    );

  const current = localStorage.getItem(STORAGE_KEY);
  if (current) {
    const parsed: unknown = JSON.parse(current);
    return isCart(parsed) ? parsed : [];
  }

  for (const key of Object.keys(localStorage)) {
    if (key === STORAGE_KEY || !key.endsWith('_cart_v1')) continue;
    const value = localStorage.getItem(key);
    if (!value) continue;

    const parsed: unknown = JSON.parse(value);
    if (!isCart(parsed)) continue;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    localStorage.removeItem(key);
    return parsed;
  }
  return [];
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return loadSavedCart();
    } catch {
      return [];
    }
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore storage quota errors
    }
  }, [items]);

  const addToCart = useCallback(
    (product: Product, quantity = 1, grindType = 'Nguyên hạt') => {
      if (product.stock <= 0) {
        showToast(`Sản phẩm "${product.name}" hiện đã hết hàng.`, 'error');
        return;
      }

      setItems((prev) => {
        const idx = prev.findIndex(
          (i) => i.productId === product.id && i.grind_type === grindType
        );
        if (idx > -1) {
          const current = prev[idx];
          const nextQty = Math.min(product.stock, current.quantity + quantity);
          const updated = [...prev];
          updated[idx] = {
            ...current,
            price: product.price,
            sale_price: product.sale_price,
            stock: product.stock,
            quantity: nextQty,
          };
          return updated;
        }
        return [
          ...prev,
          {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            sku: product.sku,
            price: product.price,
            sale_price: product.sale_price,
            image_url: product.image_url,
            origin: product.origin,
            weight_grams: product.weight_grams,
            grind_type: grindType,
            quantity: Math.min(product.stock, quantity),
            stock: product.stock,
          },
        ];
      });

      showToast(`Đã thêm "${product.name}" (${grindType}) vào giỏ hàng.`);
    },
    [showToast]
  );

  const updateQuantity = useCallback(
    (productId: number, grindType: string, quantity: number) => {
      setItems((prev) =>
        prev
          .map((item) => {
            if (item.productId === productId && item.grind_type === grindType) {
              if (quantity <= 0) return null;
              const clamped = Math.min(item.stock, Math.max(1, quantity));
              return { ...item, quantity: clamped };
            }
            return item;
          })
          .filter(Boolean) as CartItem[]
      );
    },
    []
  );

  const removeFromCart = useCallback((productId: number, grindType: string) => {
    setItems((prev) =>
      prev.filter((item) => !(item.productId === productId && item.grind_type === grindType))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const syncCartWithServerProducts = useCallback((latestProducts: Product[]) => {
    const map = new Map(latestProducts.map((p) => [p.id, p]));
    setItems((prev) =>
      prev
        .map((item) => {
          const fresh = map.get(item.productId);
          if (!fresh || !fresh.is_active || fresh.stock <= 0) return item;
          return {
            ...item,
            price: fresh.price,
            sale_price: fresh.sale_price,
            stock: fresh.stock,
            quantity: Math.min(item.quantity, fresh.stock),
          };
        })
    );
  }, []);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => {
    const unit =
      item.sale_price && item.sale_price > 0 && item.sale_price < item.price
        ? item.sale_price
        : item.price;
    return sum + unit * item.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        subtotal,
        isDrawerOpen,
        openDrawer: () => setIsDrawerOpen(true),
        closeDrawer: () => setIsDrawerOpen(false),
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        syncCartWithServerProducts,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
