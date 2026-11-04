import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  api,
  getMigratedStorageValue,
  getSavedCustomerToken,
  setSavedCustomerToken,
} from '../../services/api';
import type { CustomerUser } from '../../../shared/types';
import type {
  CustomerLoginInput,
  CustomerRegisterInput,
  CustomerProfileInput,
} from '../../../shared/validators';

const CUSTOMER_PROFILE_STORAGE_KEY = 'aura_customer_profile_v1';

function loadCachedProfile(): CustomerUser | null {
  try {
    const raw = getMigratedStorageValue(
      localStorage,
      CUSTOMER_PROFILE_STORAGE_KEY,
      '_customer_profile_v1'
    );
    if (!raw) return null;
    return JSON.parse(raw) as CustomerUser;
  } catch {
    return null;
  }
}

function saveCachedProfile(user: CustomerUser | null): void {
  try {
    if (user) {
      localStorage.setItem(CUSTOMER_PROFILE_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CUSTOMER_PROFILE_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

interface CustomerAuthContextValue {
  customer: CustomerUser | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (payload: CustomerLoginInput) => Promise<CustomerUser>;
  register: (payload: CustomerRegisterInput) => Promise<CustomerUser>;
  updateProfile: (payload: CustomerProfileInput) => Promise<CustomerUser>;
  logout: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<CustomerUser | null>(() => loadCachedProfile());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshCustomer = useCallback(async () => {
    try {
      const res = await api.customerMe();
      if (res && res.user) {
        setCustomer(res.user);
        saveCachedProfile(res.user);
      } else {
        setCustomer(null);
        saveCachedProfile(null);
      }
    } catch {
      setCustomer(null);
      saveCachedProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCustomer();
  }, [refreshCustomer]);

  const login = useCallback(async (payload: CustomerLoginInput) => {
    const res = await api.customerLogin(payload);
    setCustomer(res.user);
    saveCachedProfile(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload: CustomerRegisterInput) => {
    const res = await api.customerRegister(payload);
    setCustomer(res.user);
    saveCachedProfile(res.user);
    return res.user;
  }, []);

  const updateProfile = useCallback(async (payload: CustomerProfileInput) => {
    const res = await api.updateCustomerProfile(payload);
    setCustomer(res.user);
    saveCachedProfile(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    await api.customerLogout();
    setSavedCustomerToken(null);
    setCustomer(null);
    saveCachedProfile(null);
  }, []);

  const isAdmin = Boolean(customer && (customer.role === 'admin' || customer.role === 'staff'));

  return (
    <CustomerAuthContext.Provider
      value={{
        customer,
        isAdmin,
        isLoading,
        login,
        register,
        updateProfile,
        logout,
        refreshCustomer,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) {
    throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  }
  return ctx;
}
