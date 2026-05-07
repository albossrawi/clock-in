'use client';

import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ExportRow = Record<string, string | number>;

export function exportToExcel(rows: ExportRow[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Entries');
  XLSX.writeFile(wb, filename);
}

export function exportToPdf(rows: ExportRow[], filename: string, title: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);

  const head = rows.length > 0 ? [Object.keys(rows[0])] : [['(empty)']];
  const body = rows.map((r) => Object.values(r).map((v) => String(v)));

  autoTable(doc, {
    head,
    body,
    startY: 22,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(filename);
}
