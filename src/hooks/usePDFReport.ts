import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface SalaryRecord {
  employeeName: string;
  baseSalary: number;
  allowances: number;
  attendanceDeduction: number;
  advanceDeduction: number;
  externalDeduction: number;
  manualDeduction: number;
  netSalary: number;
  paymentMethod: string;
  isApproved: boolean;
}

interface PDFOptions {
  monthYear: string;
  records: SalaryRecord[];
  totalNet: number;
  totalApproved: number;
}

export const generateSalaryPDF = ({ monthYear, records, totalNet, totalApproved }: PDFOptions) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // RTL-friendly: use standard fonts, draw Arabic labels manually in LTR fallback
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(40, 40, 40);
  doc.text('Salary Report / تقرير الرواتب', 148, 18, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Month: ${monthYear}   |   Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 148, 26, { align: 'center' });

  // Summary row
  doc.setFillColor(70, 95, 255);
  doc.roundedRect(14, 32, 80, 14, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total Net: ${totalNet.toLocaleString()} SAR`, 54, 41, { align: 'center' });

  doc.setFillColor(34, 197, 94);
  doc.roundedRect(100, 32, 80, 14, 3, 3, 'F');
  doc.text(`Approved: ${totalApproved.toLocaleString()} SAR`, 140, 41, { align: 'center' });

  doc.setFillColor(245, 158, 11);
  doc.roundedRect(186, 32, 80, 14, 3, 3, 'F');
  doc.text(`Employees: ${records.length}`, 226, 41, { align: 'center' });

  autoTable(doc, {
    startY: 52,
    head: [[
      '#', 'Employee Name', 'Base', 'Allowances', 'Attendance-', 'Advance-', 'External-', 'Manual-', 'Net Salary', 'Method', 'Status'
    ]],
    body: records.map((r, i) => [
      i + 1,
      r.employeeName,
      r.baseSalary.toFixed(0),
      r.allowances.toFixed(0),
      r.attendanceDeduction > 0 ? `-${r.attendanceDeduction.toFixed(0)}` : '—',
      r.advanceDeduction > 0 ? `-${r.advanceDeduction.toFixed(0)}` : '—',
      r.externalDeduction > 0 ? `-${r.externalDeduction.toFixed(0)}` : '—',
      r.manualDeduction > 0 ? `-${r.manualDeduction.toFixed(0)}` : '—',
      r.netSalary.toFixed(0),
      r.paymentMethod === 'bank' ? 'Bank' : r.paymentMethod === 'cash' ? 'Cash' : r.paymentMethod,
      r.isApproved ? '✓ Approved' : 'Pending',
    ]),
    styles: { fontSize: 8, cellPadding: 2.5, halign: 'center' },
    headStyles: { fillColor: [70, 95, 255], textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 249, 255] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 45, halign: 'left' },
      8: { fontStyle: 'bold', textColor: [34, 197, 94] },
      10: { fontStyle: 'bold' },
    },
    didDrawCell: (data) => {
      if (data.column.index === 10 && data.section === 'body') {
        const val = records[data.row.index]?.isApproved;
        data.cell.styles.textColor = val ? [34, 197, 94] : [245, 158, 11];
      }
    },
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Page ${i} / ${pageCount}`, 148, 205, { align: 'center' });
  }

  doc.save(`salary_report_${monthYear}.pdf`);
};
