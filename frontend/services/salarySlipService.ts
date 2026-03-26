export interface SalarySlipDriver {
  name: string;
  nationalId?: string | null;
}

const loadJsPdf = async () => (await import('jspdf')).default;

export const salarySlipService = {
  generateSalaryPDF: async (driver: SalarySlipDriver, salary: number, month: string, orders: number) => {
    const JsPdf = await loadJsPdf();
    const doc = new JsPdf();

    doc.setFontSize(16);
    doc.text('Salary Slip', 14, 16);
    doc.setFontSize(12);
    doc.text(`Driver: ${driver.name}`, 14, 28);
    doc.text(`Month: ${month}`, 14, 36);
    doc.text(`Total Orders: ${orders}`, 14, 44);
    doc.text(`Final Salary: ${salary.toFixed(2)} SAR`, 14, 52);
    if (driver.nationalId) {
      doc.text(`ID: ${driver.nationalId}`, 14, 60);
    }

    return doc.output('blob');
  },
};

export default salarySlipService;
