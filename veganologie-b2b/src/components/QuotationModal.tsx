import { Modal } from "./Modal";
import type { Order, QuotationDetails, Profitability } from "../types";
import { generateQuotationPdf } from "../lib/pdf";
import { aed } from "../lib/format";

function Text({
  label,
  value,
  onChange,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {hint && <p className="mb-1 text-[11px] text-forest-400">{hint}</p>}
      <textarea
        className="input resize-y"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export function QuotationModal({
  order,
  prof,
  onClose,
  onChangeDetails,
}: {
  order: Order;
  prof: Profitability;
  onClose: () => void;
  onChangeDetails: (d: QuotationDetails) => void;
}) {
  const d = order.details;
  const patch = (p: Partial<QuotationDetails>) => onChangeDetails({ ...d, ...p });

  const canGenerate = order.lines.length > 0;

  return (
    <Modal title="Generate quotation" onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg bg-forest-50 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-forest-500">Quotation #</span>
              <span className="font-semibold text-forest-800">{order.quotationNumber}</span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-forest-500">Subtotal (excl. VAT)</span>
              <span className="tabular-nums">{aed(prof.totalRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-forest-500">VAT 5%</span>
              <span className="tabular-nums">{aed(prof.vat)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-forest-200 pt-1 font-bold text-forest-800">
              <span>Total (incl. VAT)</span>
              <span className="tabular-nums">{aed(prof.totalWithVat)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-28">
              <label className="field-label">Valid for (days)</label>
              <input
                className="input text-right"
                type="number"
                min={1}
                value={d.validForDays}
                onChange={(e) =>
                  patch({ validForDays: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
              />
            </div>
          </div>

          <Text
            label="Lead times"
            value={d.leadTimes}
            onChange={(leadTimes) => patch({ leadTimes })}
            hint="One item per line."
            rows={3}
          />
          <Text
            label="Colour"
            value={d.colourNote}
            onChange={(colourNote) => patch({ colourNote })}
            rows={2}
          />
          <Text
            label="Packaging note"
            value={d.packagingNote}
            onChange={(packagingNote) => patch({ packagingNote })}
            rows={2}
          />
        </div>

        <div className="space-y-4">
          <Text
            label="What's included"
            value={d.whatsIncluded}
            onChange={(whatsIncluded) => patch({ whatsIncluded })}
            hint="One bullet per line."
            rows={5}
          />
          <Text
            label="Materials & certifications"
            value={d.materials}
            onChange={(materials) => patch({ materials })}
            rows={2}
          />
          <Text
            label="Certifications line"
            value={d.certifications}
            onChange={(certifications) => patch({ certifications })}
            rows={1}
          />
          <Text
            label="Terms & conditions"
            value={d.terms}
            onChange={(terms) => patch({ terms })}
            hint="One bullet per line."
            rows={3}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-forest-400">
          The PDF shows commercial pricing only — no cost, profit or margin.
        </p>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            className="btn-primary"
            disabled={!canGenerate}
            onClick={() => generateQuotationPdf(order)}
          >
            Download PDF
          </button>
        </div>
      </div>
    </Modal>
  );
}
