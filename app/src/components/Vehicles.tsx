import { Car, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button, Input, Select } from '@/components/ui';
import { fitLabel, useVehicles, type Fitment, type VehicleFilter } from '@/lib/spares';

/** Type → company → model selects; empty company / model mean "all". */
function useVehicleChoice() {
  const vehicles = useVehicles();
  const [typeId, setTypeId] = useState('');
  const [makeId, setMakeId] = useState('');
  const [modelId, setModelId] = useState('');
  const types = vehicles.data ?? [];
  const type = types.find((t) => t.id === typeId);
  const make = type?.makes.find((m) => m.id === makeId);
  const model = make?.models.find((m) => m.id === modelId);
  const selects = (
    <>
      <Select value={typeId} onChange={(e) => { setTypeId(e.target.value); setMakeId(''); setModelId(''); }}>
        <option value="">{types.length ? 'Vehicle type…' : 'No vehicles yet'}</option>
        {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Select>
      {type && (
        <Select value={makeId} onChange={(e) => { setMakeId(e.target.value); setModelId(''); }}>
          <option value="">All companies</option>
          {type.makes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      )}
      {make && (
        <Select value={modelId} onChange={(e) => setModelId(e.target.value)}>
          <option value="">All models</option>
          {make.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      )}
    </>
  );
  const reset = () => { setTypeId(''); setMakeId(''); setModelId(''); };
  return { type, make, model, selects, reset };
}

/** "Show parts for this vehicle" filter. */
export function VehicleFilterBar({ value, onChange }: { value?: VehicleFilter; onChange: (v?: VehicleFilter) => void }) {
  const { type, make, model, selects, reset } = useVehicleChoice();
  if (value) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-brand-50 px-2.5 text-sm font-medium text-brand-700 ring-1 ring-brand-200">
        <Car className="size-4" /> {value.label}
        <button type="button" aria-label="Clear vehicle" className="ml-1 rounded p-0.5 hover:bg-brand-100" onClick={() => { reset(); onChange(undefined); }}>
          <X className="size-3.5" />
        </button>
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 [&_select]:w-40">
      <Car className="size-4 text-slate-400" />
      {selects}
      {type && (
        <Button
          type="button"
          size="sm"
          onClick={() =>
            onChange({
              typeId: type.id,
              makeId: make?.id,
              modelId: model?.id,
              label: model ? `${make!.name} ${model.name}` : make?.name ?? type.name,
            })
          }
        >
          Show parts
        </Button>
      )}
    </div>
  );
}

/** The vehicles an item fits: chips, plus a picker with optional years. */
export function FitmentEditor({ value, onChange }: { value: Fitment[]; onChange: (v: Fitment[]) => void }) {
  const { type, make, model, selects, reset } = useVehicleChoice();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  function add() {
    if (!type) return;
    onChange([
      ...value,
      {
        typeId: type.id,
        typeName: type.name,
        makeId: make?.id,
        makeName: make?.name,
        modelId: model?.id,
        modelName: model?.name,
        yearFrom: from ? Number(from) : undefined,
        yearTo: to ? Number(to) : undefined,
      },
    ]);
    reset();
    setFrom('');
    setTo('');
  }
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              <Car className="size-3.5" /> {fitLabel(f)}
              <button type="button" aria-label="Remove vehicle" className="rounded p-0.5 hover:bg-slate-200" onClick={() => onChange(value.filter((_, n) => n !== i))}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 [&_select]:w-36">
        {selects}
        {type && (
          <>
            <Input className="w-20" inputMode="numeric" maxLength={4} placeholder="From yr" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ''))} />
            <Input className="w-20" inputMode="numeric" maxLength={4} placeholder="To yr" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ''))} />
            <Button type="button" size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={add}>Add</Button>
          </>
        )}
      </div>
    </div>
  );
}

/** What the server needs to save an item's vehicles. */
export const fitmentRequest = (list: Fitment[]) =>
  list.map((f) => ({ typeId: f.typeId!, makeId: f.makeId ?? undefined, modelId: f.modelId ?? undefined, yearFrom: f.yearFrom ?? undefined, yearTo: f.yearTo ?? undefined }));
