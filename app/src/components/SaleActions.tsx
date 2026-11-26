import { Mail, Printer } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button, Field, Input, Modal } from '@/components/ui';
import { call, core, errorMessage, reportActivity } from '@/lib/api';
import type { Sale } from '@/lib/queries';

/** Prints the receipt in this browser and records it in the activity log. */
export function printSale(sale: Sale, reprint = false) {
  // Let React render the receipt before the print dialog opens.
  setTimeout(() => {
    window.print();
    reportActivity(reprint ? 'REPRINTED' : 'PRINTED', 'SALE', sale.id, sale.invoiceNumber, {
      document: 'Invoice (browser print)',
      printer: 'Browser print / PDF',
    });
  }, 50);
}

/** Print and Email buttons for a sale. */
export function SaleActions({ sale, reprint = false }: { sale: Sale; reprint?: boolean }) {
  const [emailing, setEmailing] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    try {
      const res = await call(
        core.POST('/api/v1/core/sales/{id}/email', { params: { path: { id: sale.id! } }, body: { email: email.trim() || undefined } }),
      );
      toast.success(`Invoice emailed to ${res?.sentTo ?? email}`);
      setEmailing(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="secondary" icon={<Printer className="size-4" />} onClick={() => printSale(sale, reprint)}>
        Print
      </Button>
      <Button variant="secondary" icon={<Mail className="size-4" />} onClick={() => setEmailing(true)} disabled={sale.status === 'CANCELLED'}>
        Email
      </Button>
      <Modal
        open={emailing}
        onClose={() => setEmailing(false)}
        title={`Email ${sale.invoiceNumber}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEmailing(false)}>Cancel</Button>
            <Button busy={busy} onClick={send}>Send invoice</Button>
          </>
        }
      >
        <Field label="Email address" hint="Leave empty to use the customer's saved email.">
          <Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </Field>
      </Modal>
    </>
  );
}
