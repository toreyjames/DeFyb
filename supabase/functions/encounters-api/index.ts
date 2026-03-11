import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RULE_VERSION = "rules-v1.0-em-core";

type SignalBundle = {
  problems_addressed_count: number;
  chronic_condition_worsening: boolean;
  acute_problem_present: boolean;
  medication_management: boolean;
  prescription_drug_management: boolean;
  labs_reviewed: number;
  imaging_reviewed: number;
  external_note_reviewed: boolean;
  independent_historian: boolean;
  discussion_with_external_physician: boolean;
  minutes_documented: number;
  time_path_available: boolean;
  postop_detected: boolean;
  procedure_code_context: string | null;
  within_global_period: boolean;
  risk_level: "low" | "moderate" | "high";
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isTeamRole = (claims: Record<string, unknown> | null | undefined) => {
  const role = (claims?.app_metadata as Record<string, unknown> | undefined)?.role;
  return role === "team" || role === "admin" || role === "owner";
};

const normalizeNote = (raw: string) => raw.replace(/\s+/g, " ").trim();

const parseSurgeryDate = (note: string): Date | null => {
  const marker = /(surgery date|date of surgery|dos|d\/o\/s|sx date|status post|s\/p|post[-\s]?op)/i;
  if (!marker.test(note)) return null;

  const match = /(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})/.exec(note);
  if (!match?.[1]) return null;
  const parsed = new Date(match[1]);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const extractSignals = (rawNote: string, encounterDate?: string | null): SignalBundle => {
  const normalized = normalizeNote(rawNote).toLowerCase();

  const labsReviewed = (normalized.match(/\blab(s)?\b|\bcbc\b|\bmp\b|\bcmp\b|\ba1c\b/g) || []).length;
  const imagingReviewed = (normalized.match(/\bmri\b|\bx-?ray\b|\bct\b|\bultrasound\b/g) || []).length;
  const problemMentions = (normalized.match(/\b(assessment|diagnosis|problem|condition)\b/g) || []).length;
  const minutesMatch = normalized.match(/(\d{1,3})\s*(min|minute)/);
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;

  const postopDetected = /(post[-\s]?op|status post|s\/p|global period)/.test(normalized);
  const surgeryDate = parseSurgeryDate(rawNote);
  const encounter = encounterDate ? new Date(encounterDate) : new Date();
  const withinGlobalPeriod = (() => {
    if (!postopDetected || !surgeryDate || Number.isNaN(encounter.getTime())) return false;
    const diffDays = Math.floor((encounter.getTime() - surgeryDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 90;
  })();

  const prescriptionDrugManagement = /(medication management|adjusted medication|dose (increase|decrease)|prescription)/.test(normalized);
  const highRisk = /(hospitalization|opioid|high risk|severe exacerbation)/.test(normalized);
  const moderateRisk = /(chronic|worsening|exacerbation|persistent)/.test(normalized) || prescriptionDrugManagement;

  return {
    problems_addressed_count: Math.max(1, Math.min(4, problemMentions)),
    chronic_condition_worsening: /(worsening|not at goal|poorly controlled|exacerbation)/.test(normalized),
    acute_problem_present: /(acute|new problem|injury|infection)/.test(normalized),
    medication_management: prescriptionDrugManagement,
    prescription_drug_management: prescriptionDrugManagement,
    labs_reviewed: labsReviewed,
    imaging_reviewed: imagingReviewed,
    external_note_reviewed: /(reviewed records|external note|outside records)/.test(normalized),
    independent_historian: /independent historian/.test(normalized),
    discussion_with_external_physician: /(discussed with|spoke with|coordinated with)/.test(normalized),
    minutes_documented: minutes,
    time_path_available: minutes > 0,
    postop_detected: postopDetected,
    procedure_code_context: null,
    within_global_period: withinGlobalPeriod,
    risk_level: highRisk ? "high" : moderateRisk ? "moderate" : "low",
  };
};

const recommendCode = (
  signals: SignalBundle,
  patientType: string | null,
): {
  suggested_code: string;
  confidence: "low" | "medium" | "high";
  rationale: string[];
  documentation_gap_text: string | null;
} => {
  const rationale: string[] = [];

  if (signals.postop_detected && signals.within_global_period) {
    rationale.push("Encounter occurs within post-op global period.");
    return {
      suggested_code: "99024",
      confidence: "high",
      rationale,
      documentation_gap_text: "Ensure surgery date and post-op context are explicitly documented.",
    };
  }

  if (signals.prescription_drug_management) rationale.push("Prescription drug management documented.");
  if (signals.problems_addressed_count >= 2) rationale.push("Two or more problems addressed.");
  if ((signals.labs_reviewed + signals.imaging_reviewed + (signals.external_note_reviewed ? 1 : 0)) >= 2) {
    rationale.push("Multiple data elements reviewed.");
  }
  if (signals.chronic_condition_worsening) rationale.push("Chronic condition worsening/not at goal.");

  let suggested = "99213";
  if (
    (signals.risk_level === "moderate" || signals.prescription_drug_management) &&
    (signals.problems_addressed_count >= 2 || signals.chronic_condition_worsening) &&
    (signals.labs_reviewed + signals.imaging_reviewed + (signals.external_note_reviewed ? 1 : 0)) >= 2
  ) {
    suggested = "99214";
  }
  if (
    signals.risk_level === "high" &&
    signals.problems_addressed_count >= 2 &&
    (signals.labs_reviewed + signals.imaging_reviewed + (signals.external_note_reviewed ? 1 : 0)) >= 2
  ) {
    suggested = "99215";
  }

  if (patientType === "new" && suggested === "99213") {
    rationale.push("New patient context detected; recommendation remains conservative pending expanded rules.");
  }

  const gaps: string[] = [];
  if (!signals.prescription_drug_management && suggested !== "99213") {
    gaps.push("Clarify medication decision complexity.");
  }
  if ((signals.labs_reviewed + signals.imaging_reviewed) === 0 && suggested !== "99213") {
    gaps.push("Document relevant data/lab/imaging review supporting complexity.");
  }
  if (!signals.chronic_condition_worsening && suggested === "99214") {
    gaps.push("Clarify chronic condition status (worsening vs stable).");
  }

  return {
    suggested_code: suggested,
    confidence: suggested === "99215" ? "medium" : "high",
    rationale,
    documentation_gap_text: gaps.length > 0 ? gaps.join(" ") : null,
  };
};

const fallbackRate = (code: string): number => {
  const map: Record<string, number> = {
    "99213": 95,
    "99214": 142,
    "99215": 206,
    "99024": 0,
  };
  return map[code] ?? 0;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Missing authorization" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const client = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user) return json(401, { error: "Unauthorized" });

    const pathname = new URL(req.url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const fnIndex = segments.indexOf("encounters-api");
    const route = fnIndex >= 0 ? segments.slice(fnIndex + 1) : [];

    const { data: appUser } = await client
      .from("app_users")
      .select("id, practice_id, role")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const teamRole = isTeamRole(user as unknown as Record<string, unknown>);

    const emitAudit = async (
      practiceId: string,
      eventType: string,
      encounterId: string | null,
      payload: Record<string, unknown>,
    ) => {
      await client.from("audit_events").insert({
        practice_id: practiceId,
        encounter_id: encounterId,
        actor_user_id: appUser?.id || null,
        event_type: eventType,
        payload_json: payload,
      });
    };

    // POST /encounters
    if (req.method === "POST" && route.length === 1 && route[0] === "encounters") {
      const body = await req.json();
      const practiceId = body.practice_id || appUser?.practice_id;
      if (!practiceId) return json(400, { error: "practice_id is required" });
      if (!teamRole && !appUser) return json(403, { error: "No practice membership found" });

      const payload = {
        practice_id: practiceId,
        provider_id: body.provider_id || null,
        patient_ref: body.patient_ref || null,
        encounter_date: body.encounter_date,
        visit_type: body.visit_type || null,
        patient_type: body.patient_type || null,
        pos: body.pos || null,
        telehealth: Boolean(body.telehealth),
        minutes: body.minutes ?? null,
        status: "draft",
      };

      const { data, error } = await client.from("encounters").insert(payload).select("id, status").single();
      if (error) return json(400, { error: error.message });

      await emitAudit(practiceId, "encounter_created", data.id, { encounter: payload });
      return json(200, { encounter_id: data.id, status: data.status });
    }

    // POST /encounters/{id}/note
    if (req.method === "POST" && route.length === 3 && route[0] === "encounters" && route[2] === "note") {
      const encounterId = route[1];
      const body = await req.json();
      const rawNote = String(body.raw_note || "").trim();
      if (!rawNote) return json(400, { error: "raw_note is required" });

      const { data: encounter, error: encounterError } = await client
        .from("encounters")
        .select("id, practice_id")
        .eq("id", encounterId)
        .single();
      if (encounterError || !encounter) return json(404, { error: "Encounter not found" });

      const { error: noteError } = await client.from("encounter_notes").insert({
        encounter_id: encounterId,
        raw_note: rawNote,
        normalized_note: normalizeNote(rawNote),
        source: body.source || "manual",
      });
      if (noteError) return json(400, { error: noteError.message });

      await emitAudit(encounter.practice_id, "note_uploaded", encounterId, {
        source: body.source || "manual",
        note_length: rawNote.length,
      });
      return json(200, { status: "ok" });
    }

    // POST /encounters/{id}/analyze
    if (req.method === "POST" && route.length === 3 && route[0] === "encounters" && route[2] === "analyze") {
      const encounterId = route[1];
      const body = await req.json().catch(() => ({}));

      const { data: encounter, error: encounterError } = await client
        .from("encounters")
        .select("id, practice_id, encounter_date, patient_type")
        .eq("id", encounterId)
        .single();
      if (encounterError || !encounter) return json(404, { error: "Encounter not found" });

      const { data: noteRow } = await client
        .from("encounter_notes")
        .select("raw_note")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!noteRow?.raw_note) return json(400, { error: "No encounter note found" });

      const signals = extractSignals(noteRow.raw_note, encounter.encounter_date);
      const recommendation = recommendCode(signals, encounter.patient_type);

      const { error: signalsError } = await client.from("extracted_signals").insert({
        encounter_id: encounterId,
        rule_version: RULE_VERSION,
        signals_json: signals,
        confidence: recommendation.confidence === "high" ? 0.9 : recommendation.confidence === "medium" ? 0.75 : 0.6,
      });
      if (signalsError) return json(400, { error: signalsError.message });

      const { data: rec, error: recError } = await client
        .from("code_recommendations")
        .insert({
          encounter_id: encounterId,
          rule_version: RULE_VERSION,
          suggested_code: recommendation.suggested_code,
          confidence: recommendation.confidence,
          rationale_json: recommendation.rationale,
          documentation_gap_text: recommendation.documentation_gap_text,
        })
        .select("id")
        .single();
      if (recError) return json(400, { error: recError.message });

      const payerName = body.payer_name || "FALLBACK";
      const currentCode = body.current_code || "99213";
      const suggestedCode = recommendation.suggested_code;
      const state = body.state || null;

      const rateQuery = async (code: string) => {
        const { data: specific } = await client
          .from("payer_rates")
          .select("allowed_amount, payer_name")
          .eq("payer_name", payerName)
          .eq("cpt_code", code)
          .order("effective_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (specific?.allowed_amount != null) return { amount: Number(specific.allowed_amount), source: "payer_specific" };

        const { data: fallback } = await client
          .from("payer_rates")
          .select("allowed_amount")
          .eq("payer_name", "FALLBACK")
          .eq("cpt_code", code)
          .order("effective_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fallback?.allowed_amount != null) return { amount: Number(fallback.allowed_amount), source: "fallback_table" };

        return { amount: fallbackRate(code), source: "static_fallback" };
      };

      const currentRate = await rateQuery(currentCode);
      const suggestedRate = await rateQuery(suggestedCode);
      const delta = suggestedRate.amount - currentRate.amount;

      const { error: revError } = await client.from("revenue_impacts").insert({
        encounter_id: encounterId,
        payer_name: payerName,
        current_code: currentCode,
        suggested_code: suggestedCode,
        current_amount: currentRate.amount,
        suggested_amount: suggestedRate.amount,
        delta_amount: delta,
        rate_source: currentRate.source === "payer_specific" || suggestedRate.source === "payer_specific"
          ? "payer_specific"
          : "fallback",
      });
      if (revError) return json(400, { error: revError.message });

      await emitAudit(encounter.practice_id, "encounter_analyzed", encounterId, {
        rule_version: RULE_VERSION,
        recommendation_id: rec.id,
        payer_name: payerName,
        state,
      });

      return json(200, {
        encounter_id: encounterId,
        rule_version: RULE_VERSION,
        signals,
        recommendation: {
          suggested_code: recommendation.suggested_code,
          confidence: recommendation.confidence,
          rationale: recommendation.rationale,
          documentation_gap_text: recommendation.documentation_gap_text,
        },
        revenue_impact: {
          current_code: currentCode,
          suggested_code: suggestedCode,
          current_amount: currentRate.amount,
          suggested_amount: suggestedRate.amount,
          delta_amount: delta,
          rate_source: currentRate.source === "payer_specific" || suggestedRate.source === "payer_specific"
            ? "payer_specific"
            : "fallback",
        },
      });
    }

    // POST /encounters/{id}/select-code
    if (req.method === "POST" && route.length === 3 && route[0] === "encounters" && route[2] === "select-code") {
      const encounterId = route[1];
      const body = await req.json();
      const selectedCode = String(body.selected_code || "").trim();
      const selectionReason = String(body.selection_reason || "").trim();
      if (!selectedCode) return json(400, { error: "selected_code is required" });

      const { data: encounter, error: encounterError } = await client
        .from("encounters")
        .select("id, practice_id")
        .eq("id", encounterId)
        .single();
      if (encounterError || !encounter) return json(404, { error: "Encounter not found" });

      const { data: latestRec, error: recError } = await client
        .from("code_recommendations")
        .select("id, current_user_selected_code")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (recError || !latestRec) return json(404, { error: "No recommendation found for encounter" });

      const { error: updateError } = await client
        .from("code_recommendations")
        .update({
          current_user_selected_code: selectedCode,
          status: "selected",
        })
        .eq("id", latestRec.id);
      if (updateError) return json(400, { error: updateError.message });

      await emitAudit(encounter.practice_id, "recommendation_selected", encounterId, {
        old_selected_code: latestRec.current_user_selected_code,
        new_selected_code: selectedCode,
        reason: selectionReason || "manual_selection",
        rule_version: RULE_VERSION,
      });

      return json(200, { status: "ok", selected_code: selectedCode });
    }

    // GET /encounters/{id}
    if (req.method === "GET" && route.length === 2 && route[0] === "encounters") {
      const encounterId = route[1];
      const { data: encounter, error: encounterError } = await client
        .from("encounters")
        .select("*")
        .eq("id", encounterId)
        .single();
      if (encounterError || !encounter) return json(404, { error: "Encounter not found" });

      const { data: notes } = await client
        .from("encounter_notes")
        .select("id, source, created_at")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false });

      const { data: recs } = await client
        .from("code_recommendations")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false });

      const { data: rev } = await client
        .from("revenue_impacts")
        .select("*")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: audits } = await client
        .from("audit_events")
        .select("event_type, payload_json, created_at")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: false });

      return json(200, {
        encounter,
        notes: notes || [],
        recommendation_history: recs || [],
        latest_revenue_impact: rev || null,
        audit_events: audits || [],
      });
    }

    // GET /dashboard/metrics?practice_id=uuid
    if (req.method === "GET" && route.length === 2 && route[0] === "dashboard" && route[1] === "metrics") {
      const practiceIdParam = new URL(req.url).searchParams.get("practice_id");
      const practiceId = practiceIdParam || appUser?.practice_id;
      if (!practiceId) return json(400, { error: "practice_id is required" });

      const { data: encounterRows } = await client
        .from("encounters")
        .select("id")
        .eq("practice_id", practiceId);
      const encounterIds = (encounterRows || []).map((e) => e.id);
      if (encounterIds.length === 0) {
        return json(200, {
          undercoding_opportunities_detected: 0,
          estimated_revenue_captured: 0,
          accepted_suggestions: 0,
          overridden_suggestions: 0,
          code_distribution: {},
          top_documentation_gaps: [],
        });
      }

      const { data: recs } = await client
        .from("code_recommendations")
        .select("suggested_code, current_user_selected_code, documentation_gap_text")
        .in("encounter_id", encounterIds);

      const { data: impacts } = await client
        .from("revenue_impacts")
        .select("delta_amount")
        .in("encounter_id", encounterIds);

      const codeDistribution: Record<string, number> = {};
      let accepted = 0;
      let overridden = 0;
      let opportunities = 0;
      const gapCounts: Record<string, number> = {};

      (recs || []).forEach((r) => {
        codeDistribution[r.suggested_code] = (codeDistribution[r.suggested_code] || 0) + 1;
        if (r.current_user_selected_code) {
          if (r.current_user_selected_code === r.suggested_code) accepted += 1;
          else overridden += 1;
        }
        if (r.suggested_code === "99214" || r.suggested_code === "99215") opportunities += 1;
        if (r.documentation_gap_text) {
          const key = r.documentation_gap_text.slice(0, 120);
          gapCounts[key] = (gapCounts[key] || 0) + 1;
        }
      });

      const captured = (impacts || []).reduce((sum, i) => sum + Number(i.delta_amount || 0), 0);
      const topGaps = Object.entries(gapCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([gap, count]) => ({ gap, count }));

      return json(200, {
        undercoding_opportunities_detected: opportunities,
        estimated_revenue_captured: Number(captured.toFixed(2)),
        accepted_suggestions: accepted,
        overridden_suggestions: overridden,
        code_distribution: codeDistribution,
        top_documentation_gaps: topGaps,
      });
    }

    return json(404, { error: "Route not found" });
  } catch (error) {
    return json(400, { error: (error as Error).message });
  }
});

