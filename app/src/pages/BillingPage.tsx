import clsx from 'clsx';
import { useQueryClient } from '@tanstack/react-query';
import { VehicleFilterBar } from '@/components/Vehicles';
import { fits, matchesSearch, priceFor, useModule, type VehicleFilter } from '@/lib/spares';
import { CheckCircle2, ScanBarcode, Trash2, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { toast } from 'sonner';
import { Receipt } from '@/components/Receipt';
import { SaleActions, printSale } from '@/components/SaleActions';
import { Badge, Button, Input, Modal, Select, Spinner } from '@/components/ui';
import { call, core, errorMessage, idempotencyKey } from '@/lib/api';
import { money, qty } from '@/lib/format';
import { useBusiness, useCategories, useCustomers, useProducts, useSettings, type Product, type Sale } from '@/lib/queries';

type Line = { product: Product; quantity: number; discount: number };

const methods = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'CREDIT', label: 'Credit' },
] as const;
type Method = (typeof methods)[number]['value'];

/** "3*sugar", "2.5 x rice" or "3*" before a scan: quantity first, then the item. */
function parseEntry(raw: string): { quantity: number; query: string } {
  const m = raw.match(/^\s*(\d+(?:\.\d+)?)\s*[*xX]\s*(.*)$/);
  return m ? { quantity: Number(m[1]), query: m[2].trim() } : { quantity: 1, query: raw.trim() };
}

/** Bill columns: rate and discount are hidden on a phone. */
const cols = 'grid-cols-[22px_minmax(0,1fr)_60px_84px_22px] sm:grid-cols-[36px_minmax(0,1fr)_96px_90px_84px_100px_32px]';

/** Counter billing, built for the keyboard and a barcode scanner. */
export function BillingPage() {
  const queryClient = useQueryClient();
  const [entry, setEntry] = useState('');
  const [cursor, setCursor] = useState(0);
  const [categoryId, setCategoryId] = useState<string>();
  const products = useProducts();
  const categories = useCategories();
  const customers = useCustomers();
  // Auto spares: parts for one vehicle, the customer's vehicle number, mechanic (trade) prices.
  const spares = useModule('PART_NUMBERS');
  const [vehicle, setVehicle] = useState<VehicleFilter>();
  const [vehicleNo, setVehicleNo] = useState('');
  const settings = useSettings();
  const business = useBusiness();
  const [lines, setLines] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [method, setMethod] = useState<Method>('CASH');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Sale>();
  const keyRef = useRef<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sellable = useMemo(
    () => (products.data ?? []).filter((p) => !p.ingredient && (!vehicle || fits(p, vehicle))),
    [products.data, vehicle],
  );
  const { quantity: entryQty, query } = parseEntry(entry);
  const matches = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return [];
    return sellable
      .filter((p) => matchesSearch(p, q, query))
      .sort((a, b) => Number(b.name?.toLowerCase().startsWith(q)) - Number(a.name?.toLowerCase().startsWith(q)))
      .slice(0, 12);
  }, [sellable, query]);
  const quick = useMemo(() => sellable.filter((p) => !categoryId || p.categoryId === categoryId), [sellable, categoryId]);

  const trade = !!customers.data?.find((c) => c.id === customerId)?.tradeCustomer;
  const price = (p: (typeof sellable)[number]) => priceFor(p, trade);
  const gross = lines.reduce((t, l) => t + price(l.product) * l.quantity, 0);
  const discount = lines.reduce((t, l) => t + l.discount, 0);
  const total = gross - discount;
  const units = lines.reduce((t, l) => t + l.quantity, 0);
  const change = method === 'CASH' && Number(received) > 0 ? Number(received) - total : undefined;

  useEffect(() => setCursor(0), [query]);

  function update(next: Line[]) {
    keyRef.current = null; // a different bill: a new retry key
    setLines(next);
  }

  function add(p: Product, n = 1) {
    const existing = lines.find((l) => l.product.id === p.id);
    const want = (existing?.quantity ?? 0) + n;
    if (p.trackInventory && (p.stock ?? 0) < want) {
      toast.warning(`Only ${qty(p.stock)} ${p.unit?.toLowerCase() ?? ''} of ${p.name} in stock`);
      return;
    }
    update(existing ? lines.map((l) => (l === existing ? { ...l, quantity: want } : l)) : [...lines, { product: p, quantity: n, discount: 0 }]);
  }

  function setQuantity(line: Line, quantity: number) {
    if (quantity <= 0) return update(lines.filter((l) => l !== line));
    update(lines.map((l) => (l === line ? { ...l, quantity } : l)));
  }

  function focusSearch() {
    searchRef.current?.focus();
    searchRef.current?.select();
  }

  function clearBill() {
    update([]);
    setCustomerId('');
    setInvoiceEmail('');
    setReceived('');
    setMethod('CASH');
    setEntry('');
    focusSearch();
  }

  function onSearchKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matches.length) setCursor((c) => Math.max(c - 1, 0));
      else qtyRefs.current[lines.length - 1]?.select(); // jump into the bill to fix the last line
    } else if (e.key === 'Escape') {
      setEntry('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Barcode scanners type the code and press Enter.
      const exact = sellable.find((p) => p.barcode && p.barcode === query);
      const pick = exact ?? matches[cursor];
      if (pick) {
        add(pick, entryQty);
        setEntry('');
      } else if (query) {
        toast.error(`No item matches “${query}”`);
      }
    }
  }

  async function checkout() {
    if (lines.length === 0 || busy) return;
    if (method === 'CREDIT' && !customerId) {
      toast.error('Choose the customer for a credit (pay later) bill.');
      return;
    }
    keyRef.current ??= idempotencyKey();
    setBusy(true);
    try {
      const sale = await call(
        core.POST('/api/v1/core/sales', {
          params: { header: { 'Idempotency-Key': keyRef.current } },
          body: {
            paymentMethod: method,
            customerId: customerId || undefined,
            invoiceEmail: invoiceEmail.trim() || undefined,
            totalAmount: total,
            items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity, discount: l.discount })),
            vehicleNumber: spares && vehicleNo.trim() ? vehicleNo.trim().toUpperCase() : undefined,
          },
        }),
      );
      keyRef.current = null;
      setLines([]);
      setCustomerId('');
      setVehicleNo('');
      setInvoiceEmail('');
      setReceived('');
      setMethod('CASH');
      setDone(sale);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (sale && settings.data?.printAfterSale) printSale(sale);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function closeDone() {
    setDone(undefined);
    setTimeout(focusSearch, 0);
  }

  return (
    <div className="grid gap-3 xl:h-full xl:min-h-[calc(100vh-5rem)] xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* ------------------------------------------------ entry + bill */}
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <div className="relative">
          <div className="flex h-12 items-center gap-2 rounded-lg border-2 border-brand-600 bg-white px-3 shadow-sm focus-within:ring-4 focus-within:ring-brand-100">
            <ScanBarcode className="size-5 shrink-0 text-brand-600" />
            {entryQty !== 1 && <span className="num rounded bg-brand-600 px-1.5 py-0.5 text-xs font-bold text-white">×{qty(entryQty)}</span>}
            <input
              ref={searchRef}
              autoFocus
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
              placeholder="Type item name, code or scan barcode…"
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onKeyDown={onSearchKey}
            />
          </div>
          {matches.length > 0 && (
            <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl">
              <div className="grid grid-cols-[minmax(0,1fr)_110px_80px_100px] border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Item</span>
                <span>Code</span>
                <span className="text-right">Stock</span>
                <span className="text-right">Rate</span>
              </div>
              {matches.map((p, i) => {
                const out = p.trackInventory && (p.stock ?? 0) <= 0;
                return (
                  <button
                    key={p.id}
                    onMouseEnter={() => setCursor(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      add(p, entryQty);
                      setEntry('');
                      focusSearch();
                    }}
                    className={clsx(
                      'grid w-full grid-cols-[minmax(0,1fr)_110px_80px_100px] items-center px-3 py-1.5 text-left text-[13px]',
                      i === cursor ? 'bg-brand-600 text-white' : 'hover:bg-slate-50',
                    )}
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    <span className={clsx('num truncate text-xs', i === cursor ? 'text-brand-100' : 'text-slate-400')}>
                      {[p.partNumber, p.rackLocation && `📍${p.rackLocation}`].filter(Boolean).join(' ') || p.barcode || p.sku || '—'}
                    </span>
                    <span className={clsx('num text-right text-xs', out && i !== cursor && 'text-rose-600')}>{p.trackInventory ? qty(p.stock) : '∞'}</span>
                    <span className="num text-right font-semibold">{money(price(p))}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {spares && <VehicleFilterBar value={vehicle} onChange={setVehicle} />}

        <div className="flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className={clsx('grid items-center gap-2 bg-chrome px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400', cols)}>
            <span />
            <span>Item</span>
            <span className="text-center">Qty</span>
            <span className="hidden text-right sm:block">Rate</span>
            <span className="hidden text-right sm:block">Disc ₹</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
            {lines.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center text-slate-400">
                <ScanBarcode className="size-8 text-slate-300" />
                <p className="text-sm">Start typing or scan — the bill builds here.</p>
              </div>
            )}
            {lines.map((l, i) => (
              <div
                key={l.product.id}
                className={clsx('grid items-center gap-2 px-3 py-1.5 text-[13px] even:bg-slate-50/60 focus-within:bg-brand-50', cols)}
              >
                <span className="num text-xs text-slate-400">{i + 1}</span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{l.product.name}</p>
                  {l.product.trackInventory && <p className="num text-[10px] text-slate-400">stock {qty(l.product.stock)}</p>}
                </div>
                <input
                  ref={(el) => {
                    qtyRefs.current[i] = el;
                  }}
                  className="num h-7 w-full rounded border border-slate-300 text-center outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  value={l.quantity}
                  inputMode="decimal"
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setQuantity(l, Number(e.target.value) || 0)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') focusSearch();
                    if (e.key === 'ArrowUp') qtyRefs.current[i - 1]?.select();
                    if (e.key === 'ArrowDown') (qtyRefs.current[i + 1] ?? searchRef.current)?.select();
                    if (e.key === '+') {
                      e.preventDefault();
                      setQuantity(l, l.quantity + 1);
                    }
                    if (e.key === '-') {
                      e.preventDefault();
                      setQuantity(l, l.quantity - 1);
                    }
                  }}
                />
                <span className="num hidden text-right text-slate-600 sm:block">{money(price(l.product))}</span>
                <input
                  className="num hidden h-7 w-full rounded border border-slate-200 px-1.5 text-right outline-none focus:border-brand-500 sm:block"
                  inputMode="decimal"
                  placeholder="0"
                  value={l.discount || ''}
                  onChange={(e) => update(lines.map((x) => (x === l ? { ...x, discount: Math.max(0, Number(e.target.value) || 0) } : x)))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape') && focusSearch()}
                />
                <span className="num text-right font-semibold">{money(price(l.product) * l.quantity - l.discount)}</span>
                <button className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600" onClick={() => setQuantity(l, 0)} aria-label="Remove" tabIndex={-1}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* quick picks for loose items and fast movers */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex gap-1 overflow-x-auto border-b border-slate-100 px-2 py-1.5">
            {[{ id: undefined as string | undefined, name: 'All' }, ...(categories.data ?? []).filter((c) => c.active !== false)].map((c) => (
              <button
                key={c.id ?? 'all'}
                tabIndex={-1}
                onClick={() => setCategoryId(c.id)}
                className={clsx(
                  'whitespace-nowrap rounded px-2.5 py-1 text-xs font-semibold',
                  categoryId === c.id ? 'bg-chrome text-white' : 'text-slate-500 hover:bg-slate-100',
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          {products.isLoading ? (
            <Spinner className="py-4" />
          ) : (
            <div className="grid max-h-44 grid-cols-2 gap-1.5 overflow-y-auto p-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
              {quick.map((p) => {
                const out = p.trackInventory && (p.stock ?? 0) <= 0;
                const n = lines.find((l) => l.product.id === p.id)?.quantity ?? 0;
                return (
                  <button
                    key={p.id}
                    tabIndex={-1}
                    onClick={() => {
                      add(p);
                      focusSearch();
                    }}
                    disabled={out}
                    className={clsx(
                      'relative rounded-md border px-2 py-1.5 text-left transition disabled:opacity-40',
                      n ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-400',
                    )}
                  >
                    <p className={clsx('truncate text-xs font-medium', n > 0 && 'pr-5')}>{p.name}</p>
                    <p className="num text-xs font-semibold text-brand-700">{money(price(p))}</p>
                    {n > 0 && <span className="num absolute right-1 top-1 rounded bg-brand-600 px-1 text-[10px] font-bold text-white">{qty(n)}</span>}
                  </button>
                );
              })}
              {quick.length === 0 && <p className="col-span-full py-3 text-center text-xs text-slate-400">No items in this category.</p>}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ totals + payment */}
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-lg bg-chrome text-white shadow-lg">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            <span>Bill total</span>
            <span className="num">
              {lines.length} item{lines.length === 1 ? '' : 's'} · {qty(units)} qty
            </span>
          </div>
          <p className="num px-4 pb-1 pt-3 text-right text-5xl font-bold tracking-tight text-brand-200">{money(total)}</p>
          <div className="space-y-0.5 px-4 pb-3 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Gross</span>
              <span className="num">{money(gross)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span className="num">−{money(discount)}</span>
            </div>
            <p className="pt-1 text-[10px] text-slate-500">GST is worked out on the invoice</p>
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</p>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Select className="pl-8" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Walk-in customer</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.mobile ? ` · ${c.mobile}` : ''}
                  </option>
                ))}
              </Select>
            </div>
            {!customerId && (
              <Input className="mt-1.5" type="email" placeholder="Email the bill (optional)" value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)} />
            )}
            {trade && <p className="mt-1 text-xs font-medium text-brand-700">Mechanic / trade prices applied</p>}
            {spares && (
              <Input className="mt-1.5" maxLength={20} placeholder="Vehicle number (optional), e.g. AP 39 AB 1234" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value.toUpperCase())} />
            )}
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Payment</p>
            <div className="grid grid-cols-4 gap-1">
              {methods.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={clsx(
                    'flex flex-col items-center rounded-md border py-1.5 text-xs font-semibold transition',
                    method === m.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {method === 'CASH' && (
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Received</span>
                <Input
                  className="num text-right"
                  inputMode="decimal"
                  placeholder="0"
                  value={received}
                  onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && checkout()}
                />
              </label>
              <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Return</span>
                <p className={clsx('num flex h-8 items-center justify-end rounded-md px-2.5 text-sm font-bold', change === undefined ? 'bg-slate-100 text-slate-400' : change < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700')}>
                  {change === undefined ? '—' : money(change)}
                </p>
              </div>
            </div>
          )}

          <Button size="lg" className="w-full justify-between text-base" disabled={lines.length === 0} busy={busy} onClick={checkout}>
            <span>Charge {money(total)}</span>
          </Button>
          <Button variant="ghost" size="sm" className="w-full" disabled={lines.length === 0} onClick={clearBill}>
            Clear bill
          </Button>
        </div>

      </div>

      <Modal
        open={!!done}
        onClose={closeDone}
        title="Bill saved"
        footer={
          done && (
            <>
              <SaleActions sale={done} />
              <Button autoFocus onClick={closeDone}>
                Next bill
              </Button>
            </>
          )
        }
      >
        {done && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
            <p className="num mt-2 text-4xl font-bold">{money(done.grandTotal)}</p>
            <p className="num mt-1 text-sm text-slate-500">{done.invoiceNumber}</p>
            {done.invoiceEmailedTo && <Badge tone="blue">Emailing to {done.invoiceEmailedTo}</Badge>}
          </div>
        )}
      </Modal>
      {done && <Receipt sale={done} business={business.data} logoId={settings.data?.logoImageId} />}
    </div>
  );
}
