// DeFyb Autopilot
// Automated checks, digests, and accountability system
// Triggered by cron or manually

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

const getSupabase = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
};

// ============================================================
// SLACK MESSAGING
// ============================================================

const postToSlack = async (blocks: any[], text: string) => {
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!webhookUrl) {
    console.log("No Slack webhook configured, skipping notification");
    return;
  }

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks, text }),
  });
};

// ============================================================
// DATA FETCHING
// ============================================================

const fetchAllData = async (supabase: any) => {
  const [
    { data: practices },
    { data: tasks },
    { data: quotes },
    { data: payments },
  ] = await Promise.all([
    supabase.from("practices").select("*"),
    supabase.from("tasks").select("*, practices(name)").in("status", ["pending", "in_progress"]),
    supabase.from("quotes").select("*, practices(name)").eq("status", "sent"),
    supabase.from("payments").select("*, practices(name)").eq("status", "pending"),
  ]);

  return { practices: practices || [], tasks: tasks || [], quotes: quotes || [], payments: payments || [] };
};

// ============================================================
// WEEKLY DIGEST (Monday Morning)
// ============================================================

const generateWeeklyDigest = async (supabase: any) => {
  const { practices, tasks, quotes, payments } = await fetchAllData(supabase);

  // Pipeline summary
  const pipeline = {
    leads: practices.filter((p: any) => p.stage === "lead"),
    assessment: practices.filter((p: any) => p.stage === "assessment"),
    implementation: practices.filter((p: any) => p.stage === "implementation"),
    managed: practices.filter((p: any) => p.stage === "managed"),
  };

  // Active pilots
  const activePilots = practices.filter((p: any) =>
    p.pilot_status && !["not_started", "completed"].includes(p.pilot_status)
  );

  // Calculate MRR
  const mrr = pipeline.managed.reduce((sum: number, p: any) => sum + (p.monthly_rate || 0), 0);

  // Pending quotes value
  const pendingQuoteValue = quotes.reduce((sum: number, q: any) => sum + (q.total_value || 0), 0);

  // Overdue tasks
  const today = new Date().toISOString().split("T")[0];
  const overdueTasks = tasks.filter((t: any) => t.due_date && t.due_date < today);

  // Stale leads (no update in 7 days)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const staleLeads = pipeline.leads.filter((p: any) => p.updated_at < weekAgo);

  // Health concerns
  const healthConcerns = practices.filter((p: any) => p.health_score && p.health_score < 60);

  // Build the digest
  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "📅 Weekly DeFyb Digest", emoji: true },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: `_${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}_` }],
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: "*📊 Pipeline Snapshot*" },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Leads:* ${pipeline.leads.length}` },
        { type: "mrkdwn", text: `*Assessment:* ${pipeline.assessment.length}` },
        { type: "mrkdwn", text: `*Implementation:* ${pipeline.implementation.length}` },
        { type: "mrkdwn", text: `*Managed:* ${pipeline.managed.length}` },
      ],
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*MRR:* $${mrr.toLocaleString()}` },
        { type: "mrkdwn", text: `*Pending Quotes:* $${pendingQuoteValue.toLocaleString()}` },
      ],
    },
  ];

  // Active pilots section
  if (activePilots.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🧪 Active Pilots (${activePilots.length})*\n${activePilots.map((p: any) => `• ${p.name} - ${p.pilot_status.replace("_", " ")}`).join("\n")}`
        },
      }
    );
  }

  // Action items section
  const actionItems: string[] = [];

  if (staleLeads.length > 0) {
    actionItems.push(`🔴 *${staleLeads.length} stale lead${staleLeads.length > 1 ? "s"  : ""}* need follow-up`);
  }
  if (overdueTasks.length > 0) {
    actionItems.push(`⚠️ *${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}*`);
  }
  if (healthConcerns.length > 0) {
    actionItems.push(`💔 *${healthConcerns.length} practice${healthConcerns.length > 1 ? "s" : ""}* with health concerns`);
  }
  if (quotes.length > 0) {
    actionItems.push(`📝 *${quotes.length} pending quote${quotes.length > 1 ? "s" : ""}* awaiting response`);
  }

  if (actionItems.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: "*🎯 This Week's Focus*\n" + actionItems.join("\n") },
      }
    );
  } else {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: "✅ *All caught up!* Pipeline is healthy." },
      }
    );
  }

  // Motivational closer
  const totalPractices = practices.length;
  const totalValue = mrr * 12 + pendingQuoteValue;
  blocks.push(
    { type: "divider" },
    {
      type: "context",
      elements: [{
        type: "mrkdwn",
        text: `💪 _You're managing ${totalPractices} practices with $${totalValue.toLocaleString()} in annual pipeline. Keep going!_`
      }],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open Dashboard", emoji: true },
          url: "https://defyb.org",
          style: "primary",
        },
      ],
    }
  );

  await postToSlack(blocks, "Weekly DeFyb Digest");

  return { type: "weekly_digest", sent: true, stats: { practices: totalPractices, mrr, actionItems: actionItems.length } };
};

// ============================================================
// DAILY HEALTH CHECK
// ============================================================

const runDailyHealthCheck = async (supabase: any) => {
  const { practices, tasks, quotes, payments } = await fetchAllData(supabase);
  const today = new Date().toISOString().split("T")[0];
  const alerts: any[] = [];

  // Check for overdue payments
  const overduePayments = payments.filter((p: any) => p.due_date && p.due_date < today);
  if (overduePayments.length > 0) {
    alerts.push({
      type: "payment",
      emoji: "💰",
      title: "Overdue Payments",
      items: overduePayments.map((p: any) => `${p.practices?.name}: $${p.amount}`),
      severity: "high",
    });
  }

  // Check for stale leads (no update in 5+ days)
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const staleLeads = practices.filter((p: any) => p.stage === "lead" && p.updated_at < fiveDaysAgo);
  if (staleLeads.length > 0) {
    alerts.push({
      type: "leads",
      emoji: "🔵",
      title: "Leads Going Cold",
      items: staleLeads.map((p: any) => p.name),
      severity: "medium",
    });
  }

  // Check for pilots needing attention
  const pilotsNeedingAttention = practices.filter((p: any) => {
    if (!p.pilot_status || p.pilot_status === "not_started" || p.pilot_status === "completed") return false;
    // Check if pilot has been in same status for more than 10 days
    const pilotStart = p.pilot_start_date ? new Date(p.pilot_start_date) : null;
    if (!pilotStart) return false;
    const daysSinceStart = (Date.now() - pilotStart.getTime()) / (1000 * 60 * 60 * 24);
    const expectedWeek = Math.ceil(daysSinceStart / 7);
    const currentWeek = parseInt(p.pilot_status.replace("week", "")) || 0;
    return expectedWeek > currentWeek + 1; // More than a week behind
  });

  if (pilotsNeedingAttention.length > 0) {
    alerts.push({
      type: "pilots",
      emoji: "🧪",
      title: "Pilots Behind Schedule",
      items: pilotsNeedingAttention.map((p: any) => `${p.name} (${p.pilot_status})`),
      severity: "medium",
    });
  }

  // Check for overdue tasks
  const overdueTasks = tasks.filter((t: any) => t.due_date && t.due_date < today);
  if (overdueTasks.length > 0) {
    alerts.push({
      type: "tasks",
      emoji: "📋",
      title: "Overdue Tasks",
      items: overdueTasks.slice(0, 5).map((t: any) => `${t.title} (${t.practices?.name || "General"})`),
      severity: "low",
    });
  }

  // Check for quotes expiring soon (within 3 days)
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const expiringQuotes = quotes.filter((q: any) => q.expires_at && q.expires_at <= threeDaysFromNow);
  if (expiringQuotes.length > 0) {
    alerts.push({
      type: "quotes",
      emoji: "📝",
      title: "Quotes Expiring Soon",
      items: expiringQuotes.map((q: any) => `${q.practices?.name}: $${q.total_value?.toLocaleString()}`),
      severity: "medium",
    });
  }

  // Check for health score drops
  const healthConcerns = practices.filter((p: any) => p.health_score && p.health_score < 50);
  if (healthConcerns.length > 0) {
    alerts.push({
      type: "health",
      emoji: "💔",
      title: "Critical Health Scores",
      items: healthConcerns.map((p: any) => `${p.name}: ${p.health_score}/100`),
      severity: "high",
    });
  }

  // Only send Slack message if there are alerts
  if (alerts.length > 0) {
    const highSeverity = alerts.filter(a => a.severity === "high");
    const mediumSeverity = alerts.filter(a => a.severity === "medium");

    const blocks: any[] = [
      {
        type: "header",
        text: { type: "plain_text", text: "🚨 Daily Health Check", emoji: true },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `_${alerts.length} item${alerts.length > 1 ? "s" : ""} need attention_` }],
      },
    ];

    for (const alert of alerts) {
      blocks.push(
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${alert.emoji} *${alert.title}*\n${alert.items.map((i: string) => `• ${i}`).join("\n")}`,
          },
        }
      );
    }

    blocks.push(
      { type: "divider" },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open Dashboard", emoji: true },
            url: "https://defyb.org",
            style: "primary",
          },
        ],
      }
    );

    await postToSlack(blocks, `Daily Health Check: ${alerts.length} items need attention`);
  }

  // Update streak tracking
  await updateStreak(supabase, alerts.length === 0);

  return { type: "daily_health_check", alerts: alerts.length, details: alerts };
};

// ============================================================
// STREAK & ACCOUNTABILITY TRACKING
// ============================================================

const updateStreak = async (supabase: any, allClear: boolean) => {
  const today = new Date().toISOString().split("T")[0];

  // Get or create streak record
  let { data: streak } = await supabase
    .from("startup_metrics")
    .select("*")
    .eq("metric_type", "streak")
    .single();

  if (!streak) {
    // Create initial streak record
    const { data: newStreak } = await supabase
      .from("startup_metrics")
      .insert({
        metric_type: "streak",
        data: {
          current_streak: 0,
          best_streak: 0,
          last_check_date: today,
          total_clear_days: 0,
          started_at: today,
        },
      })
      .select()
      .single();
    streak = newStreak;
  }

  const streakData = streak?.data || {};
  const lastCheck = streakData.last_check_date;

  // Check if this is a new day
  if (lastCheck !== today) {
    let newStreak = streakData.current_streak || 0;
    let totalClear = streakData.total_clear_days || 0;

    if (allClear) {
      newStreak++;
      totalClear++;

      // Celebrate milestones
      if (newStreak === 7) {
        await postToSlack([
          {
            type: "section",
            text: { type: "mrkdwn", text: "🔥 *7-Day Streak!* You've kept everything on track for a full week. Keep it up!" },
          },
        ], "7-Day Streak!");
      } else if (newStreak === 30) {
        await postToSlack([
          {
            type: "section",
            text: { type: "mrkdwn", text: "🏆 *30-Day Streak!* A full month of staying on top of things. You're crushing it!" },
          },
        ], "30-Day Streak!");
      }
    } else {
      // Streak broken, but encourage
      if (newStreak >= 3) {
        await postToSlack([
          {
            type: "section",
            text: { type: "mrkdwn", text: `💪 Your ${newStreak}-day streak ended, but you've got this. Clear today's items and start fresh!` },
          },
        ], "Keep going!");
      }
      newStreak = 0;
    }

    const bestStreak = Math.max(streakData.best_streak || 0, newStreak);

    await supabase
      .from("startup_metrics")
      .update({
        data: {
          current_streak: newStreak,
          best_streak: bestStreak,
          last_check_date: today,
          total_clear_days: totalClear,
          started_at: streakData.started_at || today,
        },
      })
      .eq("id", streak.id);
  }
};

// ============================================================
// WEEKLY WINS CELEBRATION
// ============================================================

const celebrateWins = async (supabase: any) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Find wins from the past week
  const { data: recentPractices } = await supabase
    .from("practices")
    .select("*")
    .gte("updated_at", weekAgo);

  const wins: string[] = [];

  // New leads
  const newLeads = recentPractices?.filter((p: any) => p.created_at >= weekAgo) || [];
  if (newLeads.length > 0) {
    wins.push(`📥 *${newLeads.length} new lead${newLeads.length > 1 ? "s" : ""}* came in`);
  }

  // Practices that advanced stages
  const { data: stageChanges } = await supabase
    .from("activity_log")
    .select("*, practices(name)")
    .eq("type", "stage_change")
    .gte("created_at", weekAgo);

  if (stageChanges && stageChanges.length > 0) {
    wins.push(`🚀 *${stageChanges.length} practice${stageChanges.length > 1 ? "s" : ""}* advanced to next stage`);
  }

  // Completed pilots
  const completedPilots = recentPractices?.filter((p: any) =>
    p.pilot_status === "completed" && p.updated_at >= weekAgo
  ) || [];
  if (completedPilots.length > 0) {
    wins.push(`✅ *${completedPilots.length} pilot${completedPilots.length > 1 ? "s" : ""}* completed`);
  }

  // Tasks completed
  const { data: completedTasks } = await supabase
    .from("tasks")
    .select("*")
    .eq("status", "completed")
    .gte("completed_at", weekAgo);

  if (completedTasks && completedTasks.length > 0) {
    wins.push(`☑️ *${completedTasks.length} task${completedTasks.length > 1 ? "s" : ""}* completed`);
  }

  if (wins.length > 0) {
    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: "🎉 This Week's Wins", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: wins.join("\n") },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: "_Celebrate progress, no matter how small!_" }],
      },
    ];

    await postToSlack(blocks, "This Week's Wins");
  }

  return { wins };
};

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
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
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "daily";

    const supabase = getSupabase();
    let result;

    switch (action) {
      case "weekly":
        result = await generateWeeklyDigest(supabase);
        break;
      case "daily":
        result = await runDailyHealthCheck(supabase);
        break;
      case "wins":
        result = await celebrateWins(supabase);
        break;
      case "all":
        // Run everything (useful for testing)
        const daily = await runDailyHealthCheck(supabase);
        const weekly = await generateWeeklyDigest(supabase);
        const wins = await celebrateWins(supabase);
        result = { daily, weekly, wins };
        break;
      default:
        result = { error: "Unknown action. Use: daily, weekly, wins, or all" };
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Autopilot error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
