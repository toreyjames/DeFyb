import { AI_TOOLS, PAIN_TO_TOOL_MAP } from "../data/constants";
import { calculateQuote } from "./pricing";

export const ROI_BENCHMARKS = {
  scribing: {
    timeSavedMinPerPatient: 12,
    patientsPerDay: 20,
    workDaysPerYear: 250,
    providerHourlyValue: 200,
    codingUpliftPercent: 12,
    avgRevenuePerProvider: 500000,
  },
  phone: {
    missedCallsPerDayBaseline: 15,
    revenuePerRecoveredPatient: 250,
    recoveryRate: 0.4,
  },
  claims: {
    denialRateBaseline: 0.10,
    denialRateWithAI: 0.04,
    avgClaimValue: 180,
    claimsPerProviderPerYear: 4000,
  },
  priorAuth: {
    hoursPerWeekBaseline: 14,
    hoursPerWeekWithAI: 4,
    staffHourlyCost: 25,
    weeksPerYear: 50,
  },
  dme: {
    applicableSpecialties: ["Orthopedic Surgery", "Pain Management", "Physical Medicine", "Podiatry"],
    potentialPerProvider: 50000,
    captureRate: 0.6,
  },
};

export const calculateROIProjection = (practice) => {
  const providerCount = parseInt(practice.provider_count?.replace(/[^0-9]/g, '') || practice.providers?.toString().replace(/[^0-9]/g, '')) || 3;
  const painPoints = practice.pain_points || [];
  const interestDrivers = practice.interest_drivers || [];
  const specialty = practice.specialty || "";

  const allConcerns = [...new Set([...painPoints, ...interestDrivers])];

  const recommendedToolIds = new Set();
  recommendedToolIds.add("coding_core");
  allConcerns.forEach(concern => {
    const tools = PAIN_TO_TOOL_MAP[concern] || [];
    tools.forEach(t => recommendedToolIds.add(t));
  });

  const recommendedTools = AI_TOOLS.filter(t => recommendedToolIds.has(t.id));

  const projections = {
    scribing: { low: 0, high: 0, description: "" },
    phone: { low: 0, high: 0, description: "" },
    claims: { low: 0, high: 0, description: "" },
    priorAuth: { low: 0, high: 0, description: "" },
    dme: { low: 0, high: 0, description: "" },
    timeSaved: { hoursPerDay: 0, description: "" },
  };

  if (recommendedTools.some(t => t.category === "scribe")) {
    const b = ROI_BENCHMARKS.scribing;
    const timeSavedHoursPerYear = (b.timeSavedMinPerPatient * b.patientsPerDay * b.workDaysPerYear) / 60;
    const opportunityCost = timeSavedHoursPerYear * b.providerHourlyValue * providerCount;
    const codingUplift = (b.codingUpliftPercent / 100) * b.avgRevenuePerProvider * providerCount;

    projections.scribing = {
      low: Math.round(codingUplift * 0.5),
      high: Math.round(codingUplift * 1.2),
      description: `${Math.round(b.codingUpliftPercent * 0.8)}-${Math.round(b.codingUpliftPercent * 1.2)}% wRVU increase from improved documentation`,
    };

    projections.timeSaved = {
      hoursPerDay: Math.round((b.timeSavedMinPerPatient * b.patientsPerDay) / 60 * 10) / 10,
      description: `${Math.round(b.timeSavedMinPerPatient)} minutes saved per patient encounter`,
    };
  }

  if (recommendedTools.some(t => t.category === "phone")) {
    const b = ROI_BENCHMARKS.phone;
    const recoveredPatientsPerYear = b.missedCallsPerDayBaseline * b.recoveryRate * 250;
    const revenue = recoveredPatientsPerYear * b.revenuePerRecoveredPatient;

    projections.phone = {
      low: Math.round(revenue * 0.6),
      high: Math.round(revenue * 1.2),
      description: `Recovering ${Math.round(recoveredPatientsPerYear * 0.8)}-${Math.round(recoveredPatientsPerYear)} patients/year from missed calls`,
    };
  }

  if (recommendedTools.some(t => t.category === "revenue" && t.id === "claims")) {
    const b = ROI_BENCHMARKS.claims;
    const denialReduction = b.denialRateBaseline - b.denialRateWithAI;
    const recoveredClaims = denialReduction * b.claimsPerProviderPerYear * providerCount;
    const revenue = recoveredClaims * b.avgClaimValue;

    projections.claims = {
      low: Math.round(revenue * 0.7),
      high: Math.round(revenue * 1.1),
      description: `Reducing denial rate from ${b.denialRateBaseline * 100}% to ${b.denialRateWithAI * 100}%`,
    };
  }

  if (recommendedTools.some(t => t.id === "pa")) {
    const b = ROI_BENCHMARKS.priorAuth;
    const hoursSaved = (b.hoursPerWeekBaseline - b.hoursPerWeekWithAI) * b.weeksPerYear;
    const savings = hoursSaved * b.staffHourlyCost * providerCount;

    projections.priorAuth = {
      low: Math.round(savings * 0.8),
      high: Math.round(savings * 1.2),
      description: `Saving ${b.hoursPerWeekBaseline - b.hoursPerWeekWithAI} staff hours/week on prior auth`,
    };
  }

  if (recommendedTools.some(t => t.id === "dme")) {
    const b = ROI_BENCHMARKS.dme;
    const isApplicable = b.applicableSpecialties.some(s =>
      specialty.toLowerCase().includes(s.toLowerCase().split(" ")[0])
    );

    if (isApplicable) {
      const potential = b.potentialPerProvider * b.captureRate * providerCount;
      projections.dme = {
        low: Math.round(potential * 0.5),
        high: Math.round(potential * 1.0),
        description: `In-house DME program capturing ${Math.round(b.captureRate * 100)}% of eligible orders`,
      };
    }
  }

  const totalLow = Object.values(projections)
    .filter(p => typeof p.low === "number")
    .reduce((sum, p) => sum + p.low, 0);
  const totalHigh = Object.values(projections)
    .filter(p => typeof p.high === "number")
    .reduce((sum, p) => sum + p.high, 0);

  const toolMonthlyCost = recommendedTools.reduce((sum, t) => sum + (t.cost * (t.category === "scribe" ? providerCount : 1)), 0);
  const quote = calculateQuote({
    providerCount,
    toolsSelected: recommendedTools.map(t => t.id),
    ehrComplexity: "standard",
    specialtyComplexity: specialty.toLowerCase().includes("surg") ? "surgical" : "standard",
  });

  const annualInvestment = quote.assessmentFee + quote.implementationFee + (quote.monthlyFee * 12) + (toolMonthlyCost * 12);

  return {
    practice: {
      name: practice.name,
      specialty,
      providerCount,
      painPoints,
      interestDrivers,
      address: practice.address,
      cityStateZip: practice.city_state_zip,
      contactName: practice.contact_name,
      contactEmail: practice.contact_email,
    },
    recommendedTools,
    projections,
    totals: {
      low: totalLow,
      high: totalHigh,
      timeSavedPerDay: projections.timeSaved.hoursPerDay,
    },
    investment: {
      assessment: quote.assessmentFee,
      implementation: quote.implementationFee,
      monthlyService: quote.monthlyFee,
      monthlyTools: toolMonthlyCost,
      totalFirstYear: annualInvestment,
      roiLow: totalLow > 0 ? Math.round((totalLow / annualInvestment) * 10) / 10 : 0,
      roiHigh: totalHigh > 0 ? Math.round((totalHigh / annualInvestment) * 10) / 10 : 0,
    },
    tiers: [
      {
        name: "Assessment Only",
        description: "Baseline capture, ROI analysis, and transformation roadmap",
        price: quote.assessmentFee,
        includes: ["Half-day on-site assessment", "workflow and revenue baseline", "Detailed ROI projection", "Implementation roadmap", "No commitment to proceed"],
      },
      {
        name: "Assessment + Implementation",
        description: "Full deployment of recommended tool stack",
        price: quote.assessmentFee + quote.implementationFee,
        includes: ["Everything in Assessment", "Tool deployment & configuration", "Staff training", "Go-live support", "30-day optimization period"],
      },
      {
        name: "Full Managed Partnership",
        description: "Ongoing optimization and support",
        priceUpfront: quote.assessmentFee + quote.implementationFee,
        priceMonthly: quote.monthlyFee + toolMonthlyCost,
        includes: ["Everything in Implementation", "Monthly performance reviews", "Continuous optimization", "Priority support", "Quarterly business reviews"],
      },
    ],
  };
};
