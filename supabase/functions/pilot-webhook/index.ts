// Pilot Webhook Notifications
// Sends webhooks to Slack/other services when pilot milestones are reached

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

// Notification types and their configurations
const notificationTypes = {
  pilot_started: {
    emoji: "🚀",
    color: "#60a5fa",
    title: "Pilot Started",
  },
  week_completed: {
    emoji: "✅",
    color: "#34d399",
    title: "Week Completed",
  },
  go_decision: {
    emoji: "🎉",
    color: "#34d399",
    title: "GO Decision Made",
  },
  conditional_decision: {
    emoji: "⚠️",
    color: "#f59e0b",
    title: "Conditional Decision Made",
  },
  no_go_decision: {
    emoji: "❌",
    color: "#ef4444",
    title: "No-Go Decision Made",
  },
  pilot_completed: {
    emoji: "🏁",
    color: "#e8762b",
    title: "Pilot Completed",
  },
  blocker_identified: {
    emoji: "🚧",
    color: "#ef4444",
    title: "Blocker Identified",
  },
};

// Format Slack message
const formatSlackMessage = (type: string, data: any) => {
  const config = notificationTypes[type as keyof typeof notificationTypes] || {
    emoji: "📢",
    color: "#8b8f9a",
    title: "Pilot Update",
  };

  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${config.emoji} ${config.title}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Practice:*\n${data.practice_name || "Unknown"}`,
          },
          {
            type: "mrkdwn",
            text: `*Stage:*\n${data.pilot_status || "N/A"}`,
          },
        ],
      },
      ...(data.message
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: data.message,
              },
            },
          ]
        : []),
      ...(data.details
        ? [
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: data.details,
                },
              ],
            },
          ]
        : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "View in Dashboard",
              emoji: true,
            },
            url: data.dashboard_url || "https://defyb.org",
            style: "primary",
          },
        ],
      },
    ],
    attachments: [
      {
        color: config.color,
        fallback: `${config.title}: ${data.practice_name}`,
      },
    ],
  };
};

// Generic webhook format
const formatGenericWebhook = (type: string, data: any) => {
  const config = notificationTypes[type as keyof typeof notificationTypes] || {
    emoji: "📢",
    title: "Pilot Update",
  };

  return {
    event: type,
    timestamp: new Date().toISOString(),
    data: {
      practice_id: data.practice_id,
      practice_name: data.practice_name,
      pilot_status: data.pilot_status,
      message: data.message,
      details: data.details,
      title: config.title,
    },
  };
};

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
    const { type, practice_id, practice_name, pilot_status, message, details } = await req.json();

    // Webhook target is controlled by environment only (prevents SSRF via request payload).
    const targetUrl = Deno.env.get("SLACK_WEBHOOK_URL");

    if (!targetUrl) {
      // No webhook configured, just log and return success
      console.log("No webhook URL configured, notification logged:", {
        type,
        practice_name,
        pilot_status,
        message,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Notification logged (no webhook configured)"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Determine if it's a Slack webhook
    const isSlack = targetUrl.includes("slack.com");

    // Format the payload
    const payload = isSlack
      ? formatSlackMessage(type, {
          practice_id,
          practice_name,
          pilot_status,
          message,
          details,
          dashboard_url: `https://defyb.org`,
        })
      : formatGenericWebhook(type, {
          practice_id,
          practice_name,
          pilot_status,
          message,
          details,
        });

    // Send the webhook
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook failed: ${response.status} ${errorText}`);
    }

    // Initialize Supabase client to log the notification
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log notification to database
    await supabase.from("notifications").insert({
      practice_id,
      user_type: "team",
      type: "pilot_webhook",
      title: notificationTypes[type as keyof typeof notificationTypes]?.title || "Pilot Update",
      message: message || `Pilot status: ${pilot_status}`,
    });

    return new Response(
      JSON.stringify({ success: true, message: "Webhook sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
