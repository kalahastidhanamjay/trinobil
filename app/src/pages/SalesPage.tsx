import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt as ReceiptIcon, Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Receipt } from '@/components/Receipt';
import { SaleActions } from '@/components/SaleActions';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Table, Td, Tabs, Textarea } from '@/components/ui';
import { call, core, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime, daysAgo, isoDay, money, paymentLabels, qty } from '@/lib/format';
import { useBusiness, useSettings } from '@/lib/queries';

type Range = 'today' | 'week' | 'month' | 'custom';

export function SalesPage() {
  const [range, setRange] = useState<Range>('today');
  const [from, setFrom] = useState(isoDay());
  const [to, setTo] = useState(isoDay());
  const [invoice, setInvoice] = useState('');
  const [openId, setOpenId] = useState<string>();

  const period = range === 'custom' ? { from, to } : { from: isoDay(daysAgo(range === 'today' ? 0 : range === 'week' ? 6 : 29)), to: isoDay() };
  const sales = useQuery({
    queryKey: ['sales', period.from, period.to, invoice],
    queryFn: async () =>
      (await call(core.GET('/api/v1/core/sales', { params: { query: { ...period, invoice: invoice || undefined, size: 200 } } })))?.content ?? [],
  });
  const valid = (sales.data ?? []).filter((s) => s.status !== 'CANCELLED');

  return (
    <>
      <PageHeader
        title="Sales"
        subtitle={`${valid.length} bills · ${money(valid.reduce((t, s) => t + (s.grandTotal ?? 0), 0))}`}
        actions={
          <Tabs
            value={range}
            onChange={setRange}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: '7 days' },
              { value: 'month', label: '30 days' },
              { value: 'custom', label: 'Dates' },
            ]}
          />
        }
      />
      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-3 py-2">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Invoice number" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
          </div>
          {range === 'custom' && (
            <>
              <Input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
        </div>
        {sales.isLoading ? (
          <Spinner />
        ) : sales.error ? (
          <div className="p-4"><ErrorBox error={sales.error} /></div>
        ) : (sales.data ?? []).length === 0 ? (
          <Empty icon={<ReceiptIcon className="size-10" />} title="No bills in this period" />
        ) : (
          <Table head={['Invoice', 'Date', 'Payment', 'By', 'GST', 'Total', '']}>
            {(sales.data ?? []).map((s) => (
              <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(s.id)}>
                <Td className="font-semibold">{s.invoiceNumber}</Td>
                <Td className="text-slate-500">{dateTime(s.soldAt)}</Td>
                <Td>{paymentLabels[s.paymentMethod ?? ''] ?? s.paymentMethod}</Td>
                <Td className="text-slate-500">{s.createdBy}</Td>
                <Td right>{money(s.taxTotal)}</Td>
                <Td right className="font-bold">{money(s.grandTotal)}</Td>
                <Td>{s.status === 'CANCELLED' && <Badge tone="red">Cancelled</Badge>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {openId && <SaleDetail id={openId} onClose={() => setOpenId(undefined)} />}
    </>
  );
}

function SaleDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const business = useBusiness();
  const settings = useSettings();
  const sale = useQuery({ queryKey: ['sale', id], queryFn: () => call(core.GET('/api/v1/core/sales/{id}', { params: { path: { id } } })) });
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const s = sale.data;

  async function cancel() {
    setBusy(true);
    try {
      await call(core.POST('/api/v1/core/sales/{id}/cancel', { params: { path: { id } }, body: { reason } }));
      toast.success('Bill cancelled. Stock is back.');
      setCancelling(false);
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', id] });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={s?.invoiceNumber ?? 'Bill'}
      footer={
        s && (
          <>
            {auth.canManage && s.status !== 'CANCELLED' && (
              <Button variant="ghost" className="mr-auto text-rose-600" onClick={() => setCancelling(true)}>Cancel bill</Button>
            )}
            <SaleActions sale={s} reprint />
          </>
        )
      }
    >
      {!s ? (
        <Spinner />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
            <span>{dateTime(s.soldAt)}</span>
            <span>{paymentLabels[s.paymentMethod ?? '']}</span>
            <span>By {s.createdBy}</span>
            {s.status === 'CANCELLED' && <Badge tone="red">Cancelled: {s.cancelReason}</Badge>}
            {s.offlineRef && <Badge tone="amber">Made offline · {s.offlineRef}</Badge>}
          </div>
          <Table head={['Item', 'Qty', 'Rate', 'Discount', 'GST', 'Amount']}>
            {s.items?.map((i, n) => (
              <tr key={n}>
                <Td>{i.productName}</Td>
                <Td right>{qty(i.quantity)}</Td>
                <Td right>{money(i.unitPrice)}</Td>
                <Td right>{i.discount ? money(i.discount) : '—'}</Td>
                <Td right>{s.gstApplied ? `${qty(i.taxRate)}%` : '—'}</Td>
                <Td right className="font-semibold">{money(i.lineTotal)}</Td>
              </tr>
            ))}
          </Table>
          <div className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
            {s.gstApplied ? (
              <>
                <Row label="Taxable value" value={money(s.taxableTotal)} />
                <Row label="CGST" value={money(s.cgst)} />
                <Row label="SGST" value={money(s.sgst)} />
              </>
            ) : (
              <Row label="Subtotal" value={money(s.subtotal)} />
            )}
            {(s.discountTotal ?? 0) > 0 && <Row label="Discount" value={`−${money(s.discountTotal)}`} />}
            {(s.serviceCharge ?? 0) > 0 && <Row label="Service charge" value={money(s.serviceCharge)} />}
            {(s.packingCharge ?? 0) > 0 && <Row label="Packing charge" value={money(s.packingCharge)} />}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold">
              <span>Total</span>
              <span>{money(s.grandTotal)}</span>
            </div>
          </div>
          <Receipt sale={s} business={business.data} logoId={settings.data?.logoImageId} />
        </>
      )}
      <Modal
        open={cancelling}
        onClose={() => setCancelling(false)}
        title="Cancel this bill?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelling(false)}>Keep bill</Button>
            <Button variant="danger" busy={busy} disabled={!reason.trim()} onClick={cancel}>Cancel bill</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">The stock comes back and the bill is marked cancelled in reports.</p>
        <Field label="Reason">
          <Textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. customer returned the items" />
        </Field>
      </Modal>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
