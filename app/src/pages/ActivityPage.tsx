import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { History, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Select, Spinner, Tabs } from '@/components/ui';
import { call, core, identity } from '@/lib/api';
import { dateTime, daysAgo, money, time } from '@/lib/format';
import { useBusiness } from '@/lib/queries';
import type { components } from '@/api/core';

type Entry = components['schemas']['ActivityEntry'];

const typeLabels: Record<string, string> = {
  ITEM: 'Item', ITEM_PHOTO: 'Item photo', MENU_OPTION: 'Menu option', RECIPE: 'Recipe', CATEGORY: 'Category',
  SALE: 'Sale', QUOTATION: 'Quotation', PURCHASE: 'Purchase', CUSTOMER: 'Customer', SUPPLIER: 'Supplier',
  EXPENSE: 'Expense', EXPENSE_CATEGORY: 'Expense category', STOCK_ADJUSTMENT: 'Stock correction',
  STOCK_TRANSFER: 'Stock transfer', WASTAGE: 'Wastage', WAREHOUSE: 'Warehouse', CASH_SHIFT: 'Cash drawer',
  TABLE: 'Table', ORDER: 'Order', ORDER_ITEM: 'Order item', SETTINGS: 'Settings', LOGO: 'Logo',
};
const groups: Record<string, string[]> = {
  Items: ['ITEM', 'ITEM_PHOTO', 'MENU_OPTION', 'RECIPE', 'CATEGORY'],
  Sales: ['SALE', 'QUOTATION'],
  Purchases: ['PURCHASE'],
  Stock: ['STOCK_ADJUSTMENT', 'STOCK_TRANSFER', 'WASTAGE', 'WAREHOUSE'],
  Customers: ['CUSTOMER'],
  Suppliers: ['SUPPLIER'],
  Expenses: ['EXPENSE', 'EXPENSE_CATEGORY'],
  'Cash drawer': ['CASH_SHIFT'],
  Restaurant: ['TABLE', 'ORDER', 'ORDER_ITEM'],
  Settings: ['SETTINGS', 'LOGO'],
};
const actions: Record<string, [string, 'green' | 'blue' | 'red' | 'amber' | 'gray' | 'indigo']> = {
  CREATED: ['Created', 'green'], UPDATED: ['Changed', 'blue'], DELETED: ['Deleted', 'red'], DEACTIVATED: ['Removed', 'red'],
  ACTIVATED: ['Restored', 'green'], CANCELLED: ['Cancelled', 'amber'], EMAILED: ['Emailed', 'indigo'],
  EMAIL_FAILED: ['Email failed', 'red'], PRINTED: ['Printed', 'gray'], REPRINTED: ['Reprinted', 'amber'], SHARED: ['Shared', 'indigo'],
};
const fieldLabels: Record<string, string> = {
  name: 'Name', price: 'Selling price', mrp: 'MRP', costPrice: 'Cost price', taxRate: 'GST %', taxInclusive: 'Price includes GST',
  unit: 'Unit', barcode: 'Barcode', hsnCode: 'HSN', reorderLevel: 'Low-stock alert at', trackInventory: 'Track stock', active: 'Active',
  mobile: 'Mobile', phone: 'Phone', email: 'Email', gstin: 'GSTIN', grandTotal: 'Total', paymentMethod: 'Payment', items: 'Items',
  invoiceNumber: 'Invoice', status: 'Status', quantity: 'Quantity', reason: 'Reason', amount: 'Amount', sentTo: 'Sent to',
  document: 'Document', printer: 'Printer', note: 'Note', error: 'Error', cancelReason: 'Cancel reason', discountTotal: 'Discount',
};
const money_ = new Set(['price', 'mrp', 'costPrice', 'grandTotal', 'subtotal', 'discountTotal', 'taxTotal', 'amount', 'totalAmount', 'taxableTotal']);
const hidden = (f: string) => (f.endsWith('Id') && f !== 'upiId') || f === 'id';
const label = (f: string) => fieldLabels[f] ?? f.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
function value(f: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (v === true || v === 'true') return 'Yes';
  if (v === false || v === 'false') return 'No';
  if (money_.has(f) && !Number.isNaN(Number(v))) return money(Number(v));
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return dateTime(v);
  return String(v);
}

function summary(e: Entry): string {
  const get = (f: string) => e.changes?.find((c) => c.field === f)?.to as string | undefined;
  switch (e.action) {
    case 'UPDATED':
    case 'CANCELLED':
      return (e.changes ?? []).filter((c) => !hidden(c.field!)).slice(0, 2).map((c) => `${label(c.field!)}: ${value(c.field!, c.from)} → ${value(c.field!, c.to)}`).join(' · ');
    case 'EMAILED':
    case 'EMAIL_FAILED':
      return [get('sentTo') && `Sent to ${get('sentTo')}`, get('document'), get('error')].filter(Boolean).join(' · ');
    case 'PRINTED':
    case 'REPRINTED':
    case 'SHARED':
      return [get('document'), get('printer'), get('items')].filter(Boolean).join(' · ');
    case 'CREATED':
      return [get('grandTotal') && value('grandTotal', get('grandTotal')), get('amount') && value('amount', get('amount')), get('price') && value('price', get('price')), get('paymentMethod'), get('items')].filter(Boolean).join(' · ');
    default:
      return '';
  }
}

export function ActivityPage() {
  const [params] = useSearchParams();
  const entityId = params.get('entityId') ?? undefined;
  const [tab, setTab] = useState<'activity' | 'signins'>('activity');
  return (
    <>
      <PageHeader
        title={entityId ? `History · ${params.get('title') ?? ''}` : 'Activity log'}
        subtitle="Who did what, and when."
        actions={!entityId && <Tabs value={tab} onChange={setTab} options={[{ value: 'activity', label: 'Activity' }, { value: 'signins', label: 'Sign-ins' }]} />}
      />
      {tab === 'activity' ? <ActivityList entityId={entityId} /> : <SignIns />}
    </>
  );
}

function ActivityList({ entityId }: { entityId?: string }) {
  // The restaurant filter only for businesses with tables.
  const restaurant = (useBusiness().data?.modules ?? []).includes('TABLES');
  const [days, setDays] = useState(entityId ? 0 : 7);
  const [actor, setActor] = useState('');
  const [group, setGroup] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Entry>();
  const people = useQuery({ queryKey: ['activity-people'], queryFn: async () => (await call(core.GET('/api/v1/core/activity/people'))) ?? [] });
  const from = days ? new Date(new Date(daysAgo(days - 1)).setHours(0, 0, 0, 0)).toISOString() : undefined;

  const list = useInfiniteQuery({
    queryKey: ['activity', days, actor, group, q, entityId],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      call(core.GET('/api/v1/core/activity', {
        params: { query: { from, actor: actor || undefined, type: group ? groups[group] : undefined, entityId, q: q || undefined, page: pageParam, size: 50 } },
      })),
    getNextPageParam: (last, all) => (last?.hasMore ? all.length : undefined),
  });
  const entries = list.data?.pages.flatMap((p) => p?.entries ?? []) ?? [];
  const byDay = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const d = new Date(e.occurredAt!).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    (acc[d] ??= []).push(e);
    return acc;
  }, {});

  return (
    <Card>
      {!entityId && (
        <div className="flex flex-wrap gap-3 border-b border-slate-100 px-3 py-2">
          <Input className="min-w-56 flex-1" placeholder="Search item, bill, person…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select className="w-36" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>Today</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={0}>All time</option>
          </Select>
          <Select className="w-40" value={actor} onChange={(e) => setActor(e.target.value)}>
            <option value="">Everyone</option>
            {(people.data ?? []).map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select className="w-40" value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All types</option>
            {Object.keys(groups).filter((g) => restaurant || g !== 'Restaurant').map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
        </div>
      )}
      {list.isLoading ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <Empty icon={<History className="size-10" />} title="Nothing recorded for this filter" />
      ) : (
        <div className="divide-y divide-slate-100">
          {Object.entries(byDay).map(([day, rows]) => (
            <div key={day}>
              <p className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</p>
              {rows.map((e) => {
                const [actionLabel, tone] = actions[e.action!] ?? [e.action, 'gray'];
                const line = summary(e);
                return (
                  <button key={e.id} onClick={() => setOpen(e)} className="flex w-full items-start gap-4 px-5 py-3 text-left hover:bg-slate-50">
                    <span className="w-16 shrink-0 pt-0.5 text-xs text-slate-400">{time(e.occurredAt)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{typeLabels[e.entityType!] ?? e.entityType}{e.entityLabel && ` · ${e.entityLabel}`}</p>
                      <p className="text-sm text-slate-500">{e.actor}{e.actorRole && <span className="text-slate-400"> ({e.actorRole.toLowerCase()})</span>}</p>
                      {line && <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{line}</p>}
                    </div>
                    <Badge tone={tone}>{actionLabel}</Badge>
                  </button>
                );
              })}
            </div>
          ))}
          {list.hasNextPage && (
            <div className="p-4 text-center">
              <Button variant="secondary" busy={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>Load more</Button>
            </div>
          )}
        </div>
      )}
      {open && (
        <Modal open wide onClose={() => setOpen(undefined)} title={`${typeLabels[open.entityType!] ?? open.entityType}${open.entityLabel ? ` · ${open.entityLabel}` : ''}`}>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Badge tone={(actions[open.action!] ?? [, 'gray'])[1]}>{(actions[open.action!] ?? [open.action])[0]}</Badge>
            <span>By <b>{open.actor}</b>{open.actorRole && ` (${open.actorRole.toLowerCase()})`}</span>
            <span>{dateTime(open.occurredAt)}</span>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {(open.changes ?? []).filter((c) => !hidden(c.field!)).map((c) => (
                <tr key={c.field}>
                  <td className="w-44 py-2 pr-4 text-slate-500">{label(c.field!)}</td>
                  <td className="py-2">
                    {c.from !== null && c.from !== undefined && open.action !== 'CREATED' ? (
                      <span>
                        <span className="text-rose-600 line-through">{value(c.field!, c.from)}</span>
                        <span className="mx-2 text-slate-400">→</span>
                        <b>{value(c.field!, c.to)}</b>
                      </span>
                    ) : (
                      value(c.field!, c.to)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </Card>
  );
}

const signInLabels: Record<string, [string, 'green' | 'red' | 'amber' | 'gray' | 'blue']> = {
  LOGIN_SUCCEEDED: ['Signed in', 'green'], LOGIN_FAILED: ['Wrong password', 'red'], ACCOUNT_LOCKED: ['Account locked', 'red'],
  LOGOUT: ['Signed out', 'gray'], PASSWORD_CHANGED: ['Password changed', 'blue'], PASSWORD_RESET_REQUESTED: ['Reset asked', 'amber'],
  PASSWORD_RESET_COMPLETED: ['Password reset', 'blue'], PASSWORD_RESET_BY_ADMIN: ['Reset by owner', 'blue'], ACCOUNT_ACTIVATED: ['Activated', 'green'],
  USER_CREATED: ['Staff added', 'green'], USER_UPDATED: ['Staff changed', 'blue'], REFRESH_TOKEN_REUSE_DETECTED: ['Session ended (security)', 'amber'],
};

function SignIns() {
  const events = useQuery({
    queryKey: ['sign-ins'],
    queryFn: async () => (await call(identity.GET('/api/v1/users/activity', { params: { query: { from: daysAgo(30).toISOString(), size: 200 } } })))?.content ?? [],
  });
  return (
    <Card>
      {events.isLoading ? (
        <Spinner />
      ) : (events.data ?? []).length === 0 ? (
        <Empty icon={<LogIn className="size-10" />} title="No sign-ins in the last 30 days" />
      ) : (
        <div className="divide-y divide-slate-100">
          {(events.data ?? []).map((e) => {
            const [text, tone] = signInLabels[e.action ?? ''] ?? [e.action ?? '', 'gray'];
            return (
              <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                <span className="w-36 shrink-0 text-xs text-slate-400">{dateTime(e.occurredAt)}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.actorUsername ?? 'Unknown'}</p>
                  <p className="text-sm text-slate-500">{[e.details, e.ipAddress && `IP ${e.ipAddress}`].filter(Boolean).join(' · ')}</p>
                </div>
                <Badge tone={tone}>{text}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
