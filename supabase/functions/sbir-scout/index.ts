// SBIR Scout Agent
// Scans SBIR.gov for open solicitations matching Totem's focus areas
// Schedule: weekly via pg_cron (Mondays)
//
// Posts matching topics to Slack with direct links and relevance notes

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

// Keywords that signal relevance to Totem's epistemic grounding focus
const TOTEM_KEYWORDS = [
  "ai safety", "artificial intelligence safety",
  "autonomous systems", "autonomous weapon",
  "trusted ai", "trustworthy ai", "trust in ai",
  "ai assurance", "ai verification", "ai validation",
  "human-ai teaming", "human-machine teaming", "human machine",
  "explainable ai", "explainability", "xai",
  "ai reasoning", "reasoning chain", "reasoning assurance",
  "epistemic", "grounding", "provenance",
  "decision support", "autonomous decision",
  "ai risk", "ai governance",
  "unmanned systems", "unmanned aerial",
  "uas", "uav", "drone",
  "kill chain", "targeting",
  "ai ethics", "responsible ai",
  "machine autonomy", "autonomous operation",
];

// Agencies most relevant to Totem
const TARGET_AGENCIES = ["dod", "air force", "army", "navy", "darpa", "dhs", "socom", "afrl"];

interface SBIRTopic {
  title: string;
  agency: string;
  topicNumber: string;
  description: string;
  closeDate: string;
  url: string;
  matchedKeywords: string[];
  relevanceScore: number;
}

// ============================================================
// SBIR.GOV SCANNING
// ============================================================

const scanSBIRGov = async (): Promise<SBIRTopic[]> => {
  const topics: SBIRTopic[] = [];

  // SBIR.gov has a public API for searching topics
  // https://www.sbir.gov/api/solicitations.json
  try {
    const response = await fetch(
      "https://www.sbir.gov/api/solicitations.json?keyword=artificial+intelligence&rows=50",
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      console.log(`SBIR.gov API returned ${response.status}, trying alternate approach`);
      return await scanSBIRAlternate();
    }

    const data = await response.json();
    const solicitations = Array.isArray(data) ? data : data?.results || data?.solicitations || [];

    for (const sol of solicitations) {
      const title = (sol.solicitation_title || sol.title || "").toLowerCase();
      const description = (sol.solicitation_description || sol.description || "").toLowerCase();
      const agency = (sol.agency || sol.branch || "").toLowerCase();
      const combined = `${title} ${description}`;

      const matchedKeywords = TOTEM_KEYWORDS.filter((kw) => combined.includes(kw));

      if (matchedKeywords.length >= 2) {
        const agencyBoost = TARGET_AGENCIES.some((a) => agency.includes(a)) ? 2 : 0;
        const relevanceScore = matchedKeywords.length + agencyBoost;

        topics.push({
          title: sol.solicitation_title || sol.title || "Unknown",
          agency: sol.agency || sol.branch || "Unknown",
          topicNumber: sol.solicitation_number || sol.topic_number || sol.id || "",
          description: (sol.solicitation_description || sol.description || "").slice(0, 500),
          closeDate: sol.close_date || sol.deadline || "TBD",
          url: sol.solicitation_url || sol.url || `https://www.sbir.gov/node/${sol.id || ""}`,
          matchedKeywords,
          relevanceScore,
        });
      }
    }
  } catch (error) {
    console.error("SBIR.gov scan error:", error);
    return await scanSBIRAlternate();
  }

  return topics.sort((a, b) => b.relevanceScore - a.relevanceScore);
};

const scanSBIRAlternate = async (): Promise<SBIRTopic[]> => {
  // Fallback: scan known SBIR listing pages
  const sources = [
    "https://www.sbir.gov/api/solicitations.json?keyword=autonomous+systems&rows=30",
    "https://www.sbir.gov/api/solicitations.json?keyword=ai+safety&rows=30",
    "https://www.sbir.gov/api/solicitations.json?keyword=trusted+ai&rows=30",
  ];

  const topics: SBIRTopic[] = [];
  const seenIds = new Set<string>();

  for (const sourceUrl of sources) {
    try {
      const response = await fetch(sourceUrl, { headers: { Accept: "application/json" } });
      if (!response.ok) continue;

      const data = await response.json();
      const solicitations = Array.isArray(data) ? data : data?.results || [];

      for (const sol of solicitations) {
        const id = sol.solicitation_number || sol.id || sol.title;
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const combined = `${sol.solicitation_title || ""} ${sol.solicitation_description || ""}`.toLowerCase();
        const matchedKeywords = TOTEM_KEYWORDS.filter((kw) => combined.includes(kw));

        if (matchedKeywords.length >= 1) {
          topics.push({
            title: sol.solicitation_title || sol.title || "Unknown",
            agency: sol.agency || "Unknown",
            topicNumber: sol.solicitation_number || "",
            description: (sol.solicitation_description || "").slice(0, 500),
            closeDate: sol.close_date || "TBD",
            url: sol.solicitation_url || `https://www.sbir.gov`,
            matchedKeywords,
            relevanceScore: matchedKeywords.length,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return topics.sort((a, b) => b.relevanceScore - a.relevanceScore);
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
    const topics = await scanSBIRGov();

    await supabase.from("agent_runs").insert({
      agent_name: "sbir_scout",
      action: "weekly_scan",
      result: { topics_found: topics.length, top_matches: topics.slice(0, 5) },
    });

    if (topics.length > 0) {
      const topTopics = topics.slice(0, 5);

      const blocks: unknown[] = [
        {
          type: "header",
          text: { type: "plain_text", text: "🔭 SBIR Scout — Weekly Scan", emoji: true },
        },
        {
          type: "context",
          elements: [{
            type: "mrkdwn",
            text: `_Found ${topics.length} potentially relevant solicitation${topics.length !== 1 ? "s" : ""} for Totem_`,
          }],
        },
      ];

      for (const topic of topTopics) {
        blocks.push(
          { type: "divider" },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `*${topic.title}*\n` +
                `Agency: ${topic.agency} | Topic: ${topic.topicNumber}\n` +
                `Deadline: ${topic.closeDate}\n` +
                `Keywords: ${topic.matchedKeywords.join(", ")}\n` +
                `Relevance: ${"⭐".repeat(Math.min(topic.relevanceScore, 5))}`,
            },
            accessory: topic.url
              ? {
                  type: "button",
                  text: { type: "plain_text", text: "View", emoji: true },
                  url: topic.url,
                }
              : undefined,
          },
        );
      }

      if (topics.length > 5) {
        blocks.push({
          type: "context",
          elements: [{ type: "mrkdwn", text: `_...and ${topics.length - 5} more. Check agent_runs for full list._` }],
        });
      }

      await postToSlack(blocks, `SBIR Scout: ${topics.length} topics found for Totem`);
    } else {
      await postToSlack(
        [{ type: "section", text: { type: "mrkdwn", text: "🔭 SBIR Scout: No new matching solicitations this week." } }],
        "SBIR Scout: No matches this week",
      );
    }

    return new Response(
      JSON.stringify({ success: true, topics_found: topics.length, topics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("SBIR scout error:", error);

    await supabase.from("agent_runs").insert({
      agent_name: "sbir_scout",
      action: "weekly_scan",
      error: error.message,
    });

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
