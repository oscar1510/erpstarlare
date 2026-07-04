import { NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { ledgerSummary } from "@/lib/ledger";
import { resolveRange } from "@/lib/date-ranges";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { start, end } = resolveRange(sp.get("range") ?? undefined, sp.get("from") ?? undefined, sp.get("to") ?? undefined);
  const summary = await ledgerSummary({ start, end });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("General Ledger");
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Type", key: "type", width: 12 },
    { header: "Category", key: "category", width: 22 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "VAT", key: "vat", width: 12 },
    { header: "Payment method", key: "paymentMethod", width: 18 },
    { header: "Source", key: "sourceModule", width: 16 },
    { header: "Notes", key: "notes", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const e of summary.entries) {
    sheet.addRow({
      date: e.date.toISOString().slice(0, 10),
      type: e.type,
      category: e.category,
      amount: e.amount,
      currency: e.currency,
      vat: e.vat,
      paymentMethod: e.paymentMethod,
      sourceModule: e.sourceModule,
      notes: e.notes,
    });
  }

  sheet.addRow({});
  sheet.addRow({ date: "Total income", amount: summary.income });
  sheet.addRow({ date: "Total expenses", amount: summary.expense });
  sheet.addRow({ date: "Profit / Loss", amount: summary.profitLoss });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="general-ledger.xlsx"`,
    },
  });
}
