import { imageUrl } from '@/lib/api';
import { dateTime, money, paymentLabels, qty } from '@/lib/format';
import type { Business, Sale } from '@/lib/queries';

const plain = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The printed bill (browser print, 80 mm roll): Item | Qty | Rate | Amount with numbers right-aligned under
 * their headings, then the totals in the same right edge. Hidden on screen; printed with window.print().
 */
export function Receipt({ sale, business, logoId }: { sale: Sale; business?: Business; logoId?: string }) {
  const gst = sale.gstApplied;
  const address = [business?.address, business?.city, business?.state, business?.pincode].filter(Boolean).join(', ');
  const row = (label: string, value: string, bold = false) => (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
  return (
    <div className="print-only font-mono text-[11px] leading-snug text-black">
      {logoId && <img src={imageUrl(logoId)} alt="" className="mx-auto mb-1 h-10 object-contain" />}
      <p className="text-center text-sm font-bold">{business?.name ?? 'Tax Invoice'}</p>
      {address && <p className="text-center">{address}</p>}
      {business?.mobile && <p className="text-center">Ph: {business.mobile}</p>}
      {gst && business?.gstin && <p className="text-center font-bold">GSTIN: {business.gstin}</p>}
      <p className="mt-1 text-center font-bold">
        {gst ? 'TAX INVOICE' : 'BILL / CASH MEMO'}
        {sale.status === 'CANCELLED' ? ' (CANCELLED)' : ''}
      </p>
      <hr className="my-1 border-dashed border-black" />
      {row('Invoice', sale.invoiceNumber ?? '')}
      {row('Date', dateTime(sale.soldAt))}
      {row('Payment', paymentLabels[sale.paymentMethod ?? ''] ?? sale.paymentMethod ?? '', true)}
      <hr className="my-1 border-dashed border-black" />
      <table className="w-full">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left font-bold">Item</th>
            <th className="text-right font-bold">Qty</th>
            <th className="text-right font-bold">Rate</th>
            <th className="text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items?.map((i, n) => (
            <tr key={n} className="align-top">
              <td className="pr-1">
                {i.productName}
                {(gst || (i.discount ?? 0) > 0) && (
                  <div className="text-[9px]">
                    {gst && i.hsnCode ? `HSN ${i.hsnCode}  ` : ''}
                    {gst ? `GST ${qty(i.taxRate)}%  ` : ''}
                    {(i.discount ?? 0) > 0 ? `Disc -${plain.format(i.discount!)}` : ''}
                  </div>
                )}
              </td>
              <td className="text-right">{qty(i.quantity)}</td>
              <td className="text-right">{plain.format(i.unitPrice ?? 0)}</td>
              <td className="text-right">{plain.format(i.lineTotal ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr className="my-1 border-dashed border-black" />
      {gst ? (
        <>
          {row('Taxable value', plain.format(sale.taxableTotal ?? 0))}
          {row('CGST', plain.format(sale.cgst ?? 0))}
          {row('SGST', plain.format(sale.sgst ?? 0))}
        </>
      ) : (
        row('Subtotal', plain.format(sale.subtotal ?? 0))
      )}
      {(sale.discountTotal ?? 0) > 0 && row('Discount', `-${plain.format(sale.discountTotal!)}`)}
      <hr className="my-1 border-black" />
      {row('TOTAL', money(sale.grandTotal), true)}
      <hr className="my-1 border-black" />
      {!gst && <p className="text-center text-[9px]">Prices inclusive of all taxes (MRP)</p>}
      <p className="mt-2 text-center">Thank you! Visit again.</p>
    </div>
  );
}
