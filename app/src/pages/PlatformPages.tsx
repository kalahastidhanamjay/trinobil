import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, Plus, Search } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Table, Td } from '@/components/ui';
import { call, errorMessage, identity } from '@/lib/api';
import { date, dateTime } from '@/lib/format';
import type { components } from '@/api/identity';

type Schemas = components['schemas'];
type Plan = NonNullable<Schemas['TenantSummary']['plan']>;
type Status = NonNullable<Schemas['TenantSummary']['status']>;

const plans: Plan[] = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];
const statusTone: Record<Status, 'green' | 'amber' | 'red'> = { ACTIVE: 'green', SUSPENDED: 'amber', CLOSED: 'red' };
const titleCase = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : '—');

/** Business types and features, from the server (never built into the app). */
const useCatalog = () =>
  useQuery({ queryKey: ['catalog'], queryFn: () => call(identity.GET('/api/v1/users/business/catalog')), staleTime: 3_600_000 });

function useTypeLabel() {
  const types = useCatalog().data?.types ?? [];
  return (code?: string) => types.find((t) => t.code === code)?.label ?? code ?? '—';
}

// ------------------------------------------------------------------ overview

export function PlatformHomePage() {
  const stats = useQuery({ queryKey: ['platform-stats'], queryFn: () => call(identity.GET('/api/v1/platform/stats')) });
  const s = stats.data;
  return (
    <>
      <PageHeader
        title="Platform"
        subtitle="All businesses using Trinobil."
        actions={<Link to="/businesses/new"><Button icon={<Plus className="size-4" />}>Onboard business</Button></Link>}
      />
      {stats.error ? <ErrorBox error={stats.error} /> : !s ? <Spinner /> : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Stat label="Businesses" value={s.totalTenants ?? 0} />
            <Stat label="Active" value={s.activeTenants ?? 0} />
            <Stat label="Suspended" value={s.suspendedTenants ?? 0} />
            <Stat label="New in 30 days" value={s.newTenantsLast30Days ?? 0} />
            <Stat label="Business users" value={s.totalBusinessUsers ?? 0} />
          </div>
          <Card className="p-4">
            <p className="mb-3 text-sm font-semibold">Businesses by plan</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(s.tenantsByPlan ?? {}).map(([plan, n]) => (
                <Badge key={plan} tone="gray">{titleCase(plan)}: {n}</Badge>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ list

export function BusinessesPage() {
  const navigate = useNavigate();
  const typeLabel = useTypeLabel();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const list = useQuery({
    queryKey: ['tenants', q, status],
    queryFn: () =>
      call(identity.GET('/api/v1/platform/tenants', { params: { query: { q: q || undefined, status: status || undefined, size: 100 } } })),
  });
  const rows = list.data?.content ?? [];
  return (
    <>
      <PageHeader
        title="Businesses"
        subtitle="Shops and restaurants on the platform."
        actions={<Link to="/businesses/new"><Button icon={<Plus className="size-4" />}>Onboard business</Button></Link>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-8" placeholder="Search name, owner, mobile, GSTIN" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value as Status | '')}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>
      {list.error ? <ErrorBox error={list.error} /> : list.isLoading ? <Spinner /> : rows.length === 0 ? (
        <Empty icon={<Building2 />} title="No businesses found" hint="Onboard the first one to get started." />
      ) : (
        <Card>
          <Table head={['Business', 'Type', 'Owner', 'City', 'Plan', 'Status', 'Since']}>
            {rows.map((t) => (
              <tr key={t.tenantId} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/businesses/${t.tenantId}`)}>
                <Td className="font-medium">{t.name}</Td>
                <Td>{typeLabel(t.businessType)}</Td>
                <Td>{t.ownerName ?? '—'}<div className="text-xs text-slate-400">{t.mobile ?? t.email}</div></Td>
                <Td>{t.city ?? '—'}</Td>
                <Td>{titleCase(t.plan)}{t.plan === 'TRIAL' && t.trialEndsAt && <div className="text-xs text-slate-400">till {date(t.trialEndsAt)}</div>}</Td>
                <Td><Badge tone={t.status ? statusTone[t.status] : 'gray'}>{titleCase(t.status)}</Badge></Td>
                <Td>{date(t.createdAt)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}

// ------------------------------------------------------------------ onboarding

export function OnboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: '', businessType: '', city: '', state: '', mobile: '', gstin: '',
    ownerName: '', ownerEmail: '', ownerMobile: '', username: '',
    plan: 'TRIAL' as Plan, trialDays: '30', maxUsers: '',
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const type = catalog.data?.types?.find((t) => t.code === f.businessType);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!f.businessType) return toast.error('Choose the business type');
    setBusy(true);
    try {
      const result = await call(
        identity.POST('/api/v1/platform/tenants', {
          body: {
            business: {
              name: f.name.trim(),
              businessType: f.businessType,
              city: f.city.trim() || undefined,
              state: f.state.trim() || undefined,
              mobile: f.mobile.trim() || undefined,
              gstin: f.gstin.trim().toUpperCase() || undefined,
            },
            plan: f.plan,
            trialDays: f.plan === 'TRIAL' && f.trialDays ? Number(f.trialDays) : undefined,
            maxUsers: f.maxUsers ? Number(f.maxUsers) : undefined,
            owner: {
              fullName: f.ownerName.trim(),
              email: f.ownerEmail.trim(),
              mobile: f.ownerMobile.trim() || undefined,
              username: f.username.trim() || undefined,
            },
          },
        }),
      );
      toast.success(`Onboarded. An activation code was emailed to ${result.owner?.email ?? f.ownerEmail}.`);
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
      navigate(`/businesses/${result.business?.tenantId}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Onboard business" subtitle="Creates the business and its owner login. The owner gets an email to set a password." />
      <form onSubmit={save} className="grid gap-3 lg:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="font-bold">Business</h2>
          <Field label="Business name *"><Input required autoFocus maxLength={200} value={f.name} onChange={set('name')} /></Field>
          <Field label="Business type *" hint={type?.description}>
            <Select required value={f.businessType} onChange={set('businessType')}>
              <option value="">Choose…</option>
              {(catalog.data?.types ?? []).map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </Select>
          </Field>
          {type && (
            <div className="flex flex-wrap gap-1">
              {(type.defaultModules ?? []).map((m) => (
                <Badge key={m} tone="gray">{catalog.data?.modules?.find((x) => x.code === m)?.label ?? m}</Badge>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City"><Input value={f.city} onChange={set('city')} /></Field>
            <Field label="State"><Input value={f.state} onChange={set('state')} /></Field>
            <Field label="Business mobile"><Input inputMode="tel" value={f.mobile} onChange={set('mobile')} /></Field>
            <Field label="GSTIN"><Input value={f.gstin} onChange={set('gstin')} placeholder="Optional" /></Field>
          </div>
        </Card>
        <div className="space-y-3">
          <Card className="space-y-3 p-4">
            <h2 className="font-bold">Owner login</h2>
            <Field label="Owner full name *"><Input required maxLength={150} value={f.ownerName} onChange={set('ownerName')} /></Field>
            <Field label="Owner email *" hint="The activation code goes here."><Input required type="email" value={f.ownerEmail} onChange={set('ownerEmail')} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Owner mobile"><Input inputMode="tel" value={f.ownerMobile} onChange={set('ownerMobile')} /></Field>
              <Field label="Login username" hint="Optional; made from the email when empty"><Input value={f.username} onChange={set('username')} /></Field>
            </div>
          </Card>
          <Card className="space-y-3 p-4">
            <h2 className="font-bold">Plan</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Plan">
                <Select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as Plan })}>
                  {plans.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
                </Select>
              </Field>
              {f.plan === 'TRIAL' && <Field label="Trial days"><Input inputMode="numeric" value={f.trialDays} onChange={set('trialDays')} /></Field>}
              <Field label="Max users" hint="Empty: the plan's default"><Input inputMode="numeric" value={f.maxUsers} onChange={set('maxUsers')} /></Field>
            </div>
          </Card>
          <div className="flex gap-2">
            <Button busy={busy}>Onboard business</Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/businesses')}>Cancel</Button>
          </div>
        </div>
      </form>
    </>
  );
}

// ------------------------------------------------------------------ detail

export function BusinessDetailPage() {
  const { tenantId = '' } = useParams();
  const queryClient = useQueryClient();
  const typeLabel = useTypeLabel();
  const path = { params: { path: { tenantId } } };
  const detail = useQuery({ queryKey: ['tenant', tenantId], queryFn: () => call(identity.GET('/api/v1/platform/tenants/{tenantId}', path)) });
  const users = useQuery({ queryKey: ['tenant-users', tenantId], queryFn: () => call(identity.GET('/api/v1/platform/tenants/{tenantId}/users', path)) });
  const [statusAction, setStatusAction] = useState<'suspend' | 'activate' | 'close'>();
  const [editing, setEditing] = useState(false);
  const b = detail.data?.business;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['tenant-users', tenantId] });
    queryClient.invalidateQueries({ queryKey: ['tenants'] });
    queryClient.invalidateQueries({ queryKey: ['platform-stats'] });
  };

  async function resetPassword(u: Schemas['UserResponse']) {
    if (!u.id || !confirm(`Send ${u.fullName ?? u.username} a new activation code by email? They choose a new password with it.`)) return;
    try {
      await call(identity.POST('/api/v1/platform/tenants/{tenantId}/users/{userId}/reset-password', { params: { path: { tenantId, userId: u.id } } }));
      toast.success(`Activation code emailed to ${u.email}`);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  if (detail.error) return <ErrorBox error={detail.error} />;
  if (!b) return <Spinner />;
  return (
    <>
      <PageHeader
        title={b.name ?? 'Business'}
        subtitle={`${typeLabel(b.businessType)} · ${titleCase(b.plan)} plan`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setEditing(true)}>Edit plan & details</Button>
            {b.status === 'ACTIVE' && <Button variant="ghost" onClick={() => setStatusAction('suspend')}>Suspend</Button>}
            {b.status !== 'ACTIVE' && <Button variant="ghost" onClick={() => setStatusAction('activate')}>Reactivate</Button>}
            {b.status !== 'CLOSED' && <Button variant="ghost" onClick={() => setStatusAction('close')}>Close</Button>}
          </div>
        }
      />
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="space-y-2 p-4 text-sm">
          <Row label="Status"><Badge tone={b.status ? statusTone[b.status] : 'gray'}>{titleCase(b.status)}</Badge></Row>
          {detail.data?.statusReason && <Row label="Reason">{detail.data.statusReason}</Row>}
          <Row label="Plan">{titleCase(b.plan)}{b.plan === 'TRIAL' && b.trialEndsAt ? ` (till ${date(b.trialEndsAt)})` : ''}</Row>
          <Row label="Users">{detail.data?.userCount ?? 0} of {b.maxUsers}</Row>
          <Row label="Owner">{b.ownerName ?? '—'}</Row>
          <Row label="Email">{b.email ?? '—'}</Row>
          <Row label="Mobile">{b.mobile ?? '—'}</Row>
          <Row label="City">{[b.city, b.state].filter(Boolean).join(', ') || '—'}</Row>
          <Row label="GSTIN">{b.gstin ?? '—'}</Row>
          <Row label="Onboarded">{date(b.createdAt)}{detail.data?.createdBy ? ` by ${detail.data.createdBy}` : ''}</Row>
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-4 py-3 font-bold">Logins</div>
          {users.isLoading ? <Spinner /> : (
            <Table head={['Name', 'Role', 'Status', 'Last sign-in', '']}>
              {(users.data ?? []).map((u) => (
                <tr key={u.id}>
                  <Td>{u.fullName ?? u.username}<div className="text-xs text-slate-400">{u.username} · {u.email}</div></Td>
                  <Td>{String(u.roles ?? '').toLowerCase().replaceAll(',', ', ')}</Td>
                  <Td>
                    {!u.enabled ? <Badge tone="red">Disabled</Badge> : u.locked ? <Badge tone="amber">Locked</Badge>
                      : !u.activated ? <Badge tone="amber">Not activated</Badge> : <Badge tone="green">Active</Badge>}
                  </Td>
                  <Td>{dateTime(u.lastLoginAt)}</Td>
                  <Td right>
                    <Button size="sm" variant="ghost" icon={<KeyRound className="size-4" />} onClick={() => resetPassword(u)}>Reset password</Button>
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
      {statusAction && <StatusDialog tenantId={tenantId} action={statusAction} name={b.name ?? ''} onClose={() => setStatusAction(undefined)} onDone={refresh} />}
      {editing && <EditDialog tenantId={tenantId} business={b} onClose={() => setEditing(false)} onDone={refresh} />}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function StatusDialog({ tenantId, action, name, onClose, onDone }: {
  tenantId: string; action: 'suspend' | 'activate' | 'close'; name: string; onClose: () => void; onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const words = {
    suspend: ['Suspend', 'Its users cannot sign in until it is reactivated.'],
    activate: ['Reactivate', 'Its users can sign in again.'],
    close: ['Close', 'The business is closed for good; its users cannot sign in.'],
  }[action];
  async function go() {
    setBusy(true);
    try {
      const options = { params: { path: { tenantId } }, body: { reason: reason.trim() || undefined } };
      if (action === 'suspend') await call(identity.POST('/api/v1/platform/tenants/{tenantId}/suspend', options));
      else if (action === 'close') await call(identity.POST('/api/v1/platform/tenants/{tenantId}/close', options));
      else await call(identity.POST('/api/v1/platform/tenants/{tenantId}/activate', { params: { path: { tenantId } } }));
      toast.success(`${words[0]}: done`);
      onDone();
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
      onClose={onClose}
      title={`${words[0]} ${name}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button busy={busy} onClick={go}>{words[0]}</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">{words[1]}</p>
      {action !== 'activate' && <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>}
    </Modal>
  );
}

function EditDialog({ tenantId, business, onClose, onDone }: {
  tenantId: string; business: Schemas['BusinessProfileResponse']; onClose: () => void; onDone: () => void;
}) {
  const catalog = useCatalog();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    name: business.name ?? '',
    businessType: business.businessType ?? '',
    plan: (business.plan ?? 'TRIAL') as Plan,
    maxUsers: String(business.maxUsers ?? ''),
    trialEnds: business.trialEndsAt ? business.trialEndsAt.slice(0, 10) : '',
  });
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { id: _id, tenantId: _t, businessTypeLabel: _l, status: _s, plan: _p, maxUsers: _m, trialEndsAt: _e, createdAt: _c, updatedAt: _u, ...details } = business;
      await call(
        identity.PUT('/api/v1/platform/tenants/{tenantId}', {
          params: { path: { tenantId } },
          body: {
            // A new type gets that type's features; otherwise the business keeps its own.
            business: { ...details, name: f.name.trim(), businessType: f.businessType, modules: f.businessType === business.businessType ? details.modules : undefined },
            plan: f.plan,
            maxUsers: Number(f.maxUsers),
            trialEndsAt: f.plan === 'TRIAL' && f.trialEnds ? new Date(`${f.trialEnds}T23:59:59`).toISOString() : undefined,
          },
        }),
      );
      toast.success('Business updated');
      onDone();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="Edit plan & details">
      <form onSubmit={save} className="space-y-3">
        <Field label="Business name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Business type" hint="Changing it switches to that type's features.">
          <Select value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value })}>
            {(catalog.data?.types ?? []).map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Plan">
            <Select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value as Plan })}>
              {plans.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
            </Select>
          </Field>
          <Field label="Max users"><Input required inputMode="numeric" value={f.maxUsers} onChange={(e) => setF({ ...f, maxUsers: e.target.value })} /></Field>
          {f.plan === 'TRIAL' && <Field label="Trial ends"><Input type="date" value={f.trialEnds} onChange={(e) => setF({ ...f, trialEnds: e.target.value })} /></Field>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button busy={busy}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
