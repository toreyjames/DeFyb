// Health Check Function
// Runs daily to recalculate health scores and generate alerts
// Schedule via pg_cron or external scheduler

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const isAuthorizedRequest = async (req: Request): Promise<boolean> => {
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (internalSecret && req.headers.get("x-internal-secret") === internalSecret) {
    return true;
  }

  const authHeader = req.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!authHeader || !supabaseUrl || !supabaseAnonKey) return false;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) return false;

  const role = (
    data.user.app_metadata?.role ||
    data.user.user_metadata?.role ||
    data.user.user_metadata?.user_role
  )?.toString().toLowerCase();
  const isTeamRole = role === "team" || role === "admin" || role === "owner";
  return isTeamRole;
};

interface Practice {
  id: string;
  name: string;
  stage: string;
  health_score: number | null;
  doc_time_baseline: number | null;
  doc_time_current: number | null;
  denial_rate_baseline: number | null;
  denial_rate_current: number | null;
  call_answer_rate_baseline: number | null;
  call_answer_rate_current: number | null;
  last_portal_login: string | null;
  last_email_response: string | null;
  last_qbr_date: string | null;
  payment_status: string | null;
  nps_score: number | null;
  contact_email: string | null;
}

function calculateHealthScore(practice: Practice): number {
  let score = 50; // Base score

  // Metrics improvement (max +35 points)
  if (practice.doc_time_baseline && practice.doc_time_current) {
    const improvement = 1 - (practice.doc_time_current / practice.doc_time_baseline);
    if (improvement > 0.5) score += 15; // >50% improvement
    else if (improvement > 0.25) score += 10;
    else if (improvement > 0) score += 5;
  }

  if (practice.denial_rate_baseline && practice.denial_rate_current) {
    const reduction = practice.denial_rate_baseline - practice.denial_rate_current;
    if (reduction > 3) score += 10; // >3pp reduction
    else if (reduction > 1) score += 5;
  }

  if (practice.call_answer_rate_baseline && practice.call_answer_rate_current) {
    const improvement = practice.call_answer_rate_current - practice.call_answer_rate_baseline;
    if (improvement > 20) score += 10; // >20pp improvement
    else if (improvement > 10) score += 5;
  }

  // Engagement (max +20 points)
  const now = new Date();

  if (practice.last_portal_login) {
    const lastLogin = new Date(practice.last_portal_login);
    const daysSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLogin < 30) score += 5;
  }

  if (practice.last_email_response) {
    const lastResponse = new Date(practice.last_email_response);
    const daysSinceResponse = (now.getTime() - lastResponse.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceResponse < 14) score += 5;
  }

  if (practice.last_qbr_date) {
    const lastQbr = new Date(practice.last_qbr_date);
    const daysSinceQbr = (now.getTime() - lastQbr.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceQbr < 90) score += 10;
  }

  // Payment (max +10 / -15 points)
  if (practice.payment_status === "current") {
    score += 10;
  } else if (practice.payment_status === "overdue") {
    score -= 15;
  }

  // NPS (max +15 / -20 points)
  if (practice.nps_score !== null) {
    if (practice.nps_score >= 9) score += 15;
    else if (practice.nps_score >= 7) score += 5;
    else if (practice.nps_score <= 6) score -= 20;
  }

  // Cap between 0 and 100
  return Math.max(0, Math.min(100, score));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authorized = await isAuthorizedRequest(req);
  if (!authorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Running daily health check...");

    // Get all managed practices
    const { data: practices, error: fetchError } = await supabase
      .from("practices")
      .select("*")
      .eq("stage", "managed");

    if (fetchError) throw fetchError;

    const alerts: { practice_id: string; type: string; title: string; message: string }[] = [];
    const updates: { id: string; health_score: number }[] = [];

    for (const practice of practices || []) {
      const oldScore = practice.health_score || 50;
      const newScore = calculateHealthScore(practice);

      // Check for significant changes
      const scoreDiff = newScore - oldScore;

      if (scoreDiff <= -10) {
        // Health score dropped significantly
        alerts.push({
          practice_id: practice.id,
          type: "health_alert",
          title: "Health Score Dropped",
          message: `${practice.name}'s health score dropped from ${oldScore} to ${newScore}. Consider scheduling a check-in call.`,
        });
      }

      if (scoreDiff >= 10) {
        // Health score improved significantly - notify client
        alerts.push({
          practice_id: practice.id,
          type: "metric_update",
          title: "Health Score Improved!",
          message: `Great news! Your practice health score improved from ${oldScore} to ${newScore}.`,
        });
      }

      // Check for no portal login in 30 days
      if (practice.last_portal_login) {
        const lastLogin = new Date(practice.last_portal_login);
        const daysSinceLogin = (new Date().getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLogin >= 30 && daysSinceLogin < 31) {
          alerts.push({
            practice_id: practice.id,
            type: "engagement_alert",
            title: "No Portal Activity",
            message: `${practice.name} hasn't logged into the portal in 30 days. Consider sending a re-engagement email.`,
          });
        }
      }

      // Check for payment overdue
      if (practice.payment_status === "overdue") {
        alerts.push({
          practice_id: practice.id,
          type: "action_required",
          title: "Payment Overdue",
          message: `${practice.name} has an overdue payment. Follow up required.`,
        });
      }

      // Check for contract expiring
      if (practice.contract_end_date) {
        const endDate = new Date(practice.contract_end_date);
        const daysUntilExpiry = (endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);

        if (daysUntilExpiry === 60 || daysUntilExpiry === 30 || daysUntilExpiry === 14) {
          alerts.push({
            practice_id: practice.id,
            type: "renewal_alert",
            title: "Contract Expiring Soon",
            message: `${practice.name}'s contract expires in ${Math.round(daysUntilExpiry)} days. Begin renewal discussion.`,
          });
        }
      }

      updates.push({ id: practice.id, health_score: newScore });
    }

    // Update health scores
    for (const update of updates) {
      await supabase
        .from("practices")
        .update({ health_score: update.health_score })
        .eq("id", update.id);
    }

    // Create notifications for alerts
    for (const alert of alerts) {
      await supabase.from("notifications").insert({
        practice_id: alert.practice_id,
        user_type: alert.type === "metric_update" ? "client" : "team",
        type: alert.type,
        title: alert.title,
        message: alert.message,
      });
    }

    console.log(`Health check complete. Updated ${updates.length} practices, created ${alerts.length} alerts.`);

    return new Response(
      JSON.stringify({
        success: true,
        updated: updates.length,
        alerts: alerts.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
