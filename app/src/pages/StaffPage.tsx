import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UserCog } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Spinner, Table, Td } from '@/components/ui';
import { call, errorMessage, identity } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTime } from '@/lib/format';
import type { components } from '@/api/identity';

type User = components['schemas']['UserResponse'];

const roleOptions = [
  { value: 'MANAGER', label: 'Manager', hint: 'Everything except business details' },
  { value: 'CASHIER', label: 'Cashier', hint: 'Billing, sales, customers' },
  { value: 'ACCOUNTANT', label: 'Accountant', hint: 'Reports, expenses, purchases' },
  { value: 'WAITER', label: 'Waiter', hint: 'Restaurant orders' },
  { value: 'CHEF', label: 'Chef', hint: 'Kitchen screen' },
];

/** The API returns roles as a list or as "OWNER,MANAGER". */
const rolesOf = (u: User): string[] => {
  const r = u.roles as unknown;
  return Array.isArray(r) ? (r as string[]) : String(r ?? '').split(',').map((x) => x.trim()).filter(Boolean);
};

export function StaffPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ['users'], queryFn: async () => (await call(identity.GET('/api/v1/users'))) ?? [] });
  const [editing, setEditing] = useState<User | 'new'>();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  async function toggle(u: User) {
    try {
      await call(identity.PATCH('/api/v1/users/{id}/status', { params: { path: { id: u.id! } }, body: { enabled: !u.enabled } }));
      toast.success(u.enabled ? `${u.fullName ?? u.username} can no longer sign in` : `${u.fullName ?? u.username} can sign in again`);
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function reset(u: User) {
    if (!confirm(`Send ${u.fullName ?? u.username} a code to set a new password?`)) return;
    try {
      await call(identity.POST('/api/v1/users/{id}/reset-password', { params: { path: { id: u.id! } } }));
      toast.success('Reset code emailed');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader title="Staff" subtitle="Who can use Trinobil in your business." actions={<Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add staff</Button>} />
      <Card>
        {users.isLoading ? (
          <Spinner />
        ) : (users.data ?? []).length === 0 ? (
          <Empty icon={<UserCog className="size-10" />} title="No staff yet" />
        ) : (
          <Table head={['Name', 'Roles', 'Last sign-in', 'Status', '']}>
            {(users.data ?? []).map((u) => {
              const roles = rolesOf(u);
              const owner = roles.includes('OWNER');
              const self = u.username === auth.user?.username;
              return (
                <tr key={u.id}>
                  <Td>
                    <p className="font-semibold">{u.fullName ?? u.username}</p>
                    <p className="text-xs text-slate-400">{[u.username, u.email, u.mobile].filter(Boolean).join(' · ')}</p>
                  </Td>
                  <Td><div className="flex flex-wrap gap-1">{roles.map((r) => <Badge key={r} tone={r === 'OWNER' ? 'indigo' : 'gray'}>{r.toLowerCase()}</Badge>)}</div></Td>
                  <Td className="text-slate-500">{u.lastLoginAt ? dateTime(u.lastLoginAt) : u.activated === false ? 'Not activated yet' : '—'}</Td>
                  <Td>{u.enabled ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}</Td>
                  <Td className="whitespace-nowrap text-right">
                    {!owner && !self && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>Roles</Button>
                        <Button size="sm" variant="ghost" onClick={() => reset(u)}>Reset password</Button>
                        <Button size="sm" variant="ghost" className={u.enabled ? 'text-rose-600' : 'text-emerald-700'} onClick={() => toggle(u)}>{u.enabled ? 'Disable' : 'Enable'}</Button>
                      </>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {editing && <StaffForm user={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} onSaved={refresh} />}
    </>
  );
}

function StaffForm({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [mobile, setMobile] = useState(user?.mobile ?? '');
  const [roles, setRoles] = useState<string[]>(user ? rolesOf(user) : ['CASHIER']);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (roles.length === 0) return toast.error('Choose at least one role');
    setBusy(true);
    try {
      if (user) {
        await call(identity.PATCH('/api/v1/users/{id}/role', { params: { path: { id: user.id! } }, body: { roles } }));
        toast.success('Roles updated');
      } else {
        await call(identity.POST('/api/v1/users', { body: { fullName: fullName.trim() || undefined, email: email.trim(), mobile: mobile.trim() || undefined, roles } }));
        toast.success(`Invitation emailed to ${email}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={user ? `Roles · ${user.fullName ?? user.username}` : 'Add staff'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="staff-form" busy={busy}>{user ? 'Save' : 'Send invitation'}</Button></>}>
      <form id="staff-form" onSubmit={save} className="space-y-4">
        {!user && (
          <>
            <Field label="Full name"><Input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
            <Field label="Email *" hint="They get a code to set their password."><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Mobile"><Input value={mobile} onChange={(e) => setMobile(e.target.value)} /></Field>
          </>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Roles</p>
          <div className="space-y-2">
            {roleOptions.map((r) => (
              <label key={r.value} className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={roles.includes(r.value)}
                  onChange={(e) => setRoles(e.target.checked ? [...roles, r.value] : roles.filter((x) => x !== r.value))}
                />
                <span>
                  <span className="block text-sm font-semibold">{r.label}</span>
                  <span className="block text-xs text-slate-500">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
