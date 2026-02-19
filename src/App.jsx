import { useState, useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "./supabase";

// ============================================================
// DeFyb v4 — Unified Platform
// Public Site | Client Portal | Team Dashboard
// ============================================================

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

// --- DATA ---
const FAILURE_POINTS = [
  { id: 1, name: "Missed Calls", stat: "40-70% unanswered", tag: "staffing", tool: "AI Phone Agent", toolCost: "$500-800/mo", fix: "100% answer rate, 24/7" },
  { id: 2, name: "Documentation", stat: "16 min/patient avg", tag: "time", tool: "Ambient AI Scribe", toolCost: "$49-299/mo/provider", fix: "10-second notes, zero pajama time" },
  { id: 3, name: "Under-Coding", stat: "25-50% of visits", tag: "revenue", tool: "AI Coding Engine", toolCost: "Included w/ scribe", fix: "11-14% wRVU increase" },
  { id: 4, name: "Prior Auth", stat: "14 hrs/week/provider", tag: "time", tool: "PA Automation", toolCost: "$300-600/mo", fix: "Auto-submit, track, appeal" },
  { id: 5, name: "Claim Denials", stat: "8-12% denial rate", tag: "revenue", tool: "Claims AI", toolCost: "$200-400/mo", fix: "Pre-submission scrub, auto-appeal" },
  { id: 6, name: "No Follow-Through", stat: "~30% no-show rate", tag: "staffing", tool: "Patient Engagement AI", toolCost: "$150-300/mo", fix: "Automated outreach, care gap closure" },
  { id: 7, name: "Referral Black Hole", stat: "No closed loop", tag: "revenue", tool: "Referral Tracker", toolCost: "Included w/ engagement AI", fix: "Auto-track, auto-remind" },
  { id: 8, name: "No Chart Prep", stat: "Provider walks in cold", tag: "time", tool: "Pre-Visit Intelligence", toolCost: "Included w/ scribe platform", fix: "30-sec briefing before every visit" },
];

const PROTOCOL_STEPS = [
  { num: "01", title: "Intake", desc: "Practice fills a 20-minute form. We already know the diagnosis.", time: "20 min" },
  { num: "02", title: "Confirm", desc: "Half-day audit + AI environment assessment. Room acoustics, device placement, workflow timing.", time: "½ day" },
  { num: "03", title: "Prove", desc: "Side-by-side parallel run on their own patients. Undeniable.", time: "1 day" },
  { num: "04", title: "Deliver", desc: "72-Hour Note. One page. Here's what's broken, here's the fix, here's the dollars.", time: "72 hrs" },
  { num: "05", title: "Transform", desc: "Tuesday Transform — one day/week runs the new stack. Staff asks to expand.", time: "2-3 wks" },
  { num: "06", title: "Sustain", desc: "Monthly scorecard. Live portal. Ongoing optimization. Rhythm restored.", time: "∞" },
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

// ============================================================
// PUBLIC SITE
// ============================================================
const PublicSite = ({ onLogin, onClientLogin }) => {
  const intakeRef = useRef(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({});
  const scrollToIntake = () => intakeRef.current?.scrollIntoView({ behavior: "smooth" });

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

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
          specialty: form.specialty,
          ehr: form.ehr,
          provider_count: form.providers,
          contact_name: form.contact,
          contact_email: form.email,
          contact_phone: form.phone,
          contact_role: form.role,
          pain_points: form.pains || [],
          success_definition: form.success,
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
        <DeFybLogo size={28} />
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
          <Button primary small onClick={scrollToIntake}>Start</Button>
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
            Your practice is <span style={{ color: DS.colors.shock, fontStyle: "italic" }}>flatlined</span> on admin.
            <br />We bring it back.
          </h1>

          {/* THREE DOORS */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "40px", maxWidth: "600px" }}>
            {[
              { icon: "⏱", text: "Providers charting until 9 PM while the family waits.", tag: "time" },
              { icon: "👥", text: "That front desk position has been posted for 6 months.", tag: "staffing" },
              { icon: "💰", text: "Revenue walking out the door to third parties.", tag: "revenue" },
            ].map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Tag type={d.tag} />
                <span style={{ color: DS.colors.textMuted, fontSize: "15px" }}>{d.text}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <Button primary onClick={scrollToIntake}>Free Practice Assessment →</Button>
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
            Defying the death of private practice.
          </p>
          <p style={{ fontSize: "14px", color: DS.colors.textDim, marginTop: "8px" }}>
            Clinician-led AI implementation for small group practices.
          </p>
        </div>

        {/* 8 FAILURE POINTS → MAPPED TO TOOLS */}
        <section style={{ padding: "80px 0" }}>
          <SectionTitle sub="Every practice has at least 6 of these. We already know the diagnosis before we walk in.">
            The 8 things killing your practice
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
                Room acoustics, device placement, ambient noise, provider habits. The AI is only as good as what it hears.
                We optimize the room so the tools actually work.
              </div>
            </div>
          </div>
        </section>

        {/* ROI SECTION */}
        <section id="roi" style={{ padding: "80px 0" }}>
          <SectionTitle sub="Based on published clinical studies — your results will vary by specialty, payer mix, and current state.">
            What the research shows for a 5-provider practice
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
                per year — tools + DeFyb service
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
                per year — based on published outcomes
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
                { source: "Coding uplift", amount: "up to $625K", note: "11–14% wRVU increase reported in JAMA, PMC studies" },
                { source: "DME capture", amount: "varies widely", note: "Specialty-dependent — ortho/pain see the most" },
                { source: "Denial recovery", amount: "$60–96K", note: "Industry avg 8–12% denial rate → 3–5% with AI scrub" },
                { source: "Answered calls", amount: "$45K+", note: "Recovering patients lost to voicemail" },
                { source: "Staff efficiency", amount: "$84–96K", note: "Reduced need for phone/auth/follow-up FTEs" },
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
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>typical ROI range</div>
            </div>
            <div style={{ textAlign: "center", borderLeft: `1px solid ${DS.colors.border}`, borderRight: `1px solid ${DS.colors.border}` }}>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.shock }}>60–90 days</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>to measurable impact</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: DS.fonts.display, fontSize: "28px", color: DS.colors.blue }}>1–2 hrs</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>back per provider/day</div>
            </div>
          </div>

          <p style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "20px", maxWidth: "700px" }}>
            Sources: Riverside Health (PMC); UCSF/JAMA Jan 2026; Texas Oncology; Healio; Health Catalyst.
            These are industry benchmarks — we'll build a realistic projection specific to your practice during the assessment.
          </p>
        </section>

        {/* PROTOCOL */}
        <section id="protocol" style={{ padding: "80px 0" }}>
          <SectionTitle sub="Six steps. First client to managed service in under 60 days.">
            The DeFyb Protocol
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
                q: "Does this work with my EHR?",
                a: "Yes. We work with athenahealth, Epic, eClinicalWorks, NextGen, AdvancedMD, and most others. The AI tools integrate via existing EHR APIs or run alongside your workflow."
              },
              {
                q: "How is this different from just buying the tools myself?",
                a: "You could buy them yourself. Most practices do, and most implementations fail. We handle vendor selection, environment setup, staff training, workflow integration, and ongoing optimization. You get the results without the project management."
              },
              {
                q: "What does it actually cost?",
                a: "Tool costs vary by stack — typically $1,500–3,000/month for a 5-provider practice. DeFyb's service fee is on top of that. We'll give you a specific quote during the assessment based on what you actually need."
              },
              {
                q: "How long until we see results?",
                a: "Documentation time typically drops immediately — usually day one. Revenue impact (coding uplift, denial reduction) takes longer to measure, usually 60–90 days to see clear trends."
              },
              {
                q: "What if my staff resists the change?",
                a: "They usually do, at first. That's why we start with Tuesday Transform — one day a week on the new stack. Staff sees the tools work, asks to expand. Change happens through proof, not mandate."
              },
            ].map((faq, i) => (
              <Card key={i} style={{ padding: "20px 24px" }}>
                <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>{faq.q}</div>
                <div style={{ fontSize: "14px", color: DS.colors.textMuted, lineHeight: 1.6 }}>{faq.a}</div>
              </Card>
            ))}
          </div>
        </section>

        {/* INTAKE FORM */}
        <section ref={intakeRef} style={{ padding: "80px 0" }}>
          {submitted ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚡</div>
              <h2 style={{ fontFamily: DS.fonts.display, fontSize: "32px", color: DS.colors.vital, marginBottom: "8px" }}>
                Rhythm detected.
              </h2>
              <p style={{ color: DS.colors.textMuted, maxWidth: "400px", margin: "0 auto" }}>
                We're reviewing your intake now. Expect a response within 48 hours with a preliminary assessment
                and next steps. Once we begin, you'll get access to your own DeFyb client portal.
              </p>
            </div>
          ) : (
            <>
              <SectionTitle sub="20 minutes. We'll tell you exactly what's broken and what it's costing you.">
                Start your practice assessment
              </SectionTitle>

              <Card style={{ maxWidth: "700px" }}>
                {[
                  { label: "Practice Name", key: "name", type: "text" },
                  { label: "Your Name", key: "contact", type: "text" },
                  { label: "Your Role", key: "role", type: "select", options: ["Practice Owner / Partner", "Office Manager", "Provider (MD/DO/PA/NP)", "Billing Manager", "Other"] },
                  { label: "Specialty", key: "specialty", type: "text", placeholder: "e.g., Family Medicine, Orthopedics, Pain Mgmt" },
                  { label: "Number of Providers", key: "providers", type: "select", options: ["1-2", "3-5", "6-10", "11-20", "20+"] },
                  { label: "Current EHR", key: "ehr", type: "select", options: ["athenahealth", "Epic", "eClinicalWorks", "NextGen", "AdvancedMD", "Allscripts/Veradigm", "Other / Not sure"] },
                  { label: "Email", key: "email", type: "email" },
                  { label: "Phone", key: "phone", type: "tel" },
                ].map((field) => (
                  <div key={field.key} style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {field.label}
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
                  <label style={{ display: "block", fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    What does success look like?
                  </label>
                  <textarea
                    rows={3} placeholder="Providers leave by 5:30 · Stop losing new patients to voicemail · Stay independent without drowning · Bring DME in-house..."
                    value={form.success || ""}
                    onChange={(e) => setForm({ ...form, success: e.target.value })}
                    style={{
                      width: "100%", padding: "10px 12px", background: DS.colors.bg,
                      border: `1px solid ${DS.colors.borderLight}`, borderRadius: DS.radius.sm,
                      color: DS.colors.text, fontSize: "14px", outline: "none", resize: "vertical",
                    }}
                  />
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
                  {submitting ? "Submitting..." : "⚡ Submit Assessment Request"}
                </Button>
              </Card>
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
          <Button primary onClick={scrollToIntake}>Start Assessment →</Button>
        </section>

        {/* FOOTER */}
        <footer style={{
          padding: "32px 0", borderTop: `1px solid ${DS.colors.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <DeFybLogo size={20} />
          <p style={{ fontSize: "12px", color: DS.colors.textDim }}>
            © 2026 DeFyb. Clinician-led. Vendor-neutral.
          </p>
        </footer>
      </div>
    </div>
  );
};

// ============================================================
// CLIENT PORTAL
// ============================================================
const ClientPortal = ({ onBack }) => {
  const [tab, setTab] = useState("health");
  const client = SAMPLE_CLIENTS[0]; // Pine Valley as demo
  const m = client.metrics;

  const tabs = [
    { key: "health", label: "Practice Health" },
    { key: "metrics", label: "Metrics" },
    { key: "stack", label: "AI Stack" },
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
          <span style={{ fontSize: "14px", color: DS.colors.textMuted }}>{client.name}</span>
        </div>
        <span onClick={onBack} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}>Sign out</span>
      </nav>

      <div style={{ padding: "80px clamp(20px, 5vw, 80px) 40px", maxWidth: "1100px", margin: "0 auto" }}>
        {/* TABS */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "32px", borderBottom: `1px solid ${DS.colors.border}`, paddingBottom: "0" }}>
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

        {/* PRACTICE HEALTH */}
        {tab === "health" && (
          <div className="fade-in">
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "40px", alignItems: "start", marginBottom: "40px" }}>
              <HealthScoreRing score={client.score} size={180} />
              <div>
                <h2 style={{ fontFamily: DS.fonts.display, fontSize: "28px", marginBottom: "8px" }}>
                  Practice running <span style={{ color: DS.colors.vital }}>strong</span>
                </h2>
                <p style={{ color: DS.colors.textMuted, fontSize: "14px", marginBottom: "20px" }}>
                  Score at intake: <span style={{ color: DS.colors.danger }}>38</span> → Current: <span style={{ color: DS.colors.vital }}>{client.score}</span>.
                  {" "}All 5 providers active on the full AI stack.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                  <MetricCard small label="Doc Time" value={`${m.docTime} min`} sub={`was ${m.docTimeBaseline} min`} color={DS.colors.blue} />
                  <MetricCard small label="Revenue Recovered" value={`$${(m.revenue / 1000).toFixed(0)}K`} sub="this month" color={DS.colors.vital} />
                  <MetricCard small label="Coding Uplift" value={`$${(m.codingUplift / 1000).toFixed(0)}K`} sub="this month" color={DS.colors.vital} />
                  <MetricCard small label="Denial Rate" value={`${m.denialRate}%`} sub={`was ${m.denialBaseline}%`} color={m.denialRate < 6 ? DS.colors.vital : DS.colors.warn} />
                  <MetricCard small label="Call Answer" value={`${m.callRate}%`} sub={`was ${m.callBaseline}%`} color={DS.colors.blue} />
                  <MetricCard small label="Value Delivered" value="$487K" sub="cumulative since engagement" color={DS.colors.shock} />
                </div>
              </div>
            </div>

            {/* BEFORE/AFTER MINI */}
            <Card style={{ marginBottom: "24px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Your Transformation</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                {[
                  { label: "Documentation", before: `${m.docTimeBaseline} min/pt`, after: `${m.docTime} min/pt`, color: DS.colors.blue },
                  { label: "Denial Rate", before: `${m.denialBaseline}%`, after: `${m.denialRate}%`, color: DS.colors.vital },
                  { label: "Calls Answered", before: `${m.callBaseline}%`, after: `${m.callRate}%`, color: DS.colors.blue },
                  { label: "Providers Home By", before: "8:30 PM", after: "5:30 PM", color: DS.colors.vital },
                ].map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "13px", color: DS.colors.textMuted, width: "120px" }}>{row.label}</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "12px", color: DS.colors.danger, textDecoration: "line-through" }}>{row.before}</span>
                    <span style={{ color: DS.colors.shock }}>→</span>
                    <span style={{ fontFamily: DS.fonts.mono, fontSize: "12px", color: row.color, fontWeight: 600 }}>{row.after}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* METRICS */}
        {tab === "metrics" && (
          <div className="fade-in">
            <Card>
              <div style={{ fontWeight: 600, fontSize: "14px", marginBottom: "16px" }}>Monthly Trend</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr>
                      {["Month", "Doc Time", "Revenue ↑", "Coding ↑", "Denial %", "Calls %", "Score"].map((h) => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", borderBottom: `1px solid ${DS.colors.border}`, color: DS.colors.textMuted, fontWeight: 500, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Oct '25", "9.2 min", "$14K", "$8K", "8.8%", "72%", 52],
                      ["Nov '25", "5.8 min", "$28K", "$18K", "6.2%", "89%", 64],
                      ["Dec '25", "4.1 min", "$35K", "$24K", "5.1%", "94%", 74],
                      ["Jan '26", "3.4 min", "$40K", "$27K", "4.4%", "96%", 80],
                      ["Feb '26", "3.2 min", "$42K", "$28.5K", "4.1%", "97%", 84],
                    ].map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} style={{
                            padding: "10px 12px", borderBottom: `1px solid ${DS.colors.border}`,
                            fontFamily: j > 0 ? DS.fonts.mono : DS.fonts.body,
                            fontSize: "12px",
                            color: j === row.length - 1 ? (cell >= 80 ? DS.colors.vital : cell >= 60 ? DS.colors.warn : DS.colors.text) : DS.colors.text,
                          }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* AI STACK */}
        {tab === "stack" && (
          <div className="fade-in">
            <div style={{ display: "grid", gap: "12px" }}>
              {client.stack.map((tool, i) => (
                <Card key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{tool.name}</div>
                    <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>Active since {tool.since}</div>
                  </div>
                  <span style={{
                    padding: "4px 12px", borderRadius: "4px", fontSize: "11px", fontWeight: 600,
                    color: tool.status === "active" ? DS.colors.vital : tool.status === "deploying" ? DS.colors.warn : DS.colors.textMuted,
                    background: tool.status === "active" ? DS.colors.vitalDim : tool.status === "deploying" ? DS.colors.warnDim : DS.colors.bg,
                    textTransform: "uppercase", letterSpacing: "0.06em",
                  }}>{tool.status}</span>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* UPDATES */}
        {tab === "updates" && (
          <div className="fade-in">
            <div style={{ display: "grid", gap: "8px" }}>
              {client.notes.map((note, i) => (
                <Card key={i} style={{ display: "flex", gap: "16px", padding: "16px 20px" }}>
                  <div style={{ fontFamily: DS.fonts.mono, fontSize: "11px", color: DS.colors.textDim, whiteSpace: "nowrap", minWidth: "60px" }}>{note.date}</div>
                  <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>{note.text}</div>
                </Card>
              ))}
            </div>
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

  useEffect(() => {
    const fetchPractices = async () => {
      if (!isSupabaseConfigured()) {
        // Fall back to sample data if Supabase not configured
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

        // Transform Supabase data to match our component structure
        const transformed = data.map((p, i) => ({
          id: p.id,
          name: p.name || 'Unnamed Practice',
          providers: p.provider_count || '?',
          ehr: p.ehr || 'Unknown',
          stage: p.stage || 'lead',
          score: null, // New leads won't have scores yet
          specialty: p.specialty || 'Not specified',
          contact: {
            name: p.contact_name,
            email: p.contact_email,
            phone: p.contact_phone,
            role: p.contact_role,
          },
          painPoints: p.pain_points || [],
          successDefinition: p.success_definition,
          metrics: {}, // Empty for new practices
          stack: [], // Empty for new practices
          notes: p.notes ? [{ date: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), text: p.notes }] : [
            { date: new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), text: 'Intake received via website.' }
          ],
          createdAt: p.created_at,
        }));

        setPractices(transformed);
      } catch (err) {
        console.error('Error fetching practices:', err);
        // Fall back to sample data on error
        setPractices(SAMPLE_CLIENTS);
      } finally {
        setLoading(false);
      }
    };

    fetchPractices();
  }, []);

  const views = [
    { key: "pipeline", label: "Pipeline" },
    { key: "activity", label: "Activity" },
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
        <span onClick={onBack} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}>Sign out</span>
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

            {/* SUCCESS DEFINITION */}
            {selectedClient.successDefinition && (
              <Card style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>What success looks like</div>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted, fontStyle: "italic" }}>
                  "{selectedClient.successDefinition}"
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
            <Card>
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
      </div>
    </div>
  );
};

// ============================================================
// APP SHELL
// ============================================================
export default function App() {
  const [currentView, setCurrentView] = useState("public");

  return (
    <>
      <FontLoader />
      <GlobalStyles />
      {currentView === "public" && (
        <PublicSite
          onLogin={() => setCurrentView("team")}
          onClientLogin={() => setCurrentView("client")}
        />
      )}
      {currentView === "client" && (
        <ClientPortal onBack={() => setCurrentView("public")} />
      )}
      {currentView === "team" && (
        <TeamDashboard onBack={() => setCurrentView("public")} />
      )}
    </>
  );
}
