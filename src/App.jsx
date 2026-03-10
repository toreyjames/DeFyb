import { useState, useEffect, useRef, createContext, useContext } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";

// ============================================================
// DeFyb v4 — Unified Platform
// Public Site | Client Portal | Team Dashboard
// ============================================================

// --- DYNAMIC CONFIG (Edge Config) ---
// Pricing and tools can be updated instantly without redeploying
const ConfigContext = createContext(null);

const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    // Return defaults if not in provider (shouldn't happen)
    return { config: DEFAULT_CONFIG, loading: false };
  }
  return context;
};

// Default config (fallback when Edge Config unavailable)
const DEFAULT_CONFIG = {
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
    assessment: { base: 2500, waivableWithContract: true },
    implementation: {
      base: 5000,
      perProvider: 1500,
      perTool: 500,
      ehrComplexity: { standard: 1.0, moderate: 1.25, complex: 1.5 },
      specialtyComplexity: { standard: 1.0, surgical: 1.15, behavioral: 1.15 },
    },
    monthly: { base: 500, perProvider: 200 },
  },
  source: "defaults",
};

const ConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/config");
        if (response.ok) {
          const data = await response.json();
          setConfig({ ...DEFAULT_CONFIG, ...data });
          setLastUpdated(data.updatedAt);
        }
      } catch (error) {
        console.log("Edge Config unavailable, using defaults");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();

    // Refresh config every 5 minutes for instant updates
    const interval = setInterval(fetchConfig, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, lastUpdated, refresh: () => {} }}>
      {children}
    </ConfigContext.Provider>
  );
};

// --- DESIGN SYSTEM ---
const DS = {
  colors: {
    bg: "#0b0c0e",
    bgCard: "#111318",
    bgHover: "#181b22",
    border: "#1e2129",
    borderLight: "#2a2e38",
    text: "#e2e4e9",
    textMuted: "#8b8f9a",
    textDim: "#5c6070",
    shock: "#e8762b",       // DeFyb orange — the defibrillator shock
    shockGlow: "#e8762b33",
    shockLight: "#f0a66d",
    vital: "#34d399",       // Green — healthy metrics
    vitalDim: "#34d39944",
    warn: "#f59e0b",        // Amber — staffing / attention
    warnDim: "#f59e0b44",
    danger: "#ef4444",      // Red — critical
    dangerDim: "#ef444444",
    blue: "#60a5fa",        // Cool blue — time metrics
    blueDim: "#60a5fa44",
    white: "#ffffff",
  },
  fonts: {
    display: "'Instrument Serif', Georgia, serif",
    body: "'Outfit', 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  radius: { sm: "6px", md: "10px", lg: "16px", xl: "24px" },
  shadow: {
    card: "0 1px 3px rgba(0,0,0,0.4)",
    glow: "0 0 40px rgba(232,118,43,0.15)",
    deep: "0 8px 32px rgba(0,0,0,0.5)",
  },
};

// Tag categories with consistent naming across all views
const TAGS = {
  time: { label: "Time", color: DS.colors.blue, bg: DS.colors.blueDim, icon: "⏱" },
  staffing: { label: "Staffing", color: DS.colors.warn, bg: DS.colors.warnDim, icon: "👥" },
  revenue: { label: "Revenue", color: DS.colors.vital, bg: DS.colors.vitalDim, icon: "💰" },
};

// --- FONTS LOADER ---
const FontLoader = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  `}</style>
);

// --- GLOBAL STYLES ---
const GlobalStyles = () => (
  <style>{`
    * { margin:0; padding:0; box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { background:${DS.colors.bg}; color:${DS.colors.text}; font-family:${DS.fonts.body}; line-height:1.6; -webkit-font-smoothing:antialiased; }
    ::selection { background:${DS.colors.shock}; color:#fff; }
    ::-webkit-scrollbar { width:6px; }
    ::-webkit-scrollbar-track { background:${DS.colors.bg}; }
    ::-webkit-scrollbar-thumb { background:${DS.colors.borderLight}; border-radius:3px; }
    input, textarea, select { font-family:${DS.fonts.body}; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
    @keyframes heartbeat { 0%,100% { transform:scale(1); } 14% { transform:scale(1.08); } 28% { transform:scale(1); } 42% { transform:scale(1.05); } 56% { transform:scale(1); } }
    @keyframes shockLine { from { stroke-dashoffset:800; } to { stroke-dashoffset:0; } }
    .fade-up { animation: fadeUp 0.5s ease both; }
    .fade-in { animation: fadeIn 0.4s ease both; }

    /* Mobile responsive */
    @media (max-width: 768px) {
      .roi-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
      .roi-grid .roi-arrow { transform: rotate(90deg); margin: 0 auto; }
      .roi-breakdown { grid-template-columns: 1fr !important; }
      .roi-breakdown > div { grid-template-columns: 1fr !important; gap: 8px !important; text-align: left !important; }
      .bottom-stats { grid-template-columns: 1fr !important; gap: 16px !important; }
      .bottom-stats > div { border: none !important; padding: 16px 0 !important; border-bottom: 1px solid ${DS.colors.border} !important; }
      .bottom-stats > div:last-child { border-bottom: none !important; }
      .protocol-step { grid-template-columns: 48px 1fr !important; }
      .protocol-step > div:last-child { display: none; }
    }
  `}</style>
);

// --- SVG COMPONENTS ---
const HeartbeatLine = ({ width = 200, color = DS.colors.shock, style = {} }) => (
  <svg width={width} height="32" viewBox="0 0 200 32" fill="none" style={{ display: "block", ...style }}>
    <path
      d="M0 16 L50 16 L60 4 L70 28 L80 8 L90 24 L100 16 L200 16"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ strokeDasharray: 800, animation: "shockLine 2s ease forwards" }}
    />
  </svg>
);

const DeFybLogo = ({ size = 32 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect x="2" y="2" width="36" height="36" rx="8" stroke={DS.colors.shock} strokeWidth="2" fill="none" />
      <path d="M12 20 L16 20 L18 12 L22 28 L24 16 L26 24 L28 20 L32 20"
        stroke={DS.colors.shock} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span style={{
      fontFamily: DS.fonts.display, fontSize: size * 0.7, color: DS.colors.text,
      letterSpacing: "-0.02em", fontWeight: 400,
    }}>
      De<span style={{ color: DS.colors.shock }}>F</span>yb
    </span>
  </div>
);

const HealthScoreRing = ({ score = 72, size = 160 }) => {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? DS.colors.vital : score >= 60 ? DS.colors.warn : DS.colors.danger;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={DS.colors.border} strokeWidth="8" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: DS.fonts.display, fontSize: size * 0.3, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: DS.colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Health</span>
      </div>
    </div>
  );
};

// --- SHARED UI COMPONENTS ---
const Tag = ({ type }) => {
  const t = TAGS[type];
  if (!t) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 8px", borderRadius: "4px", fontSize: "11px",
      fontWeight: 500, color: t.color, background: t.bg, letterSpacing: "0.04em",
    }}>
      {t.icon} {t.label}
    </span>
  );
};

const Button = ({ children, primary, small, onClick, style: s = {} }) => (
  <button onClick={onClick} style={{
    padding: small ? "8px 16px" : "12px 28px",
    background: primary ? DS.colors.shock : "transparent",
    color: primary ? "#fff" : DS.colors.text,
    border: primary ? "none" : `1px solid ${DS.colors.borderLight}`,
    borderRadius: DS.radius.md, cursor: "pointer",
    fontFamily: DS.fonts.body, fontSize: small ? "13px" : "15px",
    fontWeight: 500, letterSpacing: "0.01em",
    transition: "all 0.2s ease", ...s,
  }}>{children}</button>
);

const Card = ({ children, style: s = {} }) => (
  <div style={{
    background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
    borderRadius: DS.radius.lg, padding: "24px", ...s,
  }}>{children}</div>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: "32px" }}>
    <h2 style={{
      fontFamily: DS.fonts.display, fontSize: "clamp(28px, 4vw, 40px)",
      color: DS.colors.text, fontWeight: 400, lineHeight: 1.2, marginBottom: sub ? "8px" : 0,
    }}>{children}</h2>
    {sub && <p style={{ color: DS.colors.textMuted, fontSize: "16px", maxWidth: "600px" }}>{sub}</p>}
  </div>
);

const MetricCard = ({ label, value, sub, color = DS.colors.text, small }) => (
  <div style={{
    background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
    borderRadius: DS.radius.md, padding: small ? "14px" : "20px",
  }}>
    <div style={{ fontSize: "11px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{label}</div>
    <div style={{ fontFamily: DS.fonts.display, fontSize: small ? "22px" : "28px", color, lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginTop: "4px" }}>{sub}</div>}
  </div>
);

// --- SVG CHARTS ---

// Simple horizontal bar chart
const BarChart = ({ data, height = 200, showLabels = true }) => {
  if (!data || data.length === 0) return null;
  const maxValue = Math.max(...data.map(d => d.value));
  const barHeight = Math.min(24, (height - 20) / data.length - 4);

  return (
    <svg width="100%" height={height} style={{ overflow: "visible" }}>
      {data.map((item, i) => {
        const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const y = i * (barHeight + 8) + 10;
        return (
          <g key={i}>
            {showLabels && (
              <text x="0" y={y + barHeight / 2 + 4} fontSize="11" fill={DS.colors.textMuted}>
                {item.label.length > 15 ? item.label.slice(0, 15) + "..." : item.label}
              </text>
            )}
            <rect
              x={showLabels ? "40%" : "0"}
              y={y}
              width={`${barWidth * (showLabels ? 0.5 : 0.9)}%`}
              height={barHeight}
              rx="3"
              fill={item.color || DS.colors.shock}
              style={{ transition: "width 0.5s ease" }}
            />
            <text
              x={showLabels ? `${42 + barWidth * 0.5}%` : `${barWidth * 0.9 + 2}%`}
              y={y + barHeight / 2 + 4}
              fontSize="11"
              fill={DS.colors.text}
              fontFamily={DS.fonts.mono}
            >
              ${item.value.toLocaleString()}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// Donut chart for portfolio health
const DonutChart = ({ segments, size = 120, strokeWidth = 16 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let currentOffset = 0;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={DS.colors.border}
        strokeWidth={strokeWidth}
      />
      {/* Segments */}
      {segments.map((segment, i) => {
        const segmentLength = total > 0 ? (segment.value / total) * circumference : 0;
        const offset = currentOffset;
        currentOffset += segmentLength;

        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
            strokeDashoffset={-offset}
            style={{ transition: "stroke-dasharray 0.5s ease" }}
          />
        );
      })}
    </svg>
  );
};

// Simple sparkline for trends
const Sparkline = ({ data, width = 100, height = 30, color = DS.colors.shock }) => {
  if (!data || data.length < 2) return null;

  const maxVal = Math.max(...data);
  const minVal = Math.min(...data);
  const range = maxVal - minVal || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - minVal) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={height - ((data[data.length - 1] - minVal) / range) * (height - 4) - 2}
        r="3"
        fill={color}
      />
    </svg>
  );
};

// Portfolio overview card with charts
const PortfolioCharts = ({ practices }) => {
  // Calculate portfolio health distribution
  const healthSegments = [
    { label: "Healthy (80+)", value: practices.filter(p => (p.health_score || p.score || 0) >= 80).length, color: DS.colors.vital },
    { label: "Moderate (60-79)", value: practices.filter(p => { const s = p.health_score || p.score || 0; return s >= 60 && s < 80; }).length, color: DS.colors.warn },
    { label: "At Risk (<60)", value: practices.filter(p => (p.health_score || p.score || 0) < 60 && p.stage === "managed").length, color: DS.colors.danger },
  ];

  // Calculate ROI by practice
  const roiByPractice = practices
    .filter(p => p.roi_projections?.totalAnnualValue > 0)
    .sort((a, b) => (b.roi_projections?.totalAnnualValue || 0) - (a.roi_projections?.totalAnnualValue || 0))
    .slice(0, 5)
    .map(p => ({
      label: p.name,
      value: p.roi_projections?.totalAnnualValue || 0,
      color: DS.colors.vital,
    }));

  // Stage distribution
  const stageData = [
    { label: "Lead", value: practices.filter(p => p.stage === "lead").length, color: DS.colors.textMuted },
    { label: "Assessment", value: practices.filter(p => p.stage === "assessment").length, color: DS.colors.blue },
    { label: "Implementation", value: practices.filter(p => p.stage === "implementation").length, color: DS.colors.warn },
    { label: "Managed", value: practices.filter(p => p.stage === "managed").length, color: DS.colors.vital },
  ];

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      {/* Portfolio Health Donut */}
      <Card>
        <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Portfolio Health</div>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <DonutChart segments={healthSegments} size={100} strokeWidth={14} />
          <div style={{ display: "grid", gap: "8px" }}>
            {healthSegments.map((seg, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: seg.color }} />
                <span style={{ fontSize: "12px", color: DS.colors.textMuted }}>{seg.label}</span>
                <span style={{ fontSize: "12px", fontFamily: DS.fonts.mono, color: DS.colors.text, marginLeft: "auto" }}>{seg.value}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ROI by Practice */}
      {roiByPractice.length > 0 && (
        <Card>
          <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Projected ROI by Practice</div>
          <BarChart data={roiByPractice} height={roiByPractice.length * 32 + 20} />
        </Card>
      )}

      {/* Stage Distribution */}
      <Card>
        <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Pipeline Distribution</div>
        <div style={{ display: "flex", gap: "4px", height: "24px", borderRadius: DS.radius.sm, overflow: "hidden" }}>
          {stageData.map((stage, i) => {
            const total = stageData.reduce((s, d) => s + d.value, 0);
            const width = total > 0 ? (stage.value / total) * 100 : 0;
            if (width === 0) return null;
            return (
              <div
                key={i}
                style={{
                  width: `${width}%`,
                  background: stage.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "width 0.3s ease",
                }}
                title={`${stage.label}: ${stage.value}`}
              >
                {width > 15 && <span style={{ fontSize: "10px", color: "#fff", fontWeight: 600 }}>{stage.value}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
          {stageData.map((stage, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "2px", background: stage.color }} />
              <span style={{ fontSize: "10px", color: DS.colors.textMuted }}>{stage.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// --- DATA ---
const FAILURE_POINTS = [
  { id: 1, name: "Under-Coding", stat: "25-50% of visits", tag: "revenue", tool: "AI Coding Intelligence", toolCost: "Core platform", fix: "11-14% wRVU lift potential" },
  { id: 2, name: "Weak Code Evidence", stat: "MDM not fully documented", tag: "revenue", tool: "Documentation Gap Engine", toolCost: "Core platform", fix: "Clear rationale bullets per claim" },
  { id: 3, name: "Denials from Documentation", stat: "8-12% denial trend", tag: "revenue", tool: "Pre-Submit Billing Review", toolCost: "Core platform", fix: "Cleaner first-pass acceptance" },
  { id: 4, name: "Manual Chart Review", stat: "Slow QA throughput", tag: "time", tool: "Encounter Review Queue", toolCost: "Core platform", fix: "Faster review with priority scoring" },
  { id: 5, name: "Missed Revenue Visibility", stat: "No daily capture dashboard", tag: "revenue", tool: "Revenue Capture Dashboard", toolCost: "Core platform", fix: "Real-time underbilling visibility" },
];

const PROTOCOL_STEPS = [
  { num: "01", title: "Baseline", desc: "Import 20-50 recent encounters and compare billed vs supported coding levels.", time: "1 day" },
  { num: "02", title: "Detect", desc: "Identify undercoded visits and documentation gaps by provider and visit type.", time: "2 days" },
  { num: "03", title: "Justify", desc: "Generate evidence bullets and compliant note additions for billing review.", time: "same day" },
  { num: "04", title: "Capture", desc: "Route corrected coding recommendations to billing with audit-ready context.", time: "ongoing" },
  { num: "05", title: "Expand", desc: "Layer in optional modules like DME, prior-auth, and claims automation after coding wins.", time: "phase 2" },
];

const SAMPLE_CLIENTS = [
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

const STAGES = [
  { key: "lead", label: "Lead", color: DS.colors.textMuted },
  { key: "assessment", label: "Assessment", color: DS.colors.blue },
  { key: "implementation", label: "Implementation", color: DS.colors.warn },
  { key: "managed", label: "Managed", color: DS.colors.vital },
];

// Predefined AI tools for implementation
const AI_TOOLS = [
  { id: "suki", name: "Suki AI Scribe", category: "scribe", cost: 299 },
  { id: "ambience", name: "Ambience Scribe", category: "scribe", cost: 299 },
  { id: "healos", name: "HealOS Scribe", category: "scribe", cost: 199 },
  { id: "assort", name: "Assort Health Phone", category: "phone", cost: 650 },
  { id: "claims", name: "Claims AI", category: "revenue", cost: 300 },
  { id: "pa", name: "PA Automation", category: "workflow", cost: 450 },
  { id: "dme", name: "DME In-House Program", category: "revenue", cost: 0 },
];

// --- PRICING CONFIGURATION ---
const PRICING = {
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

// --- EMAIL TEMPLATES ---
const EMAIL_TEMPLATES = {
  welcome: { subject: "Welcome to DeFyb", trigger: "lead_created" },
  quote_sent: { subject: "Your DeFyb Quote is Ready", trigger: "quote_sent" },
  quote_followup_1: { subject: "Following Up on Your DeFyb Quote", trigger: "quote_no_response", delay: 2 },
  quote_followup_2: { subject: "Still Interested in Transforming Your Practice?", trigger: "quote_no_response", delay: 5 },
  quote_followup_3: { subject: "Last Chance: Your DeFyb Quote Expires Soon", trigger: "quote_no_response", delay: 10 },
  payment_received: { subject: "Payment Received - Thank You!", trigger: "payment_succeeded" },
  stage_change: { subject: "Update on Your DeFyb Transformation", trigger: "stage_change" },
  tool_deployed: { subject: "New AI Tool Now Live!", trigger: "tool_active" },
  scorecard: { subject: "Your Monthly Practice Scorecard", trigger: "monthly" },
  invoice_due: { subject: "Payment Reminder: Invoice Due Soon", trigger: "invoice_due", delay: -3 },
  invoice_overdue_1: { subject: "Payment Overdue - Action Required", trigger: "invoice_overdue", delay: 1 },
  invoice_overdue_7: { subject: "Urgent: Payment 7 Days Overdue", trigger: "invoice_overdue", delay: 7 },
  renewal_60: { subject: "Your DeFyb Partnership Renewal", trigger: "contract_expiring", delay: -60 },
  renewal_30: { subject: "30 Days Until Renewal", trigger: "contract_expiring", delay: -30 },
};

// --- ROI PROJECTION ENGINE ---
const ROI_BENCHMARKS = {
  // Per-provider annual savings/revenue by category
  scribing: {
    timeSavedMinPerPatient: 12, // minutes saved per patient
    patientsPerDay: 20,
    workDaysPerYear: 250,
    providerHourlyValue: 200, // opportunity cost
    codingUpliftPercent: 12, // wRVU increase from better documentation
    avgRevenuePerProvider: 500000, // baseline revenue
  },
  phone: {
    missedCallsPerDayBaseline: 15,
    revenuePerRecoveredPatient: 250, // avg visit value
    recoveryRate: 0.4, // 40% of missed calls become patients
  },
  claims: {
    denialRateBaseline: 0.10, // 10%
    denialRateWithAI: 0.04, // 4%
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
    // Only for ortho, pain management, etc.
    applicableSpecialties: ["Orthopedic Surgery", "Pain Management", "Physical Medicine", "Podiatry"],
    potentialPerProvider: 50000, // annual DME revenue potential
    captureRate: 0.6, // realistic capture with program
  },
};

// Map pain points to recommended tools
const PAIN_TO_TOOL_MAP = {
  "Documentation time": ["suki", "ambience", "healos"],
  "Phone/missed calls": ["assort"],
  "Coding accuracy": ["suki", "ambience"], // scribes include coding
  "Prior auth": ["pa"],
  "Claim denials": ["claims"],
  "Staffing shortages": ["assort", "pa"], // automation helps
  "DME revenue loss": ["dme"],
  "Patient no-shows": [], // future: engagement AI
  "Providers working late": ["suki", "ambience", "healos"],
  "Missing/losing calls": ["assort"],
  "High denial rate": ["claims"],
  "Under-coding concerns": ["suki", "ambience"],
  "Prior auth burden": ["pa"],
  "Staffing struggles": ["assort", "pa"],
  "Want to bring DME in-house": ["dme"],
  "Stay independent": [], // motivation, not tool-specific
};

// Calculate ROI projections based on practice data
const calculateROIProjection = (practice) => {
  const providerCount = parseInt(practice.provider_count?.replace(/[^0-9]/g, '') || practice.providers?.toString().replace(/[^0-9]/g, '')) || 3;
  const painPoints = practice.pain_points || [];
  const interestDrivers = practice.interest_drivers || [];
  const specialty = practice.specialty || "";

  // Combine pain points and interest drivers for tool recommendations
  const allConcerns = [...new Set([...painPoints, ...interestDrivers])];

  // Determine recommended tools
  const recommendedToolIds = new Set();
  allConcerns.forEach(concern => {
    const tools = PAIN_TO_TOOL_MAP[concern] || [];
    tools.forEach(t => recommendedToolIds.add(t));
  });

  // Always recommend at least a scribe if nothing else
  if (recommendedToolIds.size === 0) {
    recommendedToolIds.add("suki");
  }

  const recommendedTools = AI_TOOLS.filter(t => recommendedToolIds.has(t.id));

  // Calculate projections
  const projections = {
    scribing: { low: 0, high: 0, description: "" },
    phone: { low: 0, high: 0, description: "" },
    claims: { low: 0, high: 0, description: "" },
    priorAuth: { low: 0, high: 0, description: "" },
    dme: { low: 0, high: 0, description: "" },
    timeSaved: { hoursPerDay: 0, description: "" },
  };

  // Scribing ROI (if scribe recommended)
  if (recommendedTools.some(t => t.category === "scribe")) {
    const b = ROI_BENCHMARKS.scribing;
    const timeSavedHoursPerYear = (b.timeSavedMinPerPatient * b.patientsPerDay * b.workDaysPerYear) / 60;
    const opportunityCost = timeSavedHoursPerYear * b.providerHourlyValue * providerCount;
    const codingUplift = (b.codingUpliftPercent / 100) * b.avgRevenuePerProvider * providerCount;

    projections.scribing = {
      low: Math.round(codingUplift * 0.5), // conservative
      high: Math.round(codingUplift * 1.2), // optimistic
      description: `${Math.round(b.codingUpliftPercent * 0.8)}-${Math.round(b.codingUpliftPercent * 1.2)}% wRVU increase from improved documentation`,
    };

    projections.timeSaved = {
      hoursPerDay: Math.round((b.timeSavedMinPerPatient * b.patientsPerDay) / 60 * 10) / 10,
      description: `${Math.round(b.timeSavedMinPerPatient)} minutes saved per patient encounter`,
    };
  }

  // Phone AI ROI
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

  // Claims AI ROI
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

  // Prior Auth ROI
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

  // DME ROI (specialty-dependent)
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

  // Calculate totals
  const totalLow = Object.values(projections)
    .filter(p => typeof p.low === "number")
    .reduce((sum, p) => sum + p.low, 0);
  const totalHigh = Object.values(projections)
    .filter(p => typeof p.high === "number")
    .reduce((sum, p) => sum + p.high, 0);

  // Calculate investment
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
        includes: ["Half-day on-site assessment", "AI environment audit", "Detailed ROI projection", "Implementation roadmap", "No commitment to proceed"],
      },
      {
        name: "Assessment + Implementation",
        description: "Full deployment of recommended AI stack",
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

// --- LEAD SCORE BADGE ---
const LeadScoreBadge = ({ score, size = "normal" }) => {
  if (!score && score !== 0) return null;

  const getScoreConfig = (s) => {
    if (s >= 80) return { label: "Hot", color: DS.colors.danger, bg: DS.colors.dangerDim };
    if (s >= 50) return { label: "Warm", color: DS.colors.warn, bg: DS.colors.warnDim };
    return { label: "Cool", color: DS.colors.blue, bg: DS.colors.blueDim };
  };

  const config = getScoreConfig(score);
  const isSmall = size === "small";

  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: isSmall ? "4px" : "6px",
      padding: isSmall ? "2px 6px" : "4px 10px",
      background: config.bg, borderRadius: DS.radius.sm,
      border: `1px solid ${config.color}`,
    }}>
      <span style={{
        fontFamily: DS.fonts.mono, fontSize: isSmall ? "10px" : "12px",
        color: config.color, fontWeight: 600,
      }}>{score}</span>
      <span style={{
        fontSize: isSmall ? "9px" : "10px", color: config.color,
        textTransform: "uppercase", letterSpacing: "0.05em",
      }}>{config.label}</span>
    </div>
  );
};

// --- QUOTE CALCULATOR FUNCTIONS ---
// Supports dynamic pricing from Edge Config with fallback to static PRICING
const calculateQuote = (inputs, config = null) => {
  const {
    providerCount = 1,
    toolsSelected = [],
    ehrComplexity = "standard",
    specialtyComplexity = "standard",
    paymentStructure = "standard",
    waiveAssessment = false,
    discountPercent = 0,
  } = inputs;

  // Use dynamic pricing from Edge Config or fall back to static PRICING
  const pricing = config?.pricing || PRICING;
  const tools = config?.aiTools || AI_TOOLS;

  // Assessment fee
  let assessmentFee = waiveAssessment ? 0 : (pricing.assessment?.base || PRICING.assessment.base);

  // Implementation fee
  let implementationBase = pricing.implementation?.base || PRICING.implementation.base;
  let providerCost = providerCount * (pricing.implementation?.perProvider || PRICING.implementation.perProvider);
  let toolCost = toolsSelected.length * (pricing.implementation?.perTool || PRICING.implementation.perTool);
  let ehrMultiplier = pricing.implementation?.ehrComplexity?.[ehrComplexity] || PRICING.implementation.ehrComplexity[ehrComplexity] || 1;
  let specialtyMultiplier = pricing.implementation?.specialtyComplexity?.[specialtyComplexity] || PRICING.implementation.specialtyComplexity[specialtyComplexity] || 1;

  let implementationFee = (implementationBase + providerCost + toolCost) * ehrMultiplier * specialtyMultiplier;

  // Monthly managed fee
  let monthlyBase = pricing.monthly?.base || PRICING.managed.base;
  let monthlyPerProvider = providerCount * (pricing.monthly?.perProvider || PRICING.managed.perProvider);
  let monthlyFee = monthlyBase + monthlyPerProvider;

  // Tool costs (passed through) - uses dynamic tool pricing
  let monthlyToolCosts = toolsSelected.reduce((sum, toolId) => {
    const tool = tools.find(t => t.id === toolId);
    return sum + (tool?.cost || 0);
  }, 0);

  // Apply discount
  if (discountPercent > 0) {
    const discountMultiplier = 1 - (discountPercent / 100);
    implementationFee *= discountMultiplier;
    // Note: monthly fee typically not discounted
  }

  // Total first year value
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

// --- QUOTE BUILDER COMPONENT ---
const QuoteBuilder = ({ practice, onSave, onCancel }) => {
  const { config } = useConfig();
  const dynamicTools = config?.aiTools || AI_TOOLS;

  const [form, setForm] = useState({
    providerCount: parseInt(practice?.provider_count) || practice?.providers || 1,
    toolsSelected: practice?.ai_stack?.map(t =>
      dynamicTools.find(tool => tool.name === t.name)?.id
    ).filter(Boolean) || [],
    ehrComplexity: "standard",
    specialtyComplexity: practice?.specialty?.toLowerCase().includes("surg") ? "surgical" :
                         practice?.specialty?.toLowerCase().includes("behav") || practice?.specialty?.toLowerCase().includes("psych") ? "behavioral" : "standard",
    paymentStructure: "standard",
    waiveAssessment: false,
    discountPercent: 0,
    discountReason: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Use dynamic pricing from Edge Config
  const quote = calculateQuote(form, config);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const quoteData = {
        practice_id: practice.id,
        provider_count: form.providerCount,
        tools_selected: form.toolsSelected,
        ehr_complexity: form.ehrComplexity,
        specialty_complexity: form.specialtyComplexity,
        payment_structure: form.paymentStructure,
        assessment_fee: quote.assessmentFee,
        assessment_waived: form.waiveAssessment,
        implementation_fee: quote.implementationFee,
        monthly_fee: quote.monthlyFee,
        discount_percent: form.discountPercent,
        discount_reason: form.discountReason,
        total_value: quote.totalValue,
        internal_notes: form.notes,
        status: "draft",
      };

      const { data, error: insertError } = await supabase
        .from("quotes")
        .insert(quoteData)
        .select()
        .single();

      if (insertError) throw insertError;

      onSave(data);
    } catch (err) {
      console.error("Quote save error:", err);
      setError("Failed to save quote");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", background: DS.colors.bg,
    border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
    color: DS.colors.text, fontSize: "14px", outline: "none",
  };

  const labelStyle = {
    display: "block", fontSize: "12px", color: DS.colors.textMuted,
    marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em",
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Left column - Inputs */}
        <div>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Provider Count</label>
            <input
              type="number" min="1" max="50"
              value={form.providerCount}
              onChange={(e) => setForm({ ...form, providerCount: parseInt(e.target.value) || 1 })}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>AI Tools {config?.source === "edge-config" && <span style={{ fontSize: "9px", color: DS.colors.vital }}>(LIVE)</span>}</label>
            <div style={{ display: "grid", gap: "6px" }}>
              {dynamicTools.map((tool) => (
                <label
                  key={tool.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "8px 12px", borderRadius: DS.radius.sm, cursor: "pointer",
                    background: form.toolsSelected.includes(tool.id) ? DS.colors.shockGlow : DS.colors.bg,
                    border: `1px solid ${form.toolsSelected.includes(tool.id) ? DS.colors.shock : DS.colors.border}`,
                  }}
                  onClick={() => setForm({
                    ...form,
                    toolsSelected: form.toolsSelected.includes(tool.id)
                      ? form.toolsSelected.filter(t => t !== tool.id)
                      : [...form.toolsSelected, tool.id]
                  })}
                >
                  <div style={{
                    width: "16px", height: "16px", borderRadius: "3px",
                    border: `2px solid ${form.toolsSelected.includes(tool.id) ? DS.colors.shock : DS.colors.borderLight}`,
                    background: form.toolsSelected.includes(tool.id) ? DS.colors.shock : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: "10px",
                  }}>
                    {form.toolsSelected.includes(tool.id) && "✓"}
                  </div>
                  <span style={{ fontSize: "13px", flex: 1 }}>{tool.name}</span>
                  <span style={{ fontSize: "11px", color: DS.colors.textDim }}>
                    ${tool.cost}/mo
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>EHR Complexity</label>
              <select
                value={form.ehrComplexity}
                onChange={(e) => setForm({ ...form, ehrComplexity: e.target.value })}
                style={inputStyle}
              >
                <option value="standard">Standard (×1.0)</option>
                <option value="moderate">Moderate (×1.25)</option>
                <option value="complex">Complex (×1.5)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Specialty</label>
              <select
                value={form.specialtyComplexity}
                onChange={(e) => setForm({ ...form, specialtyComplexity: e.target.value })}
                style={inputStyle}
              >
                <option value="standard">Standard (×1.0)</option>
                <option value="surgical">Surgical (×1.15)</option>
                <option value="behavioral">Behavioral (×1.15)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Payment Structure</label>
            <select
              value={form.paymentStructure}
              onChange={(e) => setForm({ ...form, paymentStructure: e.target.value })}
              style={inputStyle}
            >
              {Object.entries(PRICING.paymentStructures).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Discount %</label>
              <input
                type="number" min="0" max="50" step="5"
                value={form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Discount Reason</label>
              <input
                type="text" placeholder="e.g., Early adopter"
                value={form.discountReason}
                onChange={(e) => setForm({ ...form, discountReason: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          <label style={{
            display: "flex", alignItems: "center", gap: "8px", cursor: "pointer",
            fontSize: "13px", color: DS.colors.textMuted,
          }}>
            <input
              type="checkbox"
              checked={form.waiveAssessment}
              onChange={(e) => setForm({ ...form, waiveAssessment: e.target.checked })}
            />
            Waive assessment fee (with contract)
          </label>
        </div>

        {/* Right column - Quote Preview */}
        <div>
          <Card style={{ background: DS.colors.bg, marginBottom: "16px" }}>
            <div style={{ fontSize: "11px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
              Quote Preview
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px" }}>Assessment Fee</span>
                <span style={{ fontFamily: DS.fonts.mono, fontSize: "14px", color: form.waiveAssessment ? DS.colors.textDim : DS.colors.text }}>
                  {form.waiveAssessment ? <s>${quote.assessmentFee.toLocaleString()}</s> : `$${quote.assessmentFee.toLocaleString()}`}
                  {form.waiveAssessment && <span style={{ color: DS.colors.vital, marginLeft: "8px" }}>Waived</span>}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px" }}>Implementation Fee</span>
                <span style={{ fontFamily: DS.fonts.mono, fontSize: "14px" }}>
                  ${quote.implementationFee.toLocaleString()}
                </span>
              </div>

              <div style={{ borderTop: `1px solid ${DS.colors.border}`, paddingTop: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "13px" }}>Monthly Managed</span>
                  <span style={{ fontFamily: DS.fonts.mono, fontSize: "14px" }}>
                    ${quote.monthlyFee.toLocaleString()}/mo
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: DS.colors.textMuted }}>+ Tool Costs</span>
                  <span style={{ fontFamily: DS.fonts.mono, fontSize: "14px", color: DS.colors.textMuted }}>
                    ${quote.monthlyToolCosts.toLocaleString()}/mo
                  </span>
                </div>
              </div>

              <div style={{
                borderTop: `1px solid ${DS.colors.shock}`, paddingTop: "12px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontWeight: 600 }}>Total Monthly</span>
                <span style={{ fontFamily: DS.fonts.mono, fontSize: "18px", color: DS.colors.shock, fontWeight: 600 }}>
                  ${quote.totalMonthly.toLocaleString()}/mo
                </span>
              </div>
            </div>

            <div style={{
              marginTop: "20px", padding: "12px", background: DS.colors.bgCard,
              borderRadius: DS.radius.sm, textAlign: "center",
            }}>
              <div style={{ fontSize: "11px", color: DS.colors.textMuted, marginBottom: "4px" }}>
                First Year Value
              </div>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.vital }}>
                ${quote.totalValue.toLocaleString()}
              </div>
            </div>
          </Card>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Internal Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes for internal reference..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", marginBottom: "16px", borderRadius: DS.radius.sm,
          background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "20px" }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary onClick={handleSave} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save Quote"}
        </Button>
      </div>
    </div>
  );
};

// --- PAYMENT STATUS BADGE ---
const PaymentStatusBadge = ({ status }) => {
  const config = {
    none: { color: DS.colors.textDim, bg: DS.colors.bg, label: "No Payment" },
    pending: { color: DS.colors.warn, bg: DS.colors.warnDim, label: "Pending" },
    current: { color: DS.colors.vital, bg: DS.colors.vitalDim, label: "Current" },
    overdue: { color: DS.colors.danger, bg: DS.colors.dangerDim, label: "Overdue" },
    suspended: { color: DS.colors.danger, bg: DS.colors.dangerDim, label: "Suspended" },
  }[status] || { color: DS.colors.textDim, bg: DS.colors.bg, label: status };

  return (
    <span style={{
      display: "inline-flex", padding: "2px 8px", borderRadius: DS.radius.sm,
      fontSize: "10px", fontWeight: 600, textTransform: "uppercase",
      color: config.color, background: config.bg, letterSpacing: "0.05em",
    }}>
      {config.label}
    </span>
  );
};

// --- TASK LIST COMPONENT ---
const TaskList = ({ practiceId, stage }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!isSupabaseConfigured() || !practiceId) {
        setLoading(false);
        return;
      }

      try {
        let query = supabase
          .from("tasks")
          .select("*")
          .eq("practice_id", practiceId)
          .order("created_at", { ascending: true });

        if (stage) {
          query = query.eq("stage", stage);
        }

        const { data, error } = await query;
        if (error) throw error;
        setTasks(data || []);
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [practiceId, stage]);

  const toggleTask = async (taskId, completed) => {
    try {
      await supabase
        .from("tasks")
        .update({
          status: completed ? "completed" : "pending",
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq("id", taskId);

      setTasks(tasks.map(t =>
        t.id === taskId
          ? { ...t, status: completed ? "completed" : "pending", completed_at: completed ? new Date().toISOString() : null }
          : t
      ));
    } catch (err) {
      console.error("Error updating task:", err);
    }
  };

  if (loading) return <div style={{ color: DS.colors.textMuted, fontSize: "13px" }}>Loading tasks...</div>;
  if (tasks.length === 0) return null;

  const pendingTasks = tasks.filter(t => t.status !== "completed");
  const completedTasks = tasks.filter(t => t.status === "completed");

  return (
    <Card style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ fontWeight: 600, fontSize: "13px" }}>Tasks</div>
        <span style={{ fontSize: "11px", color: DS.colors.textMuted }}>
          {completedTasks.length}/{tasks.length} done
        </span>
      </div>

      <div style={{ display: "grid", gap: "6px" }}>
        {pendingTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => toggleTask(task.id, true)}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "8px 10px", borderRadius: DS.radius.sm, cursor: "pointer",
              background: DS.colors.bg, border: `1px solid ${DS.colors.border}`,
              transition: "all 0.2s",
            }}
          >
            <div style={{
              width: "16px", height: "16px", borderRadius: "4px",
              border: `2px solid ${task.priority === "urgent" ? DS.colors.danger : task.priority === "high" ? DS.colors.warn : DS.colors.borderLight}`,
            }} />
            <span style={{ fontSize: "13px", flex: 1 }}>{task.title}</span>
            {task.priority === "urgent" && (
              <span style={{ fontSize: "10px", color: DS.colors.danger, fontWeight: 600 }}>URGENT</span>
            )}
          </div>
        ))}

        {completedTasks.length > 0 && (
          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: `1px solid ${DS.colors.border}` }}>
            <div style={{ fontSize: "11px", color: DS.colors.textDim, marginBottom: "6px" }}>Completed</div>
            {completedTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id, false)}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "6px 10px", cursor: "pointer", opacity: 0.6,
                }}
              >
                <div style={{
                  width: "16px", height: "16px", borderRadius: "4px",
                  background: DS.colors.vital, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: "10px",
                }}>✓</div>
                <span style={{ fontSize: "12px", textDecoration: "line-through" }}>{task.title}</span>
              </div>
            ))}
            {completedTasks.length > 3 && (
              <div style={{ fontSize: "11px", color: DS.colors.textDim, padding: "4px 10px" }}>
                +{completedTasks.length - 3} more completed
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

// --- FINANCIAL SUMMARY CARD ---
const FinancialSummaryCard = ({ practices }) => {
  const managed = practices.filter(p => p.stage === "managed");
  const monthlyRevenue = managed.reduce((sum, p) => sum + (p.monthly_rate || 0), 0);
  const totalValue = managed.reduce((sum, p) => sum + (p.total_value_delivered || 0), 0);

  return (
    <Card style={{ marginBottom: "16px" }}>
      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Revenue</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", color: DS.colors.textMuted, marginBottom: "4px" }}>MRR</div>
          <div style={{ fontFamily: DS.fonts.display, fontSize: "24px", color: DS.colors.vital }}>
            ${monthlyRevenue.toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: DS.colors.textMuted, marginBottom: "4px" }}>ARR</div>
          <div style={{ fontFamily: DS.fonts.display, fontSize: "24px", color: DS.colors.vital }}>
            ${(monthlyRevenue * 12).toLocaleString()}
          </div>
        </div>
      </div>
      <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: `1px solid ${DS.colors.border}` }}>
        <div style={{ fontSize: "11px", color: DS.colors.textMuted, marginBottom: "4px" }}>Total Value Delivered</div>
        <div style={{ fontFamily: DS.fonts.display, fontSize: "20px", color: DS.colors.shock }}>
          ${totalValue.toLocaleString()}
        </div>
      </div>
    </Card>
  );
};

// --- REFERRAL CODE DISPLAY ---
const ReferralCodeCard = ({ referralCode, credits = 0 }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(`https://de-fyb.vercel.app/?ref=${referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>Referral Program</div>
      <div style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "12px", background: DS.colors.bg, borderRadius: DS.radius.sm,
        marginBottom: "12px",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", color: DS.colors.textMuted, marginBottom: "4px" }}>Your Code</div>
          <div style={{ fontFamily: DS.fonts.mono, fontSize: "16px", color: DS.colors.shock }}>
            {referralCode}
          </div>
        </div>
        <Button small onClick={copyCode}>
          {copied ? "Copied!" : "Copy Link"}
        </Button>
      </div>
      {credits > 0 && (
        <div style={{ fontSize: "13px", color: DS.colors.vital }}>
          Credits earned: ${credits.toLocaleString()}
        </div>
      )}
    </Card>
  );
};

// --- QUOTES LIST COMPONENT ---
const QuotesList = ({ practiceId, onSelect }) => {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!isSupabaseConfigured() || !practiceId) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("quotes")
          .select("*")
          .eq("practice_id", practiceId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setQuotes(data || []);
      } catch (err) {
        console.error("Error fetching quotes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
  }, [practiceId]);

  if (loading) return <div style={{ color: DS.colors.textMuted, fontSize: "13px" }}>Loading quotes...</div>;
  if (quotes.length === 0) return null;

  const statusColors = {
    draft: DS.colors.textDim,
    sent: DS.colors.blue,
    viewed: DS.colors.warn,
    accepted: DS.colors.vital,
    rejected: DS.colors.danger,
    expired: DS.colors.textDim,
  };

  return (
    <Card style={{ marginBottom: "16px" }}>
      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>Quotes</div>
      <div style={{ display: "grid", gap: "8px" }}>
        {quotes.map((quote) => (
          <div
            key={quote.id}
            onClick={() => onSelect?.(quote)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px", background: DS.colors.bg, borderRadius: DS.radius.sm,
              cursor: "pointer", border: `1px solid ${DS.colors.border}`,
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 500 }}>
                Quote v{quote.version}
              </div>
              <div style={{ fontSize: "11px", color: DS.colors.textMuted }}>
                {new Date(quote.created_at).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px" }}>
                ${quote.total_value?.toLocaleString()}
              </span>
              <span style={{
                fontSize: "10px", fontWeight: 600, textTransform: "uppercase",
                color: statusColors[quote.status], letterSpacing: "0.05em",
              }}>
                {quote.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// --- DOCUMENT PDF GENERATOR (using jsPDF) ---
const generateQuotePDF = async (quote, practice) => {
  // Dynamic import for jsPDF
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

// --- MONTHLY SCORECARD GENERATOR (Enhanced Before/After) ---
const generateScorecardPDF = async (practice) => {
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

  // Helper: Draw progress bar
  const drawProgressBar = (x, y, width, height, percent, color) => {
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(x, y, width, height, 2, 2, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(x, y, width * Math.min(percent / 100, 1), height, 2, 2, 'F');
  };

  // Helper: Calculate improvement percentage
  const calcImprovement = (baseline, current, inverse = false) => {
    if (!baseline || !current) return null;
    const change = inverse ? (baseline - current) / baseline : (current - baseline) / baseline;
    return Math.round(change * 100);
  };

  // ============ PAGE 1: SUMMARY ============
  // Header
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

  // Health score circle (simulated)
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
    { label: "AI Tools Active", value: (practice.ai_stack || practice.stack || []).filter(t => t.status === "active").length.toString() },
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

      // Category indicator
      const categoryColor = m.category === "time" ? blue : green;
      doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2]);
      doc.circle(25, y + 2, 2, 'F');

      // Label
      doc.setTextColor(60, 60, 60);
      doc.text(m.label, 30, y + 3);

      // Baseline value
      doc.setTextColor(gray[0], gray[1], gray[2]);
      doc.text(m.baseline != null ? `${m.baseline}${m.unit}` : "—", 105, y + 3);

      // Arrow
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text("→", 132, y + 3);

      // Current value
      const currentColor = m.current != null ? (hasImproved ? green : [60, 60, 60]) : gray;
      doc.setTextColor(currentColor[0], currentColor[1], currentColor[2]);
      doc.text(m.current != null ? `${m.current}${m.unit}` : "—", 145, y + 3);

      // Improvement badge
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

  // Monthly value box
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

  // Projected annual value box
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
  doc.text("AI Stack Status", 20, y);
  y += 10;

  const stack = practice.ai_stack || practice.stack || [];
  doc.setFontSize(9);

  if (stack.length === 0) {
    doc.setTextColor(...gray);
    doc.text("No AI tools deployed yet", 20, y);
  } else {
    stack.forEach((tool) => {
      const statusColor = tool.status === "active" ? green : tool.status === "deploying" ? [245, 158, 11] : gray;

      // Status indicator
      doc.setFillColor(...statusColor);
      doc.circle(25, y + 1, 3, 'F');

      // Tool name
      doc.setTextColor(60, 60, 60);
      doc.text(tool.name, 32, y + 3);

      // Status text
      doc.setTextColor(...statusColor);
      doc.text(tool.status.toUpperCase(), 120, y + 3);

      // Since date
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

  // Legend
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

// --- PROPOSAL PDF GENERATOR ---
const generateProposalPDF = async (proposal) => {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Helper for text wrapping
  const addWrappedText = (text, x, y, maxWidth, lineHeight = 5) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line, i) => {
      doc.text(line, x, y + (i * lineHeight));
    });
    return y + (lines.length * lineHeight);
  };

  // ===== PAGE 1: COVER =====
  // Header
  doc.setFontSize(28);
  doc.setTextColor(232, 118, 43);
  doc.text("DeFyb", 20, 30);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Practice Transformation Proposal", 20, 38);

  // Practice name
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

  // Date
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
  doc.text("Recommended AI Stack", 20, 25);

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
    doc.setTextColor(52, 211, 153); // Green
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

  // Time saved
  if (proposal.totals.timeSavedPerDay > 0) {
    y += 15;
    doc.setFontSize(11);
    doc.setTextColor(96, 165, 250); // Blue
    doc.text(`Plus: ${proposal.totals.timeSavedPerDay} hours/day saved per provider`, 20, y);
  }

  // ===== PAGE 3: INVESTMENT OPTIONS =====
  doc.addPage();

  doc.setFontSize(18);
  doc.setTextColor(232, 118, 43);
  doc.text("Investment Options", 20, 25);

  y = 45;

  proposal.tiers.forEach((tier, i) => {
    // Tier box
    doc.setDrawColor(200);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(20, y - 5, pageWidth - 40, tier.priceMonthly ? 65 : 55, 3, 3, "FD");

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(tier.name, 25, y + 5);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(tier.description, 25, y + 13);

    // Price
    doc.setFontSize(16);
    doc.setTextColor(232, 118, 43);
    if (tier.priceMonthly) {
      doc.text(`$${tier.priceUpfront.toLocaleString()} + $${tier.priceMonthly.toLocaleString()}/mo`, pageWidth - 100, y + 5);
    } else {
      doc.text(`$${tier.price.toLocaleString()}`, pageWidth - 60, y + 5);
    }

    // Includes
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
    { num: "1", title: "Schedule Assessment", desc: "Half-day on-site to capture baseline metrics and conduct AI environment audit." },
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

// --- PROPOSAL GENERATOR COMPONENT ---
const ProposalGenerator = ({ practice, onClose }) => {
  const [proposal, setProposal] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (practice) {
      const proj = calculateROIProjection(practice);
      setProposal(proj);
    }
  }, [practice]);

  const handleDownload = async () => {
    if (!proposal) return;
    setGenerating(true);
    try {
      await generateProposalPDF(proposal);
    } finally {
      setGenerating(false);
    }
  };

  if (!proposal) return null;

  return (
    <div style={{ maxHeight: "80vh", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h3 style={{ fontFamily: DS.fonts.display, fontSize: "24px", marginBottom: "8px" }}>
          Proposal for {proposal.practice.name}
        </h3>
        <p style={{ color: DS.colors.textMuted, fontSize: "14px" }}>
          {proposal.practice.providerCount} providers • {proposal.practice.specialty}
        </p>
      </div>

      {/* Recommended Tools */}
      <div style={{ marginBottom: "24px" }}>
        <h4 style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.06em", color: DS.colors.textMuted, marginBottom: "12px" }}>
          Recommended AI Stack
        </h4>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {proposal.recommendedTools.map((tool) => (
            <div key={tool.id} style={{
              padding: "8px 14px", background: DS.colors.bg, border: `1px solid ${DS.colors.border}`,
              borderRadius: DS.radius.sm, fontSize: "13px",
            }}>
              <span style={{ fontWeight: 500 }}>{tool.name}</span>
              <span style={{ color: DS.colors.textMuted, marginLeft: "8px" }}>
                {tool.cost > 0 ? `$${tool.cost}/mo` : "Included"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ROI Projections */}
      <div style={{ marginBottom: "24px" }}>
        <h4 style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.06em", color: DS.colors.textMuted, marginBottom: "12px" }}>
          Projected Annual Return
        </h4>
        <div style={{ background: DS.colors.bg, borderRadius: DS.radius.md, padding: "16px" }}>
          {Object.entries(proposal.projections)
            .filter(([key, val]) => val.high > 0)
            .map(([key, val]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${DS.colors.border}` }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500, textTransform: "capitalize" }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>{val.description}</div>
                </div>
                <div style={{ fontFamily: DS.fonts.mono, color: DS.colors.vital, fontSize: "14px" }}>
                  ${val.low.toLocaleString()} - ${val.high.toLocaleString()}
                </div>
              </div>
            ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0 0", marginTop: "8px" }}>
            <div style={{ fontSize: "16px", fontWeight: 600 }}>Total Projected Return</div>
            <div style={{ fontFamily: DS.fonts.display, fontSize: "20px", color: DS.colors.vital }}>
              ${proposal.totals.low.toLocaleString()} - ${proposal.totals.high.toLocaleString()}
            </div>
          </div>
        </div>

        {proposal.totals.timeSavedPerDay > 0 && (
          <div style={{ marginTop: "12px", padding: "12px 16px", background: DS.colors.blueDim, borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.blue}44` }}>
            <span style={{ color: DS.colors.blue, fontWeight: 500 }}>
              ⏱ Plus {proposal.totals.timeSavedPerDay} hours/day saved per provider
            </span>
          </div>
        )}
      </div>

      {/* Investment Tiers */}
      <div style={{ marginBottom: "24px" }}>
        <h4 style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.06em", color: DS.colors.textMuted, marginBottom: "12px" }}>
          Investment Options
        </h4>
        <div style={{ display: "grid", gap: "12px" }}>
          {proposal.tiers.map((tier, i) => (
            <div key={i} style={{
              padding: "16px", background: DS.colors.bg, borderRadius: DS.radius.md,
              border: `1px solid ${i === 2 ? DS.colors.shock : DS.colors.border}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 600 }}>{tier.name}</div>
                  <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>{tier.description}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {tier.priceMonthly ? (
                    <>
                      <div style={{ fontFamily: DS.fonts.display, fontSize: "18px", color: DS.colors.shock }}>
                        ${tier.priceUpfront.toLocaleString()}
                      </div>
                      <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                        + ${tier.priceMonthly.toLocaleString()}/mo
                      </div>
                    </>
                  ) : (
                    <div style={{ fontFamily: DS.fonts.display, fontSize: "18px", color: DS.colors.shock }}>
                      ${tier.price.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                {tier.includes.slice(0, 3).join(" • ")}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ROI Summary */}
      <div style={{
        padding: "20px", background: `${DS.colors.vital}11`, borderRadius: DS.radius.lg,
        border: `1px solid ${DS.colors.vital}33`, marginBottom: "24px",
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", textAlign: "center" }}>
          <div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>First Year Investment</div>
            <div style={{ fontFamily: DS.fonts.display, fontSize: "20px" }}>${proposal.investment.totalFirstYear.toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Projected Return</div>
            <div style={{ fontFamily: DS.fonts.display, fontSize: "20px", color: DS.colors.vital }}>
              ${proposal.totals.low.toLocaleString()}+
            </div>
          </div>
          <div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Expected ROI</div>
            <div style={{ fontFamily: DS.fonts.display, fontSize: "20px", color: DS.colors.shock }}>
              {proposal.investment.roiLow}x - {proposal.investment.roiHigh}x
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "12px" }}>
        <Button primary onClick={handleDownload} style={{ flex: 1 }}>
          {generating ? "Generating..." : "📄 Download Proposal PDF"}
        </Button>
        <Button onClick={onClose}>Close</Button>
      </div>
    </div>
  );
};

// --- MODAL COMPONENT ---
const Modal = ({ open, onClose, title, children, width = "500px" }) => {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px", animation: "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: DS.colors.bgCard, borderRadius: DS.radius.lg,
          border: `1px solid ${DS.colors.border}`, width: "100%", maxWidth: width,
          maxHeight: "90vh", overflow: "auto", animation: "fadeUp 0.3s ease",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px", borderBottom: `1px solid ${DS.colors.border}`,
        }}>
          <h3 style={{ fontFamily: DS.fonts.display, fontSize: "20px", fontWeight: 400 }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "20px", color: DS.colors.textMuted, padding: "4px",
          }}>×</button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );
};

// --- BASELINE ASSESSMENT FORM (Expanded with Time, Money, Risk metrics) ---
const BaselineAssessmentForm = ({ practice, onSave, onCancel }) => {
  const [activeTab, setActiveTab] = useState("time");
  const [form, setForm] = useState({
    // TIME metrics
    doc_time_baseline: practice?.doc_time_baseline || "",
    pajama_time_baseline: practice?.pajama_time_baseline || "",
    coding_review_time_baseline: practice?.coding_review_time_baseline || "",
    pa_staff_hours_baseline: practice?.pa_staff_hours_baseline || "",
    peer_to_peer_calls_baseline: practice?.peer_to_peer_calls_baseline || "",
    patients_per_day: practice?.patients_per_day || "",
    hours_worked_weekly: practice?.hours_worked_weekly || "",
    // MONEY metrics
    has_coder: practice?.has_coder || false,
    coder_annual_cost: practice?.coder_annual_cost || "",
    em_coding_distribution: practice?.em_coding_distribution || { level3: "", level4: "", level5: "" },
    em_reimbursement_99213: practice?.em_reimbursement_99213 || "",
    em_reimbursement_99214: practice?.em_reimbursement_99214 || "",
    em_reimbursement_99215: practice?.em_reimbursement_99215 || "",
    avg_reimbursement_per_visit: practice?.avg_reimbursement_per_visit || "",
    denial_rate_baseline: practice?.denial_rate_baseline || "",
    days_in_ar_baseline: practice?.days_in_ar_baseline || "",
    call_answer_rate_baseline: practice?.call_answer_rate_baseline || "",
    // RISK metrics
    tribal_knowledge: practice?.tribal_knowledge || {
      pa_requirements: "",
      billing_exceptions: "",
      ehr_workarounds: "",
      coding_rules: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [roiPreview, setRoiPreview] = useState(null);

  // Calculate ROI preview when form changes
  useEffect(() => {
    const roi = calculateBaselineROI(form, practice);
    setRoiPreview(roi);
  }, [form, practice]);

  const handleSubmit = async () => {
    // Validate minimum required fields
    const required = ["doc_time_baseline", "patients_per_day"];
    const missing = required.filter(key => !form[key] && form[key] !== 0);

    if (missing.length > 0) {
      setError("Please fill in at least documentation time and patients per day");
      return;
    }

    // Validate E/M distribution adds up if provided
    const em = form.em_coding_distribution;
    const emSum = (parseFloat(em.level3) || 0) + (parseFloat(em.level4) || 0) + (parseFloat(em.level5) || 0);
    if (emSum > 0 && Math.abs(emSum - 100) > 0.1) {
      setError("E/M coding distribution should add up to 100%");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Calculate and store ROI projections
      const roiProjections = calculateBaselineROI(form, practice);

      const { error: updateError } = await supabase
        .from("practices")
        .update({
          // TIME metrics
          doc_time_baseline: parseFloat(form.doc_time_baseline) || null,
          pajama_time_baseline: parseFloat(form.pajama_time_baseline) || null,
          coding_review_time_baseline: parseFloat(form.coding_review_time_baseline) || null,
          pa_staff_hours_baseline: parseFloat(form.pa_staff_hours_baseline) || null,
          peer_to_peer_calls_baseline: parseFloat(form.peer_to_peer_calls_baseline) || null,
          patients_per_day: parseFloat(form.patients_per_day) || null,
          hours_worked_weekly: parseFloat(form.hours_worked_weekly) || null,
          // MONEY metrics
          has_coder: form.has_coder,
          coder_annual_cost: parseFloat(form.coder_annual_cost) || null,
          em_coding_distribution: emSum > 0 ? {
            level3: parseFloat(em.level3) || 0,
            level4: parseFloat(em.level4) || 0,
            level5: parseFloat(em.level5) || 0,
          } : null,
          em_reimbursement_99213: parseFloat(form.em_reimbursement_99213) || null,
          em_reimbursement_99214: parseFloat(form.em_reimbursement_99214) || null,
          em_reimbursement_99215: parseFloat(form.em_reimbursement_99215) || null,
          avg_reimbursement_per_visit: parseFloat(form.avg_reimbursement_per_visit) || null,
          denial_rate_baseline: parseFloat(form.denial_rate_baseline) || null,
          days_in_ar_baseline: parseFloat(form.days_in_ar_baseline) || null,
          call_answer_rate_baseline: parseFloat(form.call_answer_rate_baseline) || null,
          // RISK metrics
          tribal_knowledge: form.tribal_knowledge,
          // ROI projections
          roi_projections: roiProjections,
          // Stage update
          stage: "assessment",
          portal_enabled: true,
        })
        .eq("id", practice.id);

      if (updateError) throw updateError;

      // Create notification
      await supabase.from("notifications").insert({
        practice_id: practice.id,
        user_type: "client",
        type: "stage_change",
        title: "Assessment Started",
        message: "Your DeFyb assessment is now underway. We'll be analyzing your baseline data to build your transformation plan.",
      });

      onSave();
    } catch (err) {
      console.error("Baseline save error:", err);
      setError("Failed to save baseline data");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", background: DS.colors.bg,
    border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
    color: DS.colors.text, fontSize: "14px", outline: "none",
  };

  const labelStyle = {
    display: "block", fontSize: "12px", color: DS.colors.textMuted,
    marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em",
  };

  const tabs = [
    { key: "time", label: "Time", icon: "⏱", color: DS.colors.blue },
    { key: "money", label: "Money", icon: "💰", color: DS.colors.vital },
    { key: "risk", label: "Risk", icon: "⚠️", color: DS.colors.warn },
    { key: "roi", label: "ROI Preview", icon: "📊", color: DS.colors.shock },
  ];

  return (
    <div>
      <p style={{ fontSize: "14px", color: DS.colors.textMuted, marginBottom: "20px" }}>
        Capture baseline metrics across Time, Money, and Risk categories. These establish the foundation for measuring ROI.
      </p>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: `1px solid ${DS.colors.border}`, paddingBottom: "8px" }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px", background: activeTab === tab.key ? DS.colors.bgCard : "transparent",
              border: `1px solid ${activeTab === tab.key ? tab.color : "transparent"}`,
              borderRadius: DS.radius.sm, cursor: "pointer", fontFamily: DS.fonts.body,
              fontSize: "13px", fontWeight: 500,
              color: activeTab === tab.key ? tab.color : DS.colors.textMuted,
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TIME Tab */}
      {activeTab === "time" && (
        <div className="fade-in">
          <div style={{ padding: "12px 16px", background: DS.colors.blueDim, borderRadius: DS.radius.sm, marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", color: DS.colors.blue, fontWeight: 500 }}>Time Metrics</div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>How much time is spent on non-patient activities?</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Doc time per patient (min) <span style={{ color: DS.colors.shock }}>*</span></label>
              <input type="number" step="0.5" placeholder="e.g., 16" value={form.doc_time_baseline}
                onChange={(e) => setForm({ ...form, doc_time_baseline: e.target.value })} style={inputStyle} />
              <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "4px" }}>Time spent documenting each patient visit</div>
            </div>
            <div>
              <label style={labelStyle}>Pajama Time (hrs/week)</label>
              <input type="number" step="0.5" placeholder="e.g., 8" value={form.pajama_time_baseline}
                onChange={(e) => setForm({ ...form, pajama_time_baseline: e.target.value })} style={inputStyle} />
              <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "4px" }}>After-hours charting at home</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Coding Review Time (min/encounter)</label>
              <input type="number" step="0.5" placeholder="e.g., 3" value={form.coding_review_time_baseline}
                onChange={(e) => setForm({ ...form, coding_review_time_baseline: e.target.value })} style={inputStyle} />
              <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "4px" }}>Time provider/coder spends reviewing codes</div>
            </div>
            <div>
              <label style={labelStyle}>PA Staff Hours (hrs/week)</label>
              <input type="number" step="0.5" placeholder="e.g., 14" value={form.pa_staff_hours_baseline}
                onChange={(e) => setForm({ ...form, pa_staff_hours_baseline: e.target.value })} style={inputStyle} />
              <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "4px" }}>Staff time on prior authorizations</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Peer-to-Peer Calls/week</label>
              <input type="number" step="1" placeholder="e.g., 5" value={form.peer_to_peer_calls_baseline}
                onChange={(e) => setForm({ ...form, peer_to_peer_calls_baseline: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Patients per day <span style={{ color: DS.colors.shock }}>*</span></label>
              <input type="number" step="1" placeholder="e.g., 20" value={form.patients_per_day}
                onChange={(e) => setForm({ ...form, patients_per_day: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hours worked/week</label>
              <input type="number" step="1" placeholder="e.g., 55" value={form.hours_worked_weekly}
                onChange={(e) => setForm({ ...form, hours_worked_weekly: e.target.value })} style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      {/* MONEY Tab */}
      {activeTab === "money" && (
        <div className="fade-in">
          <div style={{ padding: "12px 16px", background: DS.colors.vitalDim, borderRadius: DS.radius.sm, marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", color: DS.colors.vital, fontWeight: 500 }}>Money Metrics</div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>Revenue capture, coding, and collection efficiency</div>
          </div>

          {/* Coder Section */}
          <div style={{ padding: "16px", background: DS.colors.bgCard, borderRadius: DS.radius.md, marginBottom: "16px", border: `1px solid ${DS.colors.border}` }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", marginBottom: form.has_coder ? "12px" : 0 }}>
              <input type="checkbox" checked={form.has_coder}
                onChange={(e) => setForm({ ...form, has_coder: e.target.checked })}
                style={{ width: "18px", height: "18px", accentColor: DS.colors.shock }} />
              <span style={{ fontSize: "14px", fontWeight: 500 }}>Practice employs a coder</span>
            </label>
            {form.has_coder && (
              <div style={{ marginLeft: "26px" }}>
                <label style={labelStyle}>Annual Coder Cost</label>
                <input type="number" step="1000" placeholder="e.g., 55000" value={form.coder_annual_cost}
                  onChange={(e) => setForm({ ...form, coder_annual_cost: e.target.value })}
                  style={{ ...inputStyle, maxWidth: "200px" }} />
              </div>
            )}
          </div>

          {/* E/M Distribution */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ ...labelStyle, marginBottom: "8px" }}>E/M Coding Distribution (%)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Level 3 (99213)</label>
                <input type="number" step="1" placeholder="e.g., 45" value={form.em_coding_distribution.level3}
                  onChange={(e) => setForm({ ...form, em_coding_distribution: { ...form.em_coding_distribution, level3: e.target.value }})}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Level 4 (99214)</label>
                <input type="number" step="1" placeholder="e.g., 40" value={form.em_coding_distribution.level4}
                  onChange={(e) => setForm({ ...form, em_coding_distribution: { ...form.em_coding_distribution, level4: e.target.value }})}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Level 5 (99215)</label>
                <input type="number" step="1" placeholder="e.g., 15" value={form.em_coding_distribution.level5}
                  onChange={(e) => setForm({ ...form, em_coding_distribution: { ...form.em_coding_distribution, level5: e.target.value }})}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "6px" }}>
              Current total: {((parseFloat(form.em_coding_distribution.level3) || 0) + (parseFloat(form.em_coding_distribution.level4) || 0) + (parseFloat(form.em_coding_distribution.level5) || 0))}%
            </div>
          </div>

          {/* Reimbursement Rates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Avg $ 99213</label>
              <input type="number" step="1" placeholder="e.g., 95" value={form.em_reimbursement_99213}
                onChange={(e) => setForm({ ...form, em_reimbursement_99213: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Avg $ 99214</label>
              <input type="number" step="1" placeholder="e.g., 135" value={form.em_reimbursement_99214}
                onChange={(e) => setForm({ ...form, em_reimbursement_99214: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Avg $ 99215</label>
              <input type="number" step="1" placeholder="e.g., 185" value={form.em_reimbursement_99215}
                onChange={(e) => setForm({ ...form, em_reimbursement_99215: e.target.value })} style={inputStyle} />
            </div>
          </div>

          {/* Other Money Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Avg $/visit</label>
              <input type="number" step="1" placeholder="e.g., 125" value={form.avg_reimbursement_per_visit}
                onChange={(e) => setForm({ ...form, avg_reimbursement_per_visit: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Denial Rate (%)</label>
              <input type="number" step="0.1" placeholder="e.g., 11" value={form.denial_rate_baseline}
                onChange={(e) => setForm({ ...form, denial_rate_baseline: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Days in A/R</label>
              <input type="number" step="1" placeholder="e.g., 45" value={form.days_in_ar_baseline}
                onChange={(e) => setForm({ ...form, days_in_ar_baseline: e.target.value })} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={labelStyle}>Call Answer Rate (%)</label>
            <input type="number" step="1" placeholder="e.g., 54" value={form.call_answer_rate_baseline}
              onChange={(e) => setForm({ ...form, call_answer_rate_baseline: e.target.value })}
              style={{ ...inputStyle, maxWidth: "200px" }} />
            <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "4px" }}>% of incoming calls answered by staff</div>
          </div>
        </div>
      )}

      {/* RISK Tab */}
      {activeTab === "risk" && (
        <div className="fade-in">
          <div style={{ padding: "12px 16px", background: DS.colors.warnDim, borderRadius: DS.radius.sm, marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", color: DS.colors.warn, fontWeight: 500 }}>Risk Metrics - Tribal Knowledge Inventory</div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>Who holds critical knowledge? What happens if they leave?</div>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Who knows PA requirements for each payer?</label>
              <input type="text" placeholder="e.g., Mary in billing, been here 12 years" value={form.tribal_knowledge.pa_requirements}
                onChange={(e) => setForm({ ...form, tribal_knowledge: { ...form.tribal_knowledge, pa_requirements: e.target.value }})}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Who knows billing exceptions & workarounds?</label>
              <input type="text" placeholder="e.g., John, but nothing is documented" value={form.tribal_knowledge.billing_exceptions}
                onChange={(e) => setForm({ ...form, tribal_knowledge: { ...form.tribal_knowledge, billing_exceptions: e.target.value }})}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Who knows EHR workarounds & shortcuts?</label>
              <input type="text" placeholder="e.g., Dr. Smith and the MA staff" value={form.tribal_knowledge.ehr_workarounds}
                onChange={(e) => setForm({ ...form, tribal_knowledge: { ...form.tribal_knowledge, ehr_workarounds: e.target.value }})}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Who knows specialty coding rules?</label>
              <input type="text" placeholder="e.g., External coder, $55k/year" value={form.tribal_knowledge.coding_rules}
                onChange={(e) => setForm({ ...form, tribal_knowledge: { ...form.tribal_knowledge, coding_rules: e.target.value }})}
                style={inputStyle} />
            </div>
          </div>

          <div style={{ marginTop: "20px", padding: "16px", background: DS.colors.bgCard, borderRadius: DS.radius.md, border: `1px solid ${DS.colors.border}` }}>
            <div style={{ fontSize: "12px", color: DS.colors.textDim, marginBottom: "8px" }}>RISK ASSESSMENT</div>
            <div style={{ fontSize: "14px", color: DS.colors.text }}>
              {Object.values(form.tribal_knowledge).filter(v => v && v.toLowerCase().includes("not documented")).length > 0
                ? "High risk - undocumented tribal knowledge identified"
                : Object.values(form.tribal_knowledge).filter(v => v).length > 2
                  ? "Moderate risk - knowledge concentrated in few individuals"
                  : "Assessment incomplete - fill in tribal knowledge fields"}
            </div>
          </div>
        </div>
      )}

      {/* ROI Preview Tab */}
      {activeTab === "roi" && roiPreview && (
        <div className="fade-in">
          <div style={{ padding: "12px 16px", background: DS.colors.shockGlow, borderRadius: DS.radius.sm, marginBottom: "20px" }}>
            <div style={{ fontSize: "13px", color: DS.colors.shock, fontWeight: 500 }}>ROI Projection Preview</div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>Based on the baseline data entered so far</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
            <MetricCard label="Time Saved/Year" value={`${roiPreview.timeSavedAnnualHours}h`} color={DS.colors.blue} />
            <MetricCard label="Time Value" value={`$${(roiPreview.timeSavedAnnualValue / 1000).toFixed(0)}k`} color={DS.colors.blue} />
            <MetricCard label="Coding Uplift" value={`$${(roiPreview.codingUpliftAnnual / 1000).toFixed(0)}k`} color={DS.colors.vital} />
            <MetricCard label="Total Annual ROI" value={`$${(roiPreview.totalAnnualValue / 1000).toFixed(0)}k`} color={DS.colors.shock} />
          </div>

          <div style={{ padding: "16px", background: DS.colors.bgCard, borderRadius: DS.radius.md, border: `1px solid ${DS.colors.border}` }}>
            <div style={{ fontSize: "12px", color: DS.colors.textDim, marginBottom: "12px" }}>BREAKDOWN</div>
            {roiPreview.breakdown.map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < roiPreview.breakdown.length - 1 ? `1px solid ${DS.colors.border}` : "none" }}>
                <span style={{ fontSize: "13px", color: DS.colors.textMuted }}>{item.label}</span>
                <span style={{ fontSize: "13px", color: item.value > 0 ? DS.colors.vital : DS.colors.textDim, fontFamily: DS.fonts.mono }}>
                  {item.value > 0 ? `+$${item.value.toLocaleString()}` : "$0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: "12px 16px", marginTop: "16px", borderRadius: DS.radius.sm,
          background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary onClick={handleSubmit} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save & Move to Assessment"}
        </Button>
      </div>
    </div>
  );
};

// --- ROI CALCULATOR FROM BASELINE DATA ---
const calculateBaselineROI = (form, practice) => {
  const providerCount = parseInt(practice?.provider_count?.replace?.(/[^0-9]/g, '') || "3") || 3;
  const patientsPerDay = parseFloat(form.patients_per_day) || 20;
  const docTimeBaseline = parseFloat(form.doc_time_baseline) || 16;
  const pajamaTimeBaseline = parseFloat(form.pajama_time_baseline) || 0;
  const hasCoder = form.has_coder;
  const coderCost = parseFloat(form.coder_annual_cost) || 0;
  const denialRate = parseFloat(form.denial_rate_baseline) || 10;
  const avgReimbursement = parseFloat(form.avg_reimbursement_per_visit) || 125;
  const workDays = 250;
  const providerHourlyValue = 200;

  // Time savings from AI scribe
  const docTimeSaved = Math.max(0, docTimeBaseline - 3); // Assume 3 min with AI
  const timeSavedMinPerDay = docTimeSaved * patientsPerDay;
  const timeSavedHoursPerYear = (timeSavedMinPerDay / 60) * workDays * providerCount;
  const timeSavedAnnualValue = timeSavedHoursPerYear * providerHourlyValue;

  // Pajama time savings
  const pajamaTimeSavedHours = pajamaTimeBaseline * 50 * providerCount; // 50 weeks
  const pajamaTimeSavedValue = pajamaTimeSavedHours * providerHourlyValue;

  // Coding uplift from better documentation (conservative 10% shift from 99213 to 99214/99215)
  const em = form.em_coding_distribution;
  const level3Pct = parseFloat(em?.level3) || 45;
  const level4Pct = parseFloat(em?.level4) || 40;
  const level5Pct = parseFloat(em?.level5) || 15;
  const reimbursement3 = parseFloat(form.em_reimbursement_99213) || 95;
  const reimbursement4 = parseFloat(form.em_reimbursement_99214) || 135;
  const reimbursement5 = parseFloat(form.em_reimbursement_99215) || 185;

  const totalVisits = patientsPerDay * workDays * providerCount;
  const currentRevenue = totalVisits * ((level3Pct/100 * reimbursement3) + (level4Pct/100 * reimbursement4) + (level5Pct/100 * reimbursement5));

  // Assume 10% uplift from better coding
  const upliftPct = 0.10;
  const newLevel3 = Math.max(0, level3Pct - 10);
  const newLevel4 = level4Pct + 5;
  const newLevel5 = level5Pct + 5;
  const newRevenue = totalVisits * ((newLevel3/100 * reimbursement3) + (newLevel4/100 * reimbursement4) + (newLevel5/100 * reimbursement5));
  const codingUpliftAnnual = newRevenue - currentRevenue;

  // Coder replacement savings (if applicable)
  const coderSavings = hasCoder ? coderCost * 0.5 : 0; // Assume 50% reduction in coder needs

  // Denial reduction (assume 50% reduction in denials)
  const totalClaims = patientsPerDay * workDays * providerCount;
  const denialReduction = (denialRate / 100) * 0.5 * totalClaims * avgReimbursement;

  const totalAnnualValue = timeSavedAnnualValue + pajamaTimeSavedValue + codingUpliftAnnual + coderSavings + denialReduction;

  return {
    timeSavedAnnualHours: Math.round(timeSavedHoursPerYear + pajamaTimeSavedHours),
    timeSavedAnnualValue: Math.round(timeSavedAnnualValue + pajamaTimeSavedValue),
    codingUpliftAnnual: Math.round(codingUpliftAnnual),
    coderSavings: Math.round(coderSavings),
    denialReduction: Math.round(denialReduction),
    totalAnnualValue: Math.round(totalAnnualValue),
    breakdown: [
      { label: "Time saved (documentation)", value: Math.round(timeSavedAnnualValue) },
      { label: "Pajama time eliminated", value: Math.round(pajamaTimeSavedValue) },
      { label: "E/M coding uplift", value: Math.round(codingUpliftAnnual) },
      { label: "Coder cost reduction", value: Math.round(coderSavings) },
      { label: "Denial reduction", value: Math.round(denialReduction) },
    ],
    calculatedAt: new Date().toISOString(),
  };
};

// --- PILOT PROGRESS TRACKER ---
const PilotTracker = ({ practice, onSave, onCancel }) => {
  const defaultChecklist = {
    week1: { scribe_selected: false, scribe_vendor: "", account_created: false, mobile_app_installed: false, first_note_generated: false, notes: "" },
    week2: { ehr_integration_started: false, integration_type: "", test_patient_synced: false, note_template_configured: false, notes: "" },
    week3: { full_day_pilot: false, pilot_date: "", notes_reviewed: 0, time_saved_estimate: "", provider_feedback: "", notes: "" },
    week4: { coding_analysis_complete: false, em_distribution_current: null, coding_uplift_identified: false, go_no_go_decision: "", notes: "" },
  };

  const [checklist, setChecklist] = useState(practice?.pilot_checklist || defaultChecklist);
  const [pilotStatus, setPilotStatus] = useState(practice?.pilot_status || "not_started");
  const [pilotStartDate, setPilotStartDate] = useState(practice?.pilot_start_date || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const weeks = [
    { key: "week1", label: "Week 1: Scribe Selection", color: DS.colors.blue, description: "Choose and set up ambient AI scribe" },
    { key: "week2", label: "Week 2: EHR Integration", color: DS.colors.warn, description: "Connect scribe to EHR, configure templates" },
    { key: "week3", label: "Week 3: Full-Day Pilot", color: DS.colors.vital, description: "Run full day with AI, measure results" },
    { key: "week4", label: "Week 4: Coding Analysis", color: DS.colors.shock, description: "Analyze coding impact, make go/no-go decision" },
  ];

  const scribeOptions = ["Suki AI", "Ambience", "HealOS", "Nuance DAX", "Other"];
  const integrationTypes = ["Direct EHR Integration", "Copy/Paste Workflow", "API Integration", "Manual Entry"];

  const updateChecklist = (week, field, value) => {
    setChecklist(prev => ({
      ...prev,
      [week]: { ...prev[week], [field]: value }
    }));
  };

  const getWeekProgress = (week) => {
    const items = checklist[week];
    const checkableFields = Object.entries(items).filter(([k, v]) => typeof v === "boolean");
    const completed = checkableFields.filter(([k, v]) => v).length;
    return Math.round((completed / checkableFields.length) * 100);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Check for milestone changes that should trigger webhooks
      const previousStatus = practice?.pilot_status;
      const newStatus = pilotStatus;
      const goDecision = checklist.week4?.go_no_go_decision;
      const previousDecision = practice?.pilot_checklist?.week4?.go_no_go_decision;

      const { error: updateError } = await supabase
        .from("practices")
        .update({
          pilot_checklist: checklist,
          pilot_status: pilotStatus,
          pilot_start_date: pilotStartDate || null,
        })
        .eq("id", practice.id);

      if (updateError) throw updateError;

      // Send webhooks for milestone events (fire and forget)
      const sendWebhook = async (type, message, details) => {
        try {
          await fetch("https://ijuhtxskfixsdqindcjd.supabase.co/functions/v1/pilot-webhook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type,
              practice_id: practice.id,
              practice_name: practice.name,
              pilot_status: newStatus,
              message,
              details,
            }),
          });
        } catch (e) {
          console.error("Webhook error:", e);
        }
      };

      // Pilot started
      if (previousStatus === "not_started" && newStatus !== "not_started") {
        sendWebhook("pilot_started", `${practice.name} has started their pilot`, `Starting at ${newStatus}`);
      }

      // Week completed (status advanced)
      if (previousStatus !== newStatus && newStatus !== "not_started" && previousStatus !== "not_started") {
        const weekNum = newStatus.replace("week", "");
        if (newStatus === "completed") {
          sendWebhook("pilot_completed", `${practice.name} has completed their pilot`, "All 4 weeks finished");
        } else {
          sendWebhook("week_completed", `${practice.name} advanced to Week ${weekNum}`, `Previous: ${previousStatus}`);
        }
      }

      // Go/No-Go decision made
      if (goDecision && goDecision !== previousDecision) {
        if (goDecision === "go") {
          sendWebhook("go_decision", `${practice.name}: GO decision made!`, "Proceeding to full implementation");
        } else if (goDecision === "conditional") {
          sendWebhook("conditional_decision", `${practice.name}: Conditional decision`, "Proceeding with adjustments");
        } else if (goDecision === "no_go") {
          sendWebhook("no_go_decision", `${practice.name}: No-Go decision`, "Pilot criteria not met");
        }
      }

      onSave();
    } catch (err) {
      console.error("Pilot save error:", err);
      setError("Failed to save pilot progress");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "8px 12px", background: DS.colors.bg,
    border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
    color: DS.colors.text, fontSize: "13px", outline: "none",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>Pilot Progress Tracker</h3>
          <p style={{ fontSize: "13px", color: DS.colors.textMuted }}>Track Week 1-4 pilot implementation milestones</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "11px", color: DS.colors.textDim, display: "block", marginBottom: "2px" }}>Start Date</label>
            <input type="date" value={pilotStartDate} onChange={(e) => setPilotStartDate(e.target.value)}
              style={{ ...inputStyle, width: "auto" }} />
          </div>
          <div>
            <label style={{ fontSize: "11px", color: DS.colors.textDim, display: "block", marginBottom: "2px" }}>Status</label>
            <select value={pilotStatus} onChange={(e) => setPilotStatus(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
              <option value="not_started">Not Started</option>
              <option value="week1">Week 1</option>
              <option value="week2">Week 2</option>
              <option value="week3">Week 3</option>
              <option value="week4">Week 4</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: "16px" }}>
        {weeks.map(week => (
          <div key={week.key} style={{
            padding: "16px", background: DS.colors.bgCard, borderRadius: DS.radius.md,
            border: `1px solid ${pilotStatus === week.key ? week.color : DS.colors.border}`,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: week.color }} />
                <span style={{ fontSize: "14px", fontWeight: 600, color: week.color }}>{week.label}</span>
              </div>
              <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                {getWeekProgress(week.key)}% complete
              </div>
            </div>
            <p style={{ fontSize: "12px", color: DS.colors.textDim, marginBottom: "12px" }}>{week.description}</p>

            {week.key === "week1" && (
              <div style={{ display: "grid", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week1.scribe_selected}
                    onChange={(e) => updateChecklist("week1", "scribe_selected", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>Scribe vendor selected</span>
                </label>
                {checklist.week1.scribe_selected && (
                  <select value={checklist.week1.scribe_vendor}
                    onChange={(e) => updateChecklist("week1", "scribe_vendor", e.target.value)}
                    style={{ ...inputStyle, marginLeft: "24px", width: "auto" }}>
                    <option value="">Select vendor...</option>
                    {scribeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week1.account_created}
                    onChange={(e) => updateChecklist("week1", "account_created", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>Account created</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week1.mobile_app_installed}
                    onChange={(e) => updateChecklist("week1", "mobile_app_installed", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>Mobile app installed</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week1.first_note_generated}
                    onChange={(e) => updateChecklist("week1", "first_note_generated", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>First note generated (test run)</span>
                </label>
              </div>
            )}

            {week.key === "week2" && (
              <div style={{ display: "grid", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week2.ehr_integration_started}
                    onChange={(e) => updateChecklist("week2", "ehr_integration_started", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>EHR integration initiated</span>
                </label>
                {checklist.week2.ehr_integration_started && (
                  <select value={checklist.week2.integration_type}
                    onChange={(e) => updateChecklist("week2", "integration_type", e.target.value)}
                    style={{ ...inputStyle, marginLeft: "24px", width: "auto" }}>
                    <option value="">Integration type...</option>
                    {integrationTypes.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week2.test_patient_synced}
                    onChange={(e) => updateChecklist("week2", "test_patient_synced", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>Test patient note synced to EHR</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week2.note_template_configured}
                    onChange={(e) => updateChecklist("week2", "note_template_configured", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>Note templates configured</span>
                </label>
              </div>
            )}

            {week.key === "week3" && (
              <div style={{ display: "grid", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week3.full_day_pilot}
                    onChange={(e) => updateChecklist("week3", "full_day_pilot", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>Full-day pilot completed</span>
                </label>
                {checklist.week3.full_day_pilot && (
                  <div style={{ marginLeft: "24px", display: "grid", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Pilot Date</label>
                      <input type="date" value={checklist.week3.pilot_date}
                        onChange={(e) => updateChecklist("week3", "pilot_date", e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Notes Reviewed</label>
                      <input type="number" value={checklist.week3.notes_reviewed}
                        onChange={(e) => updateChecklist("week3", "notes_reviewed", parseInt(e.target.value) || 0)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Time Saved Estimate (min/patient)</label>
                      <input type="text" placeholder="e.g., 12 min" value={checklist.week3.time_saved_estimate}
                        onChange={(e) => updateChecklist("week3", "time_saved_estimate", e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Provider Feedback</label>
                      <textarea value={checklist.week3.provider_feedback}
                        onChange={(e) => updateChecklist("week3", "provider_feedback", e.target.value)}
                        style={{ ...inputStyle, minHeight: "60px" }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {week.key === "week4" && (
              <div style={{ display: "grid", gap: "8px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week4.coding_analysis_complete}
                    onChange={(e) => updateChecklist("week4", "coding_analysis_complete", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>Coding analysis completed</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input type="checkbox" checked={checklist.week4.coding_uplift_identified}
                    onChange={(e) => updateChecklist("week4", "coding_uplift_identified", e.target.checked)} />
                  <span style={{ fontSize: "13px" }}>Coding uplift opportunity identified</span>
                </label>
                <div>
                  <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Go/No-Go Decision</label>
                  <select value={checklist.week4.go_no_go_decision}
                    onChange={(e) => updateChecklist("week4", "go_no_go_decision", e.target.value)}
                    style={inputStyle}>
                    <option value="">Pending...</option>
                    <option value="go">GO - Proceed to full implementation</option>
                    <option value="conditional">CONDITIONAL - Proceed with adjustments</option>
                    <option value="no_go">NO GO - Does not meet criteria</option>
                  </select>
                </div>
              </div>
            )}

            {/* Notes for each week */}
            <div style={{ marginTop: "12px" }}>
              <label style={{ fontSize: "11px", color: DS.colors.textDim }}>Notes</label>
              <textarea value={checklist[week.key].notes}
                onChange={(e) => updateChecklist(week.key, "notes", e.target.value)}
                placeholder="Add notes..."
                style={{ ...inputStyle, minHeight: "50px" }} />
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", marginTop: "16px", borderRadius: DS.radius.sm,
          background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "24px" }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary onClick={handleSave} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Save Progress"}
        </Button>
      </div>
    </div>
  );
};

// --- IMPLEMENTATION TRACKER / AI STACK SELECTOR ---
const ImplementationTracker = ({ practice, onSave, onCancel }) => {
  const { config } = useConfig();
  const dynamicTools = config?.aiTools || AI_TOOLS;

  const [selectedTools, setSelectedTools] = useState(
    practice?.ai_stack?.map(t => t.name) || []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const toggleTool = (toolName) => {
    setSelectedTools(prev =>
      prev.includes(toolName)
        ? prev.filter(t => t !== toolName)
        : [...prev, toolName]
    );
  };

  const handleSubmit = async () => {
    if (selectedTools.length === 0) {
      setError("Please select at least one AI tool to deploy");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const aiStack = selectedTools.map(name => ({
        name,
        status: "planned",
        since: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }));

      const { error: updateError } = await supabase
        .from("practices")
        .update({
          ai_stack: aiStack,
          stage: "implementation",
        })
        .eq("id", practice.id);

      if (updateError) throw updateError;

      // Create notification
      await supabase.from("notifications").insert({
        practice_id: practice.id,
        user_type: "client",
        type: "stage_change",
        title: "Implementation Started",
        message: `We're beginning deployment of ${selectedTools.length} AI tool${selectedTools.length > 1 ? "s" : ""} for your practice. You'll be notified as each tool goes live.`,
      });

      onSave();
    } catch (err) {
      console.error("Implementation save error:", err);
      setError("Failed to save implementation plan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "14px", color: DS.colors.textMuted, marginBottom: "24px" }}>
        Select the AI tools to deploy for this practice. Tools will start with "planned" status and progress through "deploying" to "active".
      </p>

      <div style={{ display: "grid", gap: "8px", marginBottom: "24px" }}>
        {dynamicTools.map((tool) => (
          <label
            key={tool.id}
            onClick={() => toggleTool(tool.name)}
            style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "14px 16px", borderRadius: DS.radius.md, cursor: "pointer",
              background: selectedTools.includes(tool.name) ? DS.colors.shockGlow : DS.colors.bg,
              border: `1px solid ${selectedTools.includes(tool.name) ? DS.colors.shock : DS.colors.borderLight}`,
              transition: "all 0.2s ease",
            }}
          >
            <div style={{
              width: "20px", height: "20px", borderRadius: "4px",
              border: `2px solid ${selectedTools.includes(tool.name) ? DS.colors.shock : DS.colors.borderLight}`,
              background: selectedTools.includes(tool.name) ? DS.colors.shock : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: "12px", fontWeight: "bold",
            }}>
              {selectedTools.includes(tool.name) && "✓"}
            </div>
            <div>
              <div style={{ fontWeight: 500, fontSize: "14px" }}>{tool.name}</div>
              <div style={{ fontSize: "11px", color: DS.colors.textDim, textTransform: "uppercase" }}>{tool.category}</div>
            </div>
          </label>
        ))}
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", marginBottom: "16px", borderRadius: DS.radius.sm,
          background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary onClick={handleSubmit} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : `Begin Implementation (${selectedTools.length} tools)`}
        </Button>
      </div>
    </div>
  );
};

// --- GO LIVE FORM ---
const GoLiveForm = ({ practice, onSave, onCancel }) => {
  const [goLiveDate, setGoLiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      // Mark all tools as active and initialize current metrics from baseline
      const updatedStack = (practice.ai_stack || []).map(tool => ({
        ...tool,
        status: "active",
      }));

      const { error: updateError } = await supabase
        .from("practices")
        .update({
          ai_stack: updatedStack,
          go_live_date: goLiveDate,
          stage: "managed",
          // Initialize current metrics from baseline
          doc_time_current: practice.doc_time_baseline,
          denial_rate_current: practice.denial_rate_baseline,
          call_answer_rate_current: practice.call_answer_rate_baseline,
          health_score: 50, // Start at 50, will improve as metrics improve
        })
        .eq("id", practice.id);

      if (updateError) throw updateError;

      // Create notification
      await supabase.from("notifications").insert({
        practice_id: practice.id,
        user_type: "client",
        type: "stage_change",
        title: "You're Live!",
        message: "Congratulations! Your practice is now live with the full AI stack. Check your portal to see real-time metrics and progress.",
      });

      onSave();
    } catch (err) {
      console.error("Go live error:", err);
      setError("Failed to complete go-live");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: "14px", color: DS.colors.textMuted, marginBottom: "24px" }}>
        Confirm the go-live date to move this practice to managed status. All AI tools will be marked as active.
      </p>

      <div style={{ marginBottom: "24px" }}>
        <label style={{
          display: "block", fontSize: "12px", color: DS.colors.textMuted,
          marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          Go-Live Date
        </label>
        <input
          type="date"
          value={goLiveDate}
          onChange={(e) => setGoLiveDate(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", background: DS.colors.bg,
            border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
            color: DS.colors.text, fontSize: "14px", outline: "none",
          }}
        />
      </div>

      <div style={{
        padding: "16px", background: DS.colors.vitalDim, borderRadius: DS.radius.md,
        marginBottom: "24px", fontSize: "13px",
      }}>
        <strong style={{ color: DS.colors.vital }}>Ready to go live:</strong>
        <div style={{ marginTop: "8px", color: DS.colors.textMuted }}>
          {(practice.ai_stack || []).map(t => t.name).join(", ") || "No tools selected"}
        </div>
      </div>

      {error && (
        <div style={{
          padding: "12px 16px", marginBottom: "16px", borderRadius: DS.radius.sm,
          background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary onClick={handleSubmit} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? "Going Live..." : "Confirm Go Live"}
        </Button>
      </div>
    </div>
  );
};

// --- METRICS EDITOR (for managed practices) ---
const MetricsEditor = ({ practice, onSave, onCancel }) => {
  const [form, setForm] = useState({
    doc_time_current: practice?.doc_time_current || "",
    denial_rate_current: practice?.denial_rate_current || "",
    call_answer_rate_current: practice?.call_answer_rate_current || "",
    coding_uplift_monthly: practice?.coding_uplift_monthly || "",
    revenue_recovered_monthly: practice?.revenue_recovered_monthly || "",
    health_score: practice?.health_score || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("practices")
        .update({
          doc_time_current: parseFloat(form.doc_time_current) || null,
          denial_rate_current: parseFloat(form.denial_rate_current) || null,
          call_answer_rate_current: parseFloat(form.call_answer_rate_current) || null,
          coding_uplift_monthly: parseFloat(form.coding_uplift_monthly) || null,
          revenue_recovered_monthly: parseFloat(form.revenue_recovered_monthly) || null,
          health_score: parseInt(form.health_score) || null,
        })
        .eq("id", practice.id);

      if (updateError) throw updateError;

      // Create notification if metrics improved significantly
      if (form.health_score && practice.health_score && parseInt(form.health_score) > practice.health_score + 5) {
        await supabase.from("notifications").insert({
          practice_id: practice.id,
          user_type: "client",
          type: "metric_update",
          title: "Health Score Improved!",
          message: `Your practice health score improved from ${practice.health_score} to ${form.health_score}. Keep up the great work!`,
        });
      }

      onSave();
    } catch (err) {
      console.error("Metrics save error:", err);
      setError("Failed to save metrics");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "10px 12px", background: DS.colors.bg,
    border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
    color: DS.colors.text, fontSize: "14px", outline: "none",
  };

  return (
    <div>
      <p style={{ fontSize: "14px", color: DS.colors.textMuted, marginBottom: "24px" }}>
        Update current metrics for comparison with baseline values.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>
            Doc time (min) <span style={{ color: DS.colors.textDim }}>was {practice.doc_time_baseline || "?"}</span>
          </label>
          <input type="number" step="0.1" value={form.doc_time_current} onChange={(e) => setForm({ ...form, doc_time_current: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>
            Denial rate (%) <span style={{ color: DS.colors.textDim }}>was {practice.denial_rate_baseline || "?"}%</span>
          </label>
          <input type="number" step="0.1" value={form.denial_rate_current} onChange={(e) => setForm({ ...form, denial_rate_current: e.target.value })} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>
            Call answer rate (%) <span style={{ color: DS.colors.textDim }}>was {practice.call_answer_rate_baseline || "?"}%</span>
          </label>
          <input type="number" step="0.1" value={form.call_answer_rate_current} onChange={(e) => setForm({ ...form, call_answer_rate_current: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Health Score (0-100)</label>
          <input type="number" min="0" max="100" value={form.health_score} onChange={(e) => setForm({ ...form, health_score: e.target.value })} style={inputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Coding Uplift ($/mo)</label>
          <input type="number" step="100" value={form.coding_uplift_monthly} onChange={(e) => setForm({ ...form, coding_uplift_monthly: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Revenue Recovered ($/mo)</label>
          <input type="number" step="100" value={form.revenue_recovered_monthly} onChange={(e) => setForm({ ...form, revenue_recovered_monthly: e.target.value })} style={inputStyle} />
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", marginBottom: "16px", borderRadius: DS.radius.sm, background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button primary onClick={handleSubmit} style={{ opacity: saving ? 0.7 : 1 }}>
          {saving ? "Saving..." : "Update Metrics"}
        </Button>
      </div>
    </div>
  );
};

// --- NOTIFICATION BELL COMPONENT ---
const NotificationBell = ({ userType = "team" }) => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const bellRef = useRef(null);

  // Fetch notifications
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_type", userType)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        setNotifications(data || []);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_type=eq.${userType}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notificationId) => {
    if (!isSupabaseConfigured()) return;
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    if (!isSupabaseConfigured()) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .in("id", unreadIds);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "stage_change": return "🔄";
      case "note_added": return "📝";
      case "action_required": return "⚡";
      case "metric_update": return "📈";
      default: return "🔔";
    }
  };

  return (
    <div ref={bellRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          padding: "8px", borderRadius: DS.radius.sm, position: "relative",
          color: DS.colors.textMuted, fontSize: "18px",
          transition: "background 0.2s",
        }}
        onMouseOver={(e) => e.currentTarget.style.background = DS.colors.bgHover}
        onMouseOut={(e) => e.currentTarget.style.background = "none"}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: "absolute", top: "4px", right: "4px",
            width: "16px", height: "16px", borderRadius: "50%",
            background: DS.colors.shock, color: "#fff",
            fontSize: "10px", fontWeight: 600, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "8px",
          width: "340px", maxHeight: "400px", overflowY: "auto",
          background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
          borderRadius: DS.radius.md, boxShadow: DS.shadow.deep,
          zIndex: 200, animation: "fadeUp 0.2s ease",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: `1px solid ${DS.colors.border}`,
          }}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: DS.colors.shock, fontSize: "12px", fontFamily: DS.fonts.body,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: "24px", textAlign: "center", color: DS.colors.textMuted }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: DS.colors.textMuted }}>
              No notifications yet
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                style={{
                  padding: "12px 16px", borderBottom: `1px solid ${DS.colors.border}`,
                  cursor: "pointer", background: notification.read ? "transparent" : `${DS.colors.shock}08`,
                  transition: "background 0.2s",
                }}
                onMouseOver={(e) => e.currentTarget.style.background = DS.colors.bgHover}
                onMouseOut={(e) => e.currentTarget.style.background = notification.read ? "transparent" : `${DS.colors.shock}08`}
              >
                <div style={{ display: "flex", gap: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{getTypeIcon(notification.type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px",
                    }}>
                      <span style={{
                        fontWeight: notification.read ? 400 : 600, fontSize: "13px",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {notification.title}
                      </span>
                      {!notification.read && (
                        <span style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: DS.colors.shock, flexShrink: 0,
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: "12px", color: DS.colors.textMuted,
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {notification.message}
                    </div>
                    <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "4px" }}>
                      {formatTime(notification.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// --- STAGE ACTIONS COMPONENT ---
const StageActions = ({ practice, onAction }) => {
  const stage = practice?.stage || "lead";

  const getNextAction = () => {
    switch (stage) {
      case "lead":
        return { label: "Start Assessment", action: "baseline", color: DS.colors.blue };
      case "assessment":
        return { label: "Begin Implementation", action: "implementation", color: DS.colors.warn };
      case "implementation":
        return { label: "Go Live", action: "golive", color: DS.colors.vital };
      case "managed":
        return { label: "Update Metrics", action: "metrics", color: DS.colors.shock };
      default:
        return null;
    }
  };

  const nextAction = getNextAction();
  if (!nextAction) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "16px", background: DS.colors.bg, borderRadius: DS.radius.md,
      marginBottom: "16px", border: `1px solid ${DS.colors.border}`,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "11px", color: DS.colors.textDim, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2px" }}>
          Current Stage
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "10px", height: "10px", borderRadius: "50%",
            background: STAGES.find(s => s.key === stage)?.color || DS.colors.textMuted,
          }} />
          <span style={{ fontWeight: 600, fontSize: "14px" }}>
            {STAGES.find(s => s.key === stage)?.label || stage}
          </span>
        </div>
      </div>
      <Button primary onClick={() => onAction(nextAction.action)} style={{ background: nextAction.color }}>
        {nextAction.label} →
      </Button>
    </div>
  );
};

// ============================================================
// PUBLIC SITE
// ============================================================
const PublicSite = ({ onLogin, onClientLogin }) => {
  const intakeRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);
  const [baselineRan, setBaselineRan] = useState(false);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);
  const [baseline, setBaseline] = useState({
    providers: "5",
    visitsPerProviderPerDay: "20",
    undercodedRate: "30",
    avgMissedPerVisit: "58",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});
  const [logoClicks, setLogoClicks] = useState(0);
  const logoClickTimer = useRef(null);
  const scrollToIntake = () => intakeRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleLogoClick = () => {
    const newClicks = logoClicks + 1;
    setLogoClicks(newClicks);

    // Reset after 2 seconds of no clicks
    clearTimeout(logoClickTimer.current);
    logoClickTimer.current = setTimeout(() => setLogoClicks(0), 2000);

    // 3 clicks = team access
    if (newClicks >= 3) {
      setLogoClicks(0);
      onLogin();
    }
  };

  const baselineNumbers = (() => {
    const providerCount = Math.max(1, parseInt(baseline.providers || "0", 10) || 0);
    const visitsPerDay = Math.max(1, parseInt(baseline.visitsPerProviderPerDay || "0", 10) || 0);
    const undercodedRate = Math.max(0, parseFloat(baseline.undercodedRate || "0") || 0) / 100;
    const avgMissed = Math.max(0, parseFloat(baseline.avgMissedPerVisit || "0") || 0);
    const annualVisits = providerCount * visitsPerDay * 240;
    const undercodedVisits = Math.round(annualVisits * undercodedRate);
    const annualRecovery = Math.round(undercodedVisits * avgMissed);
    const monthlyRecovery = Math.round(annualRecovery / 12);

    return { providerCount, visitsPerDay, undercodedVisits, annualRecovery, monthlyRecovery };
  })();

  const handleSubmit = async () => {
    setError(null);

    // Validate required fields
    const required = ['name', 'specialty', 'providers', 'contact', 'email'];
    const missing = required.filter(key => !form[key]?.trim?.() && !form[key]);
    if (missing.length > 0) {
      setError('Please fill in all required fields (marked with *)');
      return;
    }

    // Basic email validation
    if (form.email && !form.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSubmitting(true);

    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.error('Supabase not configured');
      setError('Form submission is temporarily unavailable. Please email us directly at torey@defyb.org');
      setSubmitting(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('practices')
        .insert({
          name: form.name,
          address: form.address,
          city_state_zip: form.cityStateZip,
          specialty: form.specialty,
          ehr: form.ehr,
          provider_count: form.providers,
          contact_name: form.contact,
          contact_email: form.email,
          contact_phone: form.phone,
          contact_role: form.role,
          pain_points: form.pains || [],
          interest_drivers: form.interestDrivers || [],
          stage: 'lead',
        });

      if (insertError) throw insertError;

      // Send notification email (fire and forget)
      fetch('https://ijuhtxskfixsdqindcjd.supabase.co/functions/v1/notify-intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          contact_name: form.contact,
          contact_email: form.email,
          specialty: form.specialty,
          provider_count: form.providers,
          pain_points: form.pains,
          interest_drivers: form.interestDrivers,
        }),
      }).catch(console.error);

      setSubmitted(true);
    } catch (err) {
      console.error('Submission error:', err);
      setError('Something went wrong. Please try again or email us directly at torey@defyb.org');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px clamp(16px, 4vw, 80px)",
        background: `${DS.colors.bg}ee`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${DS.colors.border}`,
      }}>
        <div onClick={handleLogoClick} style={{ cursor: "pointer" }}>
          <DeFybLogo size={28} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {[
            { label: "ROI", id: "roi" },
            { label: "Process", id: "protocol" },
            { label: "FAQ", id: "faq" },
          ].map((link) => (
            <span
              key={link.id}
              onClick={() => document.getElementById(link.id)?.scrollIntoView({ behavior: "smooth" })}
              style={{
                fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer",
                padding: "6px 10px", borderRadius: DS.radius.sm,
                transition: "color 0.2s",
              }}
              onMouseOver={(e) => e.target.style.color = DS.colors.text}
              onMouseOut={(e) => e.target.style.color = DS.colors.textMuted}
            >
              {link.label}
            </span>
          ))}
          <span onClick={onClientLogin} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer", padding: "6px 10px" }}>Portal</span>
          <Button primary small onClick={scrollToIntake}>Run Baseline</Button>
        </div>
      </nav>

      <div style={{ padding: "0 clamp(20px, 5vw, 80px)", maxWidth: "1200px", margin: "0 auto" }}>
        {/* HERO */}
        <section style={{ paddingTop: "140px", paddingBottom: "80px" }}>
          <HeartbeatLine width={280} style={{ marginBottom: "32px", opacity: 0.6 }} />
          <h1 style={{
            fontFamily: DS.fonts.display, fontSize: "clamp(36px, 6vw, 64px)",
            color: DS.colors.text, fontWeight: 400, lineHeight: 1.1, maxWidth: "700px",
            marginBottom: "24px",
          }}>
            Your revenue is <span style={{ color: DS.colors.shock, fontStyle: "italic" }}>leaking</span> in documentation.
            <br />We capture it back.
          </h1>

          {/* THREE DOORS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "40px", maxWidth: "600px" }}>
            {[
              { icon: "💰", text: "Your coding level is lower than the encounter supports.", tag: "revenue" },
              { icon: "🧾", text: "Billing teams lack defensible documentation rationale.", tag: "revenue" },
              { icon: "📉", text: "Denied or downgraded claims are reducing collections.", tag: "revenue" },
            ].map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Tag type={d.tag} />
                <span style={{ color: DS.colors.textMuted, fontSize: "15px" }}>{d.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Button primary onClick={scrollToIntake}>Start Free Coding Baseline →</Button>
            <Button onClick={() => document.getElementById("roi")?.scrollIntoView({ behavior: "smooth" })}>See the ROI</Button>
          </div>
        </section>

        {/* TAGLINE */}
        <div style={{
          textAlign: "center", padding: "48px 0", borderTop: `1px solid ${DS.colors.border}`,
          borderBottom: `1px solid ${DS.colors.border}`,
        }}>
          <p style={{
            fontFamily: DS.fonts.display, fontSize: "clamp(20px, 3vw, 28px)",
            color: DS.colors.textMuted, fontStyle: "italic",
          }}>
            Capturing revenue private practices are underbilling.
          </p>
          <p style={{ fontSize: "14px", color: DS.colors.textDim, marginTop: "8px" }}>
            Clinician-led billing intelligence and operational automation for small group practices.
          </p>
        </div>

        {/* CODING LEAKS */}
        <section style={{ padding: "80px 0" }}>
          <SectionTitle sub="We focus frontend workflow on coding intelligence first. Add-on modules remain available in your backend roadmap.">
            The 5 coding leaks draining revenue
          </SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "12px" }}>
            {FAILURE_POINTS.map((fp) => (
              <div key={fp.id} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto",
                alignItems: "center", gap: "16px",
                padding: "16px 20px", background: DS.colors.bgCard,
                border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md,
              }}>
                <div style={{
                  fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.textDim,
                  width: "24px", textAlign: "center",
                }}>
                  {String(fp.id).padStart(2, "0")}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{fp.name}</span>
                    <Tag type={fp.tag} />
                  </div>
                  <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>{fp.stat}</div>
                  <div style={{ fontSize: "12px", marginTop: "4px" }}>
                    <span style={{ color: DS.colors.shock }}>→</span>{" "}
                    <span style={{ color: DS.colors.text, fontWeight: 500 }}>{fp.tool}</span>{" "}
                    <span style={{ color: DS.colors.textDim }}>({fp.toolCost})</span>
                  </div>
                </div>
                <div style={{
                  fontSize: "11px", color: DS.colors.vital, background: DS.colors.vitalDim,
                  padding: "4px 8px", borderRadius: "4px", whiteSpace: "nowrap",
                }}>
                  {fp.fix}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: "24px", padding: "16px 20px", borderRadius: DS.radius.md,
            background: `${DS.colors.shock}11`, border: `1px solid ${DS.colors.shock}33`,
            display: "flex", alignItems: "center", gap: "12px",
          }}>
            <span style={{ fontSize: "20px" }}>🔊</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>AI Environment Audit — included in every assessment</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                We start with coding capture. DME, prior-auth, and broader automation modules are layered in phase two
                after baseline coding lift is proven.
              </div>
            </div>
          </div>
        </section>

        {/* ROI SECTION */}
        <section id="roi" style={{ padding: "80px 0" }}>
          <SectionTitle sub="Coding-first projections based on published benchmarks. Results vary by specialty and payer mix.">
            What revenue capture can look like for a 5-provider practice
          </SectionTitle>

          {/* SIMPLE PAY → GET */}
          <div className="roi-grid" style={{
            display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "32px",
            alignItems: "center", marginBottom: "48px",
          }}>
            {/* YOU PAY */}
            <Card style={{ textAlign: "center", padding: "40px 32px" }}>
              <div style={{
                fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: "12px",
              }}>Typical investment</div>
              <div style={{
                fontFamily: DS.fonts.display, fontSize: "clamp(36px, 5vw, 48px)",
                color: DS.colors.text, lineHeight: 1,
              }}>~$146K</div>
              <div style={{ fontSize: "14px", color: DS.colors.textDim, marginTop: "8px" }}>
                per year — DeFyb core coding platform
              </div>
            </Card>

            {/* ARROW */}
            <div className="roi-arrow" style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: DS.colors.shock, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "24px", boxShadow: DS.shadow.glow,
            }}>→</div>

            {/* YOU GET */}
            <Card style={{ textAlign: "center", padding: "40px 32px", borderColor: DS.colors.vital + "44" }}>
              <div style={{
                fontSize: "12px", color: DS.colors.vital, textTransform: "uppercase",
                letterSpacing: "0.1em", marginBottom: "12px",
              }}>Potential return</div>
              <div style={{
                fontFamily: DS.fonts.display, fontSize: "clamp(36px, 5vw, 48px)",
                color: DS.colors.vital, lineHeight: 1,
              }}>$400K–1M+</div>
              <div style={{ fontSize: "14px", color: DS.colors.textDim, marginTop: "8px" }}>
                per year — underbilling recovery potential
              </div>
            </Card>
          </div>

          {/* WHERE IT COMES FROM */}
          <div className="roi-breakdown" style={{ marginBottom: "40px" }}>
            <div style={{
              fontSize: "13px", color: DS.colors.textMuted, marginBottom: "16px",
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}>Where practices are seeing returns (published data)</div>
            <div style={{ display: "grid", gap: "2px" }}>
              {[
                { source: "Coding uplift", amount: "up to $625K", note: "11-14% wRVU increase reported in published studies" },
                { source: "Denial prevention", amount: "$60-96K", note: "Cleaner documentation reduces preventable denials" },
                { source: "Faster review cycles", amount: "high impact", note: "Billing teams spend less time clarifying notes" },
                { source: "Audit-ready claims", amount: "risk reduction", note: "Each recommendation includes evidence bullets" },
                { source: "Phase 2 add-ons", amount: "optional", note: "DME and prior-auth modules can layer in later" },
              ].map((row, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "160px 120px 1fr",
                  alignItems: "center", gap: "16px", padding: "14px 20px",
                  background: DS.colors.bgCard,
                  borderRadius: i === 0 ? `${DS.radius.md} ${DS.radius.md} 0 0` : i === 4 ? `0 0 ${DS.radius.md} ${DS.radius.md}` : "0",
                }}>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{row.source}</span>
                  <span style={{ fontFamily: DS.fonts.mono, fontSize: "14px", color: DS.colors.vital }}>{row.amount}</span>
                  <span style={{ fontSize: "13px", color: DS.colors.textMuted }}>{row.note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* BOTTOM LINE */}
          <div className="bottom-stats" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px",
            padding: "24px", background: DS.colors.bgCard, borderRadius: DS.radius.lg,
            border: `1px solid ${DS.colors.border}`,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.vital }}>3–5x</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>typical coding ROI range</div>
            </div>
            <div style={{ textAlign: "center", borderLeft: `1px solid ${DS.colors.border}`, borderRight: `1px solid ${DS.colors.border}` }}>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.shock }}>60–90 days</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>to measurable coding impact</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.blue }}>Daily</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>underbilling visibility</div>
            </div>
          </div>

          <p style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "20px", maxWidth: "700px" }}>
            Sources: Riverside Health (PMC); UCSF/JAMA Jan 2026; Texas Oncology; Healio; Health Catalyst.
            These are industry benchmarks — we'll build a realistic projection specific to your practice during the assessment.
          </p>
        </section>

        {/* PROJECTED OUTCOMES */}
        <section style={{ padding: "80px 0", borderTop: `1px solid ${DS.colors.border}` }}>
          <SectionTitle sub="Front-end focus is coding and revenue capture.">
            Expected coding outcomes
          </SectionTitle>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "16px" }}>
            {[
              { metric: "11-14%", label: "coding uplift potential", icon: "📈", color: DS.colors.vital, sub: "from undercoding correction" },
              { metric: "60-90 days", label: "to trend visibility", icon: "📊", color: DS.colors.blue, sub: "for measured capture rates" },
              { metric: "Defensible", label: "claim rationale quality", icon: "🧾", color: DS.colors.warn, sub: "evidence-linked recommendations" },
              { metric: "Phase 2", label: "add-on modules", icon: "⚙️", color: DS.colors.shock, sub: "DME and prior-auth available later" },
            ].map((item, i) => (
              <Card key={i} style={{ textAlign: "center", padding: "32px 24px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>{item.icon}</div>
                <div style={{ fontFamily: DS.fonts.display, fontSize: "36px", color: item.color, lineHeight: 1 }}>
                  {item.metric}
                </div>
                <div style={{ fontSize: "14px", color: DS.colors.text, marginTop: "8px", fontWeight: 500 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginTop: "4px" }}>
                  {item.sub}
                </div>
              </Card>
            ))}
          </div>

          <div style={{
            marginTop: "32px", padding: "20px 24px", borderRadius: DS.radius.lg,
            background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
            display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap",
          }}>
            <div style={{ fontSize: "24px" }}>💡</div>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>
                These are projections, not guarantees
              </div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                Every practice is different. We validate coding opportunity first, then phase in DME, prior-auth,
                and additional automations as optional expansion modules.
              </div>
            </div>
          </div>
        </section>

        {/* INTEGRATIONS */}
        <section style={{ padding: "80px 0", borderTop: `1px solid ${DS.colors.border}` }}>
          <SectionTitle sub="Coding-first implementation on your existing stack, with optional add-on modules.">
            Integrations & Partners
          </SectionTitle>

          <div style={{ marginBottom: "40px" }}>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
              EHR Systems
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {["athenahealth", "Epic", "eClinicalWorks", "NextGen", "AdvancedMD", "Allscripts", "Veradigm", "ModMed"].map((ehr) => (
                <div key={ehr} style={{
                  padding: "12px 20px", background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
                  borderRadius: DS.radius.md, fontSize: "14px", fontWeight: 500,
                }}>
                  {ehr}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "16px" }}>
              AI Tool Partners
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {[
                { name: "Suki", category: "Scribe" },
                { name: "Ambience", category: "Scribe" },
                { name: "HealOS", category: "Scribe" },
                { name: "Thoughtful AI", category: "RCM" },
                { name: "Infinitus", category: "Prior Auth (Add-On)" },
                { name: "Assort Health", category: "Phone AI (Add-On)" },
              ].map((tool) => (
                <div key={tool.name} style={{
                  padding: "12px 20px", background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
                  borderRadius: DS.radius.md, display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{tool.name}</span>
                  <span style={{ fontSize: "11px", color: DS.colors.textMuted, background: DS.colors.bg, padding: "2px 6px", borderRadius: "4px" }}>
                    {tool.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROTOCOL */}
        <section id="protocol" style={{ padding: "80px 0" }}>
          <SectionTitle sub="Simple, coding-first rollout.">
            The Revenue Capture Protocol
          </SectionTitle>

          <div style={{ display: "grid", gap: "2px" }}>
            {PROTOCOL_STEPS.map((step, i) => (
              <div key={i} style={{
                display: "grid", gridTemplateColumns: "60px 1fr auto",
                alignItems: "center", gap: "20px",
                padding: "20px 24px", background: DS.colors.bgCard,
                borderRadius: i === 0 ? `${DS.radius.lg} ${DS.radius.lg} 0 0` :
                  i === PROTOCOL_STEPS.length - 1 ? `0 0 ${DS.radius.lg} ${DS.radius.lg}` : "0",
              }}>
                <div style={{
                  fontFamily: DS.fonts.display, fontSize: "28px",
                  color: i === PROTOCOL_STEPS.length - 1 ? DS.colors.vital : DS.colors.shock,
                }}>
                  {step.num}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "15px", marginBottom: "2px" }}>{step.title}</div>
                  <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>{step.desc}</div>
                </div>
                <div style={{
                  fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.textDim,
                  background: DS.colors.bg, padding: "4px 10px", borderRadius: "4px",
                }}>
                  {step.time}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" style={{ padding: "80px 0" }}>
          <SectionTitle>Common questions</SectionTitle>
          <div style={{ display: "grid", gap: "12px", maxWidth: "700px" }}>
            {[
              {
                q: "Is this a coding tool or a full automation platform?",
                a: "The frontend experience is intentionally coding-first for MVP. We prioritize underbilling detection, claim rationale, and documentation completion."
              },
              {
                q: "Do you still support DME and prior-auth automation?",
                a: "Yes. Those capabilities remain in the backend roadmap and can be activated as phase-two add-on modules after coding capture is stable."
              },
              {
                q: "What does it actually cost?",
                a: "Core MVP pricing is centered on coding intelligence and revenue capture workflows. We provide expansion pricing for DME, prior-auth, and claims modules separately."
              },
              {
                q: "How long until we see results?",
                a: "Most practices see coding trend visibility within 2-4 weeks and measurable revenue impact within 60-90 days."
              },
              {
                q: "Will this replace my billing team?",
                a: "No. It augments your billing team with better evidence, cleaner documentation, and prioritized correction opportunities."
              },
            ].map((faq, i) => (
              <Card key={i} style={{ padding: "20px 24px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>{faq.q}</div>
                <div style={{ fontSize: "14px", color: DS.colors.textMuted, lineHeight: 1.6 }}>{faq.a}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* BASELINE + ASSESSMENT */}
        <section ref={intakeRef} style={{ padding: "80px 0" }}>
          <SectionTitle sub="Run a fast estimate first. Book a full assessment only if the coding opportunity is worth it.">
            Start your free coding baseline
          </SectionTitle>

          <Card style={{ maxWidth: "900px", marginBottom: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "16px" }}>
              {[
                { label: "Providers", key: "providers" },
                { label: "Visits/provider/day", key: "visitsPerProviderPerDay" },
                { label: "Estimated undercoded %", key: "undercodedRate" },
                { label: "Avg missed $/visit", key: "avgMissedPerVisit" },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {field.label}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={baseline[field.key]}
                    onChange={(e) => setBaseline({ ...baseline, [field.key]: e.target.value })}
                    style={{
                      width: "100%", padding: "10px 12px", background: DS.colors.bg,
                      border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                      color: DS.colors.text, fontSize: "14px", outline: "none",
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
              <Button primary onClick={() => setBaselineRan(true)}>Run Baseline Estimate</Button>
              <Button onClick={() => setShowAssessmentForm((v) => !v)}>
                {showAssessmentForm ? "Hide Assessment Form" : "Book Full Assessment"}
              </Button>
              <Button onClick={onClientLogin}>Watch Demo</Button>
            </div>

            {baselineRan && (
              <div style={{
                padding: "16px 18px", borderRadius: DS.radius.md, background: DS.colors.bg,
                border: `1px solid ${DS.colors.borderLight}`, display: "grid", gap: "8px",
              }}>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>Baseline Result</div>
                <div style={{ fontFamily: DS.fonts.display, fontSize: "34px", color: DS.colors.vital }}>
                  ${baselineNumbers.monthlyRecovery.toLocaleString()}/mo
                </div>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  Estimated recoverable revenue from {baselineNumbers.undercodedVisits.toLocaleString()} potentially undercoded encounters/year.
                </div>
              </div>
            )}
          </Card>

          {showAssessmentForm && (
            <>
              {submitted ? (
                <div style={{ textAlign: "center", padding: "40px 0 60px" }}>
                  <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚡</div>
                  <h2 style={{ fontFamily: DS.fonts.display, fontSize: "32px", color: DS.colors.vital, marginBottom: "8px" }}>
                    Assessment request received.
                  </h2>
                  <p style={{ color: DS.colors.textMuted, maxWidth: "520px", margin: "0 auto" }}>
                    We’ll follow up within 48 hours with a coding-focused review plan and next steps.
                  </p>
                </div>
              ) : (
                <Card style={{ maxWidth: "700px" }}>
                  <div style={{ marginBottom: "18px" }}>
                    <div style={{ fontWeight: 600, fontSize: "16px" }}>Book Full Assessment</div>
                    <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                      Use this after baseline if you want a full workflow and implementation plan.
                    </div>
                  </div>
                {[
                  // Practice Info (feeds baseline)
                  { label: "Practice Name", key: "name", type: "text", required: true },
                  { label: "Practice Address", key: "address", type: "text", placeholder: "Street address" },
                  { label: "City, State, ZIP", key: "cityStateZip", type: "text", placeholder: "City, ST 12345" },
                  { label: "Specialty", key: "specialty", type: "select", required: true, options: [
                    "Family Medicine / Primary Care",
                    "Internal Medicine",
                    "Cardiology",
                    "Gastroenterology",
                    "Psychiatry / Behavioral Health",
                    "Orthopedic Surgery",
                    "OB/GYN",
                    "Urology",
                    "Endocrinology",
                    "Dermatology",
                    "Pediatrics",
                    "Pain Management",
                    "General Surgery",
                    "Other"
                  ]},
                  { label: "Number of Providers", key: "providers", type: "select", required: true, options: ["1-2", "3-5", "6-10", "11-20", "20+"] },
                  { label: "Current EHR", key: "ehr", type: "select", options: ["athenahealth", "Epic", "eClinicalWorks", "NextGen", "AdvancedMD", "Allscripts/Veradigm", "Other / Not sure"] },
                  // Contact Info
                  { label: "Your Full Name", key: "contact", type: "text", required: true },
                  { label: "Your Role", key: "role", type: "select", options: ["Practice Owner / Partner", "Office Manager", "Provider (MD/DO/PA/NP)", "Billing Manager", "Other"] },
                  { label: "Email", key: "email", type: "email", required: true },
                  { label: "Phone", key: "phone", type: "tel" },
                ].map((field) => (
                  <div key={field.key} style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {field.label}{field.required && <span style={{ color: DS.colors.shock }}> *</span>}
                    </label>
                    {field.type === "select" ? (
                      <select
                        value={form[field.key] || ""}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        style={{
                          width: "100%", padding: "10px 12px", background: DS.colors.bg,
                          border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                          color: DS.colors.text, fontSize: "14px", outline: "none",
                        }}
                      >
                        <option value="">Select...</option>
                        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type} placeholder={field.placeholder || ""}
                        value={form[field.key] || ""}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        style={{
                          width: "100%", padding: "10px 12px", background: DS.colors.bg,
                          border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                          color: DS.colors.text, fontSize: "14px", outline: "none",
                        }}
                      />
                    )}
                  </div>
                ))}

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Top 3 Pain Points
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {["Documentation time", "Phone/missed calls", "Coding accuracy", "Prior auth", "Claim denials", "Staffing shortages", "DME revenue loss", "Patient no-shows"].map((p) => (
                      <label key={p} style={{
                        display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px",
                        background: (form.pains || []).includes(p) ? DS.colors.shockGlow : DS.colors.bg,
                        border: `1px solid ${(form.pains || []).includes(p) ? DS.colors.shock : DS.colors.borderLight}`,
                        borderRadius: DS.radius.sm, cursor: "pointer", fontSize: "13px",
                        color: (form.pains || []).includes(p) ? DS.colors.shock : DS.colors.textMuted,
                      }}>
                        <input type="checkbox" style={{ display: "none" }}
                          checked={(form.pains || []).includes(p)}
                          onChange={() => {
                            const pains = form.pains || [];
                            setForm({ ...form, pains: pains.includes(p) ? pains.filter((x) => x !== p) : [...pains, p].slice(0, 3) });
                          }}
                        />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    What's driving your interest? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(select up to 3)</span>
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {[
                      { label: "Providers working late", icon: "🌙", maps: "doc_time" },
                      { label: "Missing/losing calls", icon: "📞", maps: "call_rate" },
                      { label: "High denial rate", icon: "❌", maps: "denial_rate" },
                      { label: "Under-coding concerns", icon: "📊", maps: "coding" },
                      { label: "Prior auth burden", icon: "📋", maps: "prior_auth" },
                      { label: "Staffing struggles", icon: "👥", maps: "staffing" },
                      { label: "Want to bring DME in-house", icon: "🏥", maps: "dme" },
                      { label: "Stay independent", icon: "🛡️", maps: "independence" },
                    ].map((driver) => (
                      <label key={driver.label} style={{
                        display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px",
                        background: (form.interestDrivers || []).includes(driver.label) ? DS.colors.shockGlow : DS.colors.bg,
                        border: `1px solid ${(form.interestDrivers || []).includes(driver.label) ? DS.colors.shock : DS.colors.borderLight}`,
                        borderRadius: DS.radius.md, cursor: "pointer", fontSize: "14px",
                        color: (form.interestDrivers || []).includes(driver.label) ? DS.colors.text : DS.colors.textMuted,
                        transition: "all 0.2s ease",
                      }}>
                        <input type="checkbox" style={{ display: "none" }}
                          checked={(form.interestDrivers || []).includes(driver.label)}
                          onChange={() => {
                            const drivers = form.interestDrivers || [];
                            setForm({
                              ...form,
                              interestDrivers: drivers.includes(driver.label)
                                ? drivers.filter((x) => x !== driver.label)
                                : [...drivers, driver.label].slice(0, 3)
                            });
                          }}
                        />
                        <span>{driver.icon}</span>
                        <span>{driver.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div style={{
                    padding: "12px 16px", marginBottom: "16px", borderRadius: DS.radius.sm,
                    background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
                  }}>
                    {error}
                  </div>
                )}

                <Button
                  primary
                  onClick={handleSubmit}
                  style={{ width: "100%", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Submitting..." : "⚡ Submit Full Assessment Request"}
                </Button>
                </Card>
              )}
            </>
          )}
        </section>

        {/* CONTACT */}
        <section style={{
          padding: "48px 0", borderTop: `1px solid ${DS.colors.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "24px",
        }}>
          <div>
            <div style={{ fontSize: "14px", color: DS.colors.textMuted, marginBottom: "4px" }}>
              Rather just talk?
            </div>
            <a href="mailto:torey@defyb.org" style={{
              fontFamily: DS.fonts.display, fontSize: "20px", color: DS.colors.shock,
              textDecoration: "none",
            }}>
              torey@defyb.org
            </a>
          </div>
          <Button primary onClick={scrollToIntake}>Run Baseline →</Button>
        </section>

        {/* TRUST & COMPLIANCE */}
        <section style={{ padding: "60px 0", borderTop: `1px solid ${DS.colors.border}` }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h3 style={{ fontFamily: DS.fonts.display, fontSize: "24px", color: DS.colors.text, marginBottom: "8px" }}>
              Built for Healthcare
            </h3>
            <p style={{ fontSize: "14px", color: DS.colors.textMuted, maxWidth: "500px", margin: "0 auto" }}>
              We take data security seriously. Your practice information is protected.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", maxWidth: "900px", margin: "0 auto" }}>
            {[
              {
                icon: "🔒",
                title: "HIPAA Compliant",
                desc: "All systems and processes designed to meet HIPAA requirements. BAA available.",
              },
              {
                icon: "🛡️",
                title: "No PHI Storage",
                desc: "We track practice metrics, not patient data. AI tools integrate directly with your EHR.",
              },
              {
                icon: "🔐",
                title: "Secure Infrastructure",
                desc: "Enterprise-grade encryption. SOC 2 Type II compliant hosting. Regular security audits.",
              },
              {
                icon: "📋",
                title: "BAA Ready",
                desc: "Business Associate Agreements available for all engagements requiring PHI access.",
              },
            ].map((item, i) => (
              <div key={i} style={{
                padding: "24px", background: DS.colors.bgCard, border: `1px solid ${DS.colors.border}`,
                borderRadius: DS.radius.lg, textAlign: "center",
              }}>
                <div style={{ fontSize: "28px", marginBottom: "12px" }}>{item.icon}</div>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px" }}>{item.title}</div>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          <div style={{
            marginTop: "32px", textAlign: "center", padding: "20px",
            background: `${DS.colors.vital}11`, border: `1px solid ${DS.colors.vital}33`,
            borderRadius: DS.radius.lg, maxWidth: "700px", margin: "32px auto 0",
          }}>
            <div style={{ fontSize: "14px", color: DS.colors.vital, fontWeight: 500 }}>
              🏥 Clinician-Founded & Operated
            </div>
            <div style={{ fontSize: "13px", color: DS.colors.textMuted, marginTop: "4px" }}>
              DeFyb was built by practicing physicians who understand the unique challenges of private practice.
              We're not just vendors — we're partners in your success.
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer style={{
          padding: "40px 0 32px", borderTop: `1px solid ${DS.colors.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "32px", marginBottom: "32px" }}>
            <div>
              <DeFybLogo size={24} />
              <p style={{ fontSize: "13px", color: DS.colors.textMuted, marginTop: "12px", maxWidth: "280px" }}>
                Revenue capture, coding intelligence, and workflow automation for private practices.
              </p>
            </div>
            <div style={{ display: "flex", gap: "48px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Contact</div>
                <a href="mailto:torey@defyb.org" style={{ fontSize: "14px", color: DS.colors.text, textDecoration: "none", display: "block", marginBottom: "6px" }}>torey@defyb.org</a>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>Legal</div>
                <span style={{ fontSize: "14px", color: DS.colors.textMuted, display: "block", marginBottom: "6px" }}>Privacy Policy</span>
                <span style={{ fontSize: "14px", color: DS.colors.textMuted, display: "block" }}>Terms of Service</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", paddingTop: "24px", borderTop: `1px solid ${DS.colors.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <span style={{ fontSize: "11px", color: DS.colors.textDim, padding: "4px 8px", background: DS.colors.bgCard, borderRadius: "4px" }}>🔒 HIPAA</span>
              <span style={{ fontSize: "11px", color: DS.colors.textDim, padding: "4px 8px", background: DS.colors.bgCard, borderRadius: "4px" }}>🛡️ SOC 2</span>
              <span style={{ fontSize: "11px", color: DS.colors.textDim, padding: "4px 8px", background: DS.colors.bgCard, borderRadius: "4px" }}>📋 BAA Ready</span>
            </div>
            <p style={{ fontSize: "12px", color: DS.colors.textDim }}>
              © 2026 DeFyb. Clinician-led. Vendor-neutral.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

// ============================================================
// CLIENT PORTAL
// ============================================================
// --- STAGE PROGRESS BAR ---
const StageProgressBar = ({ currentStage }) => {
  const stageIndex = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div style={{ marginBottom: "32px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {STAGES.map((stage, i) => {
          const isComplete = i < stageIndex;
          const isCurrent = i === stageIndex;
          return (
            <div key={stage.key} style={{ flex: 1, display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "28px", height: "28px", borderRadius: "50%",
                background: isComplete ? DS.colors.vital : isCurrent ? DS.colors.shock : DS.colors.border,
                color: isComplete || isCurrent ? "#fff" : DS.colors.textDim,
                fontSize: "12px", fontWeight: 600,
              }}>
                {isComplete ? "✓" : i + 1}
              </div>
              <div style={{
                flex: 1, height: "3px", borderRadius: "2px",
                background: i < STAGES.length - 1 ? (isComplete ? DS.colors.vital : DS.colors.border) : "transparent",
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", marginTop: "8px" }}>
        {STAGES.map((stage, i) => (
          <div key={stage.key} style={{ flex: 1, textAlign: "left" }}>
            <span style={{
              fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em",
              color: i <= stageIndex ? (i === stageIndex ? DS.colors.shock : DS.colors.vital) : DS.colors.textDim,
              fontWeight: i === stageIndex ? 600 : 400,
            }}>
              {stage.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- STAGE MESSAGING ---
const getStageMessage = (stage) => {
  switch (stage) {
    case "lead":
      return {
        title: "We're reviewing your intake",
        subtitle: "Your DeFyb journey is starting. We'll reach out within 48 hours to schedule your assessment.",
        icon: "📋",
      };
    case "assessment":
      return {
        title: "Assessment in progress",
        subtitle: "We're capturing your baseline metrics and designing your transformation plan.",
        icon: "🔍",
      };
    case "implementation":
      return {
        title: "Implementation underway",
        subtitle: "Your AI tools are being deployed. You'll be notified as each tool goes live.",
        icon: "🚀",
      };
    case "managed":
      return {
        title: "You're live!",
        subtitle: "Your practice is running on the full AI stack. Track your progress below.",
        icon: "⚡",
      };
    default:
      return { title: "Welcome", subtitle: "", icon: "👋" };
  }
};

const ClientPortal = ({ onBack, practiceId: propPracticeId }) => {
  const [tab, setTab] = useState("overview");
  const [practice, setPractice] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get practice ID from URL or props
  const practiceId = propPracticeId || (() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("practice");
    }
    return null;
  })();

  useEffect(() => {
    const fetchData = async () => {
      if (!isSupabaseConfigured()) {
        // Fall back to sample data for demo
        setPractice(SAMPLE_CLIENTS[0]);
        setLoading(false);
        return;
      }

      if (!practiceId) {
        // No practice ID, show sample data
        setPractice(SAMPLE_CLIENTS[0]);
        setLoading(false);
        return;
      }

      try {
        // Fetch practice data
        const { data: practiceData, error: practiceError } = await supabase
          .from("practices")
          .select("*")
          .eq("id", practiceId)
          .single();

        if (practiceError) throw practiceError;

        // Transform to component format
        const transformed = {
          ...practiceData,
          stack: practiceData.ai_stack || [],
          score: practiceData.health_score,
          metrics: {
            docTime: practiceData.doc_time_current,
            docTimeBaseline: practiceData.doc_time_baseline,
            denialRate: practiceData.denial_rate_current,
            denialBaseline: practiceData.denial_rate_baseline,
            callRate: practiceData.call_answer_rate_current,
            callBaseline: practiceData.call_answer_rate_baseline,
            codingUplift: practiceData.coding_uplift_monthly,
            revenue: practiceData.revenue_recovered_monthly,
          },
        };
        setPractice(transformed);

        // Fetch client notifications
        const { data: notifData } = await supabase
          .from("notifications")
          .select("*")
          .eq("practice_id", practiceId)
          .eq("user_type", "client")
          .order("created_at", { ascending: false })
          .limit(10);

        setNotifications(notifData || []);
      } catch (err) {
        console.error("Error fetching practice:", err);
        setPractice(SAMPLE_CLIENTS[0]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [practiceId]);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        color: DS.colors.textMuted,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>⚡</div>
          Loading your portal...
        </div>
      </div>
    );
  }

  if (!practice) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
          <h2 style={{ fontFamily: DS.fonts.display, fontSize: "24px", marginBottom: "8px" }}>Portal Not Found</h2>
          <p style={{ color: DS.colors.textMuted, fontSize: "14px" }}>
            This portal link may be invalid or expired.
          </p>
          <Button onClick={onBack} style={{ marginTop: "20px" }}>← Back to site</Button>
        </Card>
      </div>
    );
  }

  const m = practice.metrics || {};
  const hasCurrentMetrics = m.docTime != null || m.denialRate != null || m.callRate != null;
  const stageMessage = getStageMessage(practice.stage);

  const hasPilot = ["assessment", "implementation"].includes(practice.stage) && practice.pilot_status && practice.pilot_status !== "not_started";

  const tabs = [
    { key: "overview", label: "Overview" },
    ...(hasPilot ? [{ key: "pilot", label: "Pilot Progress" }] : []),
    ...(hasCurrentMetrics ? [{ key: "metrics", label: "Metrics" }] : []),
    ...(practice.stack?.length > 0 ? [{ key: "stack", label: "AI Stack" }] : []),
    { key: "updates", label: "Updates" },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px clamp(20px, 5vw, 80px)",
        background: `${DS.colors.bg}ee`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${DS.colors.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <DeFybLogo size={24} />
          <div style={{ width: "1px", height: "20px", background: DS.colors.border }} />
          <span style={{ fontSize: "14px", color: DS.colors.textMuted }}>{practice.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {practiceId && <NotificationBell userType="client" />}
          <span onClick={onBack} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}>Sign out</span>
        </div>
      </nav>

      <div style={{ padding: "80px clamp(20px, 5vw, 80px) 40px", maxWidth: "1100px", margin: "0 auto" }}>
        {/* STAGE PROGRESS */}
        <StageProgressBar currentStage={practice.stage} />

        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "32px", borderBottom: `1px solid ${DS.colors.border}` }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
              fontFamily: DS.fonts.body, fontSize: "14px", fontWeight: 500,
              color: tab === t.key ? DS.colors.shock : DS.colors.textMuted,
              borderBottom: tab === t.key ? `2px solid ${DS.colors.shock}` : "2px solid transparent",
              marginBottom: "-1px", transition: "all 0.2s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="fade-in">
            {/* Stage Message */}
            <Card style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ fontSize: "40px" }}>{stageMessage.icon}</div>
              <div>
                <h2 style={{ fontFamily: DS.fonts.display, fontSize: "24px", marginBottom: "4px" }}>
                  {stageMessage.title}
                </h2>
                <p style={{ color: DS.colors.textMuted, fontSize: "14px" }}>{stageMessage.subtitle}</p>
              </div>
            </Card>

            {/* Health Score (only for managed) */}
            {practice.stage === "managed" && practice.score && (
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "40px", alignItems: "start", marginBottom: "32px" }}>
                <HealthScoreRing score={practice.score} size={160} />
                <div>
                  <h3 style={{ fontFamily: DS.fonts.display, fontSize: "22px", marginBottom: "16px" }}>
                    Practice Health
                  </h3>
                  {hasCurrentMetrics && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                      {m.docTime != null && (
                        <MetricCard small label="Doc Time" value={`${m.docTime} min`} sub={m.docTimeBaseline ? `was ${m.docTimeBaseline} min` : undefined} color={DS.colors.blue} />
                      )}
                      {m.denialRate != null && (
                        <MetricCard small label="Denial Rate" value={`${m.denialRate}%`} sub={m.denialBaseline ? `was ${m.denialBaseline}%` : undefined} color={m.denialRate < 6 ? DS.colors.vital : DS.colors.warn} />
                      )}
                      {m.callRate != null && (
                        <MetricCard small label="Call Answer" value={`${m.callRate}%`} sub={m.callBaseline ? `was ${m.callBaseline}%` : undefined} color={DS.colors.blue} />
                      )}
                      {m.codingUplift != null && m.codingUplift > 0 && (
                        <MetricCard small label="Coding Uplift" value={`$${(m.codingUplift / 1000).toFixed(0)}K`} sub="this month" color={DS.colors.vital} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Baseline captured (for assessment stage) */}
            {practice.stage === "assessment" && practice.doc_time_baseline && (
              <Card style={{ marginBottom: "24px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Baseline Captured</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                  {practice.doc_time_baseline && <MetricCard small label="Doc Time" value={`${practice.doc_time_baseline} min`} color={DS.colors.blue} />}
                  {practice.denial_rate_baseline && <MetricCard small label="Denial Rate" value={`${practice.denial_rate_baseline}%`} color={DS.colors.warn} />}
                  {practice.call_answer_rate_baseline && <MetricCard small label="Call Answer" value={`${practice.call_answer_rate_baseline}%`} color={DS.colors.blue} />}
                </div>
                <p style={{ fontSize: "13px", color: DS.colors.textMuted, marginTop: "16px" }}>
                  We'll compare these baseline numbers to your metrics after implementation.
                </p>
              </Card>
            )}

            {/* AI Stack Preview */}
            {practice.stack?.length > 0 && (
              <Card style={{ marginBottom: "24px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Your AI Stack</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {practice.stack.map((tool, i) => (
                    <span key={i} style={{
                      padding: "8px 14px", borderRadius: DS.radius.md,
                      background: tool.status === "active" ? DS.colors.vitalDim : tool.status === "deploying" ? DS.colors.warnDim : DS.colors.bg,
                      border: `1px solid ${tool.status === "active" ? DS.colors.vital : tool.status === "deploying" ? DS.colors.warn : DS.colors.border}`,
                      fontSize: "13px",
                      color: tool.status === "active" ? DS.colors.vital : tool.status === "deploying" ? DS.colors.warn : DS.colors.textMuted,
                    }}>
                      {tool.name}
                      {tool.status !== "active" && <span style={{ fontSize: "10px", marginLeft: "6px", textTransform: "uppercase" }}>({tool.status})</span>}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {/* Recent Updates */}
            {notifications.length > 0 && (
              <Card>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Recent Updates</div>
                <div style={{ display: "grid", gap: "8px" }}>
                  {notifications.slice(0, 5).map((notif, i) => (
                    <div key={i} style={{
                      display: "flex", gap: "12px", padding: "10px 0",
                      borderBottom: i < Math.min(notifications.length, 5) - 1 ? `1px solid ${DS.colors.border}` : "none",
                    }}>
                      <span style={{ fontSize: "14px" }}>
                        {notif.type === "stage_change" ? "🔄" : notif.type === "metric_update" ? "📈" : "📝"}
                      </span>
                      <div>
                        <div style={{ fontWeight: 500, fontSize: "13px" }}>{notif.title}</div>
                        <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>{notif.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* PILOT TAB */}
        {tab === "pilot" && hasPilot && (
          <div className="fade-in">
            <Card style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ fontFamily: DS.fonts.display, fontSize: "22px", marginBottom: "4px" }}>
                    Your Pilot Journey
                  </h3>
                  <p style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                    {practice.pilot_start_date
                      ? `Started ${new Date(practice.pilot_start_date).toLocaleDateString()}`
                      : "Tracking your transformation progress"}
                  </p>
                </div>
                <div style={{
                  padding: "8px 16px", borderRadius: DS.radius.md,
                  background: practice.pilot_status === "completed" ? DS.colors.vitalDim : DS.colors.blueDim,
                  color: practice.pilot_status === "completed" ? DS.colors.vital : DS.colors.blue,
                  fontSize: "13px", fontWeight: 600,
                }}>
                  {practice.pilot_status === "completed" ? "Completed" : `Week ${practice.pilot_status?.replace("week", "")}`}
                </div>
              </div>

              {/* Week Progress Timeline */}
              <div style={{ display: "grid", gap: "16px" }}>
                {[
                  { key: "week1", num: 1, title: "Scribe Selection", desc: "Choose and set up your AI scribe", icon: "🎯" },
                  { key: "week2", num: 2, title: "EHR Integration", desc: "Connect to your electronic health record", icon: "🔗" },
                  { key: "week3", num: 3, title: "Full-Day Pilot", desc: "Test drive with real patients", icon: "🚀" },
                  { key: "week4", num: 4, title: "Coding Analysis", desc: "Review impact and make decision", icon: "📊" },
                ].map((week) => {
                  const checklist = practice.pilot_checklist?.[week.key] || {};
                  const checkableFields = Object.entries(checklist).filter(([k, v]) => typeof v === "boolean");
                  const completedCount = checkableFields.filter(([k, v]) => v).length;
                  const totalCount = checkableFields.length || 1;
                  const progress = Math.round((completedCount / totalCount) * 100);
                  const weekNum = parseInt(practice.pilot_status?.replace("week", "") || "0");
                  const isCurrentWeek = practice.pilot_status === week.key;
                  const isCompleted = progress === 100 || weekNum > week.num || practice.pilot_status === "completed";
                  const isUpcoming = weekNum < week.num && practice.pilot_status !== "completed";

                  return (
                    <div key={week.key} style={{
                      display: "grid", gridTemplateColumns: "50px 1fr auto", gap: "16px", alignItems: "center",
                      padding: "16px", borderRadius: DS.radius.md,
                      background: isCurrentWeek ? DS.colors.blueDim : DS.colors.bg,
                      border: `1px solid ${isCurrentWeek ? DS.colors.blue : isCompleted ? DS.colors.vital : DS.colors.border}`,
                      opacity: isUpcoming ? 0.5 : 1,
                    }}>
                      <div style={{
                        width: "44px", height: "44px", borderRadius: "50%", display: "flex",
                        alignItems: "center", justifyContent: "center", fontSize: "20px",
                        background: isCompleted ? DS.colors.vitalDim : isCurrentWeek ? DS.colors.blueDim : DS.colors.bgCard,
                        border: `2px solid ${isCompleted ? DS.colors.vital : isCurrentWeek ? DS.colors.blue : DS.colors.border}`,
                      }}>
                        {isCompleted ? "✓" : week.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "2px" }}>
                          Week {week.num}: {week.title}
                        </div>
                        <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                          {week.desc}
                        </div>
                        {isCurrentWeek && checklist.notes && (
                          <div style={{ fontSize: "12px", color: DS.colors.blue, marginTop: "6px", fontStyle: "italic" }}>
                            Note: {checklist.notes}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {isCompleted ? (
                          <span style={{ color: DS.colors.vital, fontSize: "12px", fontWeight: 600 }}>Complete</span>
                        ) : isCurrentWeek ? (
                          <div>
                            <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>{progress}%</div>
                            <div style={{ width: "80px", height: "4px", background: DS.colors.border, borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ width: `${progress}%`, height: "100%", background: DS.colors.blue }} />
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: DS.colors.textMuted, fontSize: "12px" }}>Upcoming</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* What's Next */}
            <Card>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px" }}>What's Next?</div>
              {practice.pilot_status === "week1" && (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  <p>Your DeFyb team is helping you select the right AI scribe for your practice. Once selected, we'll create your account and get the mobile app installed.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.blue }}>Expected: First AI-generated note within the week</p>
                </div>
              )}
              {practice.pilot_status === "week2" && (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  <p>We're connecting your AI scribe to your EHR system. This ensures notes flow seamlessly into patient charts.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.blue }}>Expected: Test patient notes syncing to EHR</p>
                </div>
              )}
              {practice.pilot_status === "week3" && (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  <p>Time for the real test! You'll use the AI scribe for a full day of patients. We'll be available for support throughout.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.blue }}>Expected: Full day using AI, measuring time saved</p>
                </div>
              )}
              {practice.pilot_status === "week4" && (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  <p>We're analyzing the coding patterns from your pilot notes to identify potential E/M coding improvements. Then we'll meet to discuss the go/no-go decision.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.blue }}>Expected: Coding analysis report and decision meeting</p>
                </div>
              )}
              {practice.pilot_status === "completed" && (
                <div style={{ fontSize: "13px" }}>
                  <p style={{ color: DS.colors.vital, fontWeight: 500 }}>Congratulations! Your pilot is complete.</p>
                  <p style={{ marginTop: "8px", color: DS.colors.textMuted }}>Based on the results, your DeFyb team will work with you on the next steps for full implementation.</p>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* METRICS TAB */}
        {tab === "metrics" && hasCurrentMetrics && (
          <div className="fade-in">
            {/* Before/After Comparison */}
            <Card style={{ marginBottom: "24px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "20px" }}>Your Transformation</div>
              <div style={{ display: "grid", gap: "16px" }}>
                {m.docTime != null && m.docTimeBaseline != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "14px", color: DS.colors.textMuted, width: "140px" }}>Documentation</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.danger, textDecoration: "line-through" }}>{m.docTimeBaseline} min/pt</span>
                    <span style={{ color: DS.colors.shock, fontSize: "16px" }}>→</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.vital, fontWeight: 600 }}>{m.docTime} min/pt</span>
                    <span style={{ fontSize: "12px", color: DS.colors.vital, marginLeft: "auto" }}>
                      {Math.round((1 - m.docTime / m.docTimeBaseline) * 100)}% faster
                    </span>
                  </div>
                )}
                {m.denialRate != null && m.denialBaseline != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "14px", color: DS.colors.textMuted, width: "140px" }}>Denial Rate</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.danger, textDecoration: "line-through" }}>{m.denialBaseline}%</span>
                    <span style={{ color: DS.colors.shock, fontSize: "16px" }}>→</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.vital, fontWeight: 600 }}>{m.denialRate}%</span>
                    <span style={{ fontSize: "12px", color: DS.colors.vital, marginLeft: "auto" }}>
                      {(m.denialBaseline - m.denialRate).toFixed(1)}pp reduction
                    </span>
                  </div>
                )}
                {m.callRate != null && m.callBaseline != null && (
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span style={{ fontSize: "14px", color: DS.colors.textMuted, width: "140px" }}>Calls Answered</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.danger, textDecoration: "line-through" }}>{m.callBaseline}%</span>
                    <span style={{ color: DS.colors.shock, fontSize: "16px" }}>→</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: DS.colors.vital, fontWeight: 600 }}>{m.callRate}%</span>
                    <span style={{ fontSize: "12px", color: DS.colors.vital, marginLeft: "auto" }}>
                      +{(m.callRate - m.callBaseline).toFixed(0)}pp
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Revenue Impact */}
            {(m.codingUplift || m.revenue) && (
              <Card>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Revenue Impact</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  {m.codingUplift && m.codingUplift > 0 && (
                    <MetricCard label="Coding Uplift" value={`$${(m.codingUplift / 1000).toFixed(0)}K/mo`} color={DS.colors.vital} />
                  )}
                  {m.revenue && m.revenue > 0 && (
                    <MetricCard label="Revenue Recovered" value={`$${(m.revenue / 1000).toFixed(0)}K/mo`} color={DS.colors.vital} />
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* AI STACK TAB */}
        {tab === "stack" && practice.stack?.length > 0 && (
          <div className="fade-in">
            <div style={{ display: "grid", gap: "12px" }}>
              {practice.stack.map((tool, i) => (
                <Card key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{tool.name}</div>
                    <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                      {tool.status === "active" ? `Active since ${tool.since}` :
                       tool.status === "deploying" ? "Currently deploying..." :
                       `Planned for ${tool.since}`}
                    </div>
                  </div>
                  <span style={{
                    padding: "6px 14px", borderRadius: DS.radius.sm, fontSize: "11px", fontWeight: 600,
                    color: tool.status === "active" ? DS.colors.vital : tool.status === "deploying" ? DS.colors.warn : DS.colors.textMuted,
                    background: tool.status === "active" ? DS.colors.vitalDim : tool.status === "deploying" ? DS.colors.warnDim : DS.colors.bg,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>{tool.status}</span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* UPDATES TAB */}
        {tab === "updates" && (
          <div className="fade-in">
            {notifications.length === 0 ? (
              <Card style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px" }}>📬</div>
                <p style={{ color: DS.colors.textMuted }}>No updates yet. Check back soon!</p>
              </Card>
            ) : (
              <div style={{ display: "grid", gap: "8px" }}>
                {notifications.map((notif, i) => (
                  <Card key={i} style={{ display: "flex", gap: "16px", padding: "16px 20px" }}>
                    <div style={{
                      fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.textDim,
                      whiteSpace: "nowrap", minWidth: "80px",
                    }}>
                      {new Date(notif.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "13px", marginBottom: "4px" }}>{notif.title}</div>
                      <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>{notif.message}</div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// TEAM DASHBOARD
// ============================================================
const TeamDashboard = ({ onBack }) => {
  const [view, setView] = useState("pipeline");
  const [selectedClient, setSelectedClient] = useState(null);
  const [practices, setPractices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null); // 'baseline', 'implementation', 'golive', 'metrics', 'quote'
  const [selectedQuote, setSelectedQuote] = useState(null);

  const refreshPractices = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data, error } = await supabase
        .from('practices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const transformed = transformPractices(data);
      setPractices(transformed);
      // Update selected client if it exists
      if (selectedClient) {
        const updated = transformed.find(p => p.id === selectedClient.id);
        if (updated) setSelectedClient(updated);
      }
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  const transformPractices = (data) => data.map((p) => ({
    id: p.id,
    name: p.name || 'Unnamed Practice',
    providers: p.provider_count || '?',
    provider_count: p.provider_count,
    ehr: p.ehr || 'Unknown',
    stage: p.stage || 'lead',
    score: p.health_score || null,
    specialty: p.specialty || 'Not specified',
    contact: {
      name: p.contact_name,
      email: p.contact_email,
      phone: p.contact_phone,
      role: p.contact_role,
    },
    painPoints: p.pain_points || [],
    interestDrivers: p.interest_drivers || [],
    // Lead scoring
    lead_score: p.lead_score,
    lead_score_breakdown: p.lead_score_breakdown,
    // Referral
    referral_code: p.referral_code,
    referred_by: p.referred_by,
    referral_credits: p.referral_credits || 0,
    // Payment/Billing
    stripe_customer_id: p.stripe_customer_id,
    payment_status: p.payment_status || 'none',
    monthly_rate: p.monthly_rate || 0,
    contract_start_date: p.contract_start_date,
    contract_end_date: p.contract_end_date,
    total_value_delivered: p.total_value_delivered || 0,
    // Baseline fields (Time)
    doc_time_baseline: p.doc_time_baseline,
    pajama_time_baseline: p.pajama_time_baseline,
    coding_review_time_baseline: p.coding_review_time_baseline,
    pa_staff_hours_baseline: p.pa_staff_hours_baseline,
    peer_to_peer_calls_baseline: p.peer_to_peer_calls_baseline,
    patients_per_day: p.patients_per_day,
    hours_worked_weekly: p.hours_worked_weekly,
    // Baseline fields (Money)
    has_coder: p.has_coder,
    coder_annual_cost: p.coder_annual_cost,
    em_coding_distribution: p.em_coding_distribution,
    em_reimbursement_99213: p.em_reimbursement_99213,
    em_reimbursement_99214: p.em_reimbursement_99214,
    em_reimbursement_99215: p.em_reimbursement_99215,
    avg_reimbursement_per_visit: p.avg_reimbursement_per_visit,
    denial_rate_baseline: p.denial_rate_baseline,
    days_in_ar_baseline: p.days_in_ar_baseline,
    call_answer_rate_baseline: p.call_answer_rate_baseline,
    // Baseline fields (Risk)
    tribal_knowledge: p.tribal_knowledge,
    // ROI projections
    roi_projections: p.roi_projections,
    // Current metrics
    doc_time_current: p.doc_time_current,
    denial_rate_current: p.denial_rate_current,
    call_answer_rate_current: p.call_answer_rate_current,
    coding_uplift_monthly: p.coding_uplift_monthly,
    revenue_recovered_monthly: p.revenue_recovered_monthly,
    health_score: p.health_score,
    pajama_time_current: p.pajama_time_current,
    coding_review_time_current: p.coding_review_time_current,
    pa_staff_hours_current: p.pa_staff_hours_current,
    peer_to_peer_calls_current: p.peer_to_peer_calls_current,
    days_in_ar_current: p.days_in_ar_current,
    em_coding_distribution_current: p.em_coding_distribution_current,
    // Pilot tracking
    pilot_start_date: p.pilot_start_date,
    pilot_status: p.pilot_status,
    pilot_checklist: p.pilot_checklist,
    // Implementation
    ai_stack: p.ai_stack || [],
    go_live_date: p.go_live_date,
    portal_enabled: p.portal_enabled,
    // Activity
    activity_log: p.activity_log || [],
    metrics: {
      docTime: p.doc_time_current,
      docTimeBaseline: p.doc_time_baseline,
      denialRate: p.denial_rate_current,
      denialBaseline: p.denial_rate_baseline,
      callRate: p.call_answer_rate_current,
      callBaseline: p.call_answer_rate_baseline,
      codingUplift: p.coding_uplift_monthly,
      revenue: p.revenue_recovered_monthly,
    },
    stack: p.ai_stack || [],
    notes: p.activity_log?.length > 0
      ? p.activity_log.map(log => ({ date: log.date, text: log.text }))
      : [{ date: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), text: 'Intake received via website.' }],
    createdAt: p.created_at,
  }));

  const handleStageAction = (action) => {
    setModalType(action);
  };

  const handleModalClose = () => {
    setModalType(null);
  };

  const handleModalSave = async () => {
    setModalType(null);
    await refreshPractices();
  };

  const handleDeletePractice = async (practice) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${practice.name}"?\n\nThis will permanently remove the practice and all associated data (quotes, tasks, etc.).`
    );

    if (!confirmed) return;

    try {
      // Delete related records first
      await supabase.from('tasks').delete().eq('practice_id', practice.id);
      await supabase.from('quotes').delete().eq('practice_id', practice.id);
      await supabase.from('documents').delete().eq('practice_id', practice.id);
      await supabase.from('payments').delete().eq('practice_id', practice.id);
      await supabase.from('notifications').delete().eq('practice_id', practice.id);
      await supabase.from('activity_log').delete().eq('practice_id', practice.id);

      // Delete the practice
      const { error } = await supabase.from('practices').delete().eq('id', practice.id);
      if (error) throw error;

      setSelectedClient(null);
      await refreshPractices();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete practice: ' + err.message);
    }
  };

  useEffect(() => {
    const fetchPractices = async () => {
      if (!isSupabaseConfigured()) {
        setPractices(SAMPLE_CLIENTS);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('practices')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setPractices(transformPractices(data));
      } catch (err) {
        console.error('Error fetching practices:', err);
        setPractices(SAMPLE_CLIENTS);
      } finally {
        setLoading(false);
      }
    };

    fetchPractices();
  }, []);

  const views = [
    { key: "pipeline", label: "Pipeline" },
    { key: "pilots", label: "Pilots" },
    { key: "activity", label: "Activity" },
    { key: "finances", label: "Finances" },
    { key: "tasks", label: "Tasks" },
  ];

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px clamp(20px, 5vw, 80px)",
        background: `${DS.colors.bg}ee`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${DS.colors.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <DeFybLogo size={24} />
          <div style={{ width: "1px", height: "20px", background: DS.colors.border }} />
          <span style={{ fontFamily: DS.fonts.mono, fontSize: "12px", color: DS.colors.shock }}>TEAM</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <NotificationBell userType="team" />
          <span onClick={onBack} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}>Sign out</span>
        </div>
      </nav>

      <div style={{ padding: "80px clamp(20px, 5vw, 60px) 40px", maxWidth: "1400px", margin: "0 auto" }}>

        {/* TOP STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "24px" }}>
          <MetricCard small label="Active Practices" value={practices.filter(p => p.stage === 'managed').length.toString()} color={DS.colors.vital} />
          <MetricCard small label="In Pipeline" value={practices.filter(p => ['lead', 'assessment', 'implementation'].includes(p.stage)).length.toString()} color={DS.colors.warn} />
          <MetricCard small label="Total Practices" value={practices.length.toString()} color={DS.colors.shock} />
          <MetricCard small label="Leads" value={practices.filter(p => p.stage === 'lead').length.toString()} color={DS.colors.blue} />
        </div>

        {/* VIEW TOGGLE */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
          {views.map((v) => (
            <button key={v.key} onClick={() => { setView(v.key); setSelectedClient(null); }} style={{
              padding: "8px 16px", background: view === v.key ? DS.colors.bgCard : "none",
              border: `1px solid ${view === v.key ? DS.colors.borderLight : "transparent"}`,
              borderRadius: DS.radius.sm, cursor: "pointer", fontFamily: DS.fonts.body,
              fontSize: "13px", fontWeight: 500, color: view === v.key ? DS.colors.text : DS.colors.textMuted,
            }}>{v.label}</button>
          ))}
        </div>

        {/* PIPELINE VIEW */}
        {view === "pipeline" && !selectedClient && (
          loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: DS.colors.textMuted }}>
              <div style={{ fontSize: "24px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>⚡</div>
              Loading practices...
            </div>
          ) : (
          <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
            {STAGES.map((stage) => (
              <div key={stage.key}>
                <div style={{
                  fontSize: "11px", color: stage.color, textTransform: "uppercase",
                  letterSpacing: "0.08em", fontWeight: 600, marginBottom: "10px",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: stage.color }} />
                  {stage.label}
                  <span style={{ color: DS.colors.textDim, fontWeight: 400 }}>
                    ({practices.filter((c) => c.stage === stage.key).length})
                  </span>
                </div>
                <div style={{ display: "grid", gap: "8px" }}>
                  {practices.filter((c) => c.stage === stage.key).map((c) => (
                    <div key={c.id} onClick={() => setSelectedClient(c)} style={{
                      padding: "14px 16px", background: DS.colors.bgCard,
                      border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md,
                      cursor: "pointer", transition: "border-color 0.2s",
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = DS.colors.borderLight}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = DS.colors.border}
                    >
                      {/* Lead Score Badge for leads */}
                      {c.stage === "lead" && c.lead_score && (
                        <div style={{ marginBottom: "8px" }}>
                          <LeadScoreBadge score={c.lead_score} size="small" />
                        </div>
                      )}
                      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "4px" }}>{c.name}</div>
                      <div style={{ fontSize: "11px", color: DS.colors.textMuted }}>{c.providers} providers · {c.specialty}</div>
                      <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "2px" }}>{c.ehr}</div>
                      {c.score && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px" }}>
                          <div style={{
                            width: "60px", height: "4px", background: DS.colors.border, borderRadius: "2px", overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${c.score}%`, height: "100%", borderRadius: "2px",
                              background: c.score >= 80 ? DS.colors.vital : c.score >= 60 ? DS.colors.warn : DS.colors.danger,
                            }} />
                          </div>
                          <span style={{ fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.textMuted }}>{c.score}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          )
        )}

        {/* CLIENT DETAIL */}
        {view === "pipeline" && selectedClient && (
          <div className="fade-in">
            <button onClick={() => setSelectedClient(null)} style={{
              background: "none", border: "none", cursor: "pointer", color: DS.colors.shock,
              fontSize: "13px", fontFamily: DS.fonts.body, marginBottom: "20px", padding: 0,
            }}>← Back to pipeline</button>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
              {selectedClient.score && <HealthScoreRing score={selectedClient.score} size={80} />}
              <div>
                <h3 style={{ fontFamily: DS.fonts.display, fontSize: "24px" }}>{selectedClient.name}</h3>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  {selectedClient.providers} providers · {selectedClient.specialty} · {selectedClient.ehr}
                </div>
              </div>
            </div>

            {/* STAGE ACTIONS */}
            <StageActions practice={selectedClient} onAction={handleStageAction} />

            {/* QUICK ACTIONS */}
            <div style={{
              display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap",
            }}>
              <Button small onClick={() => setModalType("proposal")} style={{ background: DS.colors.vital, border: "none" }}>
                📊 Generate Proposal
              </Button>
              <Button small onClick={() => setModalType("quote")}>
                Create Quote
              </Button>
              {["assessment", "implementation"].includes(selectedClient.stage) && (
                <Button small onClick={() => setModalType("pilot")} style={{ background: DS.colors.blue, border: "none" }}>
                  🚀 Track Pilot
                </Button>
              )}
              {selectedClient.stage === "managed" && (
                <Button small onClick={() => generateScorecardPDF(selectedClient)}>
                  Download Scorecard
                </Button>
              )}
              {selectedClient.lead_score && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", color: DS.colors.textMuted }}>Lead Score:</span>
                  <LeadScoreBadge score={selectedClient.lead_score} />
                </div>
              )}
              <Button
                small
                onClick={() => handleDeletePractice(selectedClient)}
                style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${DS.colors.danger}`, color: DS.colors.danger }}
              >
                Delete
              </Button>
            </div>

            {/* PILOT STATUS (for assessment/implementation) */}
            {["assessment", "implementation"].includes(selectedClient.stage) && selectedClient.pilot_status && selectedClient.pilot_status !== "not_started" && (
              <Card style={{ marginBottom: "16px", borderColor: DS.colors.blue }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px", color: DS.colors.blue, marginBottom: "4px" }}>
                      🚀 Pilot In Progress
                    </div>
                    <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                      Current Phase: {selectedClient.pilot_status === "completed" ? "Completed" : `Week ${selectedClient.pilot_status.replace("week", "")}`}
                      {selectedClient.pilot_start_date && ` • Started ${new Date(selectedClient.pilot_start_date).toLocaleDateString()}`}
                    </div>
                  </div>
                  <Button small onClick={() => setModalType("pilot")}>View Progress</Button>
                </div>
              </Card>
            )}

            {/* ROI PROJECTION (if calculated) */}
            {selectedClient.roi_projections?.totalAnnualValue > 0 && (
              <Card style={{ marginBottom: "16px", background: `linear-gradient(135deg, ${DS.colors.bgCard}, ${DS.colors.shockGlow})` }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>
                  💰 Projected Annual ROI
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
                  <MetricCard small label="Time Saved" value={`${selectedClient.roi_projections.timeSavedAnnualHours}h`} color={DS.colors.blue} />
                  <MetricCard small label="Time Value" value={`$${(selectedClient.roi_projections.timeSavedAnnualValue / 1000).toFixed(0)}k`} color={DS.colors.blue} />
                  <MetricCard small label="Coding Uplift" value={`$${(selectedClient.roi_projections.codingUpliftAnnual / 1000).toFixed(0)}k`} color={DS.colors.vital} />
                  <MetricCard small label="Total ROI" value={`$${(selectedClient.roi_projections.totalAnnualValue / 1000).toFixed(0)}k`} color={DS.colors.shock} />
                </div>
              </Card>
            )}

            {/* QUOTES */}
            <QuotesList
              practiceId={selectedClient.id}
              onSelect={(quote) => setSelectedQuote(quote)}
            />

            {/* TASKS */}
            <TaskList practiceId={selectedClient.id} />

            {/* CONTACT INFO (for leads) */}
            {selectedClient.contact?.email && (
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>Contact</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", fontSize: "13px" }}>
                  {selectedClient.contact.name && (
                    <div><span style={{ color: DS.colors.textMuted }}>Name:</span> {selectedClient.contact.name}</div>
                  )}
                  {selectedClient.contact.email && (
                    <div><span style={{ color: DS.colors.textMuted }}>Email:</span> <a href={`mailto:${selectedClient.contact.email}`} style={{ color: DS.colors.shock }}>{selectedClient.contact.email}</a></div>
                  )}
                  {selectedClient.contact.phone && (
                    <div><span style={{ color: DS.colors.textMuted }}>Phone:</span> {selectedClient.contact.phone}</div>
                  )}
                  {selectedClient.contact.role && (
                    <div><span style={{ color: DS.colors.textMuted }}>Role:</span> {selectedClient.contact.role}</div>
                  )}
                </div>
              </Card>
            )}

            {/* PAIN POINTS (for leads) */}
            {selectedClient.painPoints?.length > 0 && (
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>Pain Points</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {selectedClient.painPoints.map((p, i) => (
                    <span key={i} style={{
                      padding: "4px 10px", background: DS.colors.shockGlow, border: `1px solid ${DS.colors.shock}`,
                      borderRadius: DS.radius.sm, fontSize: "12px", color: DS.colors.shock,
                    }}>{p}</span>
                  ))}
                </div>
              </Card>
            )}

            {/* INTEREST DRIVERS */}
            {selectedClient.interestDrivers?.length > 0 && (
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>Interest Drivers</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {selectedClient.interestDrivers.map((d, i) => (
                    <span key={i} style={{
                      padding: "4px 10px", background: DS.colors.blueDim, border: `1px solid ${DS.colors.blue}`,
                      borderRadius: DS.radius.sm, fontSize: "12px", color: DS.colors.blue,
                    }}>{d}</span>
                  ))}
                </div>
              </Card>
            )}

            {/* METRICS */}
            {selectedClient.metrics?.docTime != null && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginBottom: "24px" }}>
                <MetricCard small label="Doc Time" value={`${selectedClient.metrics.docTime} min`} sub={`was ${selectedClient.metrics.docTimeBaseline}`} color={DS.colors.blue} />
                <MetricCard small label="Revenue ↑" value={`$${(selectedClient.metrics.revenue / 1000).toFixed(0)}K/mo`} color={DS.colors.vital} />
                <MetricCard small label="Coding ↑" value={`$${(selectedClient.metrics.codingUplift / 1000).toFixed(0)}K/mo`} color={DS.colors.vital} />
                <MetricCard small label="Denials" value={`${selectedClient.metrics.denialRate}%`} sub={`was ${selectedClient.metrics.denialBaseline}%`} color={DS.colors.vital} />
                <MetricCard small label="Calls" value={`${selectedClient.metrics.callRate}%`} sub={`was ${selectedClient.metrics.callBaseline}%`} color={DS.colors.blue} />
                {selectedClient.metrics.dme > 0 && <MetricCard small label="DME" value={`$${(selectedClient.metrics.dme / 1000).toFixed(0)}K/mo`} color={DS.colors.vital} />}
              </div>
            )}

            {/* STACK */}
            {selectedClient.stack.length > 0 && (
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>AI Stack</div>
                {selectedClient.stack.map((tool, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: i < selectedClient.stack.length - 1 ? `1px solid ${DS.colors.border}` : "none",
                  }}>
                    <span style={{ fontSize: "13px" }}>{tool.name}</span>
                    <span style={{
                      fontSize: "10px", fontWeight: 600, textTransform: "uppercase",
                      color: tool.status === "active" ? DS.colors.vital : tool.status === "deploying" ? DS.colors.warn : DS.colors.textDim,
                    }}>{tool.status} · {tool.since}</span>
                  </div>
                ))}
              </Card>
            )}

            {/* NOTES */}
            <Card style={{ marginBottom: "16px" }}>
              <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>Activity Log</div>
              {selectedClient.notes.map((note, i) => (
                <div key={i} style={{
                  display: "flex", gap: "12px", padding: "8px 0",
                  borderBottom: i < selectedClient.notes.length - 1 ? `1px solid ${DS.colors.border}` : "none",
                }}>
                  <span style={{ fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.textDim, whiteSpace: "nowrap" }}>{note.date}</span>
                  <span style={{ fontSize: "13px", color: DS.colors.textMuted }}>{note.text}</span>
                </div>
              ))}
            </Card>

            {/* REFERRAL CODE (for managed clients) */}
            {selectedClient.stage === "managed" && selectedClient.referral_code && (
              <ReferralCodeCard
                referralCode={selectedClient.referral_code}
                credits={selectedClient.referral_credits}
              />
            )}
          </div>
        )}

        {/* PILOTS VIEW */}
        {view === "pilots" && (
          <div className="fade-in">
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: DS.colors.textMuted }}>
                <div style={{ fontSize: "24px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>🚀</div>
                Loading pilots...
              </div>
            ) : (
              <div>
                {/* Pilot Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "24px" }}>
                  <MetricCard small label="Active Pilots" value={practices.filter(p => p.pilot_status && p.pilot_status !== "not_started" && p.pilot_status !== "completed").length.toString()} color={DS.colors.blue} />
                  <MetricCard small label="Completed" value={practices.filter(p => p.pilot_status === "completed").length.toString()} color={DS.colors.vital} />
                  <MetricCard small label="Not Started" value={practices.filter(p => ["assessment", "implementation"].includes(p.stage) && (!p.pilot_status || p.pilot_status === "not_started")).length.toString()} color={DS.colors.textMuted} />
                  <MetricCard small label="Go Decisions" value={practices.filter(p => p.pilot_checklist?.week4?.go_no_go_decision === "go").length.toString()} color={DS.colors.shock} />
                </div>

                {/* Pilot List */}
                <div style={{ display: "grid", gap: "12px" }}>
                  {practices
                    .filter(p => ["assessment", "implementation"].includes(p.stage))
                    .sort((a, b) => {
                      // Sort by pilot status: active first, then not started, then completed
                      const statusOrder = { week1: 1, week2: 2, week3: 3, week4: 4, not_started: 5, completed: 6 };
                      return (statusOrder[a.pilot_status] || 5) - (statusOrder[b.pilot_status] || 5);
                    })
                    .map((practice) => {
                      const pilotStatus = practice.pilot_status || "not_started";
                      const checklist = practice.pilot_checklist || {};
                      const isActive = pilotStatus !== "not_started" && pilotStatus !== "completed";

                      // Calculate overall progress
                      const getWeekProgress = (week) => {
                        const items = checklist[week] || {};
                        const checkableFields = Object.entries(items).filter(([k, v]) => typeof v === "boolean");
                        if (checkableFields.length === 0) return 0;
                        const completed = checkableFields.filter(([k, v]) => v).length;
                        return Math.round((completed / checkableFields.length) * 100);
                      };
                      const totalProgress = Math.round((getWeekProgress("week1") + getWeekProgress("week2") + getWeekProgress("week3") + getWeekProgress("week4")) / 4);

                      return (
                        <Card key={practice.id} style={{
                          borderColor: isActive ? DS.colors.blue : pilotStatus === "completed" ? DS.colors.vital : DS.colors.border,
                          cursor: "pointer",
                        }} onClick={() => { setSelectedClient(practice); setView("pipeline"); }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                <span style={{ fontWeight: 600, fontSize: "15px" }}>{practice.name}</span>
                                <span style={{
                                  padding: "2px 8px", borderRadius: DS.radius.sm, fontSize: "10px", fontWeight: 600,
                                  background: isActive ? DS.colors.blueDim : pilotStatus === "completed" ? DS.colors.vitalDim : DS.colors.bg,
                                  color: isActive ? DS.colors.blue : pilotStatus === "completed" ? DS.colors.vital : DS.colors.textMuted,
                                  textTransform: "uppercase",
                                }}>
                                  {pilotStatus === "not_started" ? "Not Started" : pilotStatus === "completed" ? "Completed" : `Week ${pilotStatus.replace("week", "")}`}
                                </span>
                              </div>
                              <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                                {practice.providers} providers • {practice.specialty} • {practice.ehr}
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div style={{ width: "200px", marginLeft: "20px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: DS.colors.textMuted, marginBottom: "4px" }}>
                                <span>Progress</span>
                                <span>{totalProgress}%</span>
                              </div>
                              <div style={{ height: "6px", background: DS.colors.border, borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{
                                  width: `${totalProgress}%`, height: "100%",
                                  background: totalProgress === 100 ? DS.colors.vital : DS.colors.blue,
                                  transition: "width 0.3s ease",
                                }} />
                              </div>
                              <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
                                {["week1", "week2", "week3", "week4"].map((week, i) => (
                                  <div key={week} style={{
                                    flex: 1, height: "4px", borderRadius: "2px",
                                    background: getWeekProgress(week) === 100 ? DS.colors.vital :
                                               getWeekProgress(week) > 0 ? DS.colors.blue : DS.colors.border,
                                  }} title={`Week ${i + 1}: ${getWeekProgress(week)}%`} />
                                ))}
                              </div>
                            </div>

                            {/* Actions */}
                            <Button small onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClient(practice);
                              setModalType("pilot");
                            }} style={{ marginLeft: "16px" }}>
                              {pilotStatus === "not_started" ? "Start Pilot" : "Update"}
                            </Button>
                          </div>

                          {/* Week 4 Decision (if made) */}
                          {checklist.week4?.go_no_go_decision && (
                            <div style={{
                              marginTop: "12px", padding: "8px 12px", borderRadius: DS.radius.sm,
                              background: checklist.week4.go_no_go_decision === "go" ? DS.colors.vitalDim :
                                         checklist.week4.go_no_go_decision === "conditional" ? DS.colors.warnDim : DS.colors.dangerDim,
                              color: checklist.week4.go_no_go_decision === "go" ? DS.colors.vital :
                                    checklist.week4.go_no_go_decision === "conditional" ? DS.colors.warn : DS.colors.danger,
                              fontSize: "12px", fontWeight: 500,
                            }}>
                              Decision: {checklist.week4.go_no_go_decision === "go" ? "✅ GO - Proceed to full implementation" :
                                        checklist.week4.go_no_go_decision === "conditional" ? "⚠️ CONDITIONAL - Proceed with adjustments" :
                                        "❌ NO GO - Does not meet criteria"}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  {practices.filter(p => ["assessment", "implementation"].includes(p.stage)).length === 0 && (
                    <div style={{ textAlign: "center", padding: "40px 0", color: DS.colors.textMuted }}>
                      No practices in assessment or implementation stages. Pilots will appear here when practices advance from lead stage.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY VIEW */}
        {view === "activity" && (
          <div className="fade-in">
            {loading ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: DS.colors.textMuted }}>
                <div style={{ fontSize: "24px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>⚡</div>
                Loading activity...
              </div>
            ) : (
              <div style={{ display: "grid", gap: "6px" }}>
                {practices
                  .flatMap((p) => p.notes.map((note) => ({
                    date: note.date,
                    client: p.name,
                    action: note.text,
                    type: p.stage,
                    sortDate: p.createdAt || new Date().toISOString(),
                  })))
                  .sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
                  .slice(0, 20)
                  .map((item, i) => {
                    const stageInfo = STAGES.find((s) => s.key === item.type) || STAGES[0];
                    return (
                      <div key={i} style={{
                        display: "grid", gridTemplateColumns: "70px 8px 180px 1fr",
                        alignItems: "center", gap: "12px", padding: "10px 16px",
                        background: DS.colors.bgCard, borderRadius: DS.radius.sm,
                        border: `1px solid ${DS.colors.border}`,
                      }}>
                        <span style={{ fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.textDim }}>{item.date}</span>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: stageInfo.color }} />
                        <span style={{ fontSize: "13px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.client}</span>
                        <span style={{ fontSize: "13px", color: DS.colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.action}</span>
                      </div>
                    );
                  })}
                {practices.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 0", color: DS.colors.textMuted }}>
                    No activity yet. Practices will appear here when they submit intakes.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* FINANCES VIEW */}
        {view === "finances" && (
          <div className="fade-in">
            {/* Portfolio Charts Row */}
            <div style={{ marginBottom: "24px" }}>
              <PortfolioCharts practices={practices} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Revenue Summary */}
              <div>
                <FinancialSummaryCard practices={practices} />

                {/* Revenue by Client */}
                <Card>
                  <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Revenue by Client</div>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {practices
                      .filter(p => p.stage === "managed" && p.monthly_rate > 0)
                      .sort((a, b) => (b.monthly_rate || 0) - (a.monthly_rate || 0))
                      .slice(0, 10)
                      .map((p) => (
                        <div key={p.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "8px 12px", background: DS.colors.bg, borderRadius: DS.radius.sm,
                        }}>
                          <span style={{ fontSize: "13px" }}>{p.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontFamily: DS.fonts.mono, fontSize: "12px", color: DS.colors.vital }}>
                              ${(p.monthly_rate || 0).toLocaleString()}/mo
                            </span>
                            <PaymentStatusBadge status={p.payment_status} />
                          </div>
                        </div>
                      ))}
                    {practices.filter(p => p.stage === "managed").length === 0 && (
                      <div style={{ textAlign: "center", padding: "20px", color: DS.colors.textMuted }}>
                        No managed clients yet
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              {/* Pipeline Value */}
              <div>
                <Card style={{ marginBottom: "16px" }}>
                  <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Pipeline Value</div>
                  <div style={{ display: "grid", gap: "12px" }}>
                    {STAGES.map((stage) => {
                      const stageClients = practices.filter(p => p.stage === stage.key);
                      const estimatedValue = stageClients.reduce((sum, p) => {
                        const providers = parseInt(p.providers) || 1;
                        // Rough estimate: $500 base + $200/provider monthly
                        return sum + ((500 + 200 * providers) * 12);
                      }, 0);
                      return (
                        <div key={stage.key} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px", background: DS.colors.bg, borderRadius: DS.radius.sm,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: stage.color }} />
                            <span style={{ fontSize: "13px" }}>{stage.label}</span>
                            <span style={{ fontSize: "11px", color: DS.colors.textDim }}>({stageClients.length})</span>
                          </div>
                          <span style={{ fontFamily: DS.fonts.mono, fontSize: "13px", color: stage.color }}>
                            ${estimatedValue.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Recent Payments */}
                <Card>
                  <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "16px" }}>Payment Status</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", textAlign: "center" }}>
                    <div>
                      <div style={{ fontFamily: DS.fonts.display, fontSize: "24px", color: DS.colors.vital }}>
                        {practices.filter(p => p.payment_status === "current").length}
                      </div>
                      <div style={{ fontSize: "11px", color: DS.colors.textMuted }}>Current</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: DS.fonts.display, fontSize: "24px", color: DS.colors.warn }}>
                        {practices.filter(p => p.payment_status === "pending").length}
                      </div>
                      <div style={{ fontSize: "11px", color: DS.colors.textMuted }}>Pending</div>
                    </div>
                    <div>
                      <div style={{ fontFamily: DS.fonts.display, fontSize: "24px", color: DS.colors.danger }}>
                        {practices.filter(p => p.payment_status === "overdue").length}
                      </div>
                      <div style={{ fontSize: "11px", color: DS.colors.textMuted }}>Overdue</div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* TASKS VIEW */}
        {view === "tasks" && (
          <div className="fade-in">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* All Tasks by Stage */}
              {STAGES.map((stage) => {
                const stagePractices = practices.filter(p => p.stage === stage.key);
                if (stagePractices.length === 0) return null;
                return (
                  <div key={stage.key}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      marginBottom: "12px", paddingBottom: "8px",
                      borderBottom: `1px solid ${DS.colors.border}`,
                    }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: stage.color }} />
                      <span style={{ fontSize: "12px", fontWeight: 600, color: stage.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {stage.label}
                      </span>
                    </div>
                    {stagePractices.map((p) => (
                      <div key={p.id} style={{ marginBottom: "16px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>{p.name}</div>
                        <TaskList practiceId={p.id} stage={stage.key} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <Modal
        open={modalType === "baseline"}
        onClose={handleModalClose}
        title="Baseline Assessment"
        width="600px"
      >
        <BaselineAssessmentForm
          practice={selectedClient}
          onSave={handleModalSave}
          onCancel={handleModalClose}
        />
      </Modal>

      <Modal
        open={modalType === "implementation"}
        onClose={handleModalClose}
        title="Select AI Stack"
        width="500px"
      >
        <ImplementationTracker
          practice={selectedClient}
          onSave={handleModalSave}
          onCancel={handleModalClose}
        />
      </Modal>

      <Modal
        open={modalType === "golive"}
        onClose={handleModalClose}
        title="Confirm Go Live"
        width="450px"
      >
        <GoLiveForm
          practice={selectedClient}
          onSave={handleModalSave}
          onCancel={handleModalClose}
        />
      </Modal>

      <Modal
        open={modalType === "metrics"}
        onClose={handleModalClose}
        title="Update Metrics"
        width="550px"
      >
        <MetricsEditor
          practice={selectedClient}
          onSave={handleModalSave}
          onCancel={handleModalClose}
        />
      </Modal>

      <Modal
        open={modalType === "quote"}
        onClose={handleModalClose}
        title="Create Quote"
        width="900px"
      >
        <QuoteBuilder
          practice={selectedClient}
          onSave={(quote) => {
            handleModalSave();
            setSelectedQuote(quote);
          }}
          onCancel={handleModalClose}
        />
      </Modal>

      {/* Proposal Generator Modal */}
      <Modal
        open={modalType === "proposal"}
        onClose={handleModalClose}
        title="Generate Proposal"
        width="800px"
      >
        <ProposalGenerator
          practice={selectedClient}
          onClose={handleModalClose}
        />
      </Modal>

      {/* Pilot Tracker Modal */}
      <Modal
        open={modalType === "pilot"}
        onClose={handleModalClose}
        title="Pilot Progress Tracker"
        width="800px"
      >
        <PilotTracker
          practice={selectedClient}
          onSave={handleModalSave}
          onCancel={handleModalClose}
        />
      </Modal>

      {/* Quote Detail Modal */}
      <Modal
        open={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
        title={`Quote v${selectedQuote?.version || 1}`}
        width="600px"
      >
        {selectedQuote && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <MetricCard small label="Assessment" value={selectedQuote.assessment_waived ? "Waived" : `$${selectedQuote.assessment_fee?.toLocaleString()}`} />
              <MetricCard small label="Implementation" value={`$${selectedQuote.implementation_fee?.toLocaleString()}`} />
              <MetricCard small label="Monthly" value={`$${selectedQuote.monthly_fee?.toLocaleString()}/mo`} color={DS.colors.shock} />
              <MetricCard small label="First Year" value={`$${selectedQuote.total_value?.toLocaleString()}`} color={DS.colors.vital} />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <Button onClick={() => setSelectedQuote(null)}>Close</Button>
              <Button primary onClick={() => generateQuotePDF(selectedQuote, selectedClient)}>
                Download PDF
              </Button>
              <Button primary onClick={async () => {
                // Mark quote as sent
                await supabase
                  .from("quotes")
                  .update({ status: "sent", sent_at: new Date().toISOString() })
                  .eq("id", selectedQuote.id);
                setSelectedQuote(null);
                refreshPractices();
              }} style={{ background: DS.colors.vital }}>
                Send to Client
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ============================================================
// CLIENT LOGIN (placeholder until portal is wired up)
// ============================================================
const ClientLogin = ({ onBack }) => {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: "100%", maxWidth: "420px", margin: "20px", textAlign: "center" }}>
        <div style={{ marginBottom: "24px" }}>
          <DeFybLogo size={32} />
        </div>

        <h2 style={{ fontFamily: DS.fonts.display, fontSize: "24px", marginBottom: "12px" }}>
          Client Portal
        </h2>

        <p style={{ color: DS.colors.textMuted, fontSize: "14px", marginBottom: "24px", lineHeight: 1.6 }}>
          Your practice dashboard is being prepared. Once your assessment is complete,
          you'll receive login credentials to access your live metrics, AI stack status,
          and practice health score.
        </p>

        <div style={{
          padding: "16px", background: DS.colors.bg, borderRadius: DS.radius.md,
          marginBottom: "24px",
        }}>
          <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>
            Questions?
          </div>
          <a href="mailto:torey@defyb.org" style={{
            color: DS.colors.shock, textDecoration: "none", fontWeight: 500,
          }}>
            torey@defyb.org
          </a>
        </div>

        <span
          onClick={onBack}
          style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}
        >
          ← Back to site
        </span>
      </Card>
    </div>
  );
};

// ============================================================
// TEAM LOGIN
// ============================================================
const TeamLogin = ({ onLogin, onBack }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [linkSent, setLinkSent] = useState(false);

  // Common email typos to catch
  const validateEmail = (email) => {
    const typos = ["gmaill.com", "gmial.com", "gamil.com", "gnail.com", "gmail.co", "gmal.com"];
    const domain = email.split("@")[1]?.toLowerCase();
    if (typos.includes(domain)) {
      return `Did you mean "${email.replace(domain, "gmail.com")}"?`;
    }
    return null;
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured()) {
      setError("Authentication not configured");
      setLoading(false);
      return;
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;
      if (data.user) {
        onLogin(data.user);
      }
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Check for email typos
    const typoWarning = validateEmail(email);
    if (typoWarning) {
      setError(typoWarning);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      setError("Authentication not configured");
      setLoading(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + "?team=1",
        },
      });

      if (authError) {
        // Handle rate limiting specifically
        if (authError.message?.includes("rate") || authError.message?.includes("limit")) {
          setError("Too many attempts. Try password login or wait a few minutes.");
          setUsePassword(true);
        } else {
          throw authError;
        }
        return;
      }
      setLinkSent(true);
    } catch (err) {
      setError(err.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  if (linkSent) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Card style={{ width: "100%", maxWidth: "380px", margin: "20px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>📧</div>
          <h2 style={{ fontFamily: DS.fonts.display, fontSize: "24px", marginBottom: "8px" }}>
            Check your email
          </h2>
          <p style={{ color: DS.colors.textMuted, fontSize: "14px", marginBottom: "24px" }}>
            We sent a magic link to <strong style={{ color: DS.colors.text }}>{email}</strong>.
            Click the link to sign in.
          </p>
          <span
            onClick={() => { setLinkSent(false); setEmail(""); }}
            style={{ fontSize: "13px", color: DS.colors.shock, cursor: "pointer" }}
          >
            Use a different email
          </span>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Card style={{ width: "100%", maxWidth: "380px", margin: "20px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <DeFybLogo size={32} />
          <div style={{
            fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.shock,
            marginTop: "8px", letterSpacing: "0.1em"
          }}>
            TEAM ACCESS
          </div>
        </div>

        <form onSubmit={usePassword ? handlePasswordLogin : handleMagicLink}>
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block", fontSize: "12px", color: DS.colors.textMuted,
              marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em"
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@defyb.org"
              required
              style={{
                width: "100%", padding: "10px 12px", background: DS.colors.bg,
                border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                color: DS.colors.text, fontSize: "14px", outline: "none",
              }}
            />
          </div>

          {usePassword && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{
                display: "block", fontSize: "12px", color: DS.colors.textMuted,
                marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em"
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: "100%", padding: "10px 12px", background: DS.colors.bg,
                  border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                  color: DS.colors.text, fontSize: "14px", outline: "none",
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              padding: "10px 14px", marginBottom: "16px", borderRadius: DS.radius.sm,
              background: DS.colors.dangerDim, color: DS.colors.danger, fontSize: "13px",
            }}>
              {error}
            </div>
          )}

          <button type="submit" style={{
            width: "100%", padding: "12px 28px",
            background: DS.colors.shock, color: "#fff",
            border: "none", borderRadius: DS.radius.md,
            cursor: "pointer", fontFamily: DS.fonts.body,
            fontSize: "15px", fontWeight: 500, letterSpacing: "0.01em",
            opacity: loading ? 0.7 : 1, transition: "all 0.2s ease",
          }}>
            {loading ? (usePassword ? "Signing in..." : "Sending...") : (usePassword ? "Sign In" : "Send Magic Link")}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: DS.colors.textDim }}>
          {usePassword ? (
            <span onClick={() => setUsePassword(false)} style={{ color: DS.colors.shock, cursor: "pointer" }}>
              Switch to magic link
            </span>
          ) : (
            <>
              No password needed — or{" "}
              <span onClick={() => setUsePassword(true)} style={{ color: DS.colors.shock, cursor: "pointer" }}>
                use password
              </span>
            </>
          )}
        </p>

        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <span
            onClick={onBack}
            style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}
          >
            ← Back to site
          </span>
        </div>
      </Card>
    </div>
  );
};

// ============================================================
// APP SHELL
// ============================================================
export default function App() {
  const [currentView, setCurrentView] = useState("public");
  const [teamUser, setTeamUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isTeamUser = (user) => {
    if (!user) return false;
    const role = (user.app_metadata?.role || user.user_metadata?.role || user.user_metadata?.user_role || "")
      .toString()
      .toLowerCase();
    return role === "team" || role === "admin" || role === "owner";
  };

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      if (!isSupabaseConfigured()) {
        setCheckingAuth(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          if (isTeamUser(session.user)) {
            setTeamUser(session.user);
            // Check URL for team access intent
            if (typeof window !== 'undefined' && window.location.search.includes('team')) {
              setCurrentView('team');
            }
          } else {
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.error('Session check error:', err);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkSession();

    // Listen for auth changes
    if (isSupabaseConfigured()) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          setTeamUser(null);
          setCurrentView('public');
        } else if (session?.user && isTeamUser(session.user)) {
          setTeamUser(session.user);
        } else if (session?.user) {
          supabase.auth.signOut();
        }
      });

      return () => subscription?.unsubscribe();
    }
  }, []);

  const handleTeamLogin = (user) => {
    if (!isTeamUser(user)) {
      if (isSupabaseConfigured()) {
        supabase.auth.signOut();
      }
      setCurrentView('team-login');
      return;
    }
    setTeamUser(user);
    setCurrentView('team');
  };

  const handleTeamLogout = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setTeamUser(null);
    setCurrentView('public');
  };

  const handleRequestTeamAccess = () => {
    // If already logged in, go straight to dashboard
    if (teamUser) {
      setCurrentView('team');
    } else {
      setCurrentView('team-login');
    }
  };

  if (checkingAuth) {
    return (
      <>
        <FontLoader />
        <GlobalStyles />
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
          color: DS.colors.textMuted
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px", animation: "pulse 1.5s infinite" }}>⚡</div>
            Loading...
          </div>
        </div>
      </>
    );
  }

  return (
    <ConfigProvider>
      <FontLoader />
      <GlobalStyles />
      {currentView === "public" && (
        <PublicSite
          onLogin={handleRequestTeamAccess}
          onClientLogin={() => setCurrentView("client")}
        />
      )}
      {currentView === "client" && (
        <ClientLogin onBack={() => setCurrentView("public")} />
      )}
      {currentView === "team-login" && (
        <TeamLogin
          onLogin={handleTeamLogin}
          onBack={() => setCurrentView("public")}
        />
      )}
      {currentView === "team" && (
        teamUser ? (
          <TeamDashboard onBack={handleTeamLogout} />
        ) : (
          <TeamLogin
            onLogin={handleTeamLogin}
            onBack={() => setCurrentView("public")}
          />
        )
      )}
    </ConfigProvider>
  );
}
