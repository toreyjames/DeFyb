import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AnalyzeRequest = {
  note: string;
  billedCode?: string;
  specialty?: string;
  context?: {
    patientType?: "new" | "established";
    placeOfService?: "office" | "hospital" | "telehealth";
    codingPath?: "mdm" | "time";
    totalMinutes?: number;
    telehealth?: boolean;
    encounterDate?: string;
  };
};

const MODEL_VERSION = "rules-v1.3-context";

const toDateOrNull = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const parseSurgeryDateFromNote = (noteText: string): Date | null => {
  const note = noteText || "";
  const lower = note.toLowerCase();
  const markerRegex = /(surgery date|date of surgery|dos|status post|s\/p|post[-\s]?op)/i;
  if (!markerRegex.test(lower)) return null;

  // Prefer dates near explicit surgery markers.
  const nearby = /(?:surgery date|date of surgery|dos|status post|s\/p|post[-\s]?op)[^\n\r]{0,40}?(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/gi;
  const nearbyMatch = nearby.exec(note);
  if (nearbyMatch?.[1]) {
    const parsed = toDateOrNull(nearbyMatch[1]);
    if (parsed) return parsed;
  }

  // Fallback: use first recognizable date if the note is clearly post-op.
  const fallback = /(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i.exec(note);
  if (!fallback?.[1]) return null;
  return toDateOrNull(fallback[1]);
};

const analyzeEncounterNote = (
  noteText: string,
  billedCode = "99213",
  context: AnalyzeRequest["context"] = {},
) => {
  const normalized = (noteText || "").toLowerCase();
  const encounterDate = toDateOrNull(context?.encounterDate) || toDateOrNull(new Date().toISOString().slice(0, 10))!;
  const surgeryDate = parseSurgeryDateFromNote(noteText || "");
  const isPostOpLanguage = /(post[-\s]?op|status post|s\/p|global period)/.test(normalized);
  const hasDataReview = /(mri|x-?ray|ct|imaging|lab|reviewed records|independent historian)/.test(normalized);
  const hasProblemComplexity = /(chronic|worsening|exacerbation|persistent pain|multiple conditions)/.test(normalized);
  const hasManagementRisk = /(surgery|procedure|injection|prescription|medication management|opioid|high risk)/.test(normalized);
  const hasRiskDiscussion = /(risk|benefit|shared decision|alternatives|informed consent)/.test(normalized);
  const hasFollowUpPlan = /(follow-up|return in|plan|next steps|monitor)/.test(normalized);

  const rationale: string[] = [];
  if (hasDataReview) rationale.push("Reviewed external/internal diagnostic data (imaging/labs/history).");
  if (hasProblemComplexity) rationale.push("Problem complexity indicates moderate decision burden.");
  if (hasManagementRisk) rationale.push("Management options include higher-risk treatment decisions.");
  if (hasRiskDiscussion) rationale.push("Risk/benefit discussion is documented for management choices.");
  if (hasFollowUpPlan) rationale.push("Assessment includes a clear ongoing treatment/follow-up plan.");
  if (context?.placeOfService === "telehealth" || context?.telehealth) {
    rationale.push("Encounter context indicates telehealth setting was considered.");
  }

  let suggestedCode = "99213";

  // Global-period post-op protection:
  // If note is post-op and surgery date is within 90 days, visit should be 99024 (non-billable global follow-up).
  if (surgeryDate && isPostOpLanguage) {
    const diffDays = Math.floor((encounterDate.getTime() - surgeryDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 90) {
      suggestedCode = "99024";
      rationale.unshift(`Post-op global period detected (${diffDays} days since surgery date ${surgeryDate.toISOString().slice(0, 10)}).`);
    }
  }

  if (suggestedCode !== "99024") {
  if (rationale.length >= 3) suggestedCode = "99214";
  if (rationale.length >= 5 || (hasManagementRisk && hasDataReview && hasRiskDiscussion)) suggestedCode = "99215";
  }

  // Optional time-based path for established patient E/M (MVP scope 99213-99215).
  if (context?.codingPath === "time") {
    const minutes = Number(context?.totalMinutes || 0);
    if (minutes >= 40) suggestedCode = "99215";
    else if (minutes >= 30) suggestedCode = "99214";
    else if (minutes >= 20) suggestedCode = "99213";
    if (minutes > 0) {
      rationale.push(`Time-based coding path selected with ${minutes} documented minutes.`);
    }
  }

  const codeRank: Record<string, number> = { "99213": 1, "99214": 2, "99215": 3 };
  const perVisitDelta: Record<string, number> = {
    "99213->99214": 58,
    "99213->99215": 132,
    "99214->99215": 74,
  };

  const gaps: string[] = [];
  const suggestions: string[] = [];
  if (suggestedCode !== "99024" && !hasDataReview) {
    gaps.push("Data review not clearly documented.");
    suggestions.push("Reviewed relevant prior records and diagnostic data to inform clinical decision making.");
  }
  if (suggestedCode !== "99024" && !hasRiskDiscussion) {
    gaps.push("Risk/benefit discussion missing for selected management path.");
    suggestions.push("Discussed risks and benefits of procedural and conservative treatment options with shared decision making.");
  }
  if (suggestedCode !== "99024" && !hasFollowUpPlan) {
    gaps.push("Follow-up plan or monitoring details are limited.");
    suggestions.push("Documented follow-up timeline, return precautions, and criteria for escalation.");
  }
  if (context?.codingPath === "time" && (!context?.totalMinutes || Number(context.totalMinutes) < 20)) {
    gaps.push("Time-based path selected but total time is missing or below typical threshold.");
    suggestions.push("Document total clinician time spent on date of encounter if selecting time-based coding.");
  }

  const deltaKey = `${billedCode}->${suggestedCode}`;
  const estimatedDeltaPerVisit =
    suggestedCode === "99024"
      ? 0
      : (codeRank[suggestedCode] > codeRank[billedCode] ? (perVisitDelta[deltaKey] || 0) : 0);

  return {
    suggestedCode,
    rationale,
    confidence: Math.min(0.97, 0.5 + rationale.length * 0.09 + (context?.codingPath === "time" && context?.totalMinutes ? 0.07 : 0)),
    gaps,
    suggestions,
    estimatedDeltaPerVisit,
    estimatedMonthlyRecovery: estimatedDeltaPerVisit * 80,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const payload = (await req.json()) as AnalyzeRequest;
    const note = payload?.note?.trim() || "";
    const billedCode = payload?.billedCode || "99213";
    const specialty = payload?.specialty || "General";
    const context = payload?.context || {};

    if (!note) {
      return new Response(JSON.stringify({ error: "Encounter note is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (note.length > 15000) {
      return new Response(JSON.stringify({ error: "Encounter note is too long" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const result = analyzeEncounterNote(note, billedCode, context);

    const { data: inserted, error: insertError } = await userClient
      .from("encounter_analyses")
      .insert({
        user_id: user.id,
        specialty,
        // Do not persist raw note content/snippets; keep only billing intelligence outputs.
        note_text: null,
        note_snippet: null,
        billed_code: billedCode,
        suggested_code: result.suggestedCode,
        encounter_context: context,
        model_version: MODEL_VERSION,
        confidence: result.confidence,
        rationale: result.rationale,
        gaps: result.gaps,
        suggestions: result.suggestions,
        estimated_delta_per_visit: result.estimatedDeltaPerVisit,
        estimated_monthly_recovery: result.estimatedMonthlyRecovery,
      })
      .select(
        "id, specialty, billed_code, suggested_code, model_version, encounter_context, confidence, rationale, gaps, suggestions, estimated_delta_per_visit, estimated_monthly_recovery, note_snippet, created_at",
      )
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(JSON.stringify({ analysis: inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
