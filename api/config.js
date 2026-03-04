// Vercel Edge Config API route
// Returns dynamic pricing configuration

import { get, getAll } from '@vercel/edge-config';

// Default configuration (fallback if Edge Config not set)
const defaultConfig = {
  aiTools: [
    { id: "suki", name: "Suki AI Scribe", category: "scribe", cost: 299 },
    { id: "ambience", name: "Ambience Scribe", category: "scribe", cost: 299 },
    { id: "healos", name: "HealOS Scribe", category: "scribe", cost: 199 },
    { id: "assort", name: "Assort Health Phone", category: "phone", cost: 650 },
    { id: "claims", name: "Claims AI", category: "revenue", cost: 300 },
    { id: "pa", name: "PA Automation", category: "workflow", cost: 450 },
    { id: "dme", name: "DME In-House Program", category: "revenue", cost: 0 },
  ],
  pricing: {
    assessment: {
      base: 2500,
      waivableWithContract: true,
    },
    implementation: {
      base: 5000,
      perProvider: 1500,
      perTool: 500,
      ehrComplexity: {
        standard: 1.0,
        moderate: 1.25,
        complex: 1.5,
      },
      specialtyComplexity: {
        standard: 1.0,
        surgical: 1.15,
        behavioral: 1.15,
      },
    },
    monthly: {
      base: 500,
      perProvider: 200,
    },
  },
  roiBenchmarks: {
    scribing: {
      timeSavedMinPerPatient: 5,
      patientsPerDay: 20,
      workDaysPerYear: 250,
      providerHourlyValue: 200,
      codingUpliftPercent: 8,
      avgRevenuePerProvider: 450000,
    },
    phone: {
      callsHandledPerDay: 50,
      costPerCallSavings: 2.50,
      appointmentRecoveryRate: 0.15,
      avgAppointmentValue: 180,
    },
    claims: {
      denialReductionPercent: 40,
      avgDenialsPerMonthPerProvider: 15,
      avgDenialValue: 250,
    },
    priorAuth: {
      hoursPerWeekReduction: 10,
      staffHourlyCost: 25,
      approvalRateImprovement: 0.12,
      avgClaimValueWhenApproved: 800,
    },
    dme: {
      patientPercentEligible: 0.08,
      avgReimbursementPerPatient: 450,
      netToProviderPercent: 0.35,
    },
  },
  version: "1.0.0",
  updatedAt: new Date().toISOString(),
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Check if Edge Config is available
    if (!process.env.EDGE_CONFIG) {
      console.log('Edge Config not configured, returning defaults');
      return res.status(200).json({
        ...defaultConfig,
        source: 'defaults',
      });
    }

    // Try to get config from Edge Config
    const [aiTools, pricing, roiBenchmarks, version] = await Promise.all([
      get('aiTools'),
      get('pricing'),
      get('roiBenchmarks'),
      get('version'),
    ]);

    const config = {
      aiTools: aiTools || defaultConfig.aiTools,
      pricing: pricing || defaultConfig.pricing,
      roiBenchmarks: roiBenchmarks || defaultConfig.roiBenchmarks,
      version: version || defaultConfig.version,
      updatedAt: new Date().toISOString(),
      source: 'edge-config',
    };

    return res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching Edge Config:', error);

    // Return defaults on error
    return res.status(200).json({
      ...defaultConfig,
      source: 'defaults',
      error: 'Edge Config unavailable, using defaults',
    });
  }
}
