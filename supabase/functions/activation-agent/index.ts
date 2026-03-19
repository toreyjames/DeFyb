// Activation Agent
// Watches for new signups and nudges them toward first value
// Schedule: every 2 hours via pg_cron
//
// Funnel: signup → first_analysis → repeat_usage (5+) → paid_conversion
// Each stage gets a targeted nudge if the user stalls

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

const sendNudgeEmail = async (
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
  agentName: string,
  nudgeType: string,
  recipient: string,
  template: string,
  data: Record<string, unknown>,
) => {
  // Check if we already sent this nudge today
  const today = new Date().toISOString().split("T")[0];
  const { data: existing } = await supabase
    .from("agent_nudges")
    .select("id")
    .eq("user_id", userId)
    .eq("agent_name", agentName)
    .eq("nudge_type", nudgeType)
    .gte("sent_at", `${today}T00:00:00Z`)
    .limit(1);

  if (existing && existing.length > 0) return false;

  // Call send-email function
  const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");

  await fetch(fnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(internalSecret ? { "x-internal-secret": internalSecret } : {}),
    },
    body: JSON.stringify({ template, recipient, data }),
  });

  // Record the nudge
  await supabase.from("agent_nudges").insert({
    user_id: userId,
    agent_name: agentName,
    nudge_type: nudgeType,
    channel: "email",
  });

  return true;
};

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

// ============================================================
// ACTIVATION CHECKS
// ============================================================

const findUsersNeedingNudge = async (supabase: ReturnType<typeof getSupabase>) => {
  const results = { welcome: 0, first_analysis: 0, repeat_usage: 0, conversion: 0 };

  // 1. Users who signed up 24h+ ago but never analyzed an encounter
  const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 500 });
  if (!allUsers?.users) return results;

  for (const user of allUsers.users) {
    const email = user.email;
    if (!email) continue;

    const createdAt = new Date(user.created_at);
    const hoursSinceSignup = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    // Skip users less than 24h old (give them time)
    if (hoursSinceSignup < 24) continue;

    // Skip team users
    const role = (user.app_metadata?.role || user.user_metadata?.role || "")
      .toString()
      .toLowerCase();
    if (role === "team" || role === "admin" || role === "owner") continue;

    // Count their encounters
    const { count: encounterCount } = await supabase
      .from("encounter_analyses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const encounters = encounterCount || 0;

    // Check billing status
    const { data: membership } = await supabase
      .from("clinic_memberships")
      .select("practice_id, practices(payment_status, name)")
      .eq("auth_user_id", user.id)
      .limit(1)
      .maybeSingle();

    const isPaid = membership?.practices?.payment_status === "current";
    const practiceName = membership?.practices?.name || "";

    // NUDGE 1: Signed up, never analyzed (24h–72h window)
    if (encounters === 0 && hoursSinceSignup >= 24 && hoursSinceSignup < 72) {
      const sent = await sendNudgeEmail(
        supabase, user.id, "activation", "first_analysis_nudge", email,
        "activation_first_analysis",
        { contact_name: user.user_metadata?.full_name || "", practice_name: practiceName },
      );
      if (sent) results.first_analysis++;
      continue;
    }

    // NUDGE 2: Analyzed 1–4 encounters, hasn't come back in 3+ days
    if (encounters >= 1 && encounters < 5 && !isPaid) {
      const { data: lastEncounter } = await supabase
        .from("encounter_analyses")
        .select("created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastEncounter) {
        const daysSinceLast =
          (Date.now() - new Date(lastEncounter.created_at).getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceLast >= 3) {
          const sent = await sendNudgeEmail(
            supabase, user.id, "activation", "repeat_usage_nudge", email,
            "activation_repeat_usage",
            {
              contact_name: user.user_metadata?.full_name || "",
              encounter_count: encounters,
              practice_name: practiceName,
            },
          );
          if (sent) results.repeat_usage++;
        }
      }
      continue;
    }

    // NUDGE 3: 5+ encounters, still not paying (conversion nudge)
    if (encounters >= 5 && !isPaid) {
      // Get their revenue impact data
      const { data: impacts } = await supabase
        .from("revenue_impacts")
        .select("estimated_delta")
        .eq("user_id", user.id);

      const totalDelta = (impacts || []).reduce(
        (sum: number, r: { estimated_delta: number }) => sum + (r.estimated_delta || 0), 0,
      );

      const sent = await sendNudgeEmail(
        supabase, user.id, "activation", "conversion_nudge", email,
        "activation_conversion",
        {
          contact_name: user.user_metadata?.full_name || "",
          encounter_count: encounters,
          estimated_recovery: Math.round(totalDelta * 12),
          practice_name: practiceName,
        },
      );
      if (sent) results.conversion++;
    }
  }

  return results;
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
    const results = await findUsersNeedingNudge(supabase);
    const total = Object.values(results).reduce((a, b) => a + b, 0);

    // Log the run
    await supabase.from("agent_runs").insert({
      agent_name: "activation",
      action: "nudge_sweep",
      result: results,
    });

    if (total > 0) {
      await postToSlack(
        `🤖 Activation Agent: Sent ${total} nudges — ` +
        `${results.first_analysis} first-analysis, ` +
        `${results.repeat_usage} repeat-usage, ` +
        `${results.conversion} conversion`,
      );
    }

    return new Response(JSON.stringify({ success: true, nudges_sent: total, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Activation agent error:", error);

    await supabase.from("agent_runs").insert({
      agent_name: "activation",
      action: "nudge_sweep",
      error: error.message,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
