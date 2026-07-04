import ExcelJS from "exceljs";
import { REPORTS } from "@/lib/reports";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const report = REPORTS[key];
  if (!report) return new Response("Not found", { status: 404 });

  const data = await report.fetch();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(data.title.slice(0, 31));
  sheet.columns = data.columns.map((c) => ({ header: c.header, key: c.key, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of data.rows) sheet.addRow(row);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${key}.xlsx"`,
    },
  });
}
