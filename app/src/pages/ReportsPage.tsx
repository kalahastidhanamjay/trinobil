import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, Input, PageHeader, Spinner, Stat, Table, Td } from '@/components/ui';
import { call, core } from '@/lib/api';
import { date, daysAgo, isoDay, money, qty } from '@/lib/format';

function downloadCsv(name: string, rows: (string | number | undefined)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [from, setFrom] = useState(isoDay(daysAgo(29)));
  const [to, setTo] = useState(isoDay());
  const q = { from, to };
  const summary = useQuery({ queryKey: ['dashboard', from, to], queryFn: () => call(core.GET('/api/v1/core/reports/dashboard', { params: { query: q } })) });
  const daily = useQuery({ queryKey: ['sales-daily', from, to], queryFn: async () => (await call(core.GET('/api/v1/core/reports/sales-daily', { params: { query: q } }))) ?? [] });
  const top = useQuery({ queryKey: ['top', from, to], queryFn: async () => (await call(core.GET('/api/v1/core/reports/top-products', { params: { query: { ...q, limit: 20 } } }))) ?? [] });
  const tax = useQuery({ queryKey: ['tax', from, to], queryFn: async () => (await call(core.GET('/api/v1/core/reports/tax-summary', { params: { query: q } }))) ?? [] });
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Reports"
        actions={
          <>
            <Input type="date" className="w-auto" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-slate-400">to</span>
            <Input type="date" className="w-auto" value={to} max={isoDay()} onChange={(e) => setTo(e.target.value)} />
          </>
        }
      />
      {summary.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Sales" value={money(s?.totalSales)} hint={`${s?.totalOrders ?? 0} bills`} />
            <Stat label="GST collected" value={money(s?.totalTax)} />
            <Stat label="Purchases" value={money(s?.totalPurchases)} />
            <Stat label="Expenses" value={money(s?.totalExpenses)} hint={`Profit estimate ${money(s?.grossProfitEstimate)}`} />
          </div>

          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="font-bold">Day by day</h2>
              <Button size="sm" variant="secondary" icon={<Download className="size-4" />}
                onClick={() => downloadCsv(`sales-${from}-to-${to}.csv`, [['Date', 'Bills', 'Sales', 'GST'], ...(daily.data ?? []).map((d) => [d.date, d.orders, d.total, d.tax])])}>
                CSV
              </Button>
            </div>
            <Table head={['Date', 'Bills', 'GST', 'Sales']}>
              {(daily.data ?? []).filter((d) => (d.orders ?? 0) > 0).map((d) => (
                <tr key={d.date}>
                  <Td>{date(d.date)}</Td>
                  <Td right>{d.orders}</Td>
                  <Td right>{money(d.tax)}</Td>
                  <Td right className="font-semibold">{money(d.total)}</Td>
                </tr>
              ))}
            </Table>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold">Top items</h2>
                <Button size="sm" variant="secondary" icon={<Download className="size-4" />}
                  onClick={() => downloadCsv(`top-items-${from}-to-${to}.csv`, [['Item', 'Quantity', 'Revenue'], ...(top.data ?? []).map((p) => [p.productName, p.quantity, p.revenue])])}>
                  CSV
                </Button>
              </div>
              <Table head={['Item', 'Qty', 'Revenue']}>
                {(top.data ?? []).map((p) => (
                  <tr key={p.productId}>
                    <Td>{p.productName}</Td>
                    <Td right>{qty(p.quantity)}</Td>
                    <Td right className="font-semibold">{money(p.revenue)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="font-bold">GST summary (for filing)</h2>
                <Button size="sm" variant="secondary" icon={<Download className="size-4" />}
                  onClick={() => downloadCsv(`gst-${from}-to-${to}.csv`, [['GST %', 'Taxable value', 'CGST', 'SGST', 'Total tax'], ...(tax.data ?? []).map((t) => [t.taxRate, t.taxableValue, t.cgst, t.sgst, t.totalTax])])}>
                  CSV
                </Button>
              </div>
              <Table head={['GST %', 'Taxable', 'CGST', 'SGST', 'Tax']}>
                {(tax.data ?? []).map((t) => (
                  <tr key={t.taxRate}>
                    <Td>{qty(t.taxRate)}%</Td>
                    <Td right>{money(t.taxableValue)}</Td>
                    <Td right>{money(t.cgst)}</Td>
                    <Td right>{money(t.sgst)}</Td>
                    <Td right className="font-semibold">{money(t.totalTax)}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
