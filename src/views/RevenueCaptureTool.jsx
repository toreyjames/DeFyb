import { useState, useEffect, useRef } from "react";
import { DS } from "../design/tokens";
import { Button, Card, SectionTitle, MetricCard } from "../components/ui";
import { DeFybLogo } from "../components/svg";
import { supabase, isSupabaseConfigured } from "../supabase";
import { trackEvent } from "../lib/analytics";
import { CORE_PRICING, OPTIONAL_ADDONS, calculateCoreMonthly, resolveCorePerProviderRate } from "../lib/pricing";

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

export const RevenueCaptureTool = ({ onBack, demoMode = false }) => {
  const [note, setNote] = useState("");
  const [billedCode, setBilledCode] = useState("99213");
  const [specialty, setSpecialty] = useState("General");
  const [patientType, setPatientType] = useState("established");
  const [placeOfService, setPlaceOfService] = useState("office");
  const [codingPath, setCodingPath] = useState("mdm");
  const [conservativeMode, setConservativeMode] = useState(true);
  const [totalMinutes, setTotalMinutes] = useState("");
  const [isTelehealth, setIsTelehealth] = useState(false);
  const [encounterDate, setEncounterDate] = useState(new Date().toISOString().slice(0, 10));
  const [surgeryDate, setSurgeryDate] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [billingProfile, setBillingProfile] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [includeImplementation, setIncludeImplementation] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [providerCount, setProviderCount] = useState(1);
  const [activeProviders, setActiveProviders] = useState(1);
  const [clinicMemberships, setClinicMemberships] = useState([]);
  const [activePracticeId, setActivePracticeId] = useState(null);
  const [claimRequest, setClaimRequest] = useState(null);
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimClinicName, setClaimClinicName] = useState("");
  const [claimRequesterName, setClaimRequesterName] = useState("");
  const [claimOwnerEmail, setClaimOwnerEmail] = useState("");
  const [claimNotes, setClaimNotes] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [queueInput, setQueueInput] = useState("");
  const [queueItems, setQueueItems] = useState([]);
  const [currentQueueId, setCurrentQueueId] = useState(null);
  const [analyzingQueue, setAnalyzingQueue] = useState(false);
  const [queueStopRequested, setQueueStopRequested] = useState(false);
  const queueStopRef = useRef(false);
  const [activeEncounterId, setActiveEncounterId] = useState(null);
  const [encounterDetail, setEncounterDetail] = useState(null);
  const [encounterDetailLoading, setEncounterDetailLoading] = useState(false);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [dashboardMetricsLoading, setDashboardMetricsLoading] = useState(false);
  const [showBillingPanel, setShowBillingPanel] = useState(false);
  const [showQueuePanel, setShowQueuePanel] = useState(false);
  const [showAdvancedReview, setShowAdvancedReview] = useState(false);
  const draftStorageKey = "defyb:encounter-note-draft:v1";
  const practiceStorageKey = "defyb:active-practice-id:v1";
  const activationSyncRef = useRef(false);
  const effectiveDemoMode = demoMode || !isSupabaseConfigured();
  const pilotMode = true; // flip to false when billing is ready
  const hasPaidWorkspace = pilotMode || Boolean(
    billingProfile?.stripe_subscription_id
      || ["active", "trialing"].includes(String(billingProfile?.billing_status || "").toLowerCase())
  );
  const claimStatus = String(claimRequest?.status || "").toLowerCase();
  const isClaimApproved = claimStatus === "approved";
  const isProvisionalWorkspace = !pilotMode && !effectiveDemoMode && !hasPaidWorkspace && !isClaimApproved;
  const toggleAddon = (addonId) => {
    setSelectedAddons((prev) => (
      prev.includes(addonId) ? prev.filter((id) => id !== addonId) : [...prev, addonId]
    ));
  };

  const copyText = async (label, text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(""), 1400);
    } catch {
      setCopied("Copy failed");
      setTimeout(() => setCopied(""), 1400);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!activePracticeId) return;
    window.localStorage.setItem(practiceStorageKey, activePracticeId);
  }, [activePracticeId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(draftStorageKey);
    if (saved) setNote(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      if (note.trim()) window.localStorage.setItem(draftStorageKey, note);
      else window.localStorage.removeItem(draftStorageKey);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [note]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (!isMeta || event.key !== "Enter") return;
      event.preventDefault();
      if (event.shiftKey) {
        if (!analyzing && analysis) handleFinalizeEncounter();
      } else if (!analyzing) {
        runAnalysis();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [analyzing, analysis, note, billedCode, specialty, patientType, placeOfService, codingPath, totalMinutes, conservativeMode, isTelehealth, encounterDate, surgeryDate]);

  const mapEncounterListToHistory = (encounters = []) => (
    encounters.map((row) => {
      const rec = row.latest_recommendation || {};
      const rev = row.latest_revenue_impact || {};
      const gapText = rec.documentation_gap_text || "";
      const gapItems = gapText ? gapText.split(/(?<=\.)\s+/).filter(Boolean) : [];
      const selectedCode = rec.current_user_selected_code || "";
      const acceptedAt = selectedCode ? (rec.reviewed_at || rec.created_at || null) : null;
      return {
        id: rec.id || row.id,
        at: new Date(row.created_at).toLocaleString(),
        specialty: "General",
        billedCode: rev.current_code || "99213",
        suggestedCode: rec.suggested_code || rev.suggested_code || "99213",
        recommendationId: rec.id || null,
        modelVersion: rec.rule_version || "rules-v1.0-em-core",
        encounterContext: {
          patientType: row.patient_type || "established",
          placeOfService: row.pos || "office",
          telehealth: Boolean(row.telehealth),
          encounterDate: row.encounter_date || null,
        },
        confidence: rec.confidence === "high" ? 0.9 : rec.confidence === "medium" ? 0.75 : rec.confidence === "low" ? 0.6 : 0.75,
        estimatedDeltaPerVisit: Number(rev.delta_amount || 0),
        noteSnippet: "",
        rationale: rec.rationale_json || [],
        gaps: gapItems,
        suggestions: gapItems,
        estimatedMonthlyRecovery: Number(rev.delta_amount || 0) * 80,
        reviewStatus: rec.review_status || "pending",
        reviewerCode: rec.reviewer_code || "",
        reviewerNotes: rec.reviewer_notes || "",
        acceptedCode: selectedCode,
        acceptedAt,
        encounterId: row.id,
      };
    })
  );

  const loadHistory = async () => {
    if (effectiveDemoMode) return;
    try {
      const practiceQuery = activePracticeId ? `&practice_id=${encodeURIComponent(activePracticeId)}` : "";
      const payload = await invokeEncountersApi(`/encounters?limit=20${practiceQuery}`, "GET");
      setHistory(mapEncounterListToHistory(payload?.encounters || []));
    } catch (historyError) {
      console.warn("history unavailable:", historyError?.message || historyError);
    }
  };

  useEffect(() => {
    const loadBillingProfile = async () => {
      if (effectiveDemoMode) return;
      const { data } = await supabase
        .from("billing_profiles")
        .select("billing_status, plan_code, implementation_enabled, monthly_amount, stripe_subscription_id, licensed_provider_count, active_provider_count, selected_addons, addon_setup_pending")
        .maybeSingle();
      if (data) {
        setBillingProfile(data);
        setProviderCount(Math.max(1, Number(data.licensed_provider_count || 1)));
        setActiveProviders(Math.max(1, Number(data.active_provider_count || data.licensed_provider_count || 1)));
        if (Array.isArray(data.selected_addons)) setSelectedAddons(data.selected_addons);
      }
    };
    const loadClaimRequest = async () => {
      if (effectiveDemoMode) return;
      try {
        const { data } = await supabase
          .from("clinic_claim_requests")
          .select("id, clinic_name, owner_email, requester_name, notes, status, submitted_at, reviewed_at")
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) {
          setClaimRequest(data);
        }
      } catch {
        // Claim requests are optional until migration is applied.
      }
    };
    const loadClinicMemberships = async () => {
      if (effectiveDemoMode) return;
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return;
      const { data, error } = await supabase
        .from("clinic_memberships")
        .select("practice_id, clinic_name, role, is_default, status")
        .eq("auth_user_id", user.id)
        .eq("status", "active")
        .order("is_default", { ascending: false });
      if (!error && data && data.length > 0) {
        setClinicMemberships(data);
        const savedPractice = typeof window !== "undefined" ? window.localStorage.getItem(practiceStorageKey) : null;
        const selected = data.find((m) => m.practice_id === savedPractice)?.practice_id
          || data.find((m) => m.is_default)?.practice_id
          || data[0].practice_id;
        setActivePracticeId(selected || null);
        return;
      }

      // Backward compatibility fallback to single-practice app_users row.
      const { data: appUserRow } = await supabase
        .from("app_users")
        .select("practice_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (appUserRow?.practice_id) {
        setClinicMemberships([{ practice_id: appUserRow.practice_id, clinic_name: "Clinic", role: "provider", is_default: true, status: "active" }]);
        setActivePracticeId(appUserRow.practice_id);
      }
    };

    loadClinicMemberships();
    loadHistory();
    loadBillingProfile();
    loadClaimRequest();
  }, [effectiveDemoMode]);

  useEffect(() => {
    if (effectiveDemoMode) return;
    loadHistory();
    loadDashboardMetrics();
  }, [activePracticeId, effectiveDemoMode]);

  const startSubscriptionCheckout = async () => {
    if (!isSupabaseConfigured()) {
      setError("Billing service is not configured.");
      return;
    }
    setBillingLoading(true);
    setError(null);
    try {
      const { data, error: checkoutError } = await supabase.functions.invoke("create-billing-checkout", {
        body: {
          origin: window.location.origin,
          includeImplementation,
          selectedAddons,
          providerCount,
        },
      });
      if (checkoutError) throw checkoutError;
      if (!data?.url) throw new Error("Unable to create checkout session");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Could not start checkout.");
      setBillingLoading(false);
    }
  };

  const saveSeatUsage = async () => {
    if (!isSupabaseConfigured()) return;
    const safeActive = Math.max(1, Number(activeProviders || 1));
    const safeLicensed = Math.max(1, Number(providerCount || 1));

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;

    await supabase.from("billing_profiles").upsert({
      user_id: user.id,
      email: user.email || "",
      active_provider_count: safeActive,
      licensed_provider_count: safeLicensed,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    setBillingProfile((prev) => ({
      ...(prev || {}),
      active_provider_count: safeActive,
      licensed_provider_count: safeLicensed,
    }));
  };

  const markAddonSetupComplete = async (addonId) => {
    if (!isSupabaseConfigured()) return;
    const pending = Array.isArray(billingProfile?.addon_setup_pending) ? billingProfile.addon_setup_pending : [];
    if (!pending.includes(addonId)) return;
    const updatedPending = pending.filter((id) => id !== addonId);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return;
    await supabase
      .from("billing_profiles")
      .upsert({
        user_id: user.id,
        email: user.email || "",
        addon_setup_pending: updatedPending,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    setBillingProfile((prev) => ({ ...(prev || {}), addon_setup_pending: updatedPending }));
    setCopied(`${addonId.replace("_", " ")} setup marked complete`);
    setTimeout(() => setCopied(""), 1200);
  };

  const submitClinicClaimRequest = async () => {
    if (effectiveDemoMode || !isSupabaseConfigured()) return;
    const clinicName = claimClinicName.trim();
    const ownerEmail = claimOwnerEmail.trim().toLowerCase();
    if (!clinicName || !ownerEmail) {
      setError("Clinic name and owner/admin email are required to submit claim.");
      return;
    }
    if (!ownerEmail.includes("@")) {
      setError("Use a valid owner/admin email.");
      return;
    }
    setClaimSubmitting(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) throw new Error("Sign in required.");

      const payload = {
        requester_user_id: user.id,
        requester_email: user.email || "",
        requester_name: claimRequesterName.trim() || null,
        clinic_name: clinicName,
        owner_email: ownerEmail,
        notes: claimNotes.trim() || null,
        source: "practice_tool",
      };

      const { data, error: insertError } = await supabase
        .from("clinic_claim_requests")
        .insert(payload)
        .select("id, clinic_name, owner_email, requester_name, notes, status, submitted_at, reviewed_at")
        .single();

      if (insertError) throw insertError;
      if (data) setClaimRequest(data);
      trackEvent("clinic_claim_submitted", { source: "practice_tool" });
      supabase.functions.invoke("clinic-claim-notify", {
        body: {
          event: "submitted",
          clinicName: clinicName,
          ownerEmail: ownerEmail,
          requesterName: payload.requester_name,
          requesterEmail: payload.requester_email,
          notes: payload.notes,
        },
      }).catch(() => {});

      // Fast auto-review: low-risk requests get immediate approval.
      const { data: reviewResult } = await supabase.functions.invoke("clinic-claim-auto-review", {
        body: { claimRequestId: data?.id },
      });
      if (reviewResult?.autoApproved) {
        trackEvent("clinic_claim_auto_approved", { source: "practice_tool" });
        if (data?.id) {
          supabase.functions.invoke("clinic-claim-activate", {
            body: { claimRequestId: data.id },
          }).catch(() => {});
        }
        setClaimRequest((prev) => prev ? ({
          ...prev,
          status: "approved",
          reviewed_at: new Date().toISOString(),
        }) : prev);
        supabase.functions.invoke("clinic-claim-notify", {
          body: {
            event: "decision",
            status: "approved",
            clinicName: clinicName,
            ownerEmail: ownerEmail,
            requesterName: payload.requester_name,
            requesterEmail: payload.requester_email,
          },
        }).catch(() => {});
        setCopied("Claim auto-approved");
        setTimeout(() => setCopied(""), 1600);
      }
      setShowClaimForm(false);
      if (!reviewResult?.autoApproved) {
        setCopied("Claim request sent");
        setTimeout(() => setCopied(""), 1400);
      }
    } catch (claimError) {
      const msg = String(claimError?.message || "");
      if (msg.toLowerCase().includes("relation") && msg.toLowerCase().includes("clinic_claim_requests")) {
        window.location.href = `mailto:torey@defyb.org?subject=Clinic%20Claim%20Request&body=Clinic:%20${encodeURIComponent(clinicName)}%0AOwner%20Email:%20${encodeURIComponent(ownerEmail)}`;
        return;
      }
      setError(msg || "Could not submit clinic claim request.");
    } finally {
      setClaimSubmitting(false);
    }
  };

  const openBillingPortal = async () => {
    if (!isSupabaseConfigured()) return;
    setBillingLoading(true);
    setError(null);
    try {
      const { data, error: portalError } = await supabase.functions.invoke("create-billing-portal", {
        body: {
          returnUrl: `${window.location.origin}/tool`,
        },
      });
      if (portalError) throw portalError;
      if (!data?.url) throw new Error("Unable to create billing portal session");
      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Could not open billing portal.");
      setBillingLoading(false);
    }
  };

  const invokeEncountersApi = async (path, method = "GET", body = null) => {
    if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
    const baseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!baseUrl) throw new Error("Missing Supabase URL");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error("Missing auth session");

    const response = await fetch(`${baseUrl}/functions/v1/encounters-api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `encounters-api ${method} ${path} failed`);
    }
    return payload;
  };

  const loadDashboardMetrics = async () => {
    if (effectiveDemoMode) return;
    try {
      setDashboardMetricsLoading(true);
      const practiceQuery = activePracticeId ? `?practice_id=${encodeURIComponent(activePracticeId)}` : "";
      const metrics = await invokeEncountersApi(`/dashboard/metrics${practiceQuery}`, "GET");
      setDashboardMetrics(metrics || null);
    } catch (metricsError) {
      console.warn("dashboard metrics unavailable:", metricsError?.message || metricsError);
    } finally {
      setDashboardMetricsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardMetrics();
  }, [effectiveDemoMode]);

  useEffect(() => {
    if (effectiveDemoMode) return;
    if (activationSyncRef.current) return;
    if (!claimRequest?.id) return;
    if (String(claimRequest.status || "").toLowerCase() !== "approved") return;
    if (billingProfile?.billing_status && String(billingProfile.billing_status).toLowerCase() !== "none") return;
    activationSyncRef.current = true;
    supabase.functions.invoke("clinic-claim-activate", {
      body: { claimRequestId: claimRequest.id },
    }).then(async () => {
      const { data } = await supabase
        .from("billing_profiles")
        .select("billing_status, plan_code, implementation_enabled, monthly_amount, stripe_subscription_id, licensed_provider_count, active_provider_count, selected_addons, addon_setup_pending")
        .maybeSingle();
      if (data) setBillingProfile(data);
    }).catch(() => {
      activationSyncRef.current = false;
    });
  }, [effectiveDemoMode, claimRequest?.id, claimRequest?.status, billingProfile?.billing_status]);

  const runAnalysis = async (noteOverride = null, queueIdOverride = null, autoAdvance = true, manageLoading = true) => {
    const effectiveNote = typeof noteOverride === "string" ? noteOverride : note;
    const queueTargetId = queueIdOverride || currentQueueId;

    if (!effectiveNote.trim()) {
      setCopied("Paste an encounter note first");
      setTimeout(() => setCopied(""), 1400);
      return false;
    }
    if (manageLoading) setAnalyzing(true);
    setError(null);

    try {
      const encounterContext = {
        patientType,
        placeOfService,
        codingPath,
        totalMinutes: codingPath === "time" ? Math.max(0, Number(totalMinutes || 0)) : null,
        conservativeMode,
        telehealth: isTelehealth,
        encounterDate,
        surgeryDate: surgeryDate || null,
      };

      let mapped = null;
      if (effectiveDemoMode) {
        const local = analyzeEncounterNote(effectiveNote, billedCode, encounterContext);
        mapped = {
          id: `demo-${Date.now()}`,
          at: new Date().toLocaleString(),
          specialty,
          billedCode,
          suggestedCode: local.suggestedCode,
          recommendationId: null,
          modelVersion: "demo-rules-v1",
          encounterContext,
          confidence: local.confidence || 0.78,
          estimatedDeltaPerVisit: Number(local.estimatedDeltaPerVisit || 0),
          noteSnippet: "",
          rationale: local.rationale || [],
          gaps: local.gaps || [],
          suggestions: local.suggestions || [],
          evidenceFound: local.evidenceFound || [],
          evidenceMissing: local.evidenceMissing || [],
          moveUpRequirements: local.moveUpRequirements || [],
          moveDownReasons: local.moveDownReasons || [],
          postOpDays: local.postOpDays ?? null,
          surgeryDateDetected: local.surgeryDateDetected || null,
          estimatedMonthlyRecovery: Number(local.estimatedMonthlyRecovery || 0),
          reviewStatus: "pending",
          reviewerCode: "",
          reviewerNotes: "",
          acceptedCode: "",
          acceptedAt: null,
          encounterId: null,
        };
      } else {
        if (!activePracticeId) {
          throw new Error("Select a clinic before running analysis.");
        }
        const created = await invokeEncountersApi("/encounters", "POST", {
          practice_id: activePracticeId || undefined,
          encounter_date: encounterDate,
          visit_type: "office_followup",
          patient_type: patientType,
          pos: placeOfService,
          telehealth: isTelehealth,
          minutes: codingPath === "time" ? Math.max(0, Number(totalMinutes || 0)) : null,
        });
        const encounterId = created.encounter_id;
        setActiveEncounterId(encounterId);

        await invokeEncountersApi(`/encounters/${encounterId}/note`, "POST", {
          raw_note: effectiveNote,
          source: "manual",
        });

        const analyzed = await invokeEncountersApi(`/encounters/${encounterId}/analyze`, "POST", {
          current_code: billedCode,
          payer_name: "FALLBACK",
          state: "NA",
          specialty,
          context: encounterContext,
        });

        const rec = analyzed.recommendation || {};
        const rev = analyzed.revenue_impact || {};
        const confidenceMap = { high: 0.9, medium: 0.75, low: 0.6 };
        const gapText = rec.documentation_gap_text || "";
        const gapItems = gapText ? gapText.split(/(?<=\.)\s+/).filter(Boolean) : [];

        mapped = {
          id: rec.recommendation_id || encounterId,
          at: new Date().toLocaleString(),
          specialty,
          billedCode,
          suggestedCode: rec.suggested_code,
          recommendationId: rec.recommendation_id || null,
          modelVersion: analyzed.rule_version || "rules-v1.1-em-core",
          encounterContext,
          confidence: confidenceMap[rec.confidence] || 0.75,
          estimatedDeltaPerVisit: Number(rev.delta_amount || 0),
          noteSnippet: "",
          rationale: rec.rationale || [],
          gaps: gapItems,
          suggestions: gapItems,
          evidenceFound: [],
          evidenceMissing: gapItems,
          moveUpRequirements: [],
          moveDownReasons: [],
          postOpDays: null,
          surgeryDateDetected: null,
          estimatedMonthlyRecovery: Number(rev.delta_amount || 0) * 80,
          reviewStatus: "pending",
          reviewerCode: "",
          reviewerNotes: "",
          acceptedCode: "",
          acceptedAt: null,
          encounterId,
        };
      }

      setAnalysis({
        id: mapped.id,
        encounterId: mapped.encounterId || null,
        suggestedCode: mapped.suggestedCode,
        modelVersion: mapped.modelVersion,
        rationale: mapped.rationale,
        confidence: mapped.confidence,
        gaps: mapped.gaps,
        suggestions: mapped.suggestions,
        evidenceFound: mapped.evidenceFound || [],
        evidenceMissing: mapped.evidenceMissing || [],
        moveUpRequirements: mapped.moveUpRequirements || [],
        moveDownReasons: mapped.moveDownReasons || [],
        postOpDays: mapped.postOpDays ?? null,
        surgeryDateDetected: mapped.surgeryDateDetected || null,
        estimatedDeltaPerVisit: mapped.estimatedDeltaPerVisit,
        estimatedMonthlyRecovery: mapped.estimatedMonthlyRecovery,
      });
      setHistory((prev) => [mapped, ...prev.filter((p) => p.id !== mapped.id)].slice(0, 20));
      if (!effectiveDemoMode) {
        loadHistory();
        loadDashboardMetrics();
      }

      if (queueTargetId) {
        let nextQueueId = null;
        let nextQueueText = "";
        setQueueItems((prev) => {
          const updated = prev.map((item) => (
            item.id === queueTargetId
              ? { ...item, status: "done", result: `${mapped.billedCode}->${mapped.suggestedCode}` }
              : item
          ));
          const currentIndex = updated.findIndex((item) => item.id === queueTargetId);
          const pendingAfter = updated.slice(currentIndex + 1).find((item) => item.status === "pending");
          const fallbackPending = updated.find((item) => item.status === "pending");
          const nextItem = pendingAfter || fallbackPending || null;
          if (nextItem) {
            nextQueueId = nextItem.id;
            nextQueueText = nextItem.text;
          }
          return updated;
        });
        if (autoAdvance) {
          setCurrentQueueId(nextQueueId);
          if (nextQueueText) setNote(nextQueueText);
        }
      }
      return true;
    } catch (err) {
      setError(err.message || "Analysis failed. Please try again.");
      return false;
    } finally {
      if (manageLoading) setAnalyzing(false);
    }
  };

  const lowConfidence = analysis && analysis.confidence < 0.7;
  const billingSummary = analysis ? [
    `Billed code: ${billedCode}`,
    `Suggested code: ${analysis.suggestedCode}`,
    ...(analysis.suggestedCode === "99024" ? ["Global post-op follow-up: non-billable (90-day window)"] : []),
    `Confidence: ${Math.round(analysis.confidence * 100)}%`,
    "",
    "Justification:",
    ...analysis.rationale.map((r) => `- ${r}`),
    "",
    "Documentation gaps:",
    ...(analysis.gaps.length > 0 ? analysis.gaps : ["- No major gaps detected."]).map((g) => `- ${g}`),
    "",
    `Estimated $/visit delta: $${analysis.estimatedDeltaPerVisit}`,
    `Estimated monthly recovery: $${analysis.estimatedMonthlyRecovery.toLocaleString()}`,
  ].join("\n") : "";

  const noteAdditions = analysis ? analysis.suggestions.join("\n") : "";
  const corePerProviderRate = resolveCorePerProviderRate(providerCount);
  const coreMonthlyEstimate = calculateCoreMonthly(providerCount);
  const selectedAddonDetails = OPTIONAL_ADDONS.filter((addon) => selectedAddons.includes(addon.id));
  const purchasedAddons = Array.isArray(billingProfile?.selected_addons) ? billingProfile.selected_addons : selectedAddons;
  const addonSetupPending = Array.isArray(billingProfile?.addon_setup_pending) ? billingProfile.addon_setup_pending : [];
  const addonsMonthlyEstimate = selectedAddonDetails.reduce(
    (sum, addon) => sum + (addon.perProvider ? addon.monthly * providerCount : addon.monthly),
    0
  );
  const addonsImplementationEstimate = selectedAddonDetails.reduce((sum, addon) => sum + addon.implementation, 0);
  const monthlyEstimate = coreMonthlyEstimate + addonsMonthlyEstimate;
  const upfrontEstimate = (includeImplementation ? CORE_PRICING.implementationFee : 0) + addonsImplementationEstimate;
  const overLimit = activeProviders > providerCount;
  const reviewedCases = history.filter((h) => h.reviewStatus && h.reviewStatus !== "pending");
  const agreeCases = reviewedCases.filter((h) => h.reviewStatus === "agree");
  const agreementRate = reviewedCases.length > 0 ? Math.round((agreeCases.length / reviewedCases.length) * 100) : 0;
  const apiAnalysesRun = dashboardMetrics
    ? Object.values(dashboardMetrics.code_distribution || {}).reduce((sum, count) => sum + Number(count || 0), 0)
    : null;
  const apiAccepted = dashboardMetrics?.accepted_suggestions ?? null;
  const apiOverrides = dashboardMetrics?.overridden_suggestions ?? null;
  const apiUndercoding = dashboardMetrics?.undercoding_opportunities_detected ?? null;
  const apiRevenueCaptured = dashboardMetrics?.estimated_revenue_captured ?? null;
  const apiTopGaps = dashboardMetrics?.top_documentation_gaps || [];
  const analysesForPrompts = Number(apiAnalysesRun ?? history.length ?? 0);
  const estimatedLiftForPrompts = Number(apiRevenueCaptured ?? 0);
  const shouldPromptStartSubscription = !pilotMode && !effectiveDemoMode && !billingProfile?.stripe_subscription_id && analysesForPrompts >= 3;
  const shouldPromptFirstWin = !pilotMode && !effectiveDemoMode && analysesForPrompts >= 1 && estimatedLiftForPrompts > 0;
  const versionStats = Object.values(history.reduce((acc, item) => {
    const key = item.modelVersion || "rules-v1.0";
    if (!acc[key]) {
      acc[key] = { version: key, total: 0, reviewed: 0, agree: 0 };
    }
    acc[key].total += 1;
    if (item.reviewStatus && item.reviewStatus !== "pending") {
      acc[key].reviewed += 1;
      if (item.reviewStatus === "agree") acc[key].agree += 1;
    }
    return acc;
  }, {})).map((s) => ({
    ...s,
    agreement: s.reviewed > 0 ? Math.round((s.agree / s.reviewed) * 100) : 0,
  }));
  const activeModelVersion = history[0]?.modelVersion || analysis?.modelVersion || "rules-v1.4-context";
  const queuePendingCount = queueItems.filter((item) => item.status === "pending").length;
  const queueDoneCount = queueItems.filter((item) => item.status === "done").length;
  const qualityGate = (() => {
    if (!analysis) return { hardStops: [], warnings: [], canFinalize: false };

    const hardStops = [];
    const warnings = [];
    const gaps = analysis.gaps || [];
    const hasGap = (pattern) => gaps.some((g) => pattern.test((g || "").toLowerCase()));
    const isGlobalPostOp = analysis.suggestedCode === "99024";
    const rationaleText = (analysis.rationale || []).join(" ").toLowerCase();
    const suggestedCodeNum = Number(String(analysis.suggestedCode || "").replace(/\D/g, ""));

    if (!isGlobalPostOp && analysis.confidence < 0.7) {
      hardStops.push("Confidence is below 70%. Manual clinical/coding review required.");
    }
    if (!isGlobalPostOp && codingPath === "time") {
      const documentedMinutes = Number(totalMinutes || 0);
      const minMinutes = suggestedCodeNum >= 99215 || suggestedCodeNum === 99204
        ? 45
        : suggestedCodeNum >= 99214 || suggestedCodeNum === 99203
          ? 30
          : suggestedCodeNum === 99202
            ? 15
            : 20;
      if (!documentedMinutes || documentedMinutes < minMinutes) {
        hardStops.push(`Time-based coding selected but documented minutes are below ${minMinutes}.`);
      }
    }
    if (!isGlobalPostOp && analysis.suggestedCode !== billedCode && gaps.length > 0) {
      hardStops.push("Suggested code change has unresolved documentation gaps.");
    }
    if (!isGlobalPostOp && (["99203", "99204", "99214", "99215"].includes(String(analysis.suggestedCode || "")))) {
      const evidenceSignals = [
        /problem|chronic|acute/.test(rationaleText),
        /medication|drug|risk/.test(rationaleText),
        /data|lab|imaging|review/.test(rationaleText),
      ].filter(Boolean).length;
      if (evidenceSignals < 2) {
        hardStops.push("Insufficient evidence categories for higher-level E/M recommendation.");
      }
    }
    if (isGlobalPostOp && !surgeryDate) {
      hardStops.push("99024 requires surgery date documentation before finalization.");
    }

    if (placeOfService === "telehealth" && !isTelehealth) {
      warnings.push("POS is telehealth but telehealth toggle is off.");
    }
    if (patientType === "new") {
      warnings.push("New-patient workflows may need broader E/M range validation.");
    }
    if (isGlobalPostOp) {
      warnings.push("Global post-op follow-up detected. 99024 is non-billable in the 90-day global period.");
    }

    return { hardStops, warnings, canFinalize: hardStops.length === 0 };
  })();
  const timelineEvents = (() => {
    if (!analysis) return [];
    const events = [
      { at: analysis.id ? "now" : null, text: "Analysis generated" },
      ...(history.find((h) => h.id === analysis.id)?.acceptedAt
        ? [{ at: new Date(history.find((h) => h.id === analysis.id).acceptedAt).toLocaleString(), text: "Recommendation finalized" }]
        : []),
      ...((encounterDetail?.audit_events || []).slice(0, 4).map((ev) => ({
        at: new Date(ev.created_at).toLocaleString(),
        text: ev.event_type,
      }))),
    ].filter((e) => e.at || e.text);
    return events;
  })();
  const exportJustificationPdf = async () => {
    if (!analysis) return;
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const lines = [
      "DeFyb Billing Justification Packet",
      "",
      `Encounter Date: ${encounterDate || "-"}`,
      `Billed Code: ${billedCode}`,
      `Suggested Code: ${analysis.suggestedCode}`,
      `Confidence: ${Math.round(analysis.confidence * 100)}%`,
      "",
      "Rationale:",
      ...(analysis.rationale || []).map((r) => `- ${r}`),
      "",
      "Documentation Gaps:",
      ...((analysis.gaps || []).length > 0 ? analysis.gaps : ["- No major gaps detected."]).map((g) => `- ${g}`),
      "",
      `Estimated Delta / Visit: $${analysis.estimatedDeltaPerVisit}`,
      `Estimated Monthly Recovery: $${analysis.estimatedMonthlyRecovery.toLocaleString()}`,
    ];
    let y = 18;
    doc.setFontSize(12);
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 6;
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
    });
    doc.save(`defyb-justification-${Date.now()}.pdf`);
  };

  const loadQueue = () => {
    const parsed = queueInput
      .split(/\n-{3,}\n/g)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((text, idx) => ({
        id: `q-${Date.now()}-${idx}`,
        text,
        status: "pending",
        result: "",
      }));

    setQueueItems(parsed);
    queueStopRef.current = false;
    setQueueStopRequested(false);
    if (parsed.length > 0) {
      setCurrentQueueId(parsed[0].id);
      setNote(parsed[0].text);
      setCopied(`Queue loaded: ${parsed.length} encounters`);
      setTimeout(() => setCopied(""), 1400);
    }
  };

  const clearQueue = () => {
    setQueueItems([]);
    setCurrentQueueId(null);
    setQueueInput("");
    queueStopRef.current = false;
    setQueueStopRequested(false);
  };

  const requestStopQueue = () => {
    if (!analyzingQueue) return;
    queueStopRef.current = true;
    setQueueStopRequested(true);
  };

  const loadEncounterDetail = async (encounterId) => {
    if (!encounterId) return;
    try {
      setEncounterDetailLoading(true);
      const detail = await invokeEncountersApi(`/encounters/${encounterId}`, "GET");
      setEncounterDetail(detail);
    } catch (detailError) {
      setError(detailError.message || "Could not load encounter detail.");
    } finally {
      setEncounterDetailLoading(false);
    }
  };

  const analyzeAllQueue = async () => {
    if (analyzingQueue) return;
    const pending = queueItems.filter((item) => item.status === "pending");
    if (pending.length === 0) return;

    queueStopRef.current = false;
    setQueueStopRequested(false);
    setAnalyzingQueue(true);
    setAnalyzing(true);
    setError(null);

    let successCount = 0;
    for (const item of pending) {
      if (queueStopRef.current) break;
      setCurrentQueueId(item.id);
      setNote(item.text);
      const ok = await runAnalysis(item.text, item.id, false, false);
      if (ok) successCount += 1;
    }

    setCurrentQueueId(null);
    setAnalyzing(false);
    setAnalyzingQueue(false);
    const stopped = queueStopRef.current;
    setCopied(stopped
      ? `Queue stopped: ${successCount}/${pending.length} analyzed`
      : `Queue complete: ${successCount}/${pending.length} analyzed`
    );
    queueStopRef.current = false;
    setQueueStopRequested(false);
    setTimeout(() => setCopied(""), 1800);
  };

  const handleFinalizeEncounter = async () => {
    if (!analysis) return;
    if (!qualityGate.canFinalize) {
      setError("Finalize blocked by compliance gate. Resolve hard-stop items first.");
      return;
    }
    const packet = [
      `Finalized code: ${analysis.suggestedCode}`,
      `Original billed code: ${billedCode}`,
      "",
      "Justification:",
      ...analysis.rationale.map((r) => `- ${r}`),
      "",
      "Documentation additions:",
      ...(analysis.suggestions.length > 0 ? analysis.suggestions : ["- No additional text required."]),
      "",
      `Estimated delta per visit: $${analysis.estimatedDeltaPerVisit}`,
      `Estimated monthly recovery: $${analysis.estimatedMonthlyRecovery.toLocaleString()}`,
    ].join("\n");

    await copyText("Finalized packet copied", packet);

    const acceptedAt = new Date().toISOString();
    const encounterIdForSelection = analysis.encounterId || activeEncounterId;
    if (effectiveDemoMode) {
      setHistory((prev) => prev.map((h) => (
        h.id === analysis.id
          ? { ...h, acceptedCode: analysis.suggestedCode, acceptedAt }
          : h
      )));
      return;
    }

    if (encounterIdForSelection) {
      try {
        await invokeEncountersApi(`/encounters/${encounterIdForSelection}/select-code`, "POST", {
          selected_code: analysis.suggestedCode,
          selection_reason: "accepted_suggestion",
        });
      } catch (apiError) {
        setError(apiError.message || "Could not save finalization.");
        return;
      }
    } else {
      setError("Missing encounter reference for finalization.");
      return;
    }

    setHistory((prev) => prev.map((h) => (
      h.id === analysis.id
        ? { ...h, acceptedCode: analysis.suggestedCode, acceptedAt }
        : h
    )));
    loadHistory();
    loadDashboardMetrics();
  };

  const setReviewField = (analysisId, field, value) => {
    setReviewDrafts((prev) => ({
      ...prev,
      [analysisId]: {
        ...prev[analysisId],
        [field]: value,
      },
    }));
  };

  const saveReview = async (item) => {
    if (effectiveDemoMode) {
      setCopied("Advanced review is available after sign-in.");
      setTimeout(() => setCopied(""), 1400);
      return;
    }
    if (!isSupabaseConfigured()) return;
    const draft = reviewDrafts[item.id] || {};
    const reviewStatus = draft.reviewStatus || item.reviewStatus || "pending";
    const reviewerCode = draft.reviewerCode ?? item.reviewerCode ?? "";
    const reviewerNotes = draft.reviewerNotes ?? item.reviewerNotes ?? "";

    if (item.encounterId) {
      try {
        await invokeEncountersApi(`/encounters/${item.encounterId}/review`, "POST", {
          review_status: reviewStatus,
          reviewer_code: reviewerCode || null,
          reviewer_notes: reviewerNotes || null,
        });

        setHistory((prev) => prev.map((h) => (
          h.id === item.id
            ? { ...h, reviewStatus, reviewerCode, reviewerNotes }
            : h
        )));
        setReviewDrafts((prev) => ({ ...prev, [item.id]: {} }));
        loadHistory();
        loadDashboardMetrics();
        return;
      } catch (apiError) {
        setError(apiError.message || "Could not save review.");
        return;
      }
    }

    setError("Missing encounter reference for review.");
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px clamp(20px, 5vw, 80px)",
        background: `${DS.colors.bg}ee`, backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${DS.colors.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <DeFybLogo size={24} />
          {!effectiveDemoMode && clinicMemberships.length > 0 && (
            <select
              value={activePracticeId || ""}
              onChange={(e) => setActivePracticeId(e.target.value || null)}
              style={{
                padding: "6px 10px",
                borderRadius: DS.radius.sm,
                border: `1px solid ${DS.colors.borderLight}`,
                background: DS.colors.bgCard,
                color: DS.colors.text,
                fontSize: "12px",
                minWidth: "180px",
              }}
            >
              {clinicMemberships.map((m) => (
                <option key={m.practice_id} value={m.practice_id}>
                  {m.clinic_name || `Clinic ${String(m.practice_id).slice(0, 8)}`}
                </option>
              ))}
            </select>
          )}
        </div>
        <span onClick={onBack} style={{ fontSize: "13px", color: DS.colors.textMuted, cursor: "pointer" }}>
          {effectiveDemoMode ? "Exit Demo" : "Sign out"}
        </span>
      </nav>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "92px 20px 40px" }}>
        <SectionTitle sub="Paste encounter documentation and get billing intelligence in seconds.">
          Revenue Capture Tool
        </SectionTitle>
        {!effectiveDemoMode && clinicMemberships.length > 0 && (
          <div style={{ marginBottom: "8px", fontSize: "12px", color: DS.colors.textMuted }}>
            Active clinic: <span style={{ color: DS.colors.text }}>{clinicMemberships.find((m) => m.practice_id === activePracticeId)?.clinic_name || "Unspecified clinic"}</span>
          </div>
        )}
        <div style={{ marginBottom: "10px", fontSize: "12px", color: DS.colors.textMuted }}>
          Clinic-safe mode: encounter notes in this tool are not sent to analytics.
        </div>
        {isProvisionalWorkspace && (
          <div style={{
            marginBottom: "12px",
            padding: "12px",
            borderRadius: DS.radius.md,
            border: `1px solid ${DS.colors.warn}`,
            background: DS.colors.warnDim,
            fontSize: "12px",
            color: DS.colors.text,
          }}>
            Provisional workspace: provider-start mode is active. Billing owner/admin must claim this clinic to unlock full controls.
            {claimRequest?.submitted_at ? (
              <span style={{ marginLeft: "8px", color: DS.colors.warn, fontWeight: 700 }}>
                Claim status: {claimStatus || "pending"} (submitted {new Date(claimRequest.submitted_at).toLocaleDateString()})
              </span>
            ) : (
              <span
                onClick={() => setShowClaimForm((v) => !v)}
                style={{ marginLeft: "8px", color: DS.colors.shock, fontWeight: 700, cursor: "pointer" }}
              >
                {showClaimForm ? "Hide claim form" : "Claim clinic workspace →"}
              </span>
            )}
          </div>
        )}
        {isProvisionalWorkspace && showClaimForm && (
          <Card style={{ marginBottom: "12px" }}>
            <div style={{ fontWeight: 600, marginBottom: "8px" }}>Claim Clinic Workspace</div>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "8px" }}>
              Submit owner/admin contact so DeFyb can move this account from provisional to full clinic ownership.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px" }}>
              <input
                type="text"
                value={claimClinicName}
                onChange={(e) => setClaimClinicName(e.target.value)}
                placeholder="Clinic legal name"
                style={{ padding: "10px 12px", borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg, color: DS.colors.text }}
              />
              <input
                type="text"
                value={claimRequesterName}
                onChange={(e) => setClaimRequesterName(e.target.value)}
                placeholder="Your name (optional)"
                style={{ padding: "10px 12px", borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg, color: DS.colors.text }}
              />
              <input
                type="email"
                value={claimOwnerEmail}
                onChange={(e) => setClaimOwnerEmail(e.target.value)}
                placeholder="Owner/Admin email"
                style={{ padding: "10px 12px", borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg, color: DS.colors.text }}
              />
              <input
                type="text"
                value={claimNotes}
                onChange={(e) => setClaimNotes(e.target.value)}
                placeholder="Notes (optional)"
                style={{ padding: "10px 12px", borderRadius: DS.radius.sm, border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg, color: DS.colors.text }}
              />
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <Button primary small onClick={() => !claimSubmitting && submitClinicClaimRequest()} style={{ opacity: claimSubmitting ? 0.7 : 1 }}>
                {claimSubmitting ? "Submitting..." : "Submit Claim Request"}
              </Button>
              <Button small onClick={() => setShowClaimForm(false)}>Cancel</Button>
            </div>
          </Card>
        )}
        {effectiveDemoMode && (
          <div style={{
            marginBottom: "12px",
            padding: "10px 12px",
            borderRadius: DS.radius.md,
            border: `1px solid ${DS.colors.blue}`,
            background: DS.colors.blueDim,
            fontSize: "12px",
            color: DS.colors.text,
          }}>
            You're in demo mode — results are instant but not saved.
            <span
              onClick={() => (window.location.href = "/login")}
              style={{ marginLeft: "8px", color: DS.colors.shock, cursor: "pointer", fontWeight: 700 }}
            >
              Create a free account to save your results →
            </span>
          </div>
        )}
        {(shouldPromptStartSubscription || shouldPromptFirstWin) && (
          <div style={{
            marginBottom: "12px",
            padding: "10px 12px",
            borderRadius: DS.radius.md,
            border: `1px solid ${DS.colors.vital}`,
            background: DS.colors.vitalDim,
            fontSize: "12px",
            color: DS.colors.text,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}>
            <span>
              {shouldPromptStartSubscription
                ? `You ran ${analysesForPrompts} analyses. Activate billing now to keep capturing underbilling across all providers.`
                : `First revenue signal detected: $${estimatedLiftForPrompts.toFixed(2)} estimated captured. Keep this running clinic-wide.`}
            </span>
            <Button small primary onClick={() => setShowBillingPanel(true)}>
              {shouldPromptStartSubscription ? "Activate Subscription" : "Open Billing Setup"}
            </Button>
          </div>
        )}
        <div style={{ marginBottom: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {!effectiveDemoMode && !pilotMode && (
            <Button small onClick={() => setShowBillingPanel((v) => !v)}>
              {showBillingPanel ? "Hide Billing Panel" : "Show Billing Panel"}
            </Button>
          )}
          <Button small onClick={() => setShowQueuePanel((v) => !v)}>
            {showQueuePanel ? "Hide Queue Mode" : "Show Queue Mode"}
          </Button>
          <Button
            small
            onClick={() => {
              if (isProvisionalWorkspace) {
                setCopied("Advanced review unlocks after clinic claim");
                setTimeout(() => setCopied(""), 1400);
                return;
              }
              setShowAdvancedReview((v) => !v);
            }}
            style={{ opacity: isProvisionalWorkspace ? 0.6 : 1 }}
          >
            {showAdvancedReview ? "Hide Advanced Review" : "Show Advanced Review"}
          </Button>
        </div>

        {!effectiveDemoMode && !pilotMode && showBillingPanel && (
        <Card style={{ marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Subscription</div>
              <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                Core Coding Guardrail: <strong style={{ color: DS.colors.text }}>${corePerProviderRate}/provider/mo</strong> (tiered)
                {billingProfile?.stripe_subscription_id && (
                  <span style={{ marginLeft: "8px", color: DS.colors.vital }}>
                    • {billingProfile.billing_status || "active"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "8px", alignItems: "end", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "12px", color: DS.colors.textDim, marginBottom: "4px" }}>Licensed providers</div>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={providerCount}
                    onChange={(e) => setProviderCount(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    disabled={billingLoading}
                    style={{
                      width: "96px", padding: "8px 10px", borderRadius: DS.radius.sm,
                      border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg, color: DS.colors.text,
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: "12px", color: DS.colors.textDim, marginBottom: "4px" }}>Active providers</div>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={activeProviders}
                    onChange={(e) => setActiveProviders(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    disabled={billingLoading}
                    style={{
                      width: "96px", padding: "8px 10px", borderRadius: DS.radius.sm,
                      border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg, color: DS.colors.text,
                    }}
                  />
                </div>
                <Button small onClick={() => !billingLoading && saveSeatUsage()}>Save Seats</Button>
              </div>
              <div style={{ marginTop: "8px", fontSize: "12px", color: DS.colors.textMuted }}>
                Core monthly: <strong style={{ color: DS.colors.text }}>${coreMonthlyEstimate}/mo</strong>
                <span> ({providerCount} provider{providerCount === 1 ? "" : "s"} at ${corePerProviderRate}, min ${CORE_PRICING.platformMinimumMonthly})</span>
              </div>
              <div style={{ marginTop: "6px", fontSize: "12px", color: DS.colors.textMuted }}>
                Optional add-ons:
              </div>
              <div style={{ marginTop: "6px", display: "grid", gap: "6px" }}>
                {OPTIONAL_ADDONS.map((addon) => (
                  <label key={addon.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: DS.colors.textMuted }}>
                    <input
                      type="checkbox"
                      checked={selectedAddons.includes(addon.id)}
                      onChange={() => toggleAddon(addon.id)}
                      disabled={billingLoading}
                    />
                    {addon.name}: +${addon.monthly}/provider/mo and ${addon.implementation} one-time
                  </label>
                ))}
              </div>
              <div style={{ marginTop: "8px", fontSize: "12px", color: DS.colors.textMuted }}>
                Total monthly estimate: <strong style={{ color: DS.colors.text }}>${monthlyEstimate}/mo</strong>
                {addonsMonthlyEstimate > 0 && <span> (includes ${addonsMonthlyEstimate}/mo add-ons)</span>}
              </div>
              <div style={{ marginTop: "4px", fontSize: "12px", color: DS.colors.textMuted }}>
                One-time estimate: <strong style={{ color: DS.colors.text }}>${upfrontEstimate}</strong>
                {upfrontEstimate > 0 && (
                  <span> ({includeImplementation ? `$${CORE_PRICING.implementationFee} core` : "core implementation not selected"}{addonsImplementationEstimate > 0 ? ` + $${addonsImplementationEstimate} add-ons` : ""})</span>
                )}
              </div>
              {overLimit && (
                <div style={{
                  marginTop: "8px", fontSize: "12px", color: DS.colors.warn,
                  background: DS.colors.warnDim, borderRadius: DS.radius.sm, padding: "6px 8px",
                }}>
                  Active providers exceed licensed seats. Soft warning only for now; upgrade recommended.
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "13px", color: DS.colors.textMuted }}>
                <input
                  type="checkbox"
                  checked={includeImplementation}
                  onChange={(e) => setIncludeImplementation(e.target.checked)}
                  disabled={billingLoading || !!billingProfile?.stripe_subscription_id}
                />
                Add core implementation fee (+${CORE_PRICING.implementationFee}) at checkout
              </label>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {isProvisionalWorkspace ? (
                <Button primary onClick={() => setShowClaimForm(true)}>
                  Claim Workspace to Enable Billing
                </Button>
              ) : billingProfile?.stripe_subscription_id ? (
                <Button primary onClick={() => !billingLoading && openBillingPortal()} style={{ opacity: billingLoading ? 0.7 : 1 }}>
                  {billingLoading ? "Opening..." : "Manage Billing"}
                </Button>
              ) : (
                <Button primary onClick={() => !billingLoading && startSubscriptionCheckout()} style={{ opacity: billingLoading ? 0.7 : 1 }}>
                  {billingLoading ? "Starting..." : "Start Core Subscription"}
                </Button>
              )}
            </div>
          </div>
          {purchasedAddons.length > 0 && (
            <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
              <div style={{ fontSize: "12px", color: DS.colors.textDim }}>Add-on activation status</div>
              {OPTIONAL_ADDONS.filter((addon) => purchasedAddons.includes(addon.id)).map((addon) => {
                const pending = addonSetupPending.includes(addon.id);
                return (
                  <div
                    key={addon.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12px",
                      padding: "8px 10px",
                      borderRadius: DS.radius.sm,
                      border: `1px solid ${pending ? DS.colors.warn : DS.colors.vital}`,
                      background: pending ? DS.colors.warnDim : DS.colors.vitalDim,
                    }}
                  >
                    <span style={{ color: DS.colors.text }}>
                      {addon.name}: {pending ? "Pending setup" : "Active"}
                    </span>
                    {pending && (
                      <Button small onClick={() => markAddonSetupComplete(addon.id)}>
                        Mark setup complete
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        )}

        {showQueuePanel && (
        <Card style={{ marginBottom: "14px" }}>
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>Queue Mode (Rapid Review)</div>
          <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "8px" }}>
            Paste multiple encounters separated by a line with `---`, then process them one by one.
          </div>
          <textarea
            value={queueInput}
            onChange={(e) => setQueueInput(e.target.value)}
            placeholder={"Encounter 1...\n---\nEncounter 2...\n---\nEncounter 3..."}
            style={{
              width: "100%",
              minHeight: "120px",
              resize: "vertical",
              padding: "10px",
              borderRadius: DS.radius.sm,
              border: `1px solid ${DS.colors.borderLight}`,
              background: DS.colors.bg,
              color: DS.colors.text,
              fontSize: "13px",
              marginBottom: "8px",
            }}
          />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <Button small onClick={loadQueue}>Load Queue</Button>
            <Button small onClick={clearQueue}>Clear Queue</Button>
            <Button small onClick={analyzeAllQueue} style={{ opacity: analyzingQueue || queuePendingCount === 0 ? 0.6 : 1 }}>
              {analyzingQueue ? "Analyzing Queue..." : "Analyze All Pending"}
            </Button>
            {analyzingQueue && (
              <Button small onClick={requestStopQueue} style={{ background: DS.colors.warn, border: "none", color: "#111" }}>
                {queueStopRequested ? "Stopping..." : "Stop Queue"}
              </Button>
            )}
            <span style={{ fontSize: "12px", color: DS.colors.textMuted }}>
              Pending: {queuePendingCount} · Done: {queueDoneCount}
            </span>
          </div>
          {queueItems.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "10px" }}>
              {queueItems.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setCurrentQueueId(item.id); setNote(item.text); }}
                  style={{
                    padding: "5px 8px",
                    borderRadius: DS.radius.sm,
                    border: `1px solid ${currentQueueId === item.id ? DS.colors.shock : DS.colors.border}`,
                    background: currentQueueId === item.id ? DS.colors.shockGlow : DS.colors.bg,
                    color: currentQueueId === item.id ? DS.colors.shock : DS.colors.textMuted,
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  #{idx + 1} {item.status === "done" ? "✓" : "•"}
                </button>
              ))}
            </div>
          )}
        </Card>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "14px" }}>
          <Card>
            <div style={{ fontSize: "12px", color: DS.colors.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
              Encounter Note
            </div>
            {currentQueueId && (
              <div style={{ marginBottom: "8px", fontSize: "12px", color: DS.colors.shock }}>
                Queue item active. Running analysis will auto-advance to the next pending encounter.
              </div>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Paste clinical note or transcript..."
              style={{
                width: "100%", minHeight: "280px", resize: "vertical",
                padding: "12px", borderRadius: DS.radius.sm, fontSize: "14px",
                color: DS.colors.text, background: DS.colors.bg, border: `1px solid ${DS.colors.borderLight}`,
                outline: "none",
              }}
            />
            <div style={{ marginTop: "8px", fontSize: "12px", color: DS.colors.textMuted }}>
              Shortcuts: <span style={{ fontFamily: DS.fonts.mono }}>Ctrl/Cmd + Enter</span> analyze · <span style={{ fontFamily: DS.fonts.mono }}>Ctrl/Cmd + Shift + Enter</span> finalize
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
              <Button
                small
                onClick={() => setNote("Patient with chronic knee pain. MRI reviewed today. Discussed conservative treatment versus surgical intervention with risk/benefit counseling. Follow-up in 4 weeks.")}
              >
                Load Ortho Example
              </Button>
              <Button
                small
                onClick={() => setNote("Follow-up for hypertension and diabetes. Reviewed recent labs and medication response. Adjusted treatment plan and documented return precautions with next visit in 3 months.")}
              >
                Load Primary Care Example
              </Button>
            </div>
            <div style={{ display: "flex", alignItems: "end", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Currently billed code</div>
                <select
                  value={billedCode}
                  onChange={(e) => setBilledCode(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg,
                    color: DS.colors.text, fontSize: "14px",
                  }}
                >
                  <option value="99024">99024</option>
                  <option value="99202">99202</option>
                  <option value="99203">99203</option>
                  <option value="99204">99204</option>
                  <option value="99213">99213</option>
                  <option value="99214">99214</option>
                  <option value="99215">99215</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Encounter Date</div>
                <input
                  type="date"
                  value={encounterDate}
                  onChange={(e) => setEncounterDate(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg,
                    color: DS.colors.text, fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Surgery Date (optional)</div>
                <input
                  type="date"
                  value={surgeryDate}
                  onChange={(e) => setSurgeryDate(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg,
                    color: DS.colors.text, fontSize: "14px",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Specialty</div>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg,
                    color: DS.colors.text, fontSize: "14px",
                  }}
                >
                  <option>General</option>
                  <option>Orthopedics</option>
                  <option>Family Medicine</option>
                  <option>Internal Medicine</option>
                  <option>Pain Management</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Patient Type</div>
                <select
                  value={patientType}
                  onChange={(e) => setPatientType(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg,
                    color: DS.colors.text, fontSize: "14px",
                  }}
                >
                  <option value="established">Established</option>
                  <option value="new">New</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>POS</div>
                <select
                  value={placeOfService}
                  onChange={(e) => setPlaceOfService(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg,
                    color: DS.colors.text, fontSize: "14px",
                  }}
                >
                  <option value="office">Office</option>
                  <option value="hospital">Hospital</option>
                  <option value="telehealth">Telehealth</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Coding Path</div>
                <select
                  value={codingPath}
                  onChange={(e) => setCodingPath(e.target.value)}
                  style={{
                    padding: "10px 12px", borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg,
                    color: DS.colors.text, fontSize: "14px",
                  }}
                >
                  <option value="mdm">MDM</option>
                  <option value="time">Time</option>
                </select>
              </div>
              {codingPath === "time" && (
                <div>
                  <div style={{ fontSize: "12px", color: DS.colors.textMuted, marginBottom: "4px" }}>Total Minutes</div>
                  <input
                    type="number"
                    min={0}
                    value={totalMinutes}
                    onChange={(e) => setTotalMinutes(e.target.value)}
                    style={{
                      width: "120px",
                      padding: "10px 12px", borderRadius: DS.radius.sm,
                      border: `1px solid ${DS.colors.borderLight}`, background: DS.colors.bg,
                      color: DS.colors.text, fontSize: "14px",
                    }}
                  />
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: DS.colors.textMuted, paddingBottom: "10px" }}>
                <input
                  type="checkbox"
                  checked={isTelehealth}
                  onChange={(e) => setIsTelehealth(e.target.checked)}
                />
                Telehealth encounter
              </label>
              {effectiveDemoMode && (
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: DS.colors.textMuted, paddingBottom: "10px" }}>
                  <input
                    type="checkbox"
                    checked={conservativeMode}
                    onChange={(e) => setConservativeMode(e.target.checked)}
                  />
                  Conservative demo mode (reduces high-level suggestions without strong evidence)
                </label>
              )}
              <Button primary onClick={() => !analyzing && runAnalysis()} style={{ opacity: analyzing ? 0.7 : 1 }}>
                {analyzing ? "Analyzing..." : "Analyze Encounter"}
              </Button>
              {copied && (
                <div style={{ fontSize: "12px", color: DS.colors.vital, marginLeft: "2px" }}>{copied}</div>
              )}
            </div>
            {error && (
              <div style={{
                marginTop: "10px", fontSize: "13px", color: DS.colors.danger,
                background: DS.colors.dangerDim, borderRadius: DS.radius.sm, padding: "8px 10px",
              }}>
                {error}
              </div>
            )}
          </Card>

          <Card>
            {!analysis ? (
              <div style={{ fontSize: "14px", color: DS.colors.textMuted }}>
                No analysis yet. Run encounter analysis to generate a suggested code, rationale, documentation gaps, and recovery estimate.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                <MetricCard label="Suggested Code" value={analysis.suggestedCode} color={DS.colors.shock} />
                <MetricCard label="Confidence" value={`${Math.round(analysis.confidence * 100)}%`} color={DS.colors.blue} />
                <MetricCard label="Estimated $ / Visit" value={`$${analysis.estimatedDeltaPerVisit}`} color={DS.colors.vital} />
                <MetricCard label="Estimated Monthly Recovery" value={`$${analysis.estimatedMonthlyRecovery.toLocaleString()}`} color={DS.colors.vital} />
                {analysis.suggestedCode === "99024" && (
                  <div style={{
                    padding: "8px 10px",
                    borderRadius: DS.radius.sm,
                    border: `1px solid ${DS.colors.warn}`,
                    background: DS.colors.warnDim,
                    color: DS.colors.warn,
                    fontSize: "12px",
                  }}>
                    Post-op global-period follow-up detected. 99024 is non-billable for visits within 90 days of surgery.
                    {analysis.surgeryDateDetected && (
                      <span style={{ display: "block", marginTop: "4px" }}>
                        Surgery date used: {analysis.surgeryDateDetected}
                        {analysis.postOpDays != null ? ` (${analysis.postOpDays} days from encounter date)` : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {analysis && (
          <div style={{ marginTop: "14px", display: "grid", gap: "14px" }}>
            <Card>
              <div style={{ fontWeight: 600, marginBottom: "10px" }}>Practice Metrics</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
                <MetricCard small label="Analyses Run" value={(apiAnalysesRun ?? history.length).toString()} color={DS.colors.blue} />
                <MetricCard small label="Undercoding Opportunities" value={(apiUndercoding ?? 0).toString()} color={DS.colors.warn} />
                <MetricCard small label="Accepted Suggestions" value={(apiAccepted ?? reviewedCases.length).toString()} color={DS.colors.vital} />
                <MetricCard small label="Overrides" value={(apiOverrides ?? 0).toString()} color={DS.colors.textMuted} />
              </div>
              <div style={{ marginTop: "10px", fontSize: "12px", color: DS.colors.textMuted }}>
                Estimated revenue captured: <span style={{ color: DS.colors.vital }}>${Number(apiRevenueCaptured ?? 0).toFixed(2)}</span>
                {dashboardMetricsLoading && <span style={{ marginLeft: "8px", color: DS.colors.textDim }}>Refreshing...</span>}
              </div>
              {apiTopGaps.length > 0 && (
                <div style={{ marginTop: "8px", fontSize: "12px", color: DS.colors.textMuted }}>
                  Top documentation gap: {apiTopGaps[0]?.gap} ({apiTopGaps[0]?.count})
                </div>
              )}
              <div style={{ marginTop: "8px", fontSize: "12px", color: DS.colors.textMuted }}>
                Local agreement (reviewed cases): <span style={{ color: agreementRate >= 80 ? DS.colors.vital : DS.colors.warn }}>{agreementRate}%</span>
              </div>
              <div style={{ marginTop: "10px", fontSize: "12px", color: qualityGate.canFinalize ? DS.colors.vital : DS.colors.warn }}>
                Finalize gate: {qualityGate.canFinalize ? "Clear" : `Blocked (${qualityGate.hardStops.length} hard-stop)`}
              </div>
              <div style={{ marginTop: "10px", fontSize: "12px", color: DS.colors.textMuted }}>
                Active model version: <span style={{ color: DS.colors.text, fontFamily: DS.fonts.mono }}>{activeModelVersion}</span>
              </div>
              {versionStats.length > 0 && (
                <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
                  {versionStats.map((row) => (
                    <div
                      key={row.version}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto auto",
                        gap: "10px",
                        alignItems: "center",
                        padding: "6px 8px",
                        borderRadius: DS.radius.sm,
                        border: `1px solid ${DS.colors.border}`,
                        background: DS.colors.bg,
                        fontSize: "12px",
                      }}
                    >
                      <span style={{ color: DS.colors.text, fontFamily: DS.fonts.mono }}>{row.version}</span>
                      <span style={{ color: DS.colors.textMuted }}>n={row.total}</span>
                      <span style={{ color: DS.colors.textMuted }}>reviewed={row.reviewed}</span>
                      <span style={{ color: row.agreement >= 80 ? DS.colors.vital : DS.colors.warn }}>{row.agreement}% agree</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {lowConfidence && (
              <Card style={{ borderColor: DS.colors.warn, background: `${DS.colors.warn}11` }}>
                <div style={{ fontWeight: 600, color: DS.colors.warn, marginBottom: "6px" }}>
                  Manual review required
                </div>
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>
                  Confidence is below 70%. Keep physician/billing review in the loop before any coding change.
                </div>
              </Card>
            )}

            <Card>
              <div style={{ fontWeight: 600, marginBottom: "8px" }}>Encounter Timeline</div>
              {timelineEvents.length === 0 ? (
                <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>No timeline events yet.</div>
              ) : (
                <div style={{ display: "grid", gap: "6px" }}>
                  {timelineEvents.map((ev, idx) => (
                    <div key={`${ev.text}-${idx}`} style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                      {ev.at ? `${ev.at} · ` : ""}{ev.text}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <Card>
              <div style={{ fontWeight: 600, marginBottom: "10px" }}>Billing Justification</div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px",
                marginBottom: "10px", fontSize: "12px",
              }}>
                <div style={{ padding: "8px", borderRadius: DS.radius.sm, background: DS.colors.bg, border: `1px solid ${DS.colors.border}` }}>
                  <div style={{ color: DS.colors.textDim }}>Billed</div>
                  <div style={{ fontWeight: 600 }}>{billedCode}</div>
                </div>
                <div style={{ padding: "8px", borderRadius: DS.radius.sm, background: DS.colors.bg, border: `1px solid ${DS.colors.border}` }}>
                  <div style={{ color: DS.colors.textDim }}>Suggested</div>
                  <div style={{ fontWeight: 600, color: DS.colors.shock }}>{analysis.suggestedCode}</div>
                </div>
                <div style={{ padding: "8px", borderRadius: DS.radius.sm, background: DS.colors.bg, border: `1px solid ${DS.colors.border}` }}>
                  <div style={{ color: DS.colors.textDim }}>Delta / Visit</div>
                  <div style={{ fontWeight: 600, color: DS.colors.vital }}>${analysis.estimatedDeltaPerVisit}</div>
                </div>
              </div>
              <div style={{ display: "grid", gap: "8px" }}>
                <div style={{
                  padding: "8px",
                  borderRadius: DS.radius.sm,
                  border: `1px solid ${DS.colors.border}`,
                  background: DS.colors.bg,
                  display: "grid",
                  gap: "6px",
                }}>
                  <div style={{ fontSize: "12px", color: DS.colors.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Why This Code
                  </div>
                  {(analysis.evidenceFound || []).length > 0 && (
                    <div style={{ fontSize: "12px", color: DS.colors.vital }}>
                      Found: {(analysis.evidenceFound || []).join(" · ")}
                    </div>
                  )}
                  {(analysis.evidenceMissing || []).length > 0 && (
                    <div style={{ fontSize: "12px", color: DS.colors.warn }}>
                      Missing: {(analysis.evidenceMissing || []).join(" · ")}
                    </div>
                  )}
                  {(analysis.moveUpRequirements || []).length > 0 && (
                    <div style={{ fontSize: "12px", color: DS.colors.shock }}>
                      To move up: {(analysis.moveUpRequirements || []).join(" · ")}
                    </div>
                  )}
                  {(analysis.moveDownReasons || []).length > 0 && (
                    <div style={{ fontSize: "12px", color: DS.colors.warn }}>
                      Downcode guardrail: {(analysis.moveDownReasons || []).join(" · ")}
                    </div>
                  )}
                </div>
                {analysis.rationale.map((item, i) => (
                  <div key={i} style={{ fontSize: "14px", color: DS.colors.textMuted }}>
                    • {item}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "12px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <Button small onClick={() => copyText("Copied billing summary", billingSummary)}>
                    Copy Billing Summary
                  </Button>
                  <Button
                    small
                    onClick={() => {
                      if (isProvisionalWorkspace) {
                        setCopied("PDF export unlocks after clinic claim");
                        setTimeout(() => setCopied(""), 1400);
                        return;
                      }
                      exportJustificationPdf();
                    }}
                    style={{ opacity: isProvisionalWorkspace ? 0.6 : 1 }}
                  >
                    Download Justification PDF
                  </Button>
                  <Button
                    small
                    onClick={handleFinalizeEncounter}
                    style={{
                      background: qualityGate.canFinalize ? DS.colors.vital : DS.colors.warn,
                      border: "none",
                      opacity: qualityGate.canFinalize ? 1 : 0.8,
                    }}
                  >
                    Finalize + Copy Packet
                  </Button>
                </div>
                {qualityGate.hardStops.length > 0 && (
                  <div style={{
                    marginTop: "8px",
                    padding: "8px 10px",
                    borderRadius: DS.radius.sm,
                    background: DS.colors.warnDim,
                    color: DS.colors.warn,
                    fontSize: "12px",
                    display: "grid",
                    gap: "4px",
                  }}>
                    {qualityGate.hardStops.map((item, idx) => (
                      <div key={idx}>• {item}</div>
                    ))}
                  </div>
                )}
                {qualityGate.warnings.length > 0 && (
                  <div style={{
                    marginTop: "8px",
                    padding: "8px 10px",
                    borderRadius: DS.radius.sm,
                    background: DS.colors.blueDim,
                    color: DS.colors.textMuted,
                    fontSize: "12px",
                    display: "grid",
                    gap: "4px",
                  }}>
                    {qualityGate.warnings.map((item, idx) => (
                      <div key={idx}>• {item}</div>
                    ))}
                  </div>
                )}
                {analysis.id && history.find((h) => h.id === analysis.id)?.acceptedAt && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: DS.colors.vital }}>
                    Finalized at {new Date(history.find((h) => h.id === analysis.id).acceptedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </Card>
            <Card>
              <div style={{ fontWeight: 600, marginBottom: "10px" }}>Documentation Gaps</div>
              <div style={{ display: "grid", gap: "8px" }}>
                {analysis.gaps.length > 0 ? analysis.gaps.map((item, i) => (
                  <div key={i} style={{ fontSize: "14px", color: DS.colors.warn }}>
                    • {item}
                  </div>
                )) : (
                  <div style={{ fontSize: "14px", color: DS.colors.vital }}>No major gaps detected.</div>
                )}
              </div>
              <div style={{ marginTop: "12px", fontWeight: 600, fontSize: "13px" }}>Suggested Note Additions</div>
              <div style={{ marginTop: "6px", display: "grid", gap: "8px" }}>
                {analysis.suggestions.map((item, i) => (
                  <div key={i} style={{
                    fontSize: "13px", color: DS.colors.text,
                    background: DS.colors.bg, border: `1px solid ${DS.colors.border}`,
                    borderRadius: DS.radius.sm, padding: "8px 10px",
                  }}>
                    {item}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "12px" }}>
                <Button small onClick={() => copyText("Copied note additions", noteAdditions)}>
                  Copy Note Additions
                </Button>
              </div>
            </Card>
            </div>

            <Card>
              <div style={{ fontWeight: 600, marginBottom: "10px" }}>Recent Analyses (last 20)</div>
              {history.length === 0 ? (
                <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>No analyses yet.</div>
              ) : (
                <div style={{ display: "grid", gap: "8px" }}>
                  {history.map((h) => (
                    <div key={h.id} style={{
                      display: "grid",
                      gridTemplateColumns: "140px 1fr auto",
                      gap: "10px",
                      alignItems: "start",
                      padding: "8px 10px",
                      borderRadius: DS.radius.sm,
                      background: DS.colors.bg,
                      border: `1px solid ${DS.colors.border}`,
                    }}>
                      <div style={{ fontSize: "11px", color: DS.colors.textDim }}>{h.at}</div>
                      <div>
                        <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                          [{h.specialty}]{" "}
                          {h.billedCode} {"->"} {h.suggestedCode} ({Math.round(h.confidence * 100)}%)
                        </div>
                        <div style={{ marginTop: "4px", fontSize: "11px", color: DS.colors.textDim, fontFamily: DS.fonts.mono }}>
                          {h.modelVersion || "rules-v1.0"}
                        </div>
                        {showAdvancedReview ? (
                          <>
                            <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                              <select
                                value={reviewDrafts[h.id]?.reviewStatus ?? h.reviewStatus ?? "pending"}
                                onChange={(e) => setReviewField(h.id, "reviewStatus", e.target.value)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: DS.radius.sm,
                                  border: `1px solid ${DS.colors.borderLight}`,
                                  background: DS.colors.bgCard,
                                  color: DS.colors.text,
                                  fontSize: "12px",
                                }}
                              >
                                <option value="pending">Review pending</option>
                                <option value="agree">Agree with suggestion</option>
                                <option value="disagree">Disagree</option>
                              </select>
                              <select
                                value={reviewDrafts[h.id]?.reviewerCode ?? h.reviewerCode ?? ""}
                                onChange={(e) => setReviewField(h.id, "reviewerCode", e.target.value)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: DS.radius.sm,
                                  border: `1px solid ${DS.colors.borderLight}`,
                                  background: DS.colors.bgCard,
                                  color: DS.colors.text,
                                  fontSize: "12px",
                                }}
                              >
                                <option value="">Reviewer final code</option>
                                <option value="99202">99202</option>
                                <option value="99203">99203</option>
                                <option value="99204">99204</option>
                                <option value="99213">99213</option>
                                <option value="99214">99214</option>
                                <option value="99215">99215</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => saveReview({ ...h, reviewStatus: "agree", reviewerCode: h.suggestedCode })}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: DS.radius.sm,
                                  border: `1px solid ${DS.colors.vital}`,
                                  background: DS.colors.vitalDim,
                                  color: DS.colors.vital,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Quick Agree
                              </button>
                              <button
                                type="button"
                                onClick={() => saveReview({ ...h, reviewStatus: "disagree", reviewerCode: h.billedCode || "" })}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: DS.radius.sm,
                                  border: `1px solid ${DS.colors.warn}`,
                                  background: DS.colors.warnDim,
                                  color: DS.colors.warn,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Quick Disagree
                              </button>
                              <button
                                type="button"
                                onClick={() => saveReview(h)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: DS.radius.sm,
                                  border: `1px solid ${DS.colors.borderLight}`,
                                  background: DS.colors.bgCard,
                                  color: DS.colors.text,
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                Save review
                              </button>
                              {h.encounterId && (
                                <button
                                  type="button"
                                  onClick={() => loadEncounterDetail(h.encounterId)}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: DS.radius.sm,
                                    border: `1px solid ${DS.colors.blue}`,
                                    background: DS.colors.blueDim,
                                    color: DS.colors.blue,
                                    cursor: "pointer",
                                    fontSize: "12px",
                                  }}
                                >
                                  View Encounter Detail
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              value={reviewDrafts[h.id]?.reviewerNotes ?? h.reviewerNotes ?? ""}
                              onChange={(e) => setReviewField(h.id, "reviewerNotes", e.target.value)}
                              placeholder="Reviewer notes (optional)"
                              style={{
                                width: "100%",
                                marginTop: "8px",
                                padding: "6px 8px",
                                borderRadius: DS.radius.sm,
                                border: `1px solid ${DS.colors.borderLight}`,
                                background: DS.colors.bgCard,
                                color: DS.colors.text,
                                fontSize: "12px",
                              }}
                            />
                          </>
                        ) : (
                          <div style={{ marginTop: "8px", fontSize: "12px", color: DS.colors.textDim }}>
                            Quick mode active. Enable Advanced Review for reviewer controls and encounter detail.
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "12px", color: DS.colors.vital, fontWeight: 500 }}>
                        +${h.estimatedDeltaPerVisit}/visit
                        {h.acceptedAt && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: DS.colors.vital }}>
                            Finalized: {h.acceptedCode || h.suggestedCode}
                          </div>
                        )}
                        <div style={{
                          marginTop: "6px",
                          fontSize: "11px",
                          color: h.reviewStatus === "agree" ? DS.colors.vital : h.reviewStatus === "disagree" ? DS.colors.warn : DS.colors.textDim,
                        }}>
                          {h.reviewStatus === "agree" ? "Reviewed: agree" : h.reviewStatus === "disagree" ? "Reviewed: disagree" : "Not reviewed"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {(encounterDetailLoading || encounterDetail) && (
              <Card>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div style={{ fontWeight: 600 }}>Encounter Detail</div>
                  {encounterDetail && (
                    <button
                      type="button"
                      onClick={() => setEncounterDetail(null)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: DS.radius.sm,
                        border: `1px solid ${DS.colors.borderLight}`,
                        background: "transparent",
                        color: DS.colors.textMuted,
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Close
                    </button>
                  )}
                </div>

                {encounterDetailLoading && (
                  <div style={{ fontSize: "13px", color: DS.colors.textMuted }}>Loading encounter detail...</div>
                )}

                {!encounterDetailLoading && encounterDetail && (
                  <div style={{ display: "grid", gap: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px" }}>
                      <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                        Encounter ID
                        <div style={{ color: DS.colors.text, fontFamily: DS.fonts.mono, marginTop: "2px" }}>{encounterDetail.encounter?.id || "-"}</div>
                      </div>
                      <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                        Date
                        <div style={{ color: DS.colors.text, marginTop: "2px" }}>{encounterDetail.encounter?.encounter_date || "-"}</div>
                      </div>
                      <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                        Status
                        <div style={{ color: DS.colors.text, marginTop: "2px" }}>{encounterDetail.encounter?.status || "-"}</div>
                      </div>
                      <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                        POS
                        <div style={{ color: DS.colors.text, marginTop: "2px" }}>{encounterDetail.encounter?.pos || "-"}</div>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>Latest Revenue Impact</div>
                      {encounterDetail.latest_revenue_impact ? (
                        <div style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                          {encounterDetail.latest_revenue_impact.current_code || "-"} → {encounterDetail.latest_revenue_impact.suggested_code || "-"} ·
                          Delta ${Number(encounterDetail.latest_revenue_impact.delta_amount || 0).toFixed(2)} ·
                          Source {encounterDetail.latest_revenue_impact.rate_source || "unknown"}
                        </div>
                      ) : (
                        <div style={{ fontSize: "12px", color: DS.colors.textDim }}>No revenue impact record yet.</div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>Recommendation History</div>
                      {(encounterDetail.recommendation_history || []).length === 0 ? (
                        <div style={{ fontSize: "12px", color: DS.colors.textDim }}>No recommendations recorded.</div>
                      ) : (
                        <div style={{ display: "grid", gap: "6px" }}>
                          {(encounterDetail.recommendation_history || []).slice(0, 5).map((rec) => (
                            <div key={rec.id} style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                              [{rec.rule_version}] {rec.suggested_code} · status: {rec.status} · selected: {rec.current_user_selected_code || "-"}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>Audit Trail</div>
                      {(encounterDetail.audit_events || []).length === 0 ? (
                        <div style={{ fontSize: "12px", color: DS.colors.textDim }}>No audit events yet.</div>
                      ) : (
                        <div style={{ display: "grid", gap: "6px" }}>
                          {(encounterDetail.audit_events || []).slice(0, 8).map((ev, idx) => (
                            <div key={`${ev.created_at}-${idx}`} style={{ fontSize: "12px", color: DS.colors.textMuted }}>
                              {new Date(ev.created_at).toLocaleString()} · {ev.event_type}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
