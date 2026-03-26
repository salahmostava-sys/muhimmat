/**
 * Open a print dialog with a cloned table (RTL-friendly).
 */
export function printHtmlTable(
  table: HTMLTableElement,
  options: { title: string; subtitle?: string }
): void {
  const printWindow = globalThis.open('', '_blank');
  if (!printWindow) return;
  const { title, subtitle } = options;
  printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8"/>
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; direction: rtl; color: #111; background: white; }
          h2 { text-align: center; margin-bottom: 8px; font-size: 15px; }
          p.subtitle { text-align: center; color: #666; font-size: 11px; margin-bottom: 12px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: right; font-size: 10px; white-space: nowrap; }
          td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; text-align: right; white-space: nowrap; vertical-align: middle; }
          tr:nth-child(even) td { background: #f9f9f9; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    `);
  if (!printWindow.document.body) return;
  printWindow.document.body.appendChild(table.cloneNode(true));
  printWindow.document.write(
    `<script>globalThis.onload = () => { globalThis.print(); globalThis.onafterprint = () => globalThis.close(); }</script></body></html>`
  );
  printWindow.document.close();
}
