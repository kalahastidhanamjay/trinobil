import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Card, Field, Input, PageHeader, Spinner, Toggle } from '@/components/ui';
import { call, core, errorMessage, identity, imageUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useBusiness, useSettings, type Settings } from '@/lib/queries';

export function SettingsPage() {
  const auth = useAuth();
  return (
    <>
      <PageHeader title="Settings" subtitle="How billing works for your business." />
      <div className="grid gap-3 lg:grid-cols-2">
        <BillingSettings />
        <div className="space-y-3">
          <LogoCard />
          {auth.hasRole('OWNER') && <BusinessDetails />}
        </div>
      </div>
    </>
  );
}

function BillingSettings() {
  const queryClient = useQueryClient();
  const settings = useSettings();
  // Restaurant-only settings show only when the business has those features.
  const modules = useBusiness().data?.modules ?? [];
  const kitchen = modules.includes('TABLES') || modules.includes('KITCHEN_DISPLAY');
  const serviceCharge = modules.includes('SERVICE_CHARGE');
  const takeaway = modules.includes('TAKEAWAY');
  const [s, setS] = useState<Settings>();
  const [busy, setBusy] = useState(false);
  useEffect(() => setS(settings.data), [settings.data]);
  if (!s) return <Card className="p-4"><Spinner /></Card>;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { logoImageId: _logo, ...body } = s!;
      await call(core.PUT('/api/v1/core/settings', { body: { ...body, upiId: body.upiId ?? '' } }));
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-lg font-bold">Billing</h2>
      <form onSubmit={save} className="space-y-2">
        <Toggle checked={!!s.gstRegistered} onChange={(v) => set('gstRegistered', v)} label="GST registered" hint="Off: simple bills at MRP with no GST lines" />
        <Toggle checked={!!s.printAfterSale} onChange={(v) => set('printAfterSale', v)} label="Print after every sale" />
        <Toggle checked={!!s.autoEmailInvoice} onChange={(v) => set('autoEmailInvoice', v)} label="Email the invoice automatically" hint="When the customer has an email" />
        {kitchen && (
          <Toggle checked={!!s.printKot} onChange={(v) => set('printKot', v)} label="Print KOT" hint="Kitchen order ticket when items are sent to the kitchen" />
        )}
        <div className="grid gap-4 pt-4 sm:grid-cols-2">
          <Field label="UPI ID" hint="Shown as a QR on bills">
            <Input value={s.upiId ?? ''} onChange={(e) => set('upiId', e.target.value)} placeholder="shopname@okaxis" />
          </Field>
          {serviceCharge && (
            <Field label="Service charge %" hint="Dine-in bills">
              <Input inputMode="decimal" value={s.serviceChargePercent ?? 0} onChange={(e) => set('serviceChargePercent', Number(e.target.value) || 0)} />
            </Field>
          )}
          {takeaway && (
            <Field label="Packing charge ₹" hint="Takeaway / parcel bills">
              <Input inputMode="decimal" value={s.packingCharge ?? 0} onChange={(e) => set('packingCharge', Number(e.target.value) || 0)} />
            </Field>
          )}
          <Field label="Cashier max discount %">
            <Input inputMode="decimal" value={s.cashierMaxDiscountPercent ?? 0} onChange={(e) => set('cashierMaxDiscountPercent', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Manager max discount %">
            <Input inputMode="decimal" value={s.managerMaxDiscountPercent ?? 0} onChange={(e) => set('managerMaxDiscountPercent', Number(e.target.value) || 0)} />
          </Field>
        </div>
        <div className="pt-4">
          <Button busy={busy}>Save settings</Button>
        </div>
      </form>
    </Card>
  );
}

function LogoCard() {
  const queryClient = useQueryClient();
  const settings = useSettings();
  const [busy, setBusy] = useState(false);
  const logo = settings.data?.logoImageId;

  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 1_000_000) return toast.error('The logo must be under 1 MB');
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await call(core.PUT('/api/v1/core/settings/logo', { body: form as never, bodySerializer: (b) => b as unknown as FormData }));
      toast.success('Logo saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    await call(core.DELETE('/api/v1/core/settings/logo')).catch((e) => toast.error(errorMessage(e)));
    queryClient.invalidateQueries({ queryKey: ['settings'] });
  }

  return (
    <Card className="p-4">
      <h2 className="mb-4 text-lg font-bold">Logo</h2>
      <div className="flex items-center gap-5">
        <div className="flex size-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
          {logo ? <img src={imageUrl(logo)} alt="Logo" className="size-full object-contain p-2" /> : <ImagePlus className="size-6 text-slate-300" />}
        </div>
        <div className="space-y-2">
          <p className="text-sm text-slate-500">Printed on bills and invoices. A dark logo on white prints best.</p>
          <div className="flex gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 px-3 text-sm font-semibold hover:bg-slate-50">
              {busy ? 'Uploading…' : logo ? 'Change' : 'Upload'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {logo && <Button size="sm" variant="ghost" className="text-rose-600" onClick={remove}>Remove</Button>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function BusinessDetails() {
  const queryClient = useQueryClient();
  const business = useBusiness();
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const b = business.data;
    if (b) setF({ name: b.name ?? '', ownerName: b.ownerName ?? '', mobile: b.mobile ?? '', email: b.email ?? '', address: b.address ?? '', city: b.city ?? '', state: b.state ?? '', pincode: b.pincode ?? '', gstin: b.gstin ?? '', pan: b.pan ?? '', invoicePrefix: b.invoicePrefix ?? '' });
  }, [business.data]);
  if (!business.data) return <Card className="p-4"><Spinner /></Card>;
  const b = business.data;
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim() || undefined]));
      await call(identity.PUT('/api/v1/users/business', {
        body: { ...clean, name: f.name.trim(), businessType: b.businessType, logo: b.logo, currency: b.currency, timezone: b.timezone, invoiceSettings: b.invoiceSettings, taxSettings: b.taxSettings },
      }));
      toast.success('Business details saved');
      queryClient.invalidateQueries({ queryKey: ['business'] });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <h2 className="mb-1 text-lg font-bold">Business details</h2>
      <p className="mb-4 text-sm text-slate-500">{b.businessTypeLabel} · plan {b.plan?.toLowerCase()}</p>
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name *" className="sm:col-span-2"><Input required value={f.name ?? ''} onChange={set('name')} /></Field>
        <Field label="Owner name"><Input value={f.ownerName ?? ''} onChange={set('ownerName')} /></Field>
        <Field label="Mobile"><Input value={f.mobile ?? ''} onChange={set('mobile')} /></Field>
        <Field label="Email" className="sm:col-span-2"><Input type="email" value={f.email ?? ''} onChange={set('email')} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address ?? ''} onChange={set('address')} /></Field>
        <Field label="City"><Input value={f.city ?? ''} onChange={set('city')} /></Field>
        <Field label="State"><Input value={f.state ?? ''} onChange={set('state')} /></Field>
        <Field label="PIN code"><Input value={f.pincode ?? ''} onChange={set('pincode')} maxLength={6} /></Field>
        <Field label="GSTIN"><Input value={f.gstin ?? ''} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} maxLength={15} /></Field>
        <Field label="PAN"><Input value={f.pan ?? ''} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} maxLength={10} /></Field>
        <Field label="Invoice prefix"><Input value={f.invoicePrefix ?? ''} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value.toUpperCase() })} maxLength={10} /></Field>
        <div className="sm:col-span-2"><Button busy={busy}>Save details</Button></div>
      </form>
    </Card>
  );
}
