import { ContactsPage } from '@/components/ContactsPage';
import { call, core } from '@/lib/api';
import { useCustomers } from '@/lib/queries';

export function CustomersPage() {
  const customers = useCustomers();
  return (
    <ContactsPage
      title="Customers"
      noun="customer"
      queryKey="customers"
      rows={customers.data}
      loading={customers.isLoading}
      canEdit
      save={(body, id) =>
        id
          ? call(core.PUT('/api/v1/core/customers/{id}', { params: { path: { id } }, body: { ...body, name: body.name ?? '' } }))
          : call(core.POST('/api/v1/core/customers', { body: { ...body, name: body.name ?? '' } }))
      }
      remove={(id) => call(core.DELETE('/api/v1/core/customers/{id}', { params: { path: { id } } }))}
    />
  );
}
