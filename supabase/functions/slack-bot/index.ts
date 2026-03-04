// DeFyb Slack Bot
// Handles slash commands, interactive components, and Claude AI agent

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
const getSupabase = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseServiceKey);
};

// ============================================================
// SLACK VERIFICATION
// ============================================================

const verifySlackRequest = async (req: Request, body: string): Promise<boolean> => {
  const signingSecret = Deno.env.get("SLACK_SIGNING_SECRET");
  if (!signingSecret) return false;

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");

  if (!timestamp || !signature) return false;

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  // Verify signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(sigBasestring));
  const mySignature = "v0=" + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  return mySignature === signature;
};

// ============================================================
// CLAUDE AI INTEGRATION
// ============================================================

const askClaude = async (query: string, context: any): Promise<string> => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return "Claude AI is not configured. Please set ANTHROPIC_API_KEY.";
  }

  const systemPrompt = `You are DeFyb's AI assistant, helping the team manage medical practice transformations. You have access to the following context about practices and pilots.

Current Data:
${JSON.stringify(context, null, 2)}

Guidelines:
- Be concise and actionable (Slack messages should be brief)
- Use bullet points for lists
- Highlight important numbers and metrics
- If asked to draft an email, format it clearly
- For ROI questions, show the math briefly
- Flag any concerns or risks you notice
- Use emoji sparingly but appropriately for Slack`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: query }],
      }),
    });

    const data = await response.json();
    return data.content?.[0]?.text || "Sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Claude API error:", error);
    return "Error connecting to Claude AI. Please try again.";
  }
};

// ============================================================
// DATA FETCHING
// ============================================================

const fetchPractices = async (supabase: any, filter?: string) => {
  let query = supabase.from("practices").select("*");

  if (filter) {
    query = query.or(`name.ilike.%${filter}%,specialty.ilike.%${filter}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
};

const fetchPipelineSummary = async (supabase: any) => {
  const { data: practices, error } = await supabase
    .from("practices")
    .select("stage, health_score, pilot_status, payment_status");

  if (error) throw error;

  const summary = {
    total: practices.length,
    byStage: { lead: 0, assessment: 0, implementation: 0, managed: 0 },
    activePilots: 0,
    healthConcerns: 0,
    paymentIssues: 0,
  };

  practices.forEach((p: any) => {
    if (p.stage && summary.byStage[p.stage as keyof typeof summary.byStage] !== undefined) {
      summary.byStage[p.stage as keyof typeof summary.byStage]++;
    }
    if (p.pilot_status && p.pilot_status !== "not_started" && p.pilot_status !== "completed") {
      summary.activePilots++;
    }
    if (p.health_score && p.health_score < 60) {
      summary.healthConcerns++;
    }
    if (p.payment_status === "overdue") {
      summary.paymentIssues++;
    }
  });

  return summary;
};

const fetchPendingTasks = async (supabase: any) => {
  const { data, error } = await supabase
    .from("tasks")
    .select("*, practices(name)")
    .in("status", ["pending", "in_progress"])
    .order("priority", { ascending: false })
    .order("due_date", { ascending: true })
    .limit(10);

  if (error) throw error;
  return data || [];
};

const fetchPracticeByName = async (supabase: any, name: string) => {
  const { data, error } = await supabase
    .from("practices")
    .select("*")
    .ilike("name", `%${name}%`)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
};

// ============================================================
// SLASH COMMAND HANDLERS
// ============================================================

const handleStatusCommand = async (supabase: any): Promise<any> => {
  const summary = await fetchPipelineSummary(supabase);

  return {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "📊 DeFyb Pipeline Status", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Total Practices:*\n${summary.total}` },
          { type: "mrkdwn", text: `*Active Pilots:*\n${summary.activePilots}` },
        ],
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Leads:* ${summary.byStage.lead}` },
          { type: "mrkdwn", text: `*Assessment:* ${summary.byStage.assessment}` },
          { type: "mrkdwn", text: `*Implementation:* ${summary.byStage.implementation}` },
          { type: "mrkdwn", text: `*Managed:* ${summary.byStage.managed}` },
        ],
      },
      ...(summary.healthConcerns > 0 || summary.paymentIssues > 0 ? [{
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${summary.healthConcerns > 0 ? `⚠️ ${summary.healthConcerns} health concerns` : ""} ${summary.paymentIssues > 0 ? `🔴 ${summary.paymentIssues} payment issues` : ""}`.trim(),
          },
        ],
      }] : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Dashboard", emoji: true },
            url: "https://defyb.org",
            style: "primary",
          },
        ],
      },
    ],
  };
};

const handlePracticeCommand = async (supabase: any, practiceName: string): Promise<any> => {
  if (!practiceName) {
    return {
      response_type: "ephemeral",
      text: "Please provide a practice name. Usage: `/defyb practice Sunrise Medical`",
    };
  }

  const practice = await fetchPracticeByName(supabase, practiceName);

  if (!practice) {
    return {
      response_type: "ephemeral",
      text: `No practice found matching "${practiceName}"`,
    };
  }

  const stageEmoji: Record<string, string> = {
    lead: "🔵",
    assessment: "🟡",
    implementation: "🟠",
    managed: "🟢",
  };

  const pilotStatus = practice.pilot_status && practice.pilot_status !== "not_started"
    ? `\n*Pilot:* ${practice.pilot_status.replace("_", " ")}`
    : "";

  return {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `${stageEmoji[practice.stage] || "⚪"} ${practice.name}`, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Stage:*\n${practice.stage}` },
          { type: "mrkdwn", text: `*Specialty:*\n${practice.specialty || "N/A"}` },
          { type: "mrkdwn", text: `*Providers:*\n${practice.provider_count || "N/A"}` },
          { type: "mrkdwn", text: `*Health Score:*\n${practice.health_score || "N/A"}/100` },
        ],
      },
      ...(practice.lead_score ? [{
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Lead Score:*\n${practice.lead_score}/100` },
          { type: "mrkdwn", text: `*Payment Status:*\n${practice.payment_status || "none"}` },
        ],
      }] : []),
      ...(pilotStatus ? [{
        type: "context",
        elements: [{ type: "mrkdwn", text: pilotStatus }],
      }] : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View Details", emoji: true },
            url: `https://defyb.org?practice=${practice.id}`,
            style: "primary",
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Update Status", emoji: true },
            action_id: "update_practice_status",
            value: practice.id,
          },
        ],
      },
    ],
  };
};

const handleQuoteCommand = async (providers: number): Promise<any> => {
  if (!providers || providers < 1) {
    return {
      response_type: "ephemeral",
      text: "Please provide provider count. Usage: `/defyb quote 5`",
    };
  }

  // Calculate quote using DeFyb pricing
  const assessmentFee = 2500;
  const implementationBase = 5000;
  const implementationPerProvider = 1500;
  const implementationPerTool = 500;
  const monthlyBase = 500;
  const monthlyPerProvider = 200;
  const avgTools = 3;

  const implementationFee = implementationBase + (providers * implementationPerProvider) + (avgTools * implementationPerTool);
  const monthlyFee = monthlyBase + (providers * monthlyPerProvider);
  const firstYearValue = assessmentFee + implementationFee + (monthlyFee * 12);

  return {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "💰 Quick Quote Calculator", emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${providers} Provider${providers > 1 ? "s" : ""}* (avg 3 AI tools)` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Assessment:*\n$${assessmentFee.toLocaleString()}` },
          { type: "mrkdwn", text: `*Implementation:*\n$${implementationFee.toLocaleString()}` },
          { type: "mrkdwn", text: `*Monthly:*\n$${monthlyFee.toLocaleString()}/mo` },
          { type: "mrkdwn", text: `*First Year:*\n$${firstYearValue.toLocaleString()}` },
        ],
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: "💡 Use the full Quote Builder for custom pricing with specific tools and complexity factors." },
        ],
      },
    ],
  };
};

const handleTasksCommand = async (supabase: any): Promise<any> => {
  const tasks = await fetchPendingTasks(supabase);

  if (tasks.length === 0) {
    return {
      response_type: "ephemeral",
      text: "✅ No pending tasks! You're all caught up.",
    };
  }

  const priorityEmoji: Record<string, string> = {
    urgent: "🔴",
    high: "🟠",
    normal: "🟡",
    low: "🟢",
  };

  const taskBlocks = tasks.slice(0, 5).map((task: any) => ({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `${priorityEmoji[task.priority] || "⚪"} *${task.title}*\n${task.practices?.name || "General"} • ${task.status}`,
    },
    accessory: {
      type: "button",
      text: { type: "plain_text", text: "Complete", emoji: true },
      action_id: "complete_task",
      value: task.id,
      style: "primary",
    },
  }));

  return {
    response_type: "in_channel",
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `📋 Pending Tasks (${tasks.length})`, emoji: true },
      },
      ...taskBlocks,
      ...(tasks.length > 5 ? [{
        type: "context",
        elements: [{ type: "mrkdwn", text: `_...and ${tasks.length - 5} more tasks_` }],
      }] : []),
    ],
  };
};

const handleAskCommand = async (supabase: any, question: string, responseUrl?: string): Promise<any> => {
  if (!question) {
    return {
      response_type: "ephemeral",
      text: "Please provide a question. Usage: `/defyb ask How is the Valley Ortho pilot going?`",
    };
  }

  // If we have a response_url, do the work async and respond immediately
  if (responseUrl) {
    // Fire off the async work without awaiting
    (async () => {
      try {
        // Gather context for Claude
        const [practices, summary, tasks] = await Promise.all([
          fetchPractices(supabase),
          fetchPipelineSummary(supabase),
          fetchPendingTasks(supabase),
        ]);

        const context = {
          practices: practices.map((p: any) => ({
            name: p.name,
            stage: p.stage,
            specialty: p.specialty,
            providers: p.provider_count,
            health_score: p.health_score,
            pilot_status: p.pilot_status,
            payment_status: p.payment_status,
          })),
          pipeline: summary,
          pending_tasks: tasks.length,
        };

        const aiResponse = await askClaude(question, context);

        // Post the response back to Slack via response_url
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response_type: "in_channel",
            replace_original: true,
            blocks: [
              {
                type: "section",
                text: { type: "mrkdwn", text: `💬 *Q:* ${question}` },
              },
              { type: "divider" },
              {
                type: "section",
                text: { type: "mrkdwn", text: aiResponse },
              },
              {
                type: "context",
                elements: [{ type: "mrkdwn", text: "🤖 _Powered by Claude AI_" }],
              },
            ],
          }),
        });
      } catch (error) {
        console.error("Async ask error:", error);
        await fetch(responseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            response_type: "ephemeral",
            replace_original: true,
            text: `❌ Error: ${error.message}`,
          }),
        });
      }
    })();

    // Return immediate "thinking" response
    return {
      response_type: "in_channel",
      text: `💬 *Q:* ${question}\n\n⏳ _Thinking..._`,
    };
  }

  // Fallback for direct API calls (no response_url)
  const [practices, summary, tasks] = await Promise.all([
    fetchPractices(supabase),
    fetchPipelineSummary(supabase),
    fetchPendingTasks(supabase),
  ]);

  const context = {
    practices: practices.map((p: any) => ({
      name: p.name,
      stage: p.stage,
      specialty: p.specialty,
      providers: p.provider_count,
      health_score: p.health_score,
      pilot_status: p.pilot_status,
      payment_status: p.payment_status,
    })),
    pipeline: summary,
    pending_tasks: tasks.length,
  };

  const response = await askClaude(question, context);

  return {
    response_type: "in_channel",
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `💬 *Q:* ${question}` },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: response },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: "🤖 _Powered by Claude AI_" },
        ],
      },
    ],
  };
};

// ============================================================
// INTERACTIVE COMPONENT HANDLERS
// ============================================================

const handleInteraction = async (supabase: any, payload: any): Promise<any> => {
  const actionId = payload.actions?.[0]?.action_id;
  const value = payload.actions?.[0]?.value;
  const userId = payload.user?.id;

  switch (actionId) {
    case "complete_task":
      await supabase
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", value);

      return {
        response_type: "in_channel",
        text: `✅ Task marked complete by <@${userId}>`,
        replace_original: false,
      };

    case "update_practice_status":
      // Return a modal for status update
      return {
        response_action: "open_modal",
        trigger_id: payload.trigger_id,
        view: {
          type: "modal",
          callback_id: "practice_status_modal",
          private_metadata: value,
          title: { type: "plain_text", text: "Update Practice" },
          submit: { type: "plain_text", text: "Save" },
          close: { type: "plain_text", text: "Cancel" },
          blocks: [
            {
              type: "input",
              block_id: "stage_block",
              element: {
                type: "static_select",
                action_id: "stage_select",
                placeholder: { type: "plain_text", text: "Select stage" },
                options: [
                  { text: { type: "plain_text", text: "Lead" }, value: "lead" },
                  { text: { type: "plain_text", text: "Assessment" }, value: "assessment" },
                  { text: { type: "plain_text", text: "Implementation" }, value: "implementation" },
                  { text: { type: "plain_text", text: "Managed" }, value: "managed" },
                ],
              },
              label: { type: "plain_text", text: "Stage" },
            },
            {
              type: "input",
              block_id: "notes_block",
              optional: true,
              element: {
                type: "plain_text_input",
                action_id: "notes_input",
                multiline: true,
                placeholder: { type: "plain_text", text: "Add notes..." },
              },
              label: { type: "plain_text", text: "Notes" },
            },
          ],
        },
      };

    case "approve_quote":
      await supabase
        .from("quotes")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", value);

      return {
        response_type: "in_channel",
        text: `✅ Quote approved and sent by <@${userId}>`,
        replace_original: false,
      };

    case "reject_quote":
      await supabase
        .from("quotes")
        .update({ status: "rejected" })
        .eq("id", value);

      return {
        response_type: "in_channel",
        text: `❌ Quote rejected by <@${userId}>`,
        replace_original: false,
      };

    default:
      return { text: "Unknown action" };
  }
};

const handleModalSubmission = async (supabase: any, payload: any): Promise<any> => {
  const callbackId = payload.view?.callback_id;
  const practiceId = payload.view?.private_metadata;
  const values = payload.view?.state?.values;

  if (callbackId === "practice_status_modal") {
    const newStage = values?.stage_block?.stage_select?.selected_option?.value;
    const notes = values?.notes_block?.notes_input?.value;

    if (newStage && practiceId) {
      await supabase
        .from("practices")
        .update({ stage: newStage })
        .eq("id", practiceId);

      // Log activity
      await supabase.from("activity_log").insert({
        practice_id: practiceId,
        type: "stage_change",
        description: `Stage changed to ${newStage}${notes ? `: ${notes}` : ""}`,
        user_id: payload.user?.id,
      });
    }

    return { response_action: "clear" };
  }

  return {};
};

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let body: string;
    let payload: any;

    // Parse request body
    if (contentType.includes("application/x-www-form-urlencoded")) {
      body = await req.text();
      const params = new URLSearchParams(body);

      // Check if it's an interaction payload
      if (params.has("payload")) {
        payload = JSON.parse(params.get("payload")!);
      } else {
        // It's a slash command
        payload = {
          type: "slash_command",
          command: params.get("command"),
          text: params.get("text") || "",
          user_id: params.get("user_id"),
          channel_id: params.get("channel_id"),
          response_url: params.get("response_url"),
        };
      }
    } else {
      body = await req.text();
      payload = JSON.parse(body);
    }

    // Verify Slack request (skip for URL verification)
    if (payload.type !== "url_verification") {
      const isValid = await verifySlackRequest(req, body);
      if (!isValid) {
        console.error("Invalid Slack signature");
        const allowUnverified = Deno.env.get("ALLOW_UNVERIFIED_SLACK") === "true";
        if (!allowUnverified) {
          return new Response(
            JSON.stringify({ error: "Invalid Slack signature" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 },
          );
        }
      }
    }

    const supabase = getSupabase();

    // Handle different request types
    switch (payload.type) {
      // URL verification challenge from Slack
      case "url_verification":
        return new Response(
          JSON.stringify({ challenge: payload.challenge }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      // Slash commands
      case "slash_command": {
        const [command, ...args] = (payload.text || "").trim().split(/\s+/);
        const argString = args.join(" ");

        let response;
        switch (command?.toLowerCase()) {
          case "status":
            response = await handleStatusCommand(supabase);
            break;
          case "practice":
            response = await handlePracticeCommand(supabase, argString);
            break;
          case "quote":
            response = await handleQuoteCommand(parseInt(args[0]) || 0);
            break;
          case "tasks":
            response = await handleTasksCommand(supabase);
            break;
          case "ask":
            response = await handleAskCommand(supabase, argString, payload.response_url);
            break;
          default:
            response = {
              response_type: "ephemeral",
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: "*DeFyb Commands:*\n" +
                      "• `/defyb status` - Pipeline overview\n" +
                      "• `/defyb practice [name]` - Look up a practice\n" +
                      "• `/defyb quote [providers]` - Quick quote\n" +
                      "• `/defyb tasks` - Pending tasks\n" +
                      "• `/defyb ask [question]` - Ask Claude AI",
                  },
                },
              ],
            };
        }

        return new Response(
          JSON.stringify(response),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Interactive components (buttons, modals)
      case "block_actions":
        const actionResponse = await handleInteraction(supabase, payload);
        return new Response(
          JSON.stringify(actionResponse),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      // Modal submissions
      case "view_submission":
        const modalResponse = await handleModalSubmission(supabase, payload);
        return new Response(
          JSON.stringify(modalResponse),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

      // Event subscriptions (mentions, DMs)
      case "event_callback": {
        const event = payload.event;

        // Handle app mentions
        if (event.type === "app_mention" || event.type === "message") {
          const text = event.text?.replace(/<@[^>]+>/g, "").trim();

          if (text) {
            // Get context and ask Claude
            const [practices, summary] = await Promise.all([
              fetchPractices(supabase),
              fetchPipelineSummary(supabase),
            ]);

            const context = {
              practices: practices.slice(0, 10).map((p: any) => ({
                name: p.name,
                stage: p.stage,
                health_score: p.health_score,
                pilot_status: p.pilot_status,
              })),
              pipeline: summary,
            };

            const response = await askClaude(text, context);

            // Post response back to Slack
            const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
            if (slackToken) {
              await fetch("https://slack.com/api/chat.postMessage", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${slackToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  channel: event.channel,
                  thread_ts: event.ts,
                  text: response,
                }),
              });
            }
          }
        }

        return new Response(
          JSON.stringify({ ok: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown request type" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
    }
  } catch (error) {
    console.error("Slack bot error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
