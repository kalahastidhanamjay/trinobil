import { useQuery } from '@tanstack/react-query';
import { call, core } from '@/lib/api';
import { useBusiness, type Product } from '@/lib/queries';
import type { components } from '@/api/core';

/** A vehicle an item fits: a whole type, a whole company or one model, optionally for some years. */
export type Fitment = components['schemas']['FitmentView'];

/** An item, with its auto spares fields (part numbers, vehicles, rack, trade price). */
export type SpareProduct = Product;

/** "Show parts for": a type, a company or a model. */
export type VehicleFilter = { typeId: string; makeId?: string; modelId?: string; label: string };

export type VehicleModel = { id: string; name: string };
export type VehicleMake = { id: string; name: string; models: VehicleModel[] };
export type VehicleType = { id: string; name: string; makes: VehicleMake[] };

/** The shop's own vehicle list (nothing built in). */
export const useVehicles = () =>
  useQuery({
    queryKey: ['vehicles'],
    queryFn: async () => ((await call(core.GET('/api/v1/core/vehicles'))) ?? []) as VehicleType[],
  });

/** The business has this feature switched on (e.g. PART_NUMBERS, TRADE_PRICE). */
export function useModule(code: string) {
  return (useBusiness().data?.modules ?? []).includes(code);
}

export const fitLabel = (f: Fitment) => {
  const years = f.yearFrom || f.yearTo ? ` (${f.yearFrom ?? ''}–${f.yearTo ?? ''})` : '';
  if (f.modelName) return `${f.makeName} ${f.modelName}${years}`;
  if (f.makeName) return `All ${f.makeName}${years}`;
  return `All ${f.typeName}${years}`;
};

/** The item fits the vehicle (fitted to its whole type or company counts). */
export const fits = (p: SpareProduct, v: VehicleFilter) =>
  (p.fitments ?? []).some(
    (f) =>
      f.typeId === v.typeId &&
      (!v.makeId || !f.makeId || f.makeId === v.makeId) &&
      (!v.modelId || !f.modelId || f.modelId === v.modelId),
  );

/** Name, SKU, barcode, part numbers or fit notes contain the search. */
export const matchesSearch = (p: SpareProduct, q: string, raw: string) =>
  [p.name, p.sku, p.partNumber, p.altPartNumbers, p.fitsVehicles].some((v) => v?.toLowerCase().includes(q)) ||
  p.barcode === raw;

/** Price on this bill: mechanics / garages pay the trade price where one is set. */
export const priceFor = (p: SpareProduct, tradeCustomer: boolean) =>
  tradeCustomer && p.tradePrice != null ? p.tradePrice : p.price ?? 0;
