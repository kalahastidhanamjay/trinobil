import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td } from '@/components/ui';
import { call, core, errorMessage } from '@/lib/api';
import { dateTime, qty } from '@/lib/format';
import { useProducts } from '@/lib/queries';

export function StockPage() {
  const products = useProducts();
  const [adjusting, setAdjusting] = useState(false);
  const lowStock = useQuery({ queryKey: ['low-stock'], queryFn: async () => (await call(core.GET('/api/v1/core/reports/low-stock'))) ?? [] });
  const adjustments = useQuery({
    queryKey: ['adjustments'],
    queryFn: async () => (await call(core.GET('/api/v1/core/inventory/adjustments', { params: { query: { size: 100 } } })))?.content ?? [],
  });
  const name = (id?: string) => products.data?.find((p) => p.id === id)?.name ?? '—';

  return (
    <>
      <PageHeader title="Stock" subtitle="Low stock and manual stock corrections." actions={<Button icon={<Plus className="size-4" />} onClick={() => setAdjusting(true)}>Correct stock</Button>} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4 text-amber-500" /> Low stock</h2>
            <Badge tone="amber">{lowStock.data?.length ?? 0}</Badge>
          </div>
          {lowStock.isLoading ? (
            <Spinner />
          ) : (lowStock.data ?? []).length === 0 ? (
            <Empty title="All items are well stocked" />
          ) : (
            <Table head={['Item', 'In stock', 'Alert at']}>
              {(lowStock.data ?? []).map((p) => (
                <tr key={p.productId}>
                  <Td className="font-semibold">{p.name}</Td>
                  <Td right className="font-semibold text-amber-700">{qty(p.stock)} {p.unit?.toLowerCase()}</Td>
                  <Td right className="text-slate-500">{qty(p.reorderLevel)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-bold">Recent corrections</h2></div>
          {adjustments.isLoading ? (
            <Spinner />
          ) : (adjustments.data ?? []).length === 0 ? (
            <Empty title="No stock corrections yet" />
          ) : (
            <Table head={['Item', 'Change', 'Reason', 'By']}>
              {(adjustments.data ?? []).map((a) => (
                <tr key={a.id}>
                  <Td><p className="font-semibold">{name(a.productId)}</p><p className="text-xs text-slate-400">{dateTime(a.createdAt)}</p></Td>
                  <Td right className={a.type === 'ADDITION' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                    {a.type === 'ADDITION' ? '+' : '−'}{qty(a.quantity)}
                  </Td>
                  <Td className="text-slate-500">{a.reason ?? '—'}</Td>
                  <Td className="text-slate-500">{a.createdBy}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
      {adjusting && <AdjustForm onClose={() => setAdjusting(false)} />}
    </>
  );
}

function AdjustForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const products = useProducts();
  const [productId, setProductId] = useState('');
  const [type, setType] = useState<'ADDITION' | 'SUBTRACTION'>('ADDITION');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const product = products.data?.find((p) => p.id === productId);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await call(core.POST('/api/v1/core/inventory/adjustments', { body: { productId, type, quantity: Number(quantity), reason: reason.trim() || undefined } }));
      toast.success('Stock corrected');
      queryClient.invalidateQueries({ queryKey: ['adjustments'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Correct stock" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="adjust-form" busy={busy}>Save</Button></>}>
      <form id="adjust-form" onSubmit={save} className="space-y-4">
        <Field label="Item *" hint={product?.trackInventory ? `Now: ${qty(product.stock)} ${product.unit?.toLowerCase()}` : undefined}>
          <Select required value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Choose item</option>
            {(products.data ?? []).filter((p) => p.trackInventory).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Change">
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="ADDITION">Add stock</option>
              <option value="SUBTRACTION">Remove stock</option>
            </Select>
          </Field>
          <Field label="Quantity *"><Input required inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        </div>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. counted shelf, damaged, gift" /></Field>
      </form>
    </Modal>
  );
}
