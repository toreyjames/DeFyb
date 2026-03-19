import { DS } from "../design/tokens";

export const FAILURE_POINTS = [
  { id: 1, name: "Under-Coding", stat: "25-50% of visits", tag: "revenue", tool: "AI Coding Intelligence", toolCost: "Core platform", fix: "11-14% wRVU lift potential" },
  { id: 2, name: "Weak Code Evidence", stat: "MDM not fully documented", tag: "revenue", tool: "Documentation Gap Engine", toolCost: "Core platform", fix: "Clear rationale bullets per claim" },
  { id: 3, name: "Denials from Documentation", stat: "8-12% denial trend", tag: "revenue", tool: "Pre-Submit Billing Review", toolCost: "Core platform", fix: "Cleaner first-pass acceptance" },
  { id: 4, name: "Manual Chart Review", stat: "Slow QA throughput", tag: "time", tool: "Encounter Review Queue", toolCost: "Core platform", fix: "Faster review with priority scoring" },
  { id: 5, name: "Missed Revenue Visibility", stat: "No daily capture dashboard", tag: "revenue", tool: "Revenue Capture Dashboard", toolCost: "Core platform", fix: "Real-time underbilling visibility" },
];

export const PROTOCOL_STEPS = [
  { num: "01", title: "Baseline", desc: "Import 20-50 recent encounters and compare billed vs supported coding levels.", time: "1 day" },
  { num: "02", title: "Detect", desc: "Identify undercoded visits and documentation gaps by provider and visit type.", time: "2 days" },
  { num: "03", title: "Justify", desc: "Generate evidence bullets and compliant note additions for billing review.", time: "same day" },
  { num: "04", title: "Capture", desc: "Route corrected coding recommendations to billing with audit-ready context.", time: "ongoing" },
  { num: "05", title: "Expand", desc: "Layer in optional modules like DME, prior-auth, and claims automation after coding wins.", time: "phase 2" },
];

export const SAMPLE_CLIENTS = [
  { id: 1, name: "Pine Valley Family Med", providers: 5, ehr: "athenahealth", stage: "managed", score: 84, specialty: "Family Medicine",
    metrics: { docTime: 3.2, docTimeBaseline: 16, revenue: 42000, revenueBaseline: 0, denialRate: 4.1, denialBaseline: 11.2, callRate: 97, callBaseline: 54, codingUplift: 28500, dme: 0 },
    stack: [
      { name: "Suki AI Scribe", status: "active", since: "Oct 2025" },
      { name: "Assort Health Phone", status: "active", since: "Nov 2025" },
      { name: "Claims AI", status: "active", since: "Dec 2025" },
    ],
    notes: [
      { date: "Feb 15", text: "Q1 scorecard shows 84 health score, up from 38 at intake. Dr. Patel reports zero pajama time." },
      { date: "Jan 10", text: "Expanded from Tuesday Transform to full week. All 5 providers active on scribe." },
      { date: "Nov 20", text: "Phone agent live. 43 missed calls recovered in first week." },
    ],
  },
  { id: 2, name: "Lakeside Orthopedics", providers: 8, ehr: "Epic", stage: "implementation", score: 56, specialty: "Orthopedics",
    metrics: { docTime: 8.4, docTimeBaseline: 18, revenue: 18000, revenueBaseline: 0, denialRate: 7.8, denialBaseline: 12.5, callRate: 81, callBaseline: 48, codingUplift: 12000, dme: 24000 },
    stack: [
      { name: "Ambience Scribe", status: "active", since: "Jan 2026" },
      { name: "DME In-House Program", status: "deploying", since: "Feb 2026" },
      { name: "Assort Health Phone", status: "planned", since: "Mar 2026" },
    ],
    notes: [
      { date: "Feb 12", text: "DME implementation underway. Dr. Tracy estimates $2M/yr recovery at full scale across 20 providers." },
      { date: "Jan 28", text: "Tuesday Transform started. 3 of 8 providers active on scribe. Coding uplift already visible." },
    ],
  },
  { id: 3, name: "Riverside Pediatrics", providers: 3, ehr: "eClinicalWorks", stage: "assessment", score: null, specialty: "Pediatrics",
    metrics: { docTime: null, docTimeBaseline: 14, revenue: null, revenueBaseline: null, denialRate: null, denialBaseline: 9.8, callRate: null, callBaseline: 62 },
    stack: [],
    notes: [
      { date: "Feb 18", text: "Intake received. 3-provider peds group, drowning in phone volume and documentation. Shadow scheduled Feb 25." },
    ],
  },
  { id: 4, name: "Summit Pain Management", providers: 4, ehr: "NextGen", stage: "lead", score: null, specialty: "Pain Management",
    metrics: {},
    stack: [],
    notes: [{ date: "Feb 17", text: "Inbound from medical society talk. Office manager filled intake. Prior auth is their #1 pain point." }],
  },
  { id: 5, name: "Heartland Internal Med", providers: 6, ehr: "athenahealth", stage: "managed", score: 78, specialty: "Internal Medicine",
    metrics: { docTime: 4.1, docTimeBaseline: 15, revenue: 31000, revenueBaseline: 0, denialRate: 5.2, denialBaseline: 10.1, callRate: 94, callBaseline: 58, codingUplift: 22000, dme: 0 },
    stack: [
      { name: "HealOS Scribe", status: "active", since: "Sep 2025" },
      { name: "Assort Health Phone", status: "active", since: "Oct 2025" },
      { name: "PA Automation", status: "active", since: "Nov 2025" },
    ],
    notes: [
      { date: "Feb 14", text: "6-month scorecard delivered. Practice reports 2 fewer admin FTEs needed. Reinvested into patient navigator role." },
    ],
  },
];

export const STAGES = [
  { key: "lead", label: "Lead", color: DS.colors.textMuted },
  { key: "assessment", label: "Assessment", color: DS.colors.blue },
  { key: "implementation", label: "Implementation", color: DS.colors.warn },
  { key: "managed", label: "Managed", color: DS.colors.vital },
];

export const AI_TOOLS = [
  { id: "coding_core", name: "DeFyb Coding Core", category: "revenue", cost: 299 },
  { id: "suki", name: "Suki AI Scribe", category: "scribe", cost: 299 },
  { id: "ambience", name: "Ambience (Optional Scribe)", category: "scribe", cost: 299 },
  { id: "healos", name: "HealOS (Optional Scribe)", category: "scribe", cost: 199 },
  { id: "abridge", name: "Abridge (Optional Scribe)", category: "scribe", cost: 350 },
  { id: "dax", name: "Nuance DAX (Optional Scribe)", category: "scribe", cost: 650 },
  { id: "nabla", name: "Nabla (Optional Scribe)", category: "scribe", cost: 249 },
  { id: "deepscribe", name: "DeepScribe (Optional Scribe)", category: "scribe", cost: 249 },
  { id: "augmedix", name: "Augmedix (Optional Scribe)", category: "scribe", cost: 399 },
  { id: "freed", name: "Freed (Optional Scribe)", category: "scribe", cost: 99 },
  { id: "heidi", name: "Heidi (Optional Scribe)", category: "scribe", cost: 99 },
  { id: "dragon", name: "Microsoft Dragon Copilot (Optional Scribe)", category: "scribe", cost: 699 },
  { id: "assort", name: "Assort Health Phone", category: "phone", cost: 650 },
  { id: "claims", name: "Claims AI", category: "revenue", cost: 300 },
  { id: "pa", name: "PA Automation", category: "workflow", cost: 450 },
  { id: "dme", name: "DME In-House Program", category: "revenue", cost: 0 },
];

export const PAIN_TO_TOOL_MAP = {
  "Documentation time": ["coding_core", "suki", "ambience", "healos", "abridge", "dax", "nabla", "deepscribe", "augmedix", "freed", "heidi", "dragon"],
  "Phone/missed calls": ["assort"],
  "Coding accuracy": ["coding_core", "claims"],
  "Prior auth": ["pa"],
  "Claim denials": ["claims"],
  "Staffing shortages": ["assort", "pa"],
  "DME revenue loss": ["dme"],
  "Patient no-shows": [],
  "Providers working late": ["coding_core", "suki", "ambience", "healos", "abridge", "dax", "nabla", "deepscribe", "augmedix", "freed", "heidi", "dragon"],
  "Missing/losing calls": ["assort"],
  "High denial rate": ["claims"],
  "Under-coding concerns": ["coding_core", "claims"],
  "Prior auth burden": ["pa"],
  "Staffing struggles": ["assort", "pa"],
  "Want to bring DME in-house": ["dme"],
  "Stay independent": [],
};
