export const generateScorecardPDF = async (practice) => {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Colors
  const orange = [232, 118, 43];
  const green = [52, 211, 153];
  const blue = [96, 165, 250];
  const gray = [100, 100, 100];
  const lightGray = [200, 200, 200];

  const drawProgressBar = (x, y, width, height, percent, color) => {
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(x, y, width, height, 2, 2, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(x, y, width * Math.min(percent / 100, 1), height, 2, 2, 'F');
  };

  const calcImprovement = (baseline, current, inverse = false) => {
    if (!baseline || !current) return null;
    const change = inverse ? (baseline - current) / baseline : (current - baseline) / baseline;
    return Math.round(change * 100);
  };

  // ============ PAGE 1: SUMMARY ============
  doc.setFontSize(28);
  doc.setTextColor(...orange);
  doc.text("DeFyb", 20, 25);

  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text("Practice Transformation Scorecard", 20, 33);

  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text(practice.name || "Practice", 20, 48);

  doc.setFontSize(10);
  doc.setTextColor(...gray);
  doc.text(new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }), pageWidth - 50, 48);

  // Divider
  doc.setDrawColor(...lightGray);
  doc.line(20, 55, pageWidth - 20, 55);

  // Health Score Section
  let y = 70;
  const score = practice.health_score || practice.score || 0;
  const scoreColor = score >= 80 ? green : score >= 60 ? [245, 158, 11] : [239, 68, 68];

  doc.setFillColor(240, 240, 240);
  doc.circle(50, y + 15, 25, 'F');
  doc.setFillColor(...scoreColor);
  doc.setFontSize(28);
  doc.setTextColor(...scoreColor);
  doc.text(score.toString(), 40, y + 20);

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("HEALTH", 40, y + 30);
  doc.text("SCORE", 42, y + 36);

  // Summary stats next to health score
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text("Practice Summary", 90, y);

  const summaryItems = [
    { label: "Stage", value: (practice.stage || "managed").charAt(0).toUpperCase() + (practice.stage || "managed").slice(1) },
    { label: "Providers", value: practice.providers || practice.provider_count || "?" },
    { label: "Go-Live Date", value: practice.go_live_date ? new Date(practice.go_live_date).toLocaleDateString() : "N/A" },
    { label: "Tools Active", value: (practice.ai_stack || practice.stack || []).filter(t => t.status === "active").length.toString() },
  ];

  doc.setFontSize(9);
  summaryItems.forEach((item, i) => {
    doc.setTextColor(...gray);
    doc.text(item.label + ":", 90, y + 10 + (i * 8));
    doc.setTextColor(40, 40, 40);
    doc.text(item.value.toString(), 140, y + 10 + (i * 8));
  });

  // ============ BEFORE/AFTER METRICS ============
  y = 120;
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text("Transformation Results", 20, y);

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("BEFORE", 105, y);
  doc.text("AFTER", 145, y);
  doc.text("CHANGE", 180, y);
  y += 8;

  const metrics = [
    { label: "Documentation Time", baseline: practice.doc_time_baseline, current: practice.doc_time_current, unit: " min", inverse: true, category: "time" },
    { label: "Pajama Time", baseline: practice.pajama_time_baseline, current: practice.pajama_time_current, unit: " hrs/wk", inverse: true, category: "time" },
    { label: "Denial Rate", baseline: practice.denial_rate_baseline, current: practice.denial_rate_current, unit: "%", inverse: true, category: "money" },
    { label: "Call Answer Rate", baseline: practice.call_answer_rate_baseline, current: practice.call_answer_rate_current, unit: "%", inverse: false, category: "money" },
    { label: "Days in A/R", baseline: practice.days_in_ar_baseline, current: practice.days_in_ar_current, unit: " days", inverse: true, category: "money" },
  ];

  doc.setFontSize(9);
  metrics.forEach((m) => {
    if (m.baseline != null) {
      const improvement = calcImprovement(m.baseline, m.current, m.inverse);
      const hasImproved = improvement !== null && improvement > 0;

      const categoryColor = m.category === "time" ? blue : green;
      doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2]);
      doc.circle(25, y + 2, 2, 'F');

      doc.setTextColor(60, 60, 60);
      doc.text(m.label, 30, y + 3);

      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text(m.baseline != null ? `${m.baseline}${m.unit}` : "—", 105, y + 3);

      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text("→", 132, y + 3);

      const currentColor = m.current != null ? (hasImproved ? green : [60, 60, 60]) : gray;
      doc.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
      doc.text(m.current != null ? `${m.current}${m.unit}` : "—", 145, y + 3);

      if (improvement !== null) {
        const improvementColor = hasImproved ? green : [239, 68, 68];
        doc.setTextColor(improvementColor[0], improvementColor[1], improvementColor[2]);
        doc.text(`${hasImproved ? "+" : ""}${improvement}%`, 180, y + 3);
      }

      y += 12;
    }
  });

  // ============ VALUE DELIVERED ============
  y += 10;
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text("Value Delivered", 20, y);
  y += 12;

  const codingUplift = practice.coding_uplift_monthly || 0;
  const revenueRecovered = practice.revenue_recovered_monthly || 0;
  const totalMonthly = codingUplift + revenueRecovered;
  const roi = practice.roi_projections || {};

  doc.setFillColor(245, 245, 245);
  doc.roundedRect(20, y, 80, 35, 3, 3, 'F');

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("THIS MONTH", 30, y + 8);

  doc.setFontSize(20);
  doc.setTextColor(...orange);
  doc.text(`$${totalMonthly.toLocaleString()}`, 30, y + 22);

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text(`Coding: $${codingUplift.toLocaleString()} | Recovery: $${revenueRecovered.toLocaleString()}`, 30, y + 30);

  doc.setFillColor(255, 248, 240);
  doc.roundedRect(110, y, 80, 35, 3, 3, 'F');

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text("PROJECTED ANNUAL ROI", 120, y + 8);

  doc.setFontSize(20);
  doc.setTextColor(...green);
  const annualValue = roi.totalAnnualValue || (totalMonthly * 12);
  doc.text(`$${(annualValue / 1000).toFixed(0)}k`, 120, y + 22);

  doc.setFontSize(8);
  doc.setTextColor(...gray);
  doc.text(`Time saved: ${roi.timeSavedAnnualHours || 0}h/year`, 120, y + 30);

  // ============ AI STACK STATUS ============
  y += 50;
  doc.setFontSize(14);
  doc.setTextColor(40, 40, 40);
  doc.text("Tool Stack Status", 20, y);
  y += 10;

  const stack = practice.ai_stack || practice.stack || [];
  doc.setFontSize(9);

  if (stack.length === 0) {
    doc.setTextColor(...gray);
    doc.text("No tools deployed yet", 20, y);
  } else {
    stack.forEach((tool) => {
      const statusColor = tool.status === "active" ? green : tool.status === "deploying" ? [245, 158, 11] : gray;

      doc.setFillColor(...statusColor);
      doc.circle(25, y + 1, 3, 'F');

      doc.setTextColor(60, 60, 60);
      doc.text(tool.name, 32, y + 3);

      doc.setTextColor(...statusColor);
      doc.text(tool.status.toUpperCase(), 120, y + 3);

      if (tool.since) {
        doc.setTextColor(...gray);
        doc.text(`since ${tool.since}`, 150, y + 3);
      }

      y += 10;
    });
  }

  // ============ FOOTER ============
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("Generated by DeFyb | defyb.org", 20, pageHeight - 15);
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, pageWidth - 60, pageHeight - 15);

  doc.setFillColor(...blue);
  doc.circle(pageWidth - 85, pageHeight - 25, 2, 'F');
  doc.text("Time", pageWidth - 80, pageHeight - 23);
  doc.setFillColor(...green);
  doc.circle(pageWidth - 60, pageHeight - 25, 2, 'F');
  doc.text("Money", pageWidth - 55, pageHeight - 23);

  // Save
  const filename = `DeFyb-Scorecard-${practice.name?.replace(/\s+/g, "-") || "Practice"}-${new Date().toISOString().slice(0, 7)}.pdf`;
  doc.save(filename);
};
