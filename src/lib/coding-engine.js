// Demo/offline E/M coding engine — must stay in sync with encounters-api (RULE_VERSION: rules-v1.1-em-core)

const toDateOrNullLocal = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseSurgeryDateFromNoteLocal = (noteText, encounterDateValue) => {
  const note = noteText || "";
  const marker = /(surgery date|date of surgery|dos|d\/o\/s|sx date|date of procedure|status post|s\/p|post[-\s]?op|postoperative)/i;
  if (!marker.test(note)) return null;
  const encounterDate = toDateOrNullLocal(encounterDateValue) || new Date();
  const patterns = [
    /(?:surgery date|date of surgery|dos|d\/o\/s|sx date|date of procedure)\s*[:\-]?\s*(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/i,
    /(?:status post|s\/p|post[-\s]?op|postoperative)[^\n\r]{0,80}?(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/i,
  ];
  for (const p of patterns) {
    const m = p.exec(note);
    if (!m?.[1]) continue;
    const parsed = toDateOrNullLocal(m[1]) || (() => {
      const n = m[1].match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
      if (!n) return null;
      const mm = Number(n[1]);
      const dd = Number(n[2]);
      let yy = encounterDate.getFullYear();
      if (n[3]) {
        const rawYear = Number(n[3]);
        yy = rawYear < 100 ? 2000 + rawYear : rawYear;
      }
      const candidate = new Date(yy, mm - 1, dd);
      if (Number.isNaN(candidate.getTime())) return null;
      if (!n[3] && candidate.getTime() > encounterDate.getTime()) candidate.setFullYear(candidate.getFullYear() - 1);
      candidate.setHours(0, 0, 0, 0);
      return candidate;
    })();
    if (parsed) return parsed;
  }
  return null;
};

const analyzeEncounterNote = (noteText, billedCode = "99213", context = {}) => {
  const normalized = (noteText || "").toLowerCase();
  const isNewPatient = String(context?.patientType || "").toLowerCase() === "new";
  const conservativeMode = context?.conservativeMode !== false;
  const encounterDate = toDateOrNullLocal(context?.encounterDate) || new Date();
  const surgeryDate = toDateOrNullLocal(context?.surgeryDate) || parseSurgeryDateFromNoteLocal(noteText, encounterDate);
  const postOpLanguage = /(post[-\s]?op|postoperative|status post|s\/p|global period|follow[-\s]?up after surgery|after surgery|f\/u)/.test(normalized);
  const postOpDays = surgeryDate ? Math.floor((encounterDate.getTime() - surgeryDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isWithinGlobal = postOpDays != null && postOpDays >= 0 && postOpDays <= 90;

  const hasDataReview = /(mri|x-?ray|ct|imaging|lab|reviewed records|independent historian)/.test(normalized);
  const hasProblemComplexity = /(chronic|worsening|exacerbation|persistent pain|multiple conditions|new problem|acute)/.test(normalized);
  const hasManagementRisk = /(surgery|procedure|injection|prescription|medication management|opioid|high risk)/.test(normalized);
  const hasRiskDiscussion = /(risk|benefit|shared decision|alternatives|informed consent)/.test(normalized);
  const hasFollowUpPlan = /(follow-up|return in|plan|next steps|monitor)/.test(normalized);
  const evidenceCategories = [
    hasProblemComplexity,
    hasDataReview,
    hasManagementRisk || hasRiskDiscussion,
  ].filter(Boolean).length;

  const evidenceFound = [];
  if (hasProblemComplexity) evidenceFound.push("Problem complexity documented");
  if (hasDataReview) evidenceFound.push("Data/imaging/lab review documented");
  if (hasManagementRisk) evidenceFound.push("Management risk documented");
  if (hasRiskDiscussion) evidenceFound.push("Risk-benefit discussion documented");
  if (hasFollowUpPlan) evidenceFound.push("Follow-up plan documented");

  const evidenceMissing = [];
  if (!hasProblemComplexity) evidenceMissing.push("Problem status/complexity is weakly documented");
  if (!hasDataReview) evidenceMissing.push("Data review (labs/imaging/records) is missing");
  if (!hasRiskDiscussion) evidenceMissing.push("Risk/benefit discussion not explicit");
  if (!hasFollowUpPlan) evidenceMissing.push("Follow-up plan/next steps missing");

  const rationale = [];
  if (postOpLanguage && !surgeryDate) {
    rationale.push("Post-op language detected but surgery date was not found.");
  }
  if (surgeryDate) {
    rationale.push(`Surgery date considered: ${surgeryDate.toISOString().slice(0, 10)}.`);
  }
  rationale.push(`Evidence summary: categories=${evidenceCategories}, data_review=${hasDataReview ? "yes" : "no"}, problem_complexity=${hasProblemComplexity ? "yes" : "no"}, risk_discussion=${hasRiskDiscussion ? "yes" : "no"}, management_risk=${hasManagementRisk ? "yes" : "no"}.`);

  let suggestedCode = isNewPatient ? "99202" : "99213";
  const moveUpRequirements = [];
  const moveDownReasons = [];

  if (isWithinGlobal) {
    suggestedCode = "99024";
    rationale.unshift(`Post-op global period detected (${postOpDays} days since surgery).`);
  } else {
    if (evidenceCategories >= 2 && (hasProblemComplexity || hasManagementRisk)) {
      suggestedCode = isNewPatient ? "99203" : "99214";
    }
    if (evidenceCategories >= 3 && hasManagementRisk && hasRiskDiscussion && hasDataReview) {
      suggestedCode = isNewPatient ? "99204" : "99215";
    }
    if (conservativeMode && evidenceCategories < 2) {
      suggestedCode = isNewPatient ? "99202" : "99213";
      moveDownReasons.push("Conservative mode held code due to limited evidence categories.");
    }
  }

  if (suggestedCode === (isNewPatient ? "99202" : "99213")) {
    moveUpRequirements.push("Add explicit data review and risk/benefit discussion for higher level support.");
  }
  if (suggestedCode === (isNewPatient ? "99203" : "99214")) {
    moveUpRequirements.push("Document high-risk management + stronger data review to support top level.");
  }
  if ((suggestedCode === "99215" || suggestedCode === "99204") && evidenceCategories < 3) {
    moveDownReasons.push("Top-level code selected but evidence categories are not all strongly represented.");
  }

  const codeRank = { "99202": 1, "99203": 2, "99204": 3, "99213": 1, "99214": 2, "99215": 3 };
  const perVisitDelta = {
    "99202->99203": 45,
    "99202->99204": 108,
    "99203->99204": 63,
    "99213->99214": 58,
    "99213->99215": 132,
    "99214->99215": 74,
  };

  const gaps = [...evidenceMissing];
  if (postOpLanguage && !surgeryDate) gaps.push("Post-op context present but surgery date is not documented.");
  const suggestions = [];
  if (!hasDataReview) suggestions.push("Document specific labs/imaging/records reviewed to support complexity.");
  if (!hasRiskDiscussion) suggestions.push("Add risk/benefit and treatment alternatives discussion.");
  if (!hasFollowUpPlan) suggestions.push("Add follow-up interval and escalation criteria.");
  if (postOpLanguage && !surgeryDate) suggestions.push("Document surgery date in the encounter note for global-period determination.");

  const deltaKey = `${billedCode}->${suggestedCode}`;
  const estimatedDeltaPerVisit = codeRank[suggestedCode] > codeRank[billedCode] ? (perVisitDelta[deltaKey] || 0) : 0;
  const confidenceRaw = 0.46 + (evidenceCategories * 0.12) + (hasRiskDiscussion ? 0.08 : 0) + (hasFollowUpPlan ? 0.05 : 0) + (isWithinGlobal ? 0.2 : 0);
  const confidence = Math.max(0.52, Math.min(0.96, confidenceRaw - (conservativeMode && evidenceCategories < 2 ? 0.08 : 0)));

  return {
    suggestedCode,
    rationale,
    confidence,
    gaps,
    suggestions,
    estimatedDeltaPerVisit,
    estimatedMonthlyRecovery: estimatedDeltaPerVisit * 80,
    evidenceFound,
    evidenceMissing,
    moveUpRequirements,
    moveDownReasons,
    postOpDays,
    surgeryDateDetected: surgeryDate ? surgeryDate.toISOString().slice(0, 10) : null,
  };
};

export { toDateOrNullLocal, parseSurgeryDateFromNoteLocal, analyzeEncounterNote };
