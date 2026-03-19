// Retention Scrub Function
// Purges expired PHI (raw encounter notes) per the 90-day retention policy.
// Schedule via pg_cron or external scheduler (e.g. Vercel cron, daily).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const isAuthorizedRequest = async (req: Request): Promise<boolean> => {
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (
    internalSecret &&
    req.headers.get("x-internal-secret") === internalSecret
  ) {
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
  )
    ?.toString()
    .toLowerCase();
  return role === "team" || role === "admin" || role === "owner";
};

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const retentionDays = Number(
      new URL(req.url).searchParams.get("days") || "90",
    );

    console.log(
      `Running retention scrub (retention_days=${retentionDays})...`,
    );

    const { data, error } = await supabase.rpc("scrub_expired_notes", {
      retention_days: retentionDays,
    });

    if (error) throw error;

    const scrubbed = Number(data ?? 0);
    console.log(`Retention scrub complete. ${scrubbed} note(s) scrubbed.`);

    return new Response(
      JSON.stringify({
        success: true,
        scrubbed_count: scrubbed,
        retention_days: retentionDays,
        executed_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Retention scrub error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
