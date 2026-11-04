import type {
  ApiResponse,
  Category,
  Product,
  PaginatedResult,
  Order,
  Review,
  BlogPost,
  AdminUser,
  CustomerUser,
  DashboardData,
  Banner,
  SiteContent,
  ChatRequestPayload,
  ChatResponseData,
  AdminCustomerItem,
  AdminCustomerDetail,
} from '../../shared/types';
import type {
  CreateOrderInput,
  ProductFormInput,
  CustomerRegisterInput,
  CustomerLoginInput,
  CustomerProfileInput,
} from '../../shared/validators';

export const CUSTOMER_TOKEN_STORAGE_KEY = 'aura_customer_token';
export const ADMIN_TOKEN_STORAGE_KEY = 'aura_admin_token';
export const LOCAL_ORDERS_STORAGE_KEY = 'aura_local_orders_v1';

export function getMigratedStorageValue(
  storage: Storage,
  key: string,
  suffix: string
): string | null {
  const currentValue = storage.getItem(key);
  if (currentValue !== null) return currentValue;

  const previousKey = Object.keys(storage).find(
    (candidate) => candidate !== key && candidate.endsWith(suffix)
  );
  if (!previousKey) return null;

  const previousValue = storage.getItem(previousKey);
  if (previousValue !== null) {
    storage.setItem(key, previousValue);
    storage.removeItem(previousKey);
  }
  return previousValue;
}

export function getSavedCustomerToken(): string | null {
  try {
    return getMigratedStorageValue(localStorage, CUSTOMER_TOKEN_STORAGE_KEY, '_customer_token');
  } catch {
    return null;
  }
}

export function setSavedCustomerToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(CUSTOMER_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(CUSTOMER_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getSavedAdminToken(): string | null {
  try {
    return getMigratedStorageValue(localStorage, ADMIN_TOKEN_STORAGE_KEY, '_admin_token');
  } catch {
    return null;
  }
}

export function setSavedAdminToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getLocalCachedOrders(): Order[] {
  try {
    const raw = getMigratedStorageValue(localStorage, LOCAL_ORDERS_STORAGE_KEY, '_local_orders_v1');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOrderToLocalCache(order: Order): void {
  try {
    const list = getLocalCachedOrders();
    const filtered = list.filter(
      (o) => String(o.order_code).toUpperCase() !== String(order.order_code).toUpperCase()
    );
    filtered.unshift(order);
    localStorage.setItem(LOCAL_ORDERS_STORAGE_KEY, JSON.stringify(filtered.slice(0, 30)));
  } catch {
    // ignore storage errors
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, code = 'API_ERROR', status = 400, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const customerToken = getSavedCustomerToken();
  if (customerToken && !headers.has('X-Customer-Token')) {
    headers.set('X-Customer-Token', customerToken);
  }
  if (path.startsWith('/api/v1/admin/')) {
    const adminToken = getSavedAdminToken() || getSavedCustomerToken();
    if (adminToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${adminToken}`);
    }
    if (adminToken && !headers.has('X-Admin-Token')) {
      headers.set('X-Admin-Token', adminToken);
    }
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
    cache: (!options.method || options.method.toUpperCase() === 'GET') ? 'no-store' : undefined,
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !json || !json.success) {
    throw new ApiError(
      json?.error?.message || `Yêu cầu thất bại (HTTP ${res.status})`,
      json?.error?.code || 'HTTP_ERROR',
      res.status,
      json?.error?.details
    );
  }

  return json.data as T;
}

async function syncLocalOrdersWithServer(): Promise<void> {
  const localOrders = getLocalCachedOrders();
  if (!localOrders.length) return;
  try {
    await request('/api/v1/orders/sync', {
      method: 'POST',
      body: JSON.stringify({ orders: localOrders }),
    });
  } catch {
    // ignore sync errors
  }
}

export interface HomePageData {
  banners: Banner[];
  content: Record<string, any>;
  featuredProducts: Product[];
  categories: Category[];
  reviews: Review[];
  blogPosts: BlogPost[];
  shippingConfig: {
    defaultFee: number;
    freeThreshold: number;
  };
}

export const api = {
  // Public endpoints
  getHomeData: () => request<HomePageData>('/api/v1/content/home'),
  getCategories: () => request<Category[]>('/api/v1/categories'),
  getCategoryBySlug: (slug: string) =>
    request<{ category: Category; products: Product[] }>(`/api/v1/categories/${encodeURIComponent(slug)}`),
  getFeaturedProducts: (limit = 4) =>
    request<Product[]>(`/api/v1/products/featured?limit=${limit}`),
  getProducts: (params: {
    page?: number;
    limit?: number;
    q?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sort?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.q) sp.set('q', params.q);
    if (params.category && params.category !== 'all') sp.set('category', params.category);
    if (params.minPrice !== undefined) sp.set('minPrice', String(params.minPrice));
    if (params.maxPrice !== undefined) sp.set('maxPrice', String(params.maxPrice));
    if (params.inStock) sp.set('inStock', 'true');
    if (params.sort) sp.set('sort', params.sort);
    return request<PaginatedResult<Product>>(`/api/v1/products?${sp.toString()}`);
  },
  getProductBySlug: (slug: string) =>
    request<Product & { relatedProducts: Product[]; reviews: Review[] }>(
      `/api/v1/products/${encodeURIComponent(slug)}`
    ),
  searchProducts: (q: string) =>
    request<Product[]>(`/api/v1/products/search?q=${encodeURIComponent(q)}`),
  getReviews: () => request<Review[]>('/api/v1/reviews'),
  getBlogPosts: () => request<BlogPost[]>('/api/v1/blog'),
  getBlogPostBySlug: (slug: string) =>
    request<BlogPost>(`/api/v1/blog/${encodeURIComponent(slug)}`),
  createOrder: async (payload: CreateOrderInput) => {
    const order = await request<Order>('/api/v1/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveOrderToLocalCache(order);
    return order;
  },
  trackOrder: async (code: string, phone?: string) => {
    await syncLocalOrdersWithServer();
    const sp = new URLSearchParams();
    if (code) sp.set('code', code);
    if (phone) sp.set('phone', phone);
    return request<Order & { allOrdersByPhone?: Order[] }>(`/api/v1/orders/track?${sp.toString()}`);
  },
  subscribeNewsletter: (email: string, honeypot = '') =>
    request<{ email: string; subscribed?: boolean; alreadySubscribed?: boolean }>(
      '/api/v1/newsletter/subscribe',
      {
        method: 'POST',
        body: JSON.stringify({ email, honeypot }),
      }
    ),
  chatWithBarista: async (payload: ChatRequestPayload) => {
    await syncLocalOrdersWithServer();
    return request<ChatResponseData>('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Customer Account endpoints
  customerRegister: async (payload: CustomerRegisterInput) => {
    await syncLocalOrdersWithServer();
    const res = await request<{ user: CustomerUser; token: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) setSavedCustomerToken(res.token);
    return res;
  },
  customerLogin: async (payload: CustomerLoginInput) => {
    await syncLocalOrdersWithServer();
    const res = await request<{ user: CustomerUser; token: string; isAdmin?: boolean }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) {
      setSavedCustomerToken(res.token);
      if (res.user.role === 'admin' || res.user.role === 'staff' || res.isAdmin) {
        setSavedAdminToken(res.token);
      }
    }
    return res;
  },
  customerLogout: async () => {
    const res = await request<{ loggedOut: boolean }>('/api/v1/auth/logout', {
      method: 'POST',
    }).catch(() => ({ loggedOut: true }));
    setSavedCustomerToken(null);
    setSavedAdminToken(null);
    return res;
  },
  customerMe: async () => {
    const res = await request<{ user: CustomerUser | null }>('/api/v1/auth/me');
    if (res.user && (res.user.role === 'admin' || res.user.role === 'staff')) {
      const token = getSavedCustomerToken();
      if (token && !getSavedAdminToken()) {
        setSavedAdminToken(token);
      }
    }
    return res;
  },
  updateCustomerProfile: (payload: CustomerProfileInput) =>
    request<{ user: CustomerUser }>('/api/v1/account/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  updateCustomerPassword: (payload: { current_password: string; new_password: string }) =>
    request<{ updated: boolean }>('/api/v1/account/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getCustomerOrders: async () => {
    await syncLocalOrdersWithServer();
    const orders = await request<Order[]>('/api/v1/account/orders');
    for (const o of orders) {
      saveOrderToLocalCache(o);
    }
    return orders;
  },
  cancelCustomerOrder: async (id: number, reason?: string) => {
    const updated = await request<Order>(`/api/v1/account/orders/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    if (updated) {
      saveOrderToLocalCache(updated);
    }
    return updated;
  },

  // Admin endpoints
  adminLogin: async (email: string, password: string) => {
    await syncLocalOrdersWithServer();
    const res = await request<{ user: AdminUser; token?: string }>('/api/v1/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) setSavedAdminToken(res.token);
    return res;
  },
  adminLogout: async () => {
    const res = await request<{ loggedOut: boolean }>('/api/v1/admin/auth/logout', {
      method: 'POST',
    }).catch(() => ({ loggedOut: true }));
    setSavedAdminToken(null);
    return res;
  },
  adminMe: () => request<{ user: AdminUser | null }>('/api/v1/admin/auth/me'),
  getAdminDashboard: async (days = 30) => {
    await syncLocalOrdersWithServer();
    return request<DashboardData>(`/api/v1/admin/dashboard?days=${days}`);
  },
  getAdminProducts: (q = '') =>
    request<Product[]>(`/api/v1/admin/products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getAdminProductById: (id: number) =>
    request<Product>(`/api/v1/admin/products/${id}`),
  createAdminProduct: (payload: ProductFormInput) =>
    request<Product>('/api/v1/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAdminProduct: (id: number, payload: ProductFormInput) =>
    request<Product>(`/api/v1/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAdminProduct: (id: number) =>
    request<{ id: number; deleted?: boolean; softDeleted?: boolean }>(
      `/api/v1/admin/products/${id}`,
      { method: 'DELETE' }
    ),
  toggleAdminProductStatus: (id: number, isActive: boolean) =>
    request<Product>(`/api/v1/admin/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }),
  getAdminCategories: () => request<Category[]>('/api/v1/admin/categories'),
  createAdminCategory: (payload: Partial<Category>) =>
    request<Category>('/api/v1/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateAdminCategory: (id: number, payload: Partial<Category>) =>
    request<Category>(`/api/v1/admin/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteAdminCategory: (id: number) =>
    request<{ id: number; deleted: boolean }>(`/api/v1/admin/categories/${id}`, {
      method: 'DELETE',
    }),
  getAdminOrders: async (params: { status?: string; q?: string; from?: string; to?: string }) => {
    await syncLocalOrdersWithServer();
    const sp = new URLSearchParams();
    if (params.status && params.status !== 'all') sp.set('status', params.status);
    if (params.q) sp.set('q', params.q);
    if (params.from) sp.set('from', params.from);
    if (params.to) sp.set('to', params.to);
    return request<Order[]>(`/api/v1/admin/orders?${sp.toString()}`);
  },
  getAdminOrderById: (id: number) =>
    request<Order>(`/api/v1/admin/orders/${id}`),
  updateAdminOrderStatus: (
    id: number,
    payload: { status: string; payment_status?: string; note?: string }
  ) =>
    request<Order>(`/api/v1/admin/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  getAdminCustomers: (params: {
    page?: number;
    limit?: number;
    q?: string;
    role?: string;
    status?: string;
    sort?: string;
  } = {}) => {
    const sp = new URLSearchParams();
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    if (params.q) sp.set('q', params.q);
    if (params.role && params.role !== 'all') sp.set('role', params.role);
    if (params.status && params.status !== 'all') sp.set('status', params.status);
    if (params.sort) sp.set('sort', params.sort);
    return request<PaginatedResult<AdminCustomerItem>>(`/api/v1/admin/customers?${sp.toString()}`);
  },
  getAdminCustomerById: (id: number) =>
    request<AdminCustomerDetail>(`/api/v1/admin/customers/${id}`),
  updateAdminCustomerStatus: (id: number, isActive: boolean) =>
    request<{ id: number; is_active: number }>(`/api/v1/admin/customers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }),
  uploadImageToKV: (file: File, folder = 'products') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    return request<{ key: string; url: string; size: number; contentType: string; storage?: string }>(
      '/api/v1/admin/uploads',
      {
        method: 'POST',
        body: fd,
      }
    );
  },
  uploadImageToR2: (file: File, folder = 'products') => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    return request<{ key: string; url: string; size: number; contentType: string; storage?: string }>(
      '/api/v1/admin/uploads',
      {
        method: 'POST',
        body: fd,
      }
    );
  },
  deleteImageFromKV: (key: string) =>
    request<{ key: string; deleted: boolean }>(
      `/api/v1/admin/uploads/${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    ),
  deleteImageFromR2: (key: string) =>
    request<{ key: string; deleted: boolean }>(
      `/api/v1/admin/uploads/${encodeURIComponent(key)}`,
      { method: 'DELETE' }
    ),
  getAdminBanners: () => request<Banner[]>('/api/v1/admin/banners'),
  updateAdminBanner: (id: number, payload: Partial<Banner>) =>
    request<Banner>(`/api/v1/admin/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getAdminContent: () => request<SiteContent[]>('/api/v1/admin/content'),
  updateAdminContent: (key: string, payload: { title: string; subtitle: string; content_json: any }) =>
    request<SiteContent>(`/api/v1/admin/content/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getAdminNewsletter: () =>
    request<{ id: number; email: string; status: string; created_at: string }[]>(
      '/api/v1/admin/newsletter'
    ),
};
