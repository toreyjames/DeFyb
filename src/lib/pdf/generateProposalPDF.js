export const generateProposalPDF = async (proposal) => {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const addWrappedText = (text, x, y, maxWidth, lineHeight = 5) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line, i) => {
      doc.text(line, x, y + (i * lineHeight));
    });
    return y + (lines.length * lineHeight);
  };

  // ===== PAGE 1: COVER =====
  doc.setFontSize(28);
  doc.setTextColor(232, 118, 43);
  doc.text("DeFyb", 20, 30);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Practice Transformation Proposal", 20, 38);

  doc.setFontSize(22);
  doc.setTextColor(0);
  doc.text(proposal.practice.name || "Your Practice", 20, 70);

  doc.setFontSize(12);
  doc.setTextColor(100);
  if (proposal.practice.address) {
    doc.text(proposal.practice.address, 20, 80);
  }
  if (proposal.practice.cityStateZip) {
    doc.text(proposal.practice.cityStateZip, 20, 87);
  }

  doc.setFontSize(11);
  doc.text(`${proposal.practice.providerCount} providers | ${proposal.practice.specialty}`, 20, 100);

  doc.setFontSize(10);
  doc.text(`Prepared: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, 20, 115);

  // Key concerns identified
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Key Challenges Identified", 20, 140);

  doc.setFontSize(10);
  doc.setTextColor(80);
  let y = 150;
  const allConcerns = [...new Set([...(proposal.practice.painPoints || []), ...(proposal.practice.interestDrivers || [])])];
  allConcerns.slice(0, 6).forEach((concern, i) => {
    doc.text(`• ${concern}`, 25, y);
    y += 7;
  });

  // Contact
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Prepared by:", 20, 240);
  doc.setTextColor(0);
  doc.text("Torey Hall", 20, 247);
  doc.setTextColor(100);
  doc.text("torey@defyb.org", 20, 254);

  // Footer
  doc.setDrawColor(232, 118, 43);
  doc.setLineWidth(0.5);
  doc.line(20, 270, pageWidth - 20, 270);
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Confidential | Valid for 30 days", 20, 278);

  // ===== PAGE 2: RECOMMENDED SOLUTION =====
  doc.addPage();

  doc.setFontSize(18);
  doc.setTextColor(232, 118, 43);
  doc.text("Recommended Tool Stack", 20, 25);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Based on your practice's specific challenges, we recommend:", 20, 35);

  y = 50;
  doc.setFontSize(11);
  proposal.recommendedTools.forEach((tool, i) => {
    doc.setTextColor(0);
    doc.text(`${i + 1}. ${tool.name}`, 25, y);

    doc.setTextColor(100);
    const costText = tool.cost > 0
      ? `$${tool.cost}/mo${tool.category === "scribe" ? " per provider" : ""}`
      : "Included";
    doc.text(costText, pageWidth - 60, y);

    y += 10;
  });

  // ROI Projections
  y += 10;
  doc.setFontSize(18);
  doc.setTextColor(232, 118, 43);
  doc.text("Projected Annual Impact", 20, y);

  y += 15;
  doc.setFontSize(10);

  const projectionRows = [
    { label: "Documentation & Coding Uplift", proj: proposal.projections.scribing },
    { label: "Recovered Revenue (Missed Calls)", proj: proposal.projections.phone },
    { label: "Denial Rate Reduction", proj: proposal.projections.claims },
    { label: "Prior Auth Automation", proj: proposal.projections.priorAuth },
    { label: "DME Revenue Capture", proj: proposal.projections.dme },
  ].filter(r => r.proj.high > 0);

  projectionRows.forEach(row => {
    doc.setTextColor(0);
    doc.text(row.label, 25, y);
    doc.setTextColor(52, 211, 153);
    doc.text(`$${row.proj.low.toLocaleString()} - $${row.proj.high.toLocaleString()}`, pageWidth - 70, y);
    y += 7;
    doc.setTextColor(120);
    doc.setFontSize(9);
    doc.text(row.proj.description, 30, y);
    doc.setFontSize(10);
    y += 12;
  });

  // Total
  y += 5;
  doc.setDrawColor(52, 211, 153);
  doc.line(20, y, pageWidth - 20, y);
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Total Projected Annual Return", 20, y);
  doc.setTextColor(52, 211, 153);
  doc.text(`$${proposal.totals.low.toLocaleString()} - $${proposal.totals.high.toLocaleString()}`, pageWidth - 70, y);

  if (proposal.totals.timeSavedPerDay > 0) {
    y += 15;
    doc.setFontSize(11);
    doc.setTextColor(96, 165, 250);
    doc.text(`Plus: ${proposal.totals.timeSavedPerDay} hours/day saved per provider`, 20, y);
  }

  // ===== PAGE 3: INVESTMENT OPTIONS =====
  doc.addPage();

  doc.setFontSize(18);
  doc.setTextColor(232, 118, 43);
  doc.text("Investment Options", 20, 25);

  y = 45;

  proposal.tiers.forEach((tier, i) => {
    doc.setDrawColor(200);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(20, y - 5, pageWidth - 40, tier.priceMonthly ? 65 : 55, 3, 3, "FD");

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(tier.name, 25, y + 5);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(tier.description, 25, y + 13);

    doc.setFontSize(16);
    doc.setTextColor(232, 118, 43);
    if (tier.priceMonthly) {
      doc.text(`$${tier.priceUpfront.toLocaleString()} + $${tier.priceMonthly.toLocaleString()}/mo`, pageWidth - 100, y + 5);
    } else {
      doc.text(`$${tier.price.toLocaleString()}`, pageWidth - 60, y + 5);
    }

    doc.setFontSize(9);
    doc.setTextColor(80);
    let includeY = y + 22;
    tier.includes.slice(0, 4).forEach(item => {
      doc.text(`✓ ${item}`, 30, includeY);
      includeY += 6;
    });

    y += tier.priceMonthly ? 75 : 65;
  });

  // ROI Summary
  y += 10;
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("Return on Investment", 20, y);

  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`First Year Investment: $${proposal.investment.totalFirstYear.toLocaleString()}`, 25, y);
  y += 7;
  doc.text(`Projected Return: $${proposal.totals.low.toLocaleString()} - $${proposal.totals.high.toLocaleString()}`, 25, y);
  y += 7;
  doc.setTextColor(52, 211, 153);
  doc.text(`Expected ROI: ${proposal.investment.roiLow}x - ${proposal.investment.roiHigh}x`, 25, y);

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Projections based on published clinical outcomes and industry benchmarks.", 20, 270);
  doc.text("Actual results will vary based on specialty, payer mix, and implementation.", 20, 276);

  // ===== PAGE 4: NEXT STEPS =====
  doc.addPage();

  doc.setFontSize(18);
  doc.setTextColor(232, 118, 43);
  doc.text("Next Steps", 20, 25);

  const steps = [
    { num: "1", title: "Schedule Assessment", desc: "Half-day on-site to capture baseline metrics and conduct workflow and revenue baseline." },
    { num: "2", title: "Review Roadmap", desc: "We'll present findings and a detailed implementation plan within 72 hours." },
    { num: "3", title: "Begin Transformation", desc: "Start with Tuesday Transform - one day/week on the new stack to prove results." },
    { num: "4", title: "Scale & Optimize", desc: "Expand to full deployment and ongoing managed optimization." },
  ];

  y = 45;
  steps.forEach(step => {
    doc.setFontSize(20);
    doc.setTextColor(232, 118, 43);
    doc.text(step.num, 25, y);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(step.title, 40, y);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(step.desc, 40, y + 7);

    y += 25;
  });

  // Contact CTA
  y += 20;
  doc.setFillColor(232, 118, 43);
  doc.roundedRect(20, y, pageWidth - 40, 40, 5, 5, "F");

  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text("Ready to get started?", pageWidth / 2, y + 15, { align: "center" });

  doc.setFontSize(11);
  doc.text("Contact: torey@defyb.org", pageWidth / 2, y + 28, { align: "center" });

  // Trust section
  y += 60;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("HIPAA Compliant  |  No PHI Storage  |  BAA Available  |  SOC 2 Compliant Infrastructure", pageWidth / 2, y, { align: "center" });

  // Save
  doc.save(`DeFyb-Proposal-${proposal.practice.name?.replace(/\s+/g, "-") || "Practice"}-${new Date().toISOString().slice(0, 10)}.pdf`);
};
