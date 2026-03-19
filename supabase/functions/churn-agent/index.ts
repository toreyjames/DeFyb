// Churn Prevention Agent
// Monitors for disengagement signals and intervenes before cancellation
// Schedule: daily via pg_cron
//
// Signals:
//   - No encounters analyzed in 7+ days (active user went quiet)
//   - No login in 14+ days
//   - Health score drop below 50
//   - Payment failed / overdue

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

const postToSlack = async (blocks: unknown[], text: string) => {
  const url = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks, text }),
  });
};

const sendNudge = async (
  supabase: ReturnType<typeof getSupabase>,
  practiceId: string,
  nudgeType: string,
  recipient: string,
  template: string,
  data: Record<string, unknown>,
) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recent } = await supabase
    .from("agent_nudges")
    .select("id")
    .eq("practice_id", practiceId)
    .eq("agent_name", "churn")
    .eq("nudge_type", nudgeType)
    .gte("sent_at", sevenDaysAgo)
    .limit(1);

  if (recent && recent.length > 0) return false;

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

  await supabase.from("agent_nudges").insert({
    practice_id: practiceId,
    agent_name: "churn",
    nudge_type: nudgeType,
    channel: "email",
  });

  return true;
};

// ============================================================
// CHURN DETECTION
// ============================================================

const runChurnScan = async (supabase: ReturnType<typeof getSupabase>) => {
  const results = { usage_drop: 0, inactive_login: 0, health_alert: 0, payment_issue: 0 };
  const alerts: { practice: string; type: string; detail: string }[] = [];

  // Get all paying practices
  const { data: practices } = await supabase
    .from("practices")
    .select("id, name, contact_email, contact_name, payment_status, health_score, last_portal_login");

  if (!practices) return { results, alerts };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  for (const practice of practices) {
    if (!practice.contact_email) continue;
    const isPaying = practice.payment_status === "current" || practice.payment_status === "overdue";
    if (!isPaying && practice.payment_status !== "overdue") continue;

    const emailData = {
      contact_name: practice.contact_name || "",
      practice_name: practice.name || "",
    };

    // 1. Usage drop: had encounters before, none in 7+ days
    const { data: recentEncounters } = await supabase
      .from("encounter_analyses")
      .select("id")
      .eq("practice_id", practice.id)
      .gte("created_at", sevenDaysAgo)
      .limit(1);

    const { count: totalEncounters } = await supabase
      .from("encounter_analyses")
      .select("id", { count: "exact", head: true })
      .eq("practice_id", practice.id);

    if ((totalEncounters || 0) > 0 && (!recentEncounters || recentEncounters.length === 0)) {
      const sent = await sendNudge(
        supabase, practice.id, "usage_drop", practice.contact_email,
        "churn_usage_drop", emailData,
      );
      if (sent) {
        results.usage_drop++;
        alerts.push({ practice: practice.name, type: "usage_drop", detail: "No encounters in 7+ days" });
      }
    }

    // 2. No login in 14+ days
    if (practice.last_portal_login && new Date(practice.last_portal_login) < new Date(fourteenDaysAgo)) {
      const sent = await sendNudge(
        supabase, practice.id, "inactive_login", practice.contact_email,
        "churn_inactive", emailData,
      );
      if (sent) {
        results.inactive_login++;
        alerts.push({ practice: practice.name, type: "inactive", detail: "No login in 14+ days" });
      }
    }

    // 3. Health score below 50
    if (practice.health_score !== null && practice.health_score < 50) {
      alerts.push({
        practice: practice.name,
        type: "health_critical",
        detail: `Health score: ${practice.health_score}/100`,
      });
      results.health_alert++;
    }

    // 4. Payment overdue
    if (practice.payment_status === "overdue") {
      const sent = await sendNudge(
        supabase, practice.id, "payment_overdue", practice.contact_email,
        "invoice_overdue",
        { ...emailData, amount: 0, days_overdue: 0, invoice_number: "", due_date: "" },
      );
      if (sent) results.payment_issue++;
      alerts.push({ practice: practice.name, type: "payment", detail: "Payment overdue" });
    }
  }

  return { results, alerts };
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
    const { results, alerts } = await runChurnScan(supabase);
    const totalNudges = results.usage_drop + results.inactive_login + results.payment_issue;

    await supabase.from("agent_runs").insert({
      agent_name: "churn",
      action: "daily_scan",
      result: { ...results, alerts_count: alerts.length },
    });

    // Post to Slack if there are any churn signals
    if (alerts.length > 0) {
      const highPriority = alerts.filter((a) => a.type === "payment" || a.type === "health_critical");
      const blocks: unknown[] = [
        {
          type: "header",
          text: { type: "plain_text", text: "🛡️ Churn Agent — Daily Report", emoji: true },
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `_${alerts.length} signal${alerts.length !== 1 ? "s" : ""} detected, ${totalNudges} nudge${totalNudges !== 1 ? "s" : ""} sent_` }],
        },
      ];

      if (highPriority.length > 0) {
        blocks.push(
          { type: "divider" },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🔴 High Priority*\n${highPriority.map((a) => `• ${a.practice}: ${a.detail}`).join("\n")}`,
            },
          },
        );
      }

      const lowPriority = alerts.filter((a) => a.type !== "payment" && a.type !== "health_critical");
      if (lowPriority.length > 0) {
        blocks.push(
          { type: "divider" },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🟡 Watch*\n${lowPriority.map((a) => `• ${a.practice}: ${a.detail}`).join("\n")}`,
            },
          },
        );
      }

      await postToSlack(blocks, `Churn Agent: ${alerts.length} signals detected`);
    }

    return new Response(
      JSON.stringify({ success: true, ...results, alerts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Churn agent error:", error);

    await supabase.from("agent_runs").insert({
      agent_name: "churn",
      action: "daily_scan",
      error: error.message,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
