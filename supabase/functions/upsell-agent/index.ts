// Upsell Agent
// Analyzes usage patterns for paying practices and recommends addons
// Schedule: daily via pg_cron
//
// Signals:
//   - Encounters with prior auth flags → Prior Auth Automation ($149/provider/mo)
//   - Encounters with DME mentions → DME Workflow ($199/provider/mo)
//   - High volume of encounters → Claims AI ($99/provider/mo)
//   - Copy/paste from scribe detected → Scribe Connector ($49/provider/mo)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const isAuthorizedRequest = (req: Request): boolean => {
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  return !!(internalSecret && req.headers.get("x-internal-secret") === internalSecret);
};

const getSupabase = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const postToSlack = async (text: string) => {
  const url = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
};

const ADDON_CONFIG = {
  claims: {
    name: "Claims AI",
    price: "$99/provider/mo",
    template: "upsell_claims",
  },
  prior_auth: {
    name: "Prior Auth Automation",
    price: "$149/provider/mo",
    template: "upsell_prior_auth",
  },
  dme: {
    name: "DME Workflow",
    price: "$199/provider/mo",
    template: "upsell_dme",
  },
  scribe_connector: {
    name: "Scribe Connector",
    price: "$49/provider/mo",
    template: "upsell_scribe",
  },
} as const;

const PRIOR_AUTH_KEYWORDS = [
  "prior auth", "pre-authorization", "pre-cert", "precertification",
  "authorization required", "auth needed", "insurance approval",
];

const DME_KEYWORDS = [
  "dme", "durable medical equipment", "brace", "splint", "cpap",
  "wheelchair", "walker", "crutch", "orthotic", "prosthetic",
  "oxygen", "nebulizer",
];

// ============================================================
// USAGE ANALYSIS
// ============================================================

const analyzeUsageForPractice = async (
  supabase: ReturnType<typeof getSupabase>,
  practiceId: string,
) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get recent encounter analyses for this practice
  const { data: encounters } = await supabase
    .from("encounter_analyses")
    .select("id, note_text, result, created_at")
    .eq("practice_id", practiceId)
    .gte("created_at", thirtyDaysAgo);

  if (!encounters || encounters.length === 0) return [];

  const recommendations: { addon: keyof typeof ADDON_CONFIG; reason: string; count: number }[] = [];

  // Check for prior auth signals
  let priorAuthHits = 0;
  let dmeHits = 0;

  for (const enc of encounters) {
    const text = `${enc.note_text || ""} ${JSON.stringify(enc.result || {})}`.toLowerCase();

    if (PRIOR_AUTH_KEYWORDS.some((kw) => text.includes(kw))) priorAuthHits++;
    if (DME_KEYWORDS.some((kw) => text.includes(kw))) dmeHits++;
  }

  if (priorAuthHits >= 5) {
    recommendations.push({
      addon: "prior_auth",
      reason: `${priorAuthHits} encounters with prior auth mentions in the last 30 days`,
      count: priorAuthHits,
    });
  }

  if (dmeHits >= 3) {
    recommendations.push({
      addon: "dme",
      reason: `${dmeHits} encounters with DME-related content in the last 30 days`,
      count: dmeHits,
    });
  }

  // High volume → Claims AI
  if (encounters.length >= 100) {
    recommendations.push({
      addon: "claims",
      reason: `${encounters.length} encounters analyzed in 30 days — high volume benefits from Claims AI`,
      count: encounters.length,
    });
  }

  return recommendations;
};

const sendUpsellNudge = async (
  supabase: ReturnType<typeof getSupabase>,
  practiceId: string,
  contactEmail: string,
  addon: keyof typeof ADDON_CONFIG,
  reason: string,
  practiceData: Record<string, unknown>,
) => {
  const today = new Date().toISOString().split("T")[0];
  const config = ADDON_CONFIG[addon];

  // Check for recent nudge (don't re-nudge within 14 days)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("agent_nudges")
    .select("id")
    .eq("practice_id", practiceId)
    .eq("agent_name", "upsell")
    .eq("nudge_type", `upsell_${addon}`)
    .gte("sent_at", twoWeeksAgo)
    .limit(1);

  if (recent && recent.length > 0) return false;

  // Send email
  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

  await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
    },
    body: JSON.stringify({
      template: config.template,
      recipient: contactEmail,
      data: {
        ...practiceData,
        addon_name: config.name,
        addon_price: config.price,
        reason,
      },
    }),
  });

  await supabase.from("agent_nudges").insert({
    practice_id: practiceId,
    agent_name: "upsell",
    nudge_type: `upsell_${addon}`,
    channel: "email",
  });

  return true;
};

// ============================================================
// MAIN
// ============================================================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!isAuthorizedRequest(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  const supabase = getSupabase();

  try {
    // Get all paying practices
    const { data: practices } = await supabase
      .from("practices")
      .select("id, name, contact_email, contact_name, payment_status, provider_count, billing_addons")
      .eq("payment_status", "current");

    if (!practices || practices.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No paying practices to analyze" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalNudges = 0;
    const details: { practice: string; addon: string; reason: string }[] = [];

    for (const practice of practices) {
      if (!practice.contact_email) continue;

      // Get current addons to skip already-purchased
      const currentAddons = practice.billing_addons || [];

      const recommendations = await analyzeUsageForPractice(supabase, practice.id);

      for (const rec of recommendations) {
        // Skip if they already have this addon
        if (currentAddons.includes(rec.addon)) continue;

        const sent = await sendUpsellNudge(
          supabase,
          practice.id,
          practice.contact_email,
          rec.addon,
          rec.reason,
          { contact_name: practice.contact_name, practice_name: practice.name },
        );

        if (sent) {
          totalNudges++;
          details.push({ practice: practice.name, addon: rec.addon, reason: rec.reason });
        }
      }
    }

    await supabase.from("agent_runs").insert({
      agent_name: "upsell",
      action: "daily_scan",
      result: { practices_scanned: practices.length, nudges_sent: totalNudges, details },
    });

    if (totalNudges > 0) {
      const summary = details
        .map((d) => `• ${d.practice}: ${ADDON_CONFIG[d.addon as keyof typeof ADDON_CONFIG].name}`)
        .join("\n");
      await postToSlack(`💰 Upsell Agent: Sent ${totalNudges} addon recommendations:\n${summary}`);
    }

    return new Response(
      JSON.stringify({ success: true, practices_scanned: practices.length, nudges_sent: totalNudges, details }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Upsell agent error:", error);

    await supabase.from("agent_runs").insert({
      agent_name: "upsell",
      action: "daily_scan",
      error: error.message,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
