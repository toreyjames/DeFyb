import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CheckoutRequest = {
  origin?: string;
  includeImplementation?: boolean;
  selectedAddons?: string[];
  practiceId?: string;
  providerCount?: number;
};

const ADDON_PRICE_ENV_MAP: Record<string, { monthly: string; setup: string }> = {
  claims: {
    monthly: "STRIPE_ADDON_CLAIMS_MONTHLY_PRICE_ID",
    setup: "STRIPE_ADDON_CLAIMS_SETUP_PRICE_ID",
  },
  prior_auth: {
    monthly: "STRIPE_ADDON_PRIOR_AUTH_MONTHLY_PRICE_ID",
    setup: "STRIPE_ADDON_PRIOR_AUTH_SETUP_PRICE_ID",
  },
  dme: {
    monthly: "STRIPE_ADDON_DME_MONTHLY_PRICE_ID",
    setup: "STRIPE_ADDON_DME_SETUP_PRICE_ID",
  },
  scribe_connector: {
    monthly: "STRIPE_ADDON_SCRIBE_CONNECTOR_MONTHLY_PRICE_ID",
    setup: "STRIPE_ADDON_SCRIBE_CONNECTOR_SETUP_PRICE_ID",
  },
};

const coreRateForProviderCount = (providerCount: number) => {
  if (providerCount >= 21) return 249;
  if (providerCount >= 6) return 279;
  return 299;
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
    const selectedAddons = Array.isArray(payload.selectedAddons)
      ? payload.selectedAddons.filter(Boolean).slice(0, 8)
      : [];
    const providerCount = Math.max(1, Math.min(200, Number(payload.providerCount || 1)));
    const origin = payload.origin?.startsWith("http") ? payload.origin : "https://defyb.org";

    const corePriceTier1To5 = Deno.env.get("STRIPE_CORE_1_5_PRICE_ID");
    const corePriceTier6To20 = Deno.env.get("STRIPE_CORE_6_20_PRICE_ID");
    const corePriceTier21Plus = Deno.env.get("STRIPE_CORE_21_PLUS_PRICE_ID");
    const platformMinimumPriceId = Deno.env.get("STRIPE_PLATFORM_MINIMUM_PRICE_ID");

    const baselinePriceId = Deno.env.get("STRIPE_BASELINE_PRICE_ID");
    const implementationPriceId = Deno.env.get("STRIPE_IMPLEMENTATION_PRICE_ID");
    const additionalProviderPriceId = Deno.env.get("STRIPE_ADDITIONAL_PROVIDER_PRICE_ID");

    const hasTieredCorePrices = Boolean(corePriceTier1To5 && corePriceTier6To20 && corePriceTier21Plus);
    if (!hasTieredCorePrices && !baselinePriceId) {
      throw new Error("Stripe core pricing is not configured");
    }
    if (includeImplementation && !implementationPriceId) {
      throw new Error("Implementation fee is not configured yet. Contact support.");
    }
    if (!hasTieredCorePrices && providerCount > 1 && !additionalProviderPriceId) {
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

    let lineIdx = 0;
    if (hasTieredCorePrices) {
      const tieredCorePriceId = providerCount >= 21
        ? corePriceTier21Plus
        : providerCount >= 6
          ? corePriceTier6To20
          : corePriceTier1To5;
      params.set(`line_items[${lineIdx}][price]`, String(tieredCorePriceId));
      params.set(`line_items[${lineIdx}][quantity]`, String(providerCount));
      lineIdx += 1;
      if (platformMinimumPriceId) {
        params.set(`line_items[${lineIdx}][price]`, platformMinimumPriceId);
        params.set(`line_items[${lineIdx}][quantity]`, "1");
        lineIdx += 1;
      }
    } else {
      const additionalProviders = Math.max(0, providerCount - 1);
      params.set(`line_items[${lineIdx}][price]`, String(baselinePriceId));
      params.set(`line_items[${lineIdx}][quantity]`, "1");
      lineIdx += 1;
      if (additionalProviders > 0 && additionalProviderPriceId) {
        params.set(`line_items[${lineIdx}][price]`, additionalProviderPriceId);
        params.set(`line_items[${lineIdx}][quantity]`, String(additionalProviders));
        lineIdx += 1;
      }
    }

    if (includeImplementation && implementationPriceId) {
      params.set(`line_items[${lineIdx}][price]`, implementationPriceId);
      params.set(`line_items[${lineIdx}][quantity]`, "1");
      lineIdx += 1;
    }

    for (const addonId of selectedAddons) {
      const envNames = ADDON_PRICE_ENV_MAP[addonId];
      if (!envNames) continue;
      const monthlyPriceId = Deno.env.get(envNames.monthly);
      const setupPriceId = Deno.env.get(envNames.setup);
      if (!monthlyPriceId || !setupPriceId) {
        throw new Error(`Stripe add-on pricing not configured for: ${addonId}`);
      }

      params.set(`line_items[${lineIdx}][price]`, monthlyPriceId);
      params.set(`line_items[${lineIdx}][quantity]`, String(providerCount));
      lineIdx += 1;

      params.set(`line_items[${lineIdx}][price]`, setupPriceId);
      params.set(`line_items[${lineIdx}][quantity]`, "1");
      lineIdx += 1;
    }

    params.set("success_url", `${origin}/tool?billing=success&session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/tool?billing=cancel`);
    params.set("allow_promotion_codes", "true");
    params.set("metadata[user_id]", user.id);
    params.set("metadata[include_implementation]", String(includeImplementation));
    params.set("metadata[provider_count]", String(providerCount));
    params.set("metadata[selected_addons]", selectedAddons.join(","));
    params.set("metadata[core_rate]", String(coreRateForProviderCount(providerCount)));
    params.set("metadata[platform_minimum]", "599");

    const session = await stripeRequest("checkout/sessions", params);

    const coreMonthly = Math.max(599, coreRateForProviderCount(providerCount) * providerCount);

    await userClient
      .from("billing_profiles")
      .upsert({
        user_id: user.id,
        email: user.email || "",
        stripe_customer_id: stripeCustomerId,
        implementation_enabled: includeImplementation,
        licensed_provider_count: providerCount,
        active_provider_count: providerCount,
        monthly_amount: coreMonthly,
        selected_addons: selectedAddons,
        addon_setup_pending: selectedAddons,
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
