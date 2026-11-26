import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Wallet } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td } from '@/components/ui';
import { call, core, errorMessage } from '@/lib/api';
import { date, daysAgo, isoDay, money, paymentLabels } from '@/lib/format';
import { useExpenseCategories } from '@/lib/queries';

export function ExpensesPage() {
  const queryClient = useQueryClient();
  const categories = useExpenseCategories();
  const [from, setFrom] = useState(isoDay(daysAgo(29)));
  const [to, setTo] = useState(isoDay());
  const [adding, setAdding] = useState(false);
  const expenses = useQuery({
    queryKey: ['expenses', from, to],
    queryFn: async () => (await call(core.GET('/api/v1/core/expenses', { params: { query: { from, to, size: 200 } } })))?.content ?? [],
  });
  const catName = (id?: string) => categories.data?.find((c) => c.id === id)?.name ?? '—';
  const total = (expenses.data ?? []).reduce((t, e) => t + (e.amount ?? 0), 0);

  async function remove(id: string) {
    if (!confirm('Delete this expense?')) return;
    try {
      await call(core.DELETE('/api/v1/core/expenses/{id}', { params: { path: { id } } }));
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader title="Expenses" subtitle={`${money(total)} in this period`} actions={<Button icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>Add expense</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 px-3 py-2">
          <Input type="date" className="w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {expenses.isLoading ? (
          <Spinner />
        ) : (expenses.data ?? []).length === 0 ? (
          <Empty icon={<Wallet className="size-10" />} title="No expenses in this period" />
        ) : (
          <Table head={['Date', 'Category', 'Notes', 'Paid by', 'Amount', '']}>
            {(expenses.data ?? []).map((e) => (
              <tr key={e.id}>
                <Td className="text-slate-500">{date(e.date)}</Td>
                <Td className="font-semibold">{catName(e.expenseCategoryId)}</Td>
                <Td className="text-slate-500">{e.notes ?? '—'}</Td>
                <Td>{paymentLabels[e.paymentMethod ?? ''] ?? e.paymentMethod ?? '—'}</Td>
                <Td right className="font-bold">{money(e.amount)}</Td>
                <Td><Button size="sm" variant="ghost" className="text-rose-600" onClick={() => remove(e.id!)}>Delete</Button></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {adding && <ExpenseForm onClose={() => setAdding(false)} />}
    </>
  );
}

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const categories = useExpenseCategories();
  const [categoryId, setCategoryId] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState(isoDay());
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      let cat = categoryId;
      if (cat === 'new') {
        cat = (await call(core.POST('/api/v1/core/expenses/categories', { body: { name: newCategory.trim() } })))?.id ?? '';
        queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      }
      await call(core.POST('/api/v1/core/expenses', { body: { expenseCategoryId: cat, amount: Number(amount), date: day, paymentMethod, notes: notes.trim() || undefined } }));
      toast.success('Expense added');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add expense" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="expense-form" busy={busy}>Save</Button></>}>
      <form id="expense-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Category *">
          <Select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose…</option>
            {(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="new">+ New category</option>
          </Select>
        </Field>
        {categoryId === 'new' ? (
          <Field label="New category name *"><Input required value={newCategory} onChange={(e) => setNewCategory(e.target.value)} /></Field>
        ) : (
          <Field label="Amount *"><Input required autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        )}
        {categoryId === 'new' && <Field label="Amount *"><Input required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>}
        <Field label="Date"><Input type="date" max={isoDay()} value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label="Paid by">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {['CASH', 'UPI', 'CARD', 'OTHER'].map((m) => <option key={m} value={m}>{paymentLabels[m]}</option>)}
          </Select>
        </Field>
        <Field label="Notes" className="sm:col-span-2"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. electricity bill for October" /></Field>
      </form>
    </Modal>
  );
}
