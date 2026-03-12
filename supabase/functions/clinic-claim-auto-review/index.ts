import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "trashmail.com",
]);

const FREE_INBOX_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

const emailDomain = (email = "") => {
  const parts = email.toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : "";
};

const localPart = (email = "") => {
  const parts = email.toLowerCase().split("@");
  return parts.length === 2 ? parts[0] : "";
};

const calculateRisk = (payload: {
  clinicName?: string | null;
  ownerEmail?: string | null;
  requesterEmail?: string | null;
  notes?: string | null;
}) => {
  const reasons: string[] = [];
  let score = 0;

  const clinicName = (payload.clinicName || "").trim();
  const ownerEmail = (payload.ownerEmail || "").trim().toLowerCase();
  const requesterEmail = (payload.requesterEmail || "").trim().toLowerCase();
  const notes = (payload.notes || "").trim().toLowerCase();

  if (!clinicName || clinicName.length < 3) {
    score += 30;
    reasons.push("Clinic name too short");
  }

  if (!ownerEmail.includes("@")) {
    score += 50;
    reasons.push("Invalid owner email");
  } else {
    const ownerDomain = emailDomain(ownerEmail);
    const ownerLocal = localPart(ownerEmail);
    if (DISPOSABLE_DOMAINS.has(ownerDomain)) {
      score += 50;
      reasons.push("Disposable owner email domain");
    } else if (FREE_INBOX_DOMAINS.has(ownerDomain)) {
      score += 15;
      reasons.push("Owner email on free inbox domain");
    }
    if ((ownerLocal.match(/\d/g) || []).length >= 5) {
      score += 10;
      reasons.push("Owner email local-part is digit-heavy");
    }
  }

  if (requesterEmail && requesterEmail.includes("@")) {
    const reqDomain = emailDomain(requesterEmail);
    if (DISPOSABLE_DOMAINS.has(reqDomain)) {
      score += 40;
      reasons.push("Requester uses disposable domain");
    }
  }

  if (notes.includes("http://") || notes.includes("https://")) {
    score += 20;
    reasons.push("Notes include URL");
  }
  if (/(crypto|telegram|whatsapp)/i.test(notes)) {
    score += 20;
    reasons.push("Notes include high-risk keywords");
  }

  return { score, reasons };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Function environment not configured");
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { claimRequestId } = await req.json();
    if (!claimRequestId) throw new Error("claimRequestId is required");

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: claim, error: claimError } = await adminClient
      .from("clinic_claim_requests")
      .select("id, requester_user_id, requester_email, clinic_name, owner_email, notes, status")
      .eq("id", claimRequestId)
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claim) throw new Error("Claim request not found");
    if (claim.requester_user_id !== authData.user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (claim.status !== "pending") {
      return new Response(JSON.stringify({ ok: true, status: claim.status, autoApproved: false, riskScore: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const risk = calculateRisk({
      clinicName: claim.clinic_name,
      ownerEmail: claim.owner_email,
      requesterEmail: claim.requester_email,
      notes: claim.notes,
    });

    const AUTO_APPROVE_THRESHOLD = 20;
    let autoApproved = false;
    if (risk.score <= AUTO_APPROVE_THRESHOLD) {
      const { error: updateError } = await adminClient
        .from("clinic_claim_requests")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: authData.user.id,
        })
        .eq("id", claim.id)
        .eq("status", "pending");
      if (updateError) throw updateError;
      autoApproved = true;
    }

    return new Response(JSON.stringify({
      ok: true,
      status: autoApproved ? "approved" : "pending",
      autoApproved,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      claim: {
        id: claim.id,
        clinic_name: claim.clinic_name,
        owner_email: claim.owner_email,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
