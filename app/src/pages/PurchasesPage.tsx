import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td, Toggle } from '@/components/ui';
import { call, core, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, isoDay, money, qty } from '@/lib/format';
import { GstInput, isGstRate } from '@/components/GstInput';
import { useProducts, useSuppliers } from '@/lib/queries';

const statusTone = { ORDERED: 'amber', RECEIVED: 'green', CANCELLED: 'red' } as const;

export function PurchasesPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string>();
  const purchases = useQuery({
    queryKey: ['purchases'],
    queryFn: async () => (await call(core.GET('/api/v1/core/purchases', { params: { query: { size: 200 } } })))?.content ?? [],
  });
  const supplierName = (id?: string) => suppliers.data?.find((s) => s.id === id)?.name ?? '—';
  const open = purchases.data?.find((p) => p.id === openId);

  async function act(id: string, action: 'receive' | 'cancel') {
    try {
      await call(
        action === 'receive'
          ? core.POST('/api/v1/core/purchases/{id}/receive', { params: { path: { id } } })
          : core.POST('/api/v1/core/purchases/{id}/cancel', { params: { path: { id } } }),
      );
      toast.success(action === 'receive' ? 'Received: stock added' : 'Purchase cancelled');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setOpenId(undefined);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Purchases"
        subtitle="Goods bought from suppliers. Receiving a purchase adds the stock."
        actions={auth.canManage && <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New purchase</Button>}
      />
      <Card>
        {purchases.isLoading ? (
          <Spinner />
        ) : (purchases.data ?? []).length === 0 ? (
          <Empty icon={<ClipboardList className="size-10" />} title="No purchases yet" />
        ) : (
          <Table head={['Reference', 'Supplier', 'Bill no.', 'Date', 'Status', 'Total']}>
            {(purchases.data ?? []).map((p) => (
              <tr key={p.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(p.id)}>
                <Td className="font-semibold">{p.referenceNumber}</Td>
                <Td>{supplierName(p.supplierId)}</Td>
                <Td className="text-slate-500">{p.supplierInvoiceNumber ?? '—'}</Td>
                <Td className="text-slate-500">{date(p.purchaseDate)}</Td>
                <Td><Badge tone={statusTone[p.status ?? 'ORDERED']}>{p.status?.toLowerCase()}</Badge></Td>
                <Td right className="font-bold">{money(p.totalAmount)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {open && (
        <Modal
          open
          wide
          onClose={() => setOpenId(undefined)}
          title={`${open.referenceNumber} · ${supplierName(open.supplierId)}`}
          footer={
            auth.canManage && open.status !== 'CANCELLED' && (
              <>
                {open.status === 'ORDERED' && <Button onClick={() => act(open.id!, 'receive')}>Receive goods</Button>}
                <Button variant="ghost" className="text-rose-600" onClick={() => confirm('Cancel this purchase? Received stock is taken back.') && act(open.id!, 'cancel')}>Cancel purchase</Button>
              </>
            )
          }
        >
          <Table head={['Item', 'Qty', 'Cost', 'GST', 'Amount']}>
            {open.items?.map((i, n) => (
              <tr key={n}>
                <Td>{i.productName}</Td>
                <Td right>{qty(i.quantity)}</Td>
                <Td right>{money(i.unitCost)}</Td>
                <Td right>{money(i.taxAmount)} <span className="text-xs text-slate-400">({qty(i.taxRate)}%)</span></Td>
                <Td right className="font-semibold">{money(i.lineTotal)}</Td>
              </tr>
            ))}
          </Table>
          <p className="mt-4 text-right text-lg font-extrabold">Total {money(open.totalAmount)}</p>
        </Modal>
      )}
      {creating && <PurchaseForm onClose={() => setCreating(false)} />}
    </>
  );
}

type Line = { productId: string; quantity: string; unitCost: string; taxRate: string };

function PurchaseForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();
  const products = useProducts();
  const [supplierId, setSupplierId] = useState('');
  const [billNo, setBillNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(isoDay());
  const [received, setReceived] = useState(true);
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: '1', unitCost: '', taxRate: '' }]);
  const [busy, setBusy] = useState(false);
  const product = (id: string) => products.data?.find((p) => p.id === id);
  const net = lines.reduce((t, l) => t + Number(l.quantity || 0) * Number(l.unitCost || 0), 0);
  const tax = lines.reduce((t, l) => t + (Number(l.quantity || 0) * Number(l.unitCost || 0) * Number(l.taxRate || 0)) / 100, 0);

  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, n) => (n === i ? { ...l, ...patch } : l)));

  async function save(e: FormEvent) {
    e.preventDefault();
    const items = lines.filter((l) => l.productId && Number(l.quantity) > 0);
    if (items.length === 0) return toast.error('Add at least one item');
    if (items.some((l) => !isGstRate(l.taxRate))) return toast.error('Enter the GST % (0 to 100) on every line');
    setBusy(true);
    try {
      await call(
        core.POST('/api/v1/core/purchases', {
          body: {
            supplierId: supplierId || undefined,
            supplierInvoiceNumber: billNo.trim() || undefined,
            purchaseDate,
            received,
            items: items.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unitCost: Number(l.unitCost || 0), taxRate: Number(l.taxRate) })),
          },
        }),
      );
      toast.success(received ? 'Purchase saved, stock added' : 'Order saved');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="New purchase"
      footer={
        <>
          <span className="mr-auto self-center text-sm text-slate-500">
            {money(net)} + GST {money(tax)} = <b className="text-slate-900">{money(net + tax)}</b>
          </span>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="purchase-form" busy={busy}>Save purchase</Button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier">
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">No supplier</option>
              {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Supplier bill no."><Input value={billNo} onChange={(e) => setBillNo(e.target.value)} /></Field>
          <Field label="Date"><Input type="date" max={isoDay()} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></Field>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_80px_110px_90px_32px] gap-2 text-xs font-semibold uppercase text-slate-500">
            <span>Item</span><span>Qty</span><span>Cost (before GST)</span><span>GST</span><span />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px_90px_32px] gap-2">
              <Select
                value={l.productId}
                onChange={(e) => {
                  const p = product(e.target.value);
                  setLine(i, { productId: e.target.value, unitCost: l.unitCost || (p?.costPrice?.toString() ?? ''), taxRate: p?.taxRate?.toString() ?? l.taxRate });
                }}
              >
                <option value="">Choose item</option>
                {(products.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
              <Input inputMode="decimal" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
              <Input inputMode="decimal" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} />
              <GstInput value={l.taxRate} onChange={(v) => setLine(i, { taxRate: v })} />
              <button type="button" className="text-slate-400 hover:text-rose-600" onClick={() => setLines(lines.filter((_, n) => n !== i))} aria-label="Remove line">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" icon={<Plus className="size-4" />} onClick={() => setLines([...lines, { productId: '', quantity: '1', unitCost: '', taxRate: '' }])}>
            Add line
          </Button>
        </div>
        <Toggle checked={received} onChange={setReceived} label="Goods received now" hint={received ? 'Stock is added now' : 'Saved as an order; receive it later'} />
      </form>
    </Modal>
  );
}
