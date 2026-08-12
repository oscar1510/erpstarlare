import { Modal } from "./Modal";
import type { Order } from "../types";
import { computeProfitability } from "../lib/calc";
import { aed, formatDate } from "../lib/format";

export function SavedOrdersModal({
  orders,
  onClose,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  orders: Order[];
  onClose: () => void;
  onOpen: (o: Order) => void;
  onDuplicate: (o: Order) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Modal title="Saved orders" onClose={onClose} wide>
      {orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-forest-400">
          No saved orders yet. Build an order and press “Save”.
        </p>
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-lg border border-forest-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-forest-50 text-left text-xs uppercase tracking-wide text-forest-500">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Quotation #</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 text-right font-medium">Total (excl. VAT)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const p = computeProfitability(o.lines, o.options);
                return (
                  <tr key={o.id} className="border-t border-forest-50 hover:bg-forest-50/50">
                    <td className="px-3 py-2 text-forest-500">{formatDate(o.createdAt)}</td>
                    <td className="px-3 py-2 font-medium text-forest-800">{o.quotationNumber}</td>
                    <td className="px-3 py-2 text-forest-700">{o.customer.companyName || "—"}</td>
                    <td className="px-3 py-2 text-forest-700">{o.customer.customerName || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-forest-900">
                      {aed(p.totalRevenue)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          className="rounded px-2 py-1 text-xs font-medium text-forest-700 hover:bg-forest-100"
                          onClick={() => onOpen(o)}
                        >
                          Open
                        </button>
                        <button
                          className="rounded px-2 py-1 text-xs font-medium text-forest-700 hover:bg-forest-100"
                          onClick={() => onDuplicate(o)}
                        >
                          Duplicate
                        </button>
                        <button
                          className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Delete ${o.quotationNumber}?`)) onDelete(o.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
