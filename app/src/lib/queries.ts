import { useQuery } from '@tanstack/react-query';
import type { components as Core } from '@/api/core';
import type { components as Id } from '@/api/identity';
import { call, core, identity } from './api';

export type Product = Core['schemas']['ProductResponse'];
export type Category = Core['schemas']['CategoryResponse'];
export type Customer = Core['schemas']['CustomerResponse'];
export type Supplier = Core['schemas']['SupplierResponse'];
export type Sale = Core['schemas']['SaleResponse'];
export type Settings = Core['schemas']['SettingsResponse'];
export type Business = Id['schemas']['BusinessProfileResponse'];

/** Active products (the whole catalog for small shops; search narrows it on the server). */
export const useProducts = (q = '', categoryId?: string, includeInactive = false) =>
  useQuery({
    queryKey: ['products', q, categoryId, includeInactive],
    queryFn: async () =>
      (await call(core.GET('/api/v1/core/products', { params: { query: { q, categoryId, includeInactive, size: 500 } } })))?.content ?? [],
  });

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: async () => (await call(core.GET('/api/v1/core/categories'))) ?? [] });

export const useCustomers = (q = '') =>
  useQuery({
    queryKey: ['customers', q],
    queryFn: async () => (await call(core.GET('/api/v1/core/customers', { params: { query: { q, size: 200 } } })))?.content ?? [],
  });

export const useSuppliers = () =>
  useQuery({ queryKey: ['suppliers'], queryFn: async () => (await call(core.GET('/api/v1/core/suppliers'))) ?? [] });

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => call(core.GET('/api/v1/core/settings')) });

export const useBusiness = () => useQuery({ queryKey: ['business'], queryFn: () => call(identity.GET('/api/v1/users/business')) });

export const useExpenseCategories = () =>
  useQuery({ queryKey: ['expense-categories'], queryFn: async () => (await call(core.GET('/api/v1/core/expenses/categories'))) ?? [] });
