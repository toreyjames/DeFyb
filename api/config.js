// Vercel Edge Config API route
// Returns dynamic pricing configuration

import { get, getAll } from '@vercel/edge-config';

// Default configuration (fallback if Edge Config not set)
const defaultConfig = {
  aiTools: [
    { id: "coding_core", name: "DeFyb Coding Core", category: "revenue", cost: 299 },
    { id: "claims", name: "Claims AI (Optional)", category: "revenue", cost: 99 },
    { id: "prior_auth", name: "Prior Auth Automation (Optional)", category: "workflow", cost: 149 },
    { id: "dme", name: "DME Workflow (Optional)", category: "revenue", cost: 199 },
    { id: "scribe_connector", name: "Scribe Connector (Optional)", category: "integration", cost: 49 },
  ],
  pricing: {
    core: {
      platformMinimumMonthly: 599,
      implementationFee: 2500,
      tiers: [
        { min: 1, max: 5, perProviderMonthly: 299 },
        { min: 6, max: 20, perProviderMonthly: 279 },
        { min: 21, max: 999, perProviderMonthly: 249 },
      ],
    },
    addons: {
      claims: { monthlyPerProvider: 99, implementationFee: 750 },
      prior_auth: { monthlyPerProvider: 149, implementationFee: 1000 },
      dme: { monthlyPerProvider: 199, implementationFee: 1500 },
      scribe_connector: { monthlyPerProvider: 49, implementationFee: 500 },
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
