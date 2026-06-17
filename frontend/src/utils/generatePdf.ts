import jsPDF from 'jspdf';
import type { Session } from '../types';

export function downloadReportPdf(session: Session): void {
  const report = session.report!;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const mX = 20;
  const mY = 20;
  const contentW = W - 2 * mX;
  const bottomLimit = H - mY;

  let y = mY;

  function maybeNewPage(needed: number) {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = mY;
    }
  }

  function addSectionHeading(title: string) {
    maybeNewPage(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(217, 119, 87);
    doc.text(title.toUpperCase(), mX, y);
    y += 4;
    doc.setDrawColor(217, 119, 87);
    doc.setLineWidth(0.3);
    doc.line(mX, y, mX + contentW, y);
    y += 5;
  }

  function addBodyText(text: string) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(55, 55, 55);
    const lines = doc.splitTextToSize(text || '—', contentW);
    for (const line of lines) {
      maybeNewPage(5);
      doc.text(line, mX, y);
      y += 4.8;
    }
    y += 4;
  }

  function addBulletList(items: string[]) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(55, 55, 55);
    for (const item of items) {
      // wrap long bullets, indent continuation lines
      const lines = doc.splitTextToSize(item, contentW - 5);
      for (let i = 0; i < lines.length; i++) {
        maybeNewPage(5);
        doc.text(i === 0 ? '•  ' + lines[i] : '    ' + lines[i], mX, y);
        y += 4.8;
      }
    }
    y += 4;
  }

  // ── Cover block ────────────────────────────────────────────────────────────

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text('Research Report', mX, y);
  y += 9;

  doc.setFontSize(14);
  doc.setTextColor(217, 119, 87);
  doc.text(session.company_name, mX, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(session.company_website, mX, y);
  y += 5;
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, mX, y);
  y += 9;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(mX, y, W - mX, y);
  y += 10;

  // ── Report sections ────────────────────────────────────────────────────────

  addSectionHeading('Company Overview');
  addBodyText(report.company_overview);

  addSectionHeading('Products & Services');
  addBodyText(report.products_services);

  addSectionHeading('Target Customers');
  addBodyText(report.target_customers);

  addSectionHeading('Business Signals');
  addBodyText(report.business_signals);

  addSectionHeading('Risks & Challenges');
  addBodyText(report.risks_challenges);

  addSectionHeading('Discovery Questions');
  addBulletList(report.discovery_questions);

  addSectionHeading('Outreach Strategy');
  addBodyText(report.outreach_strategy);

  addSectionHeading('Unknowns');
  addBodyText(report.unknowns);

  addSectionHeading('Sources');
  addBulletList(report.sources);

  const filename = `${session.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-research-report.pdf`;
  doc.save(filename);
}
