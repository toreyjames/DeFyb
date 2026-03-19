import { useState, useEffect, useRef } from "react";
import { DS } from "../design/tokens";
import { Button, Card, MetricCard, Modal } from "../components/ui";
import { DeFybLogo, HealthScoreRing } from "../components/svg";
import { PortfolioCharts } from "../components/charts";
import { NotificationBell } from "../components/NotificationBell";
import { SAMPLE_CLIENTS, STAGES, AI_TOOLS } from "../data/constants";
import { PRICING } from "../lib/pricing";
import { calculateROIProjection } from "../lib/roi";
import { generateQuotePDF, generateScorecardPDF, generateProposalPDF } from "../lib/pdf";
import { supabase, isSupabaseConfigured } from "../supabase";
import { useConfig } from "../lib/config.jsx";

// --- LOCAL QUOTE CALCULATOR ---
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

  const docTimeSaved = Math.max(0, docTimeBaseline - 3);
  const timeSavedMinPerDay = docTimeSaved * patientsPerDay;
  const timeSavedHoursPerYear = (timeSavedMinPerDay / 60) * workDays * providerCount;
  const timeSavedAnnualValue = timeSavedHoursPerYear * providerHourlyValue;

  const pajamaTimeSavedHours = pajamaTimeBaseline * 50 * providerCount;
  const pajamaTimeSavedValue = pajamaTimeSavedHours * providerHourlyValue;

  const em = form.em_coding_distribution;
  const level3Pct = parseFloat(em?.level3) || 45;
  const level4Pct = parseFloat(em?.level4) || 40;
  const level5Pct = parseFloat(em?.level5) || 15;
  const reimbursement3 = parseFloat(form.em_reimbursement_99213) || 95;
  const reimbursement4 = parseFloat(form.em_reimbursement_99214) || 135;
  const reimbursement5 = parseFloat(form.em_reimbursement_99215) || 185;

  const totalVisits = patientsPerDay * workDays * providerCount;
  const currentRevenue = totalVisits * ((level3Pct/100 * reimbursement3) + (level4Pct/100 * reimbursement4) + (level5Pct/100 * reimbursement5));

  const newLevel3 = Math.max(0, level3Pct - 10);
  const newLevel4 = level4Pct + 5;
  const newLevel5 = level5Pct + 5;
  const newRevenue = totalVisits * ((newLevel3/100 * reimbursement3) + (newLevel4/100 * reimbursement4) + (newLevel5/100 * reimbursement5));
  const codingUpliftAnnual = newRevenue - currentRevenue;

  const coderSavings = hasCoder ? coderCost * 0.5 : 0;

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
            <label style={labelStyle}>Tools {config?.source === "edge-config" && <span style={{ fontSize: "9px", color: DS.colors.vital }}>(LIVE)</span>}</label>
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
          Recommended Tool Stack
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

  useEffect(() => {
    const roi = calculateBaselineROI(form, practice);
    setRoiPreview(roi);
  }, [form, practice]);

  const handleSubmit = async () => {
    const required = ["doc_time_baseline", "patients_per_day"];
    const missing = required.filter(key => !form[key] && form[key] !== 0);

    if (missing.length > 0) {
      setError("Please fill in at least documentation time and patients per day");
      return;
    }

    const em = form.em_coding_distribution;
    const emSum = (parseFloat(em.level3) || 0) + (parseFloat(em.level4) || 0) + (parseFloat(em.level5) || 0);
    if (emSum > 0 && Math.abs(emSum - 100) > 0.1) {
      setError("E/M coding distribution should add up to 100%");
      return;
    }

    setSaving(true);
    setError(null);

    try {
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
    { key: "week1", label: "Week 1: Scribe Selection", color: DS.colors.blue, description: "Choose and set up ambient scribe" },
    { key: "week2", label: "Week 2: EHR Integration", color: DS.colors.warn, description: "Connect scribe to EHR, configure templates" },
    { key: "week3", label: "Week 3: Full-Day Pilot", color: DS.colors.vital, description: "Run full day with the tool, measure results" },
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

      if (previousStatus === "not_started" && newStatus !== "not_started") {
        sendWebhook("pilot_started", `${practice.name} has started their pilot`, `Starting at ${newStatus}`);
      }

      if (previousStatus !== newStatus && newStatus !== "not_started" && previousStatus !== "not_started") {
        const weekNum = newStatus.replace("week", "");
        if (newStatus === "completed") {
          sendWebhook("pilot_completed", `${practice.name} has completed their pilot`, "All 4 weeks finished");
        } else {
          sendWebhook("week_completed", `${practice.name} advanced to Week ${weekNum}`, `Previous: ${previousStatus}`);
        }
      }

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
      setError("Please select at least one tool to deploy");
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

      await supabase.from("notifications").insert({
        practice_id: practice.id,
        user_type: "client",
        type: "stage_change",
        title: "Implementation Started",
        message: `We're beginning deployment of ${selectedTools.length} tool${selectedTools.length > 1 ? "s" : ""} for your practice. You'll be notified as each tool goes live.`,
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
        Select the tools to deploy for this practice. Tools will start with "planned" status and progress through "deploying" to "active".
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
          doc_time_current: practice.doc_time_baseline,
          denial_rate_current: practice.denial_rate_baseline,
          call_answer_rate_current: practice.call_answer_rate_baseline,
          health_score: 50,
        })
        .eq("id", practice.id);

      if (updateError) throw updateError;

      await supabase.from("notifications").insert({
        practice_id: practice.id,
        user_type: "client",
        type: "stage_change",
        title: "You're Live!",
        message: "Congratulations! Your practice is now live with the full tool stack. Check your portal to see real-time metrics and progress.",
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
        Confirm the go-live date to move this practice to managed status. All tools will be marked as active.
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
// TEAM DASHBOARD
// ============================================================
const TeamDashboard = ({ onBack }) => {
  const [view, setView] = useState("finances");
  const [selectedClient, setSelectedClient] = useState(null);
  const [practices, setPractices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [pipelineFocus, setPipelineFocus] = useState("all");
  const [claimRequests, setClaimRequests] = useState([]);
  const [claimLoading, setClaimLoading] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);
  const [membershipRows, setMembershipRows] = useState([]);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [membershipSaving, setMembershipSaving] = useState(false);
  const [selectedMembershipUserId, setSelectedMembershipUserId] = useState("");
  const [selectedMembershipPracticeId, setSelectedMembershipPracticeId] = useState("");
  const [membershipRole, setMembershipRole] = useState("provider");
  const [membershipStatus, setMembershipStatus] = useState("active");
  const [membershipDefault, setMembershipDefault] = useState(false);
  const [membershipNotice, setMembershipNotice] = useState("");

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
      if (selectedClient) {
        const updated = transformed.find(p => p.id === selectedClient.id);
        if (updated) setSelectedClient(updated);
      }
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  const refreshClaimRequests = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      setClaimLoading(true);
      const { data, error } = await supabase
        .from("clinic_claim_requests")
        .select("id, clinic_name, owner_email, requester_email, requester_name, notes, status, source, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      setClaimRequests(data || []);
    } catch (err) {
      console.error("claim request fetch error:", err);
      setClaimRequests([]);
    } finally {
      setClaimLoading(false);
    }
  };

  const refreshTeamUsers = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const { data, error } = await supabase
        .from("app_users")
        .select("auth_user_id, email")
        .not("auth_user_id", "is", null)
        .order("email", { ascending: true });
      if (error) throw error;
      const deduped = [];
      const seen = new Set();
      (data || []).forEach((row) => {
        const id = row.auth_user_id;
        if (!id || seen.has(id)) return;
        seen.add(id);
        deduped.push({ auth_user_id: id, email: row.email || "unknown" });
      });
      setTeamUsers(deduped);
      if (!selectedMembershipUserId && deduped.length > 0) setSelectedMembershipUserId(deduped[0].auth_user_id);
    } catch (err) {
      console.error("team user fetch error:", err);
      setTeamUsers([]);
    }
  };

  const refreshMembershipRows = async (userId = selectedMembershipUserId) => {
    if (!isSupabaseConfigured() || !userId) {
      setMembershipRows([]);
      return;
    }
    try {
      setMembershipLoading(true);
      const { data, error } = await supabase
        .from("clinic_memberships")
        .select("id, auth_user_id, practice_id, clinic_name, role, status, is_default, updated_at")
        .eq("auth_user_id", userId)
        .order("is_default", { ascending: false });
      if (error) throw error;
      setMembershipRows(data || []);
    } catch (err) {
      console.error("membership fetch error:", err);
      setMembershipRows([]);
    } finally {
      setMembershipLoading(false);
    }
  };

  const saveMembership = async () => {
    if (!isSupabaseConfigured()) return;
    if (!selectedMembershipUserId || !selectedMembershipPracticeId) {
      setMembershipNotice("Select user and clinic first.");
      return;
    }
    setMembershipSaving(true);
    setMembershipNotice("");
    try {
      const selectedPractice = practices.find((p) => p.id === selectedMembershipPracticeId);
      if (membershipDefault) {
        await supabase
          .from("clinic_memberships")
          .update({ is_default: false })
          .eq("auth_user_id", selectedMembershipUserId);
      }
      const { error } = await supabase
        .from("clinic_memberships")
        .upsert({
          auth_user_id: selectedMembershipUserId,
          practice_id: selectedMembershipPracticeId,
          clinic_name: selectedPractice?.name || "Clinic",
          role: membershipRole,
          status: membershipStatus,
          is_default: membershipDefault,
          updated_at: new Date().toISOString(),
        }, { onConflict: "auth_user_id,practice_id" });
      if (error) throw error;
      await refreshMembershipRows(selectedMembershipUserId);
      setMembershipNotice("Membership saved.");
    } catch (err) {
      console.error("membership save error:", err);
      setMembershipNotice("Could not save membership.");
    } finally {
      setMembershipSaving(false);
    }
  };

  const handleClaimDecision = async (requestId, status) => {
    if (!isSupabaseConfigured()) return;
    try {
      const target = claimRequests.find((r) => r.id === requestId);
      const { error } = await supabase
        .from("clinic_claim_requests")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;
      if (target) {
        supabase.functions.invoke("clinic-claim-notify", {
          body: {
            event: "decision",
            status,
            clinicName: target.clinic_name,
            ownerEmail: target.owner_email,
            requesterName: target.requester_name || null,
            requesterEmail: target.requester_email || null,
          },
        }).catch(() => {});
        if (status === "approved") {
          supabase.functions.invoke("clinic-claim-activate", {
            body: { claimRequestId: target.id },
          }).catch(() => {});
        }
      }
      await refreshClaimRequests();
    } catch (err) {
      console.error("claim request update error:", err);
      alert(`Failed to ${status} claim request.`);
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
    lead_score: p.lead_score,
    lead_score_breakdown: p.lead_score_breakdown,
    referral_code: p.referral_code,
    referred_by: p.referred_by,
    referral_credits: p.referral_credits || 0,
    stripe_customer_id: p.stripe_customer_id,
    payment_status: p.payment_status || 'none',
    monthly_rate: p.monthly_rate || 0,
    contract_start_date: p.contract_start_date,
    contract_end_date: p.contract_end_date,
    total_value_delivered: p.total_value_delivered || 0,
    doc_time_baseline: p.doc_time_baseline,
    pajama_time_baseline: p.pajama_time_baseline,
    coding_review_time_baseline: p.coding_review_time_baseline,
    pa_staff_hours_baseline: p.pa_staff_hours_baseline,
    peer_to_peer_calls_baseline: p.peer_to_peer_calls_baseline,
    patients_per_day: p.patients_per_day,
    hours_worked_weekly: p.hours_worked_weekly,
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
    tribal_knowledge: p.tribal_knowledge,
    roi_projections: p.roi_projections,
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
    pilot_start_date: p.pilot_start_date,
    pilot_status: p.pilot_status,
    pilot_checklist: p.pilot_checklist,
    ai_stack: p.ai_stack || [],
    go_live_date: p.go_live_date,
    portal_enabled: p.portal_enabled,
    portal_login_count: p.portal_login_count || 0,
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
      await supabase.from('tasks').delete().eq('practice_id', practice.id);
      await supabase.from('quotes').delete().eq('practice_id', practice.id);
      await supabase.from('documents').delete().eq('practice_id', practice.id);
      await supabase.from('payments').delete().eq('practice_id', practice.id);
      await supabase.from('notifications').delete().eq('practice_id', practice.id);
      await supabase.from('activity_log').delete().eq('practice_id', practice.id);

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
    refreshClaimRequests();
    refreshTeamUsers();
  }, []);

  useEffect(() => {
    refreshMembershipRows(selectedMembershipUserId);
  }, [selectedMembershipUserId]);

  const views = [
    { key: "pipeline", label: "Pipeline" },
    { key: "pilots", label: "Pilots" },
    { key: "activity", label: "Activity" },
    { key: "finances", label: "Revenue Capture" },
    { key: "tasks", label: "Tasks" },
  ];

  const totalCodingLift = practices.reduce((sum, p) => sum + (p.coding_uplift_monthly || 0), 0);
  const totalRecoveredRevenue = practices.reduce((sum, p) => sum + (p.revenue_recovered_monthly || 0), 0);
  const practicesWithCaptureSignals = practices.filter((p) =>
    (p.denial_rate_baseline || 0) > 0 || (p.em_coding_distribution || "").length > 0
  ).length;
  const totalProviders = practices.reduce((sum, p) => sum + (Number(p.provider_count) || 0), 0);
  const largestPracticeByProviders = practices.reduce((best, p) => {
    if (!best) return p;
    return (Number(p.provider_count) || 0) > (Number(best.provider_count) || 0) ? p : best;
  }, null);
  const topSavingsPractice = practices.reduce((best, p) => {
    if (!best) return p;
    const current = (p.coding_uplift_monthly || 0) + (p.revenue_recovered_monthly || 0);
    const bestValue = (best.coding_uplift_monthly || 0) + (best.revenue_recovered_monthly || 0);
    return current > bestValue ? p : best;
  }, null);
  const mostActivePractice = practices.reduce((best, p) => {
    if (!best) return p;
    return (p.portal_login_count || 0) > (best.portal_login_count || 0) ? p : best;
  }, null);
  const pipelinePractices = practices.filter((p) => {
    if (pipelineFocus === "capture") {
      return (p.denial_rate_baseline || 0) > 0 || (p.em_coding_distribution || "").length > 0;
    }
    return true;
  });

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "10px" }}>
          <button
            type="button"
            onClick={() => { setView("finances"); setSelectedClient(null); }}
            style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
            title="Open Revenue Capture view"
          >
            <MetricCard small label="Monthly Coding Lift" value={`$${(totalCodingLift / 1000).toFixed(0)}K`} color={DS.colors.vital} />
          </button>
          <button
            type="button"
            onClick={() => { setView("finances"); setSelectedClient(null); }}
            style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
            title="Open Revenue Capture view"
          >
            <MetricCard small label="Monthly Recovered Rev" value={`$${(totalRecoveredRevenue / 1000).toFixed(0)}K`} color={DS.colors.vital} />
          </button>
          <button
            type="button"
            onClick={() => { setView("pipeline"); setPipelineFocus("capture"); setSelectedClient(null); }}
            style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
            title="Filter Pipeline to capture-signal practices"
          >
            <MetricCard small label="Capture-Signal Practices" value={practicesWithCaptureSignals.toString()} color={DS.colors.shock} />
          </button>
          <button
            type="button"
            onClick={() => { setView("pipeline"); setPipelineFocus("all"); setSelectedClient(null); }}
            style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}
            title="Open full pipeline"
          >
            <MetricCard small label="Total Practices" value={practices.length.toString()} color={DS.colors.blue} />
          </button>
        </div>

        {/* PRACTICE LEADERS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px", marginBottom: "24px" }}>
          <MetricCard small label="Registered Providers" value={totalProviders.toString()} color={DS.colors.blue} />
          <MetricCard
            small
            label="Largest Practice"
            value={largestPracticeByProviders ? `${largestPracticeByProviders.name} (${largestPracticeByProviders.provider_count || 0})` : "N/A"}
            color={DS.colors.textMuted}
          />
          <MetricCard
            small
            label="Top Savings Practice"
            value={topSavingsPractice ? `${topSavingsPractice.name} ($${(((topSavingsPractice.coding_uplift_monthly || 0) + (topSavingsPractice.revenue_recovered_monthly || 0)) / 1000).toFixed(0)}K/mo)` : "N/A"}
            color={DS.colors.vital}
          />
          <MetricCard
            small
            label="Most Active Practice"
            value={mostActivePractice ? `${mostActivePractice.name} (${mostActivePractice.portal_login_count || 0} logins)` : "N/A"}
            color={DS.colors.shock}
          />
        </div>

        <Card style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ fontWeight: 600, fontSize: "13px" }}>Clinic Claim Requests</div>
            <Button small onClick={refreshClaimRequests} style={{ opacity: claimLoading ? 0.7 : 1 }}>
              {claimLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
          {claimRequests.length === 0 ? (
            <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
              No claim requests yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "8px" }}>
              {claimRequests.map((req) => (
                <div key={req.id} style={{
                  border: `1px solid ${DS.colors.border}`,
                  borderRadius: DS.radius.sm,
                  background: DS.colors.bg,
                  padding: "10px 12px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "10px",
                }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{req.clinic_name}</div>
                    <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                      Owner: {req.owner_email} · Requester: {req.requester_name || req.requester_email || "unknown"}
                    </div>
                    {req.notes && (
                      <div style={{ fontSize: "12px", color: DS.colors.textDim, marginTop: "4px" }}>{req.notes}</div>
                    )}
                    <div style={{ fontSize: "11px", color: DS.colors.textDim, marginTop: "4px" }}>
                      {new Date(req.submitted_at).toLocaleString()} · {req.source}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <span style={{
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "999px",
                      background: req.status === "approved" ? DS.colors.vitalDim : req.status === "rejected" ? DS.colors.dangerDim : DS.colors.warnDim,
                      color: req.status === "approved" ? DS.colors.vital : req.status === "rejected" ? DS.colors.danger : DS.colors.warn,
                      textTransform: "uppercase",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                    }}>
                      {req.status}
                    </span>
                    {req.status === "pending" && (
                      <>
                        <Button small onClick={() => handleClaimDecision(req.id, "approved")} style={{ background: DS.colors.vital, border: "none", color: "#fff" }}>
                          Approve
                        </Button>
                        <Button small onClick={() => handleClaimDecision(req.id, "rejected")} style={{ background: DS.colors.danger, border: "none", color: "#fff" }}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card style={{ marginBottom: "20px" }}>
          <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "10px" }}>Clinic Memberships</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
            <select
              value={selectedMembershipUserId}
              onChange={(e) => setSelectedMembershipUserId(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bgCard, color: DS.colors.text, fontSize: "12px" }}
            >
              <option value="">Select user</option>
              {teamUsers.map((u) => (
                <option key={u.auth_user_id} value={u.auth_user_id}>{u.email}</option>
              ))}
            </select>
            <select
              value={selectedMembershipPracticeId}
              onChange={(e) => setSelectedMembershipPracticeId(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bgCard, color: DS.colors.text, fontSize: "12px" }}
            >
              <option value="">Select clinic</option>
              {practices.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={membershipRole}
              onChange={(e) => setMembershipRole(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bgCard, color: DS.colors.text, fontSize: "12px" }}
            >
              <option value="owner">owner</option>
              <option value="admin">admin</option>
              <option value="office_manager">office_manager</option>
              <option value="provider">provider</option>
              <option value="reviewer">reviewer</option>
            </select>
            <select
              value={membershipStatus}
              onChange={(e) => setMembershipStatus(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bgCard, color: DS.colors.text, fontSize: "12px" }}
            >
              <option value="active">active</option>
              <option value="pending">pending</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: DS.colors.textMuted }}>
              <input
                type="checkbox"
                checked={membershipDefault}
                onChange={(e) => setMembershipDefault(e.target.checked)}
              />
              Set as default clinic
            </label>
            <Button small primary onClick={saveMembership} style={{ opacity: membershipSaving ? 0.7 : 1 }}>
              {membershipSaving ? "Saving..." : "Add / Update Membership"}
            </Button>
            <Button small onClick={() => refreshMembershipRows(selectedMembershipUserId)} style={{ opacity: membershipLoading ? 0.7 : 1 }}>
              {membershipLoading ? "Loading..." : "Refresh User Memberships"}
            </Button>
            {membershipNotice && <span style={{ fontSize: "12px", color: DS.colors.textMuted }}>{membershipNotice}</span>}
          </div>
          <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
            {membershipRows.length === 0 ? (
              <div style={{ fontSize: "12px", color: DS.colors.textDim }}>
                No memberships for selected user.
              </div>
            ) : (
              membershipRows.map((row) => (
                <div key={row.id} style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto auto",
                  gap: "8px",
                  alignItems: "center",
                  fontSize: "12px",
                  background: DS.colors.bg,
                  border: `1px solid ${DS.colors.border}`,
                  borderRadius: DS.radius.sm,
                  padding: "8px 10px",
                }}>
                  <span>{row.clinic_name || `Clinic ${String(row.practice_id).slice(0, 8)}`}</span>
                  <span style={{ color: DS.colors.textMuted }}>{row.role}</span>
                  <span style={{ color: row.status === "active" ? DS.colors.vital : DS.colors.warn }}>{row.status}</span>
                  <span style={{ color: row.is_default ? DS.colors.shock : DS.colors.textDim }}>{row.is_default ? "default" : ""}</span>
                </div>
              ))
            )}
          </div>
        </Card>

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
          <div className="fade-in">
            <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
              <button
                type="button"
                onClick={() => setPipelineFocus("all")}
                style={{
                  padding: "6px 10px",
                  borderRadius: DS.radius.sm,
                  border: `1px solid ${pipelineFocus === "all" ? DS.colors.borderLight : DS.colors.border}`,
                  background: pipelineFocus === "all" ? DS.colors.bgCard : "transparent",
                  color: pipelineFocus === "all" ? DS.colors.text : DS.colors.textMuted,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                All practices ({practices.length})
              </button>
              <button
                type="button"
                onClick={() => setPipelineFocus("capture")}
                style={{
                  padding: "6px 10px",
                  borderRadius: DS.radius.sm,
                  border: `1px solid ${pipelineFocus === "capture" ? DS.colors.shock : DS.colors.border}`,
                  background: pipelineFocus === "capture" ? DS.colors.shockGlow : "transparent",
                  color: pipelineFocus === "capture" ? DS.colors.shock : DS.colors.textMuted,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Capture-signal only ({practicesWithCaptureSignals})
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
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
                      ({pipelinePractices.filter((c) => c.stage === stage.key).length})
                    </span>
                  </div>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {pipelinePractices.filter((c) => c.stage === stage.key).map((c) => (
                      <div key={c.id} onClick={() => setSelectedClient(c)} style={{
                        padding: "14px 16px", background: DS.colors.bgCard,
                        border: `1px solid ${DS.colors.border}`, borderRadius: DS.radius.md,
                        cursor: "pointer", transition: "border-color 0.2s",
                      }}
                      onMouseOver={(e) => e.currentTarget.style.borderColor = DS.colors.borderLight}
                      onMouseOut={(e) => e.currentTarget.style.borderColor = DS.colors.border}
                      >
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
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px" }}>Tool Stack</div>
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
                      const statusOrder = { week1: 1, week2: 2, week3: 3, week4: 4, not_started: 5, completed: 6 };
                      return (statusOrder[a.pilot_status] || 5) - (statusOrder[b.pilot_status] || 5);
                    })
                    .map((practice) => {
                      const pilotStatus = practice.pilot_status || "not_started";
                      const checklist = practice.pilot_checklist || {};
                      const isActive = pilotStatus !== "not_started" && pilotStatus !== "completed";

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
        title="Select Tool Stack"
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

export { TeamDashboard };
