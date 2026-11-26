import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, IndianRupee, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Button, Card, PageHeader, Spinner, Stat, Tabs } from '@/components/ui';
import { call, core } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { daysAgo, isoDay, money, paymentLabels, qty } from '@/lib/format';

type Period = 'today' | 'month';

export function DashboardPage() {
  const auth = useAuth();
  const [period, setPeriod] = useState<Period>('today');
  const today = new Date();
  const from = period === 'today' ? isoDay(today) : isoDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const to = isoDay(today);

  const summary = useQuery({
    queryKey: ['dashboard', from, to],
    queryFn: () => call(core.GET('/api/v1/core/reports/dashboard', { params: { query: { from, to } } })),
    enabled: auth.isBackOffice,
  });
  const daily = useQuery({
    queryKey: ['sales-daily', 14],
    queryFn: async () =>
      (await call(core.GET('/api/v1/core/reports/sales-daily', { params: { query: { from: isoDay(daysAgo(13)), to } } }))) ?? [],
    enabled: auth.isBackOffice,
  });
  const top = useQuery({
    queryKey: ['top-products', from, to],
    queryFn: async () => (await call(core.GET('/api/v1/core/reports/top-products', { params: { query: { from, to, limit: 6 } } }))) ?? [],
    enabled: auth.isBackOffice,
  });
  const lowStock = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => (await call(core.GET('/api/v1/core/reports/low-stock'))) ?? [],
    enabled: auth.isBackOffice,
  });

  const s = summary.data;
  const hello = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const maxDay = Math.max(1, ...(daily.data ?? []).map((d) => d.total ?? 0));

  return (
    <>
      <PageHeader
        title={`${hello}, ${auth.user?.fullName ?? auth.user?.username ?? ''}`}
        subtitle="Here is how your business is doing."
        actions={
          <>
            {auth.isBackOffice && (
              <Tabs value={period} onChange={setPeriod} options={[{ value: 'today', label: 'Today' }, { value: 'month', label: 'This month' }]} />
            )}
            {auth.hasRole('OWNER', 'MANAGER', 'CASHIER') && (
              <Link to="/billing">
                <Button icon={<ShoppingCart className="size-4" />}>New bill</Button>
              </Link>
            )}
          </>
        }
      />

      {!auth.isBackOffice ? (
        <Card className="p-6 text-center text-slate-600">Use <b>New bill</b> to start billing, or open <b>Sales</b> to see today's bills.</Card>
      ) : summary.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Sales" value={money(s?.totalSales)} hint={`${s?.totalOrders ?? 0} bills · ${s?.cancelledOrders ?? 0} cancelled`} icon={<IndianRupee className="size-5" />} />
            <Stat label="Average bill" value={money(s?.averageOrderValue)} hint={`GST collected ${money(s?.totalTax)}`} icon={<Receipt className="size-5" />} />
            <Stat label="Expenses" value={money(s?.totalExpenses)} hint={`Purchases ${money(s?.totalPurchases)}`} icon={<Wallet className="size-5" />} />
            <Stat label="Profit estimate" value={money(s?.grossProfitEstimate)} hint="Sales minus cost of items sold" icon={<TrendingUp className="size-5" />} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="p-4 lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Last 14 days</h2>
                <span className="num text-sm font-semibold">{money((daily.data ?? []).reduce((t, d) => t + (d.total ?? 0), 0))}</span>
              </div>
              <div className="flex h-44 items-end gap-1 border-b border-slate-200">
                {(daily.data ?? []).map((d) => (
                  <div key={d.date} className="group relative flex h-full flex-1 flex-col justify-end">
                    <div className="rounded-t-sm bg-brand-500 transition group-hover:bg-chrome" style={{ height: `${Math.max(2, ((d.total ?? 0) / maxDay) * 100)}%` }} />
                    <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                      {new Date(d.date!).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: {money(d.total)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Payments</h2>
              <div className="space-y-3">
                {Object.entries((s?.salesByPaymentMethod ?? {}) as Record<string, number>).map(([method, amount]) => (
                  <div key={method}>
                    <div className="flex justify-between text-sm">
                      <span>{paymentLabels[method] ?? method}</span>
                      <span className="font-semibold">{money(amount)}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-sm bg-slate-100">
                      <div className="h-1.5 rounded-sm bg-brand-500" style={{ width: `${((amount ?? 0) / Math.max(1, s?.totalSales ?? 1)) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {Object.keys(s?.salesByPaymentMethod ?? {}).length === 0 && <p className="text-sm text-slate-500">No sales yet.</p>}
              </div>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Top items</h2>
              <ul className="divide-y divide-slate-100">
                {(top.data ?? []).map((p) => (
                  <li key={p.productId} className="flex justify-between py-1.5 text-[13px]">
                    <span>{p.productName} <span className="text-slate-400">× {qty(p.quantity)}</span></span>
                    <span className="num font-semibold">{money(p.revenue)}</span>
                  </li>
                ))}
                {(top.data ?? []).length === 0 && <p className="text-sm text-slate-500">No sales in this period.</p>}
              </ul>
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><AlertTriangle className="size-4 text-amber-500" /> Low stock</h2>
                <Badge tone={(lowStock.data ?? []).length ? 'amber' : 'green'}>{(lowStock.data ?? []).length} items</Badge>
              </div>
              <ul className="divide-y divide-slate-100">
                {(lowStock.data ?? []).slice(0, 8).map((p) => (
                  <li key={p.productId} className="flex justify-between py-1.5 text-[13px]">
                    <span>{p.name}</span>
                    <span className="font-semibold text-amber-700">{qty(p.stock)} {p.unit?.toLowerCase()}</span>
                  </li>
                ))}
                {(lowStock.data ?? []).length === 0 && <p className="text-sm text-slate-500">All items are well stocked.</p>}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
