import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { sha256Hex } from '../utils/crypto';
import { fail } from '../utils/response';
import type { WorkerEnv } from '../db/init';
import type { AdminUser, CustomerUser } from '../../shared/types';

export const SESSION_COOKIE_NAME = 'aura_admin_session';
export const CUSTOMER_COOKIE_NAME = 'aura_user_session';

// Rate limiting cho endpoint đăng nhập (10 lần thử thất bại / 5 phút trên mỗi IP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    return { allowed: true };
  }
  if (record.count >= 10) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((record.resetAt - now) / 1000),
    };
  }
  return { allowed: true };
}

export function recordFailedLoginAttempt(ip: string): void {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const record = loginAttempts.get(ip);
  if (!record || now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs });
  } else {
    record.count += 1;
  }
}

export function clearLoginAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export async function getAuthenticatedAdmin(
  c: Context<{ Bindings: WorkerEnv; Variables: any }>
): Promise<AdminUser | null> {
  const adminCookie = getCookie(c, SESSION_COOKIE_NAME);
  const customerCookie = getCookie(c, CUSTOMER_COOKIE_NAME);
  const adminHeader = c.req.header('X-Admin-Token')?.trim();
  const customerHeader = c.req.header('X-Customer-Token')?.trim();
  const authHeader = c.req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const rawToken = adminHeader || adminCookie || customerHeader || customerCookie || bearerToken;

  if (!rawToken) return null;

  const tokenHash = await sha256Hex(rawToken);
  const sessionRow = await c.env.DB.prepare(
    `SELECT s.token_hash, s.csrf_token, s.expires_at,
            u.id as user_id, u.email, u.full_name, u.role, u.is_active
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
  )
    .bind(tokenHash)
    .first<{
      token_hash: string;
      csrf_token: string;
      expires_at: string;
      user_id: number;
      email: string;
      full_name: string;
      role: 'admin' | 'staff' | 'customer';
      is_active: number;
    }>();

  if (!sessionRow || !sessionRow.is_active) {
    return null;
  }

  if (sessionRow.role !== 'admin' && sessionRow.role !== 'staff') {
    return null;
  }

  return {
    id: sessionRow.user_id,
    email: sessionRow.email,
    full_name: sessionRow.full_name,
    role: sessionRow.role,
    csrf_token: sessionRow.csrf_token,
  };
}

export async function requireAdminAuth(
  c: Context<{ Bindings: WorkerEnv; Variables: any }>,
  next: Next
) {
  const admin = await getAuthenticatedAdmin(c);
  if (!admin) {
    return fail(c, 'UNAUTHORIZED', 'Vui lòng đăng nhập tài khoản quản trị để thực hiện thao tác này.', 401);
  }
  c.set('adminUser', admin);
  await next();
}

export async function getAuthenticatedCustomer(
  c: Context<{ Bindings: WorkerEnv; Variables: any }>
): Promise<CustomerUser | null> {
  const customerHeader = c.req.header('X-Customer-Token')?.trim();
  const adminHeader = c.req.header('X-Admin-Token')?.trim();
  const cookieToken = getCookie(c, CUSTOMER_COOKIE_NAME) || getCookie(c, SESSION_COOKIE_NAME);
  const authHeader = c.req.header('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
  const rawToken = customerHeader || adminHeader || cookieToken || bearerToken;

  if (!rawToken) return null;

  const tokenHash = await sha256Hex(rawToken);
  const sessionRow = await c.env.DB.prepare(
    `SELECT s.token_hash, s.expires_at,
            u.id as user_id, u.email, u.phone, u.full_name, u.role,
            u.province, u.district, u.ward, u.shipping_address, u.is_active, u.created_at
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
  )
    .bind(tokenHash)
    .first<{
      token_hash: string;
      expires_at: string;
      user_id: number;
      email: string;
      phone?: string;
      full_name: string;
      role: 'customer' | 'admin' | 'staff';
      province?: string;
      district?: string;
      ward?: string;
      shipping_address?: string;
      is_active: number;
      created_at?: string;
    }>();

  if (!sessionRow || !sessionRow.is_active) {
    return null;
  }

  return {
    id: sessionRow.user_id,
    email: sessionRow.email,
    phone: sessionRow.phone || '',
    full_name: sessionRow.full_name,
    role: sessionRow.role,
    province: sessionRow.province || 'TP. Hồ Chí Minh',
    district: sessionRow.district || '',
    ward: sessionRow.ward || '',
    shipping_address: sessionRow.shipping_address || '',
    created_at: sessionRow.created_at,
  };
}

export async function requireCustomerAuth(
  c: Context<{ Bindings: WorkerEnv; Variables: any }>,
  next: Next
) {
  const customer = await getAuthenticatedCustomer(c);
  if (!customer) {
    return fail(c, 'UNAUTHORIZED', 'Vui lòng đăng nhập tài khoản để xem thông tin này.', 401);
  }
  c.set('customerUser', customer);
  await next();
}
