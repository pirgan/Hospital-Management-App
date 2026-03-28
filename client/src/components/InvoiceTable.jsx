/**
 * InvoiceTable
 * Renders invoice line items as a table with per-item totals and a grand total row.
 * Purely presentational — receives lineItems array from parent.
 *
 * @param {object[]} lineItems — [{ description, qty, unitPrice }]
 * @param {string}   [currency="£"] — currency symbol prefix
 */
export default function InvoiceTable({ lineItems = [], currency = '£' }) {
  const total = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 font-medium text-right">Qty</th>
            <th className="py-2 font-medium text-right">Unit Price</th>
            <th className="py-2 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2 text-gray-800">{item.description}</td>
              <td className="py-2 text-right text-gray-600">{item.qty}</td>
              <td className="py-2 text-right text-gray-600">
                {currency}{item.unitPrice.toFixed(2)}
              </td>
              <td className="py-2 text-right text-gray-800 font-medium">
                {currency}{(item.qty * item.unitPrice).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold text-gray-900">
            <td colSpan={3} className="pt-3 text-right">Total</td>
            <td className="pt-3 text-right">{currency}{total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
