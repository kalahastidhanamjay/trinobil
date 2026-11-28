import { useQueryClient } from '@tanstack/react-query';
import { Boxes, History, ImagePlus, Plus, Search, Tags } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Toggle } from '@/components/ui';
import { call, core, errorMessage, imageUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money, qty, units } from '@/lib/format';
import { GstInput, isGstRate } from '@/components/GstInput';
import { FitmentEditor, VehicleFilterBar, fitmentRequest } from '@/components/Vehicles';
import { fits, fitLabel, useModule, type Fitment, type VehicleFilter } from '@/lib/spares';
import { useCategories, useProducts, type Product, useSettings } from '@/lib/queries';

export function ItemsPage() {
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleFilter>();
  const spares = useModule('PART_NUMBERS');
  const products = useProducts(search, categoryId || undefined, showInactive);
  // Auto spares: only the parts that fit the chosen vehicle.
  const rows = (products.data ?? []).filter((p) => !vehicle || fits(p, vehicle));
  const categories = useCategories();
  const [editing, setEditing] = useState<Product | 'new'>();
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const catName = (id?: string) => categories.data?.find((c) => c.id === id)?.name;

  return (
    <>
      <PageHeader
        title="Items"
        subtitle={`${rows.length} items`}
        actions={
          auth.canManage && (
            <>
              <Button variant="secondary" icon={<Tags className="size-4" />} onClick={() => setCategoriesOpen(true)}>Categories</Button>
              <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add item</Button>
            </>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder={spares ? 'Search name, part number, SKU or barcode' : 'Search name, SKU or barcode'} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select className="w-48" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">All categories</option>
            {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show removed
          </label>
        </div>
        {spares && (
          <div className="border-b border-slate-100 px-3 py-2">
            <VehicleFilterBar value={vehicle} onChange={setVehicle} />
          </div>
        )}
        {products.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          vehicle ? <Empty icon={<Boxes className="size-10" />} title="No parts for this vehicle" hint="Set the vehicles an item fits in the item's details." /> :
          <Empty icon={<Boxes className="size-10" />} title="No items" hint="Add your first item to start billing." />
        ) : (
          <Table head={['Item', 'Category', 'Price', 'MRP', 'GST', 'Stock', '']}>
            {rows.map((p) => (
              <tr key={p.id} className={auth.canManage ? 'cursor-pointer hover:bg-slate-50' : ''} onClick={() => auth.canManage && setEditing(p)}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                      {p.imageId ? <img src={imageUrl(p.imageId)} alt="" className="size-full object-cover" /> : <span className="font-bold text-slate-300">{p.name?.slice(0, 1)}</span>}
                    </div>
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-slate-400">
                        {[p.partNumber && `Part ${p.partNumber}`, p.rackLocation && `Rack ${p.rackLocation}`, p.sku, p.barcode].filter(Boolean).join(' · ')}
                      </p>
                      {(p.fitments?.length ?? 0) > 0 && <p className="text-xs text-brand-700">{p.fitments!.map(fitLabel).join(', ')}</p>}
                    </div>
                  </div>
                </Td>
                <Td className="text-slate-500">{catName(p.categoryId) ?? '—'}</Td>
                <Td right className="font-semibold">{money(p.price)}</Td>
                <Td right className="text-slate-500">{p.mrp ? money(p.mrp) : '—'}</Td>
                <Td right>{qty(p.taxRate)}%</Td>
                <Td right>
                  {p.trackInventory ? (
                    <span className={p.lowStock ? 'font-semibold text-amber-600' : ''}>{qty(p.stock)} {p.unit?.toLowerCase()}</span>
                  ) : (
                    <span className="text-slate-400">not tracked</span>
                  )}
                </Td>
                <Td>{p.active === false ? <Badge tone="red">Removed</Badge> : p.lowStock ? <Badge tone="amber">Low</Badge> : null}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editing && <ItemForm product={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
      {categoriesOpen && <CategoriesModal onClose={() => setCategoriesOpen(false)} />}
    </>
  );
}

function ItemForm({ product, onClose }: { product?: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const categories = useCategories();
  const gstRegistered = useSettings().data?.gstRegistered ?? true;
  const spares = useModule('PART_NUMBERS');
  const tradePricing = useModule('TRADE_PRICE');
  const [fitments, setFitments] = useState<Fitment[]>(product?.fitments ?? []);
  const [f, setF] = useState({
    name: product?.name ?? '',
    categoryId: product?.categoryId ?? '',
    price: product?.price?.toString() ?? '',
    mrp: product?.mrp?.toString() ?? '',
    costPrice: product?.costPrice?.toString() ?? '',
    taxRate: product?.taxRate?.toString() ?? '',
    taxInclusive: product?.taxInclusive ?? true,
    unit: product?.unit ?? 'PCS',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    hsnCode: product?.hsnCode ?? '',
    reorderLevel: product?.reorderLevel?.toString() ?? '',
    trackInventory: product?.trackInventory ?? true,
    openingStock: '',
    partNumber: product?.partNumber ?? '',
    altPartNumbers: product?.altPartNumbers ?? '',
    fitsVehicles: product?.fitsVehicles ?? '',
    rackLocation: product?.rackLocation ?? '',
    tradePrice: product?.tradePrice?.toString() ?? '',
  });
  const [photo, setPhoto] = useState<File>();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

  async function save(e: FormEvent) {
    e.preventDefault();
    // GST is the shop's own rate for each item: no default.
    if (f.taxRate !== '' ? !isGstRate(f.taxRate) : gstRegistered) {
      return toast.error('Enter the GST % (0 to 100)');
    }
    setBusy(true);
    try {
      const body = {
        name: f.name.trim(),
        categoryId: f.categoryId || undefined,
        price: Number(f.price),
        mrp: num(f.mrp),
        costPrice: num(f.costPrice),
        taxRate: f.taxRate === '' ? undefined : Number(f.taxRate),
        taxInclusive: f.taxInclusive,
        unit: f.unit,
        sku: f.sku.trim() || undefined,
        barcode: f.barcode.trim() || undefined,
        hsnCode: f.hsnCode.trim() || undefined,
        reorderLevel: num(f.reorderLevel),
        trackInventory: f.trackInventory,
        openingStock: product ? undefined : num(f.openingStock),
        ...(spares && {
          partNumber: f.partNumber.trim(),
          altPartNumbers: f.altPartNumbers.trim(),
          fitsVehicles: f.fitsVehicles.trim(),
          rackLocation: f.rackLocation.trim(),
          fitments: fitmentRequest(fitments),
        }),
        ...(tradePricing && { tradePrice: num(f.tradePrice) ?? 0 }),
      };
      const saved = product
        ? await call(core.PUT('/api/v1/core/products/{id}', { params: { path: { id: product.id! } }, body }))
        : await call(core.POST('/api/v1/core/products', { body }));
      if (photo && saved?.id) {
        const form = new FormData();
        form.append('file', photo);
        await call(core.PUT('/api/v1/core/products/{id}/image', { params: { path: { id: saved.id } }, body: form as never, bodySerializer: (b) => b as unknown as FormData }));
      }
      toast.success(product ? 'Item saved' : 'Item added');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!product || !confirm(`Remove ${product.name}? It stays in old bills.`)) return;
    try {
      await call(core.DELETE('/api/v1/core/products/{id}', { params: { path: { id: product.id! } } }));
      toast.success('Item removed');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={product ? `Edit ${product.name}` : 'Add item'}
      footer={
        <>
          {product && (
            <>
              <Button variant="ghost" className="text-rose-600" onClick={remove}>Remove</Button>
              <Link to={`/activity?entityId=${product.id}&title=${encodeURIComponent(product.name ?? '')}`} className="mr-auto">
                <Button variant="ghost" icon={<History className="size-4" />}>History</Button>
              </Link>
            </>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="item-form" busy={busy}>Save</Button>
        </>
      }
    >
      <form id="item-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *" className="sm:col-span-2">
          <Input required autoFocus value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Selling price *" hint={f.taxInclusive ? 'GST included' : 'GST added on top'}>
          <Input required inputMode="decimal" value={f.price} onChange={set('price')} />
        </Field>
        <Field label="MRP">
          <Input inputMode="decimal" value={f.mrp} onChange={set('mrp')} />
        </Field>
        <Field label="Cost price" hint="For profit reports">
          <Input inputMode="decimal" value={f.costPrice} onChange={set('costPrice')} />
        </Field>
        <Field label="GST %">
          <GstInput value={f.taxRate} onChange={(v) => setF({ ...f, taxRate: v })} />
        </Field>
        <Field label="Category">
          <Select value={f.categoryId} onChange={set('categoryId')}>
            <option value="">None</option>
            {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Unit">
          <Select value={f.unit} onChange={set('unit')}>
            {Object.entries(units).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Barcode">
          <Input value={f.barcode} onChange={set('barcode')} placeholder="Scan or type" />
        </Field>
        <Field label="HSN code">
          <Input value={f.hsnCode} onChange={set('hsnCode')} />
        </Field>
        <Field label="SKU">
          <Input value={f.sku} onChange={set('sku')} />
        </Field>
        <Field label="Low-stock alert at">
          <Input inputMode="decimal" value={f.reorderLevel} onChange={set('reorderLevel')} />
        </Field>
        {!product && (
          <Field label="Opening stock">
            <Input inputMode="decimal" value={f.openingStock} onChange={set('openingStock')} />
          </Field>
        )}
        <Field label="Photo">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <ImagePlus className="size-4" /> {photo?.name ?? (product?.imageId ? 'Replace photo' : 'Choose a photo')}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0])} />
          </label>
        </Field>
        {tradePricing && (
          <Field label="Mechanic / trade price" hint="For customers marked as mechanic or garage">
            <Input inputMode="decimal" value={f.tradePrice} onChange={set('tradePrice')} placeholder="Empty: selling price" />
          </Field>
        )}
        {spares && (
          <>
            <p className="pt-2 text-sm font-semibold text-slate-700 sm:col-span-2">Part details</p>
            <Field label="Part number" hint="Company / OEM number">
              <Input value={f.partNumber} onChange={set('partNumber')} maxLength={64} />
            </Field>
            <Field label="Rack / bin">
              <Input value={f.rackLocation} onChange={set('rackLocation')} maxLength={40} placeholder="e.g. A3-2" />
            </Field>
            <Field label="Alternate part numbers" hint="Other brands' numbers, separated by commas" className="sm:col-span-2">
              <Input value={f.altPartNumbers} onChange={set('altPartNumbers')} maxLength={500} />
            </Field>
            <Field label="Fits vehicles" hint="From your vehicle list (Vehicles page)" className="sm:col-span-2">
              <FitmentEditor value={fitments} onChange={setFitments} />
            </Field>
            <Field label="Other fit notes" hint="Searched too, e.g. engine or chassis codes" className="sm:col-span-2">
              <Input value={f.fitsVehicles} onChange={set('fitsVehicles')} maxLength={500} />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          <Toggle checked={f.taxInclusive} onChange={(v) => setF({ ...f, taxInclusive: v })} label="Price includes GST" />
          <Toggle checked={f.trackInventory} onChange={(v) => setF({ ...f, trackInventory: v })} label="Track stock" hint="Stock goes down with every sale" />
        </div>
      </form>
    </Modal>
  );
}

function CategoriesModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const categories = useCategories();
  const [name, setName] = useState('');

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await call(core.POST('/api/v1/core/categories', { body: { name: name.trim() } }));
      setName('');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function remove(id: string) {
    try {
      await call(core.DELETE('/api/v1/core/categories/{id}', { params: { path: { id } } }));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Modal open onClose={onClose} title="Categories">
      <form onSubmit={add} className="mb-4 flex gap-2">
        <Input placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!name.trim()}>Add</Button>
      </form>
      <ul className="divide-y divide-slate-100">
        {(categories.data ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2">
            <span>{c.name}</span>
            <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => remove(c.id!)}>Delete</Button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
