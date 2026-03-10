import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CheckoutRequest = {
  origin?: string;
  includeImplementation?: boolean;
  practiceId?: string;
  providerCount?: number;
};

const stripeRequest = async (path: string, body?: URLSearchParams, method = "POST") => {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  const resp = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body?.toString(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Stripe request failed: ${path}`);
  }
  return data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const payload = (await req.json().catch(() => ({}))) as CheckoutRequest;
    const includeImplementation = !!payload.includeImplementation;
    const providerCount = Math.max(1, Math.min(200, Number(payload.providerCount || 1)));
    const additionalProviders = Math.max(0, providerCount - 1);
    const origin = payload.origin?.startsWith("http") ? payload.origin : "https://defyb.org";

    const baselinePriceId = Deno.env.get("STRIPE_BASELINE_PRICE_ID");
    const implementationPriceId = Deno.env.get("STRIPE_IMPLEMENTATION_PRICE_ID");
    const additionalProviderPriceId = Deno.env.get("STRIPE_ADDITIONAL_PROVIDER_PRICE_ID");
    if (!baselinePriceId) throw new Error("STRIPE_BASELINE_PRICE_ID is not configured");
    if (includeImplementation && !implementationPriceId) {
      throw new Error("Implementation fee is not configured yet. Contact support.");
    }
    if (additionalProviders > 0 && !additionalProviderPriceId) {
      throw new Error("Additional provider pricing is not configured yet. Contact support.");
    }

    const { data: existingProfile } = await userClient
      .from("billing_profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let stripeCustomerId = existingProfile?.stripe_customer_id || null;

    if (!stripeCustomerId) {
      const customerParams = new URLSearchParams();
      customerParams.set("email", user.email || "");
      customerParams.set("metadata[user_id]", user.id);
      customerParams.set("metadata[source]", "defyb");
      const customer = await stripeRequest("customers", customerParams);
      stripeCustomerId = customer.id;
    }

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("customer", stripeCustomerId);
    params.set("line_items[0][price]", baselinePriceId);
    params.set("line_items[0][quantity]", "1");

    let lineIdx = 1;
    if (additionalProviders > 0 && additionalProviderPriceId) {
      params.set(`line_items[${lineIdx}][price]`, additionalProviderPriceId);
      params.set(`line_items[${lineIdx}][quantity]`, String(additionalProviders));
      lineIdx += 1;
    }

    if (includeImplementation && implementationPriceId) {
      params.set(`line_items[${lineIdx}][price]`, implementationPriceId);
      params.set(`line_items[${lineIdx}][quantity]`, "1");
    }

    params.set("success_url", `${origin}/tool?billing=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/tool?billing=cancel`);
    params.set("allow_promotion_codes", "true");
    params.set("metadata[user_id]", user.id);
    params.set("metadata[include_implementation]", String(includeImplementation));
    params.set("metadata[provider_count]", String(providerCount));

    const session = await stripeRequest("checkout/sessions", params);

    await userClient
      .from("billing_profiles")
      .upsert({
        user_id: user.id,
        email: user.email || "",
        stripe_customer_id: stripeCustomerId,
        implementation_enabled: includeImplementation,
        licensed_provider_count: providerCount,
        active_provider_count: providerCount,
        monthly_amount: 299 + (additionalProviders * 199),
        updated_at: new Date().toISOString(),
      });

    // Optional practice linkage for reporting/legacy dashboard.
    if (payload.practiceId) {
      await userClient
        .from("practices")
        .update({ stripe_customer_id: stripeCustomerId, payment_status: "pending" })
        .eq("id", payload.practiceId);
    } else if (user.email) {
      await userClient
        .from("practices")
        .update({ stripe_customer_id: stripeCustomerId, payment_status: "pending" })
        .eq("contact_email", user.email)
        .is("stripe_customer_id", null);
    }

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
