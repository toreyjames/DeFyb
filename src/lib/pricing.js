import { AI_TOOLS } from "../data/constants";

export const CORE_PRICING = {
  platformMinimumMonthly: 599,
  implementationFee: 2500,
  tiers: [
    { min: 1, max: 5, perProviderMonthly: 299 },
    { min: 6, max: 20, perProviderMonthly: 279 },
    { min: 21, max: Infinity, perProviderMonthly: 249 },
  ],
};

export const OPTIONAL_ADDONS = [
  { id: "claims", name: "Claims AI", monthly: 99, implementation: 750, perProvider: true },
  { id: "prior_auth", name: "Prior Auth Automation", monthly: 149, implementation: 1000, perProvider: true },
  { id: "dme", name: "DME Workflow", monthly: 199, implementation: 1500, perProvider: true },
  { id: "scribe_connector", name: "Scribe Connector", monthly: 49, implementation: 500, perProvider: true },
];

export const resolveCorePerProviderRate = (providerCount) => {
  const safeProviderCount = Math.max(1, Number(providerCount || 1));
  const tier = CORE_PRICING.tiers.find((t) => safeProviderCount >= t.min && safeProviderCount <= t.max)
    || CORE_PRICING.tiers[0];
  return tier.perProviderMonthly;
};

export const calculateCoreMonthly = (providerCount) => {
  const safeProviderCount = Math.max(1, Number(providerCount || 1));
  const rate = resolveCorePerProviderRate(safeProviderCount);
  return Math.max(CORE_PRICING.platformMinimumMonthly, rate * safeProviderCount);
};

export const PRICING = {
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
  managed: {
    base: 500,
    perProvider: 200,
    successSharePercent: 15,
    minimumMonthly: 500,
  },
  paymentStructures: {
    standard: { label: "Standard (50/50)", split: [50, 50], discount: 0 },
    monthly_6: { label: "6-Month Payment Plan", months: 6, discount: 0 },
    success: { label: "Success-Based (25% + 15%)", upfront: 25, sharePercent: 15, discount: 0 },
    enterprise: { label: "Enterprise (Custom)", discount: 0 },
  },
};

export const calculateQuote = (inputs, config = null) => {
  const {
    providerCount = 1,
    toolsSelected = [],
    ehrComplexity = "standard",
    specialtyComplexity = "standard",
    paymentStructure = "standard",
    waiveAssessment = false,
    discountPercent = 0,
  } = inputs;

  const pricing = config?.pricing || PRICING;
  const tools = config?.aiTools || AI_TOOLS;

  let assessmentFee = waiveAssessment ? 0 : (pricing.assessment?.base || PRICING.assessment.base);

  let implementationBase = pricing.implementation?.base || PRICING.implementation.base;
  let providerCost = providerCount * (pricing.implementation?.perProvider || PRICING.implementation.perProvider);
  let toolCost = toolsSelected.length * (pricing.implementation?.perTool || PRICING.implementation.perTool);
  let ehrMultiplier = pricing.implementation?.ehrComplexity?.[ehrComplexity] || PRICING.implementation.ehrComplexity[ehrComplexity] || 1;
  let specialtyMultiplier = pricing.implementation?.specialtyComplexity?.[specialtyComplexity] || PRICING.implementation.specialtyComplexity[specialtyComplexity] || 1;

  let implementationFee = (implementationBase + providerCost + toolCost) * ehrMultiplier * specialtyMultiplier;

  let monthlyBase = pricing.monthly?.base || PRICING.managed.base;
  let monthlyPerProvider = providerCount * (pricing.monthly?.perProvider || PRICING.managed.perProvider);
  let monthlyFee = monthlyBase + monthlyPerProvider;

  let monthlyToolCosts = toolsSelected.reduce((sum, toolId) => {
    const tool = tools.find(t => t.id === toolId);
    return sum + (tool?.cost || 0);
  }, 0);

  if (discountPercent > 0) {
    const discountMultiplier = 1 - (discountPercent / 100);
    implementationFee *= discountMultiplier;
  }

  const totalValue = assessmentFee + implementationFee + (monthlyFee * 12) + (monthlyToolCosts * 12);

  return {
    assessmentFee: Math.round(assessmentFee),
    implementationFee: Math.round(implementationFee),
    monthlyFee: Math.round(monthlyFee),
    monthlyToolCosts: Math.round(monthlyToolCosts),
    totalMonthly: Math.round(monthlyFee + monthlyToolCosts),
    totalValue: Math.round(totalValue),
    breakdown: {
      implementation: {
        base: implementationBase,
        providers: providerCost,
        tools: toolCost,
        ehrMultiplier,
        specialtyMultiplier,
      },
      managed: {
        base: monthlyBase,
        providers: monthlyPerProvider,
        tools: monthlyToolCosts,
      },
    },
  };
};
