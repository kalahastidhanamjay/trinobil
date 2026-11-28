import { useQueryClient } from '@tanstack/react-query';
import { Car, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button, Card, Empty, Input, PageHeader, Spinner } from '@/components/ui';
import { call, core, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useVehicles } from '@/lib/spares';

type Level = 'types' | 'makes' | 'models';

/** The shop's own vehicle list: types (2 wheeler…), companies under a type, models under a company. */
export function VehiclesPage() {
  const vehicles = useVehicles();
  const queryClient = useQueryClient();
  const canEdit = useAuth().canManage;

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action();
      toast.success(done);
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const add = (level: Level, name: string, parentId?: string) =>
    run(() => {
      if (level === 'types') return call(core.POST('/api/v1/core/vehicles/types', { body: { name } }));
      if (level === 'makes') return call(core.POST('/api/v1/core/vehicles/makes', { body: { typeId: parentId!, name } }));
      return call(core.POST('/api/v1/core/vehicles/models', { body: { makeId: parentId!, name } }));
    }, `${name} added`);

  function rename(level: Level, id: string, current: string) {
    const name = window.prompt('New name', current)?.trim();
    if (!name || name === current) return;
    const options = { params: { path: { id } }, body: { name } };
    run(() => {
      if (level === 'types') return call(core.PUT('/api/v1/core/vehicles/types/{id}', options));
      if (level === 'makes') return call(core.PUT('/api/v1/core/vehicles/makes/{id}', options));
      return call(core.PUT('/api/v1/core/vehicles/models/{id}', options));
    }, 'Renamed');
  }

  function remove(level: Level, id: string, name: string) {
    if (!window.confirm(`Remove ${name}? Everything listed under it is removed too.`)) return;
    const options = { params: { path: { id } } };
    run(() => {
      if (level === 'types') return call(core.DELETE('/api/v1/core/vehicles/types/{id}', options));
      if (level === 'makes') return call(core.DELETE('/api/v1/core/vehicles/makes/{id}', options));
      return call(core.DELETE('/api/v1/core/vehicles/models/{id}', options));
    }, `${name} removed`);
  }

  const actions = (level: Level, id: string, name: string) =>
    canEdit && (
      <span className="ml-1 inline-flex gap-0.5">
        <button type="button" title="Rename" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => rename(level, id, name)}>
          <Pencil className="size-3.5" />
        </button>
        <button type="button" title="Remove" className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => remove(level, id, name)}>
          <Trash2 className="size-3.5" />
        </button>
      </span>
    );

  const types = vehicles.data ?? [];
  return (
    <>
      <PageHeader title="Vehicles" subtitle="The vehicle types, companies and models you sell parts for. Items are matched to these." />
      {canEdit && (
        <Card className="mb-3 p-3">
          <AddInline placeholder="New vehicle type, e.g. 2 wheeler, 4 wheeler, tractor" onAdd={(n) => add('types', n)} />
        </Card>
      )}
      {vehicles.isLoading ? <Spinner /> : types.length === 0 ? (
        <Empty icon={<Car />} title="No vehicles yet" hint="Add the vehicle types you sell parts for, then the companies and models under each." />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {types.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="mb-3 flex items-center">
                <Car className="mr-2 size-4 text-brand-600" />
                <h2 className="font-bold">{t.name}</h2>
                {actions('types', t.id, t.name)}
                <span className="ml-auto text-xs text-slate-400">{t.makes.length} companies</span>
              </div>
              <div className="space-y-3">
                {t.makes.map((m) => (
                  <div key={m.id} className="rounded-md border border-slate-200 p-2.5">
                    <div className="mb-2 flex items-center text-sm font-semibold">
                      {m.name}
                      {actions('makes', m.id, m.name)}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {m.models.map((model) => (
                        <span key={model.id} className="inline-flex items-center rounded bg-slate-100 py-0.5 pl-2 text-xs text-slate-700">
                          {model.name}
                          {actions('models', model.id, model.name) || <span className="pr-2" />}
                        </span>
                      ))}
                      {m.models.length === 0 && <span className="text-xs text-slate-400">No models yet</span>}
                    </div>
                    {canEdit && <AddInline className="mt-2" small placeholder={`Add a ${m.name} model`} onAdd={(n) => add('models', n, m.id)} />}
                  </div>
                ))}
                {canEdit && <AddInline small placeholder={`Add a ${t.name} company`} onAdd={(n) => add('makes', n, t.id)} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function AddInline({ placeholder, onAdd, small, className }: { placeholder: string; onAdd: (name: string) => Promise<unknown>; small?: boolean; className?: string }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    await onAdd(n);
    setBusy(false);
    setName('');
  }
  return (
    <form onSubmit={submit} className={`flex gap-2 ${className ?? ''}`}>
      <Input className={small ? 'h-7 text-xs' : ''} maxLength={60} placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} />
      <Button size="sm" variant={small ? 'ghost' : 'primary'} busy={busy} icon={<Plus className="size-4" />}>Add</Button>
    </form>
  );
}
