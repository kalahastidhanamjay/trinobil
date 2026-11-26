import { ContactsPage } from '@/components/ContactsPage';
import { call, core } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSuppliers } from '@/lib/queries';

export function SuppliersPage() {
  const auth = useAuth();
  const suppliers = useSuppliers();
  return (
    <ContactsPage
      title="Suppliers"
      noun="supplier"
      queryKey="suppliers"
      supplier
      rows={suppliers.data}
      loading={suppliers.isLoading}
      canEdit={auth.canManage}
      save={(body, id) =>
        id
          ? call(core.PUT('/api/v1/core/suppliers/{id}', { params: { path: { id } }, body: { ...body, name: body.name ?? '' } }))
          : call(core.POST('/api/v1/core/suppliers', { body: { ...body, name: body.name ?? '' } }))
      }
      remove={(id) => call(core.DELETE('/api/v1/core/suppliers/{id}', { params: { path: { id } } }))}
    />
  );
}
