import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      .select("id, requester_user_id, requester_email, status")
      .eq("id", claimRequestId)
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claim) throw new Error("Claim request not found");

    const role = (
      authData.user.app_metadata?.role ||
      authData.user.user_metadata?.role ||
      authData.user.user_metadata?.user_role
    )?.toString().toLowerCase() || "";
    const isTeamRole = role === "team" || role === "admin" || role === "owner";
    const isRequester = claim.requester_user_id === authData.user.id;
    if (!isTeamRole && !isRequester) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (claim.status !== "approved") {
      return new Response(JSON.stringify({ ok: false, reason: "claim_not_approved" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claim.requester_user_id;
    const email = claim.requester_email || authData.user.email || "";
    if (!userId || !email) throw new Error("Missing requester identity");

    const { error: upsertError } = await adminClient
      .from("billing_profiles")
      .upsert({
        user_id: userId,
        email,
        billing_status: "trialing",
        plan_code: "baseline_299",
        implementation_enabled: false,
        licensed_provider_count: 1,
        active_provider_count: 1,
        monthly_amount: 299,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ ok: true, activated: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
