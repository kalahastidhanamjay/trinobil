import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Users } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Card, Empty, Field, Input, Modal, PageHeader, Spinner, Table, Td, Textarea } from '@/components/ui';
import { errorMessage } from '@/lib/api';

export type Contact = {
  id?: string;
  name?: string;
  mobile?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactPerson?: string;
  notes?: string;
};

type Props = {
  title: string;
  noun: string;
  queryKey: string;
  rows: Contact[] | undefined;
  loading: boolean;
  canEdit: boolean;
  /** Supplier: "phone" + contact person; customer: "mobile" + notes. */
  supplier?: boolean;
  save: (body: Contact, id?: string) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
};

/** List + add / edit / remove for customers and suppliers. */
export function ContactsPage({ title, noun, queryKey, rows, loading, canEdit, supplier, save, remove }: Props) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Contact | 'new'>();
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((c) => !q || [c.name, c.mobile, c.phone, c.email, c.gstin].some((v) => v?.toLowerCase().includes(q)));
  }, [rows, search]);

  return (
    <>
      <PageHeader
        title={title}
        subtitle={`${rows?.length ?? 0} ${title.toLowerCase()}`}
        actions={canEdit && <Button icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add {noun}</Button>}
      />
      <Card>
        <div className="border-b border-slate-100 px-3 py-2">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Search name, phone, email, GSTIN" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <Spinner />
        ) : visible.length === 0 ? (
          <Empty icon={<Users className="size-10" />} title={`No ${title.toLowerCase()} yet`} />
        ) : (
          <Table head={['Name', supplier ? 'Phone' : 'Mobile', 'Email', 'GSTIN', 'City']}>
            {visible.map((c) => (
              <tr key={c.id} className={canEdit ? 'cursor-pointer hover:bg-slate-50' : ''} onClick={() => canEdit && setEditing(c)}>
                <Td className="font-semibold">{c.name}{c.contactPerson && <span className="block text-xs font-normal text-slate-400">{c.contactPerson}</span>}</Td>
                <Td>{(supplier ? c.phone : c.mobile) ?? '—'}</Td>
                <Td className="text-slate-500">{c.email ?? '—'}</Td>
                <Td className="text-slate-500">{c.gstin ?? '—'}</Td>
                <Td className="text-slate-500">{c.city ?? '—'}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {editing && (
        <ContactForm
          contact={editing === 'new' ? undefined : editing}
          noun={noun}
          supplier={supplier}
          queryKey={queryKey}
          save={save}
          remove={remove}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}

function ContactForm({ contact, noun, supplier, queryKey, save, remove, onClose }: {
  contact?: Contact;
  noun: string;
  supplier?: boolean;
  queryKey: string;
  save: Props['save'];
  remove: Props['remove'];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [f, setF] = useState<Contact>({ ...contact });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Contact) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(f).filter(([k, v]) => k !== 'id' && typeof v === 'string' && v.trim() !== '').map(([k, v]) => [k, (v as string).trim()]));
      await save(clean as Contact, contact?.id);
      toast.success(`${noun[0].toUpperCase()}${noun.slice(1)} saved`);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!contact?.id || !confirm(`Remove ${contact.name}?`)) return;
    try {
      await remove(contact.id);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={contact ? `Edit ${contact.name}` : `Add ${noun}`}
      footer={
        <>
          {contact && <Button variant="ghost" className="mr-auto text-rose-600" onClick={del}>Remove</Button>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button form="contact-form" busy={busy}>Save</Button>
        </>
      }
    >
      <form id="contact-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name *" className="sm:col-span-2"><Input required autoFocus value={f.name ?? ''} onChange={set('name')} /></Field>
        {supplier ? (
          <>
            <Field label="Phone"><Input value={f.phone ?? ''} onChange={set('phone')} /></Field>
            <Field label="Contact person"><Input value={f.contactPerson ?? ''} onChange={set('contactPerson')} /></Field>
          </>
        ) : (
          <Field label="Mobile"><Input inputMode="tel" value={f.mobile ?? ''} onChange={set('mobile')} /></Field>
        )}
        <Field label="Email"><Input type="email" value={f.email ?? ''} onChange={set('email')} /></Field>
        <Field label="GSTIN"><Input value={f.gstin ?? ''} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} maxLength={15} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address ?? ''} onChange={set('address')} /></Field>
        <Field label="City"><Input value={f.city ?? ''} onChange={set('city')} /></Field>
        <Field label="State"><Input value={f.state ?? ''} onChange={set('state')} /></Field>
        <Field label="PIN code"><Input inputMode="numeric" value={f.pincode ?? ''} onChange={set('pincode')} maxLength={6} /></Field>
        {!supplier && <Field label="Notes" className="sm:col-span-2"><Textarea value={f.notes ?? ''} onChange={set('notes')} /></Field>}
      </form>
    </Modal>
  );
}
