export const generateQuotePDF = async (quote, practice) => {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(24);
  doc.setTextColor(232, 118, 43); // DeFyb orange
  doc.text("DeFyb", 20, 25);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Practice Transformation Services", 20, 32);

  // Quote info
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Quote", pageWidth - 50, 25);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`#${quote.id.slice(0, 8).toUpperCase()}`, pageWidth - 50, 32);
  doc.text(`Date: ${new Date(quote.created_at).toLocaleDateString()}`, pageWidth - 50, 38);

  // Practice info
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Prepared for:", 20, 55);

  doc.setFontSize(14);
  doc.text(practice.name || "Practice", 20, 63);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${quote.provider_count} providers`, 20, 70);

  // Line items
  let y = 90;
  doc.setDrawColor(200);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setFontSize(11);
  doc.setTextColor(0);

  // Assessment
  if (quote.assessment_fee > 0) {
    doc.text("Assessment Fee", 20, y);
    doc.text(quote.assessment_waived ? "$0 (Waived)" : `$${quote.assessment_fee.toLocaleString()}`, pageWidth - 50, y);
    y += 12;
  }

  // Implementation
  doc.text("Implementation Fee", 20, y);
  doc.text(`$${quote.implementation_fee.toLocaleString()}`, pageWidth - 50, y);
  y += 12;

  // Monthly
  doc.text("Monthly Managed Services", 20, y);
  doc.text(`$${quote.monthly_fee.toLocaleString()}/month`, pageWidth - 50, y);
  y += 20;

  // Total
  doc.setDrawColor(232, 118, 43);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(232, 118, 43);
  doc.text("First Year Value", 20, y);
  doc.text(`$${quote.total_value.toLocaleString()}`, pageWidth - 50, y);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Questions? Contact torey@defyb.org", 20, 280);
  doc.text(`Quote valid for 30 days from ${new Date(quote.created_at).toLocaleDateString()}`, pageWidth - 90, 280);

  // Save
  doc.save(`DeFyb-Quote-${practice.name?.replace(/\s+/g, "-") || "Practice"}-${new Date().toISOString().slice(0, 10)}.pdf`);
};
