import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-token",
};

const REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

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

const verifyToken = (req: Request) => {
  const expected = Deno.env.get("STRIPE_BOOTSTRAP_TOKEN");
  const got = req.headers.get("x-bootstrap-token") || "";
  return Boolean(expected && got && expected === got);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }
  if (!verifyToken(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const expectedWebhookUrl = `${supabaseUrl}/functions/v1/stripe-webhook`;

    const webhookList = await stripeRequest("webhook_endpoints?limit=100", undefined, "GET");
    const endpoints = Array.isArray(webhookList?.data) ? webhookList.data : [];
    const matchedEndpoint = endpoints.find((ep: any) => ep?.url === expectedWebhookUrl) || null;
    const enabledEvents: string[] = matchedEndpoint?.enabled_events || [];
    const missingEvents = REQUIRED_WEBHOOK_EVENTS.filter((ev) => !enabledEvents.includes(ev) && !enabledEvents.includes("*"));

    const core1to5 = Deno.env.get("STRIPE_CORE_1_5_PRICE_ID");
    const core6to20 = Deno.env.get("STRIPE_CORE_6_20_PRICE_ID");
    const core21plus = Deno.env.get("STRIPE_CORE_21_PLUS_PRICE_ID");
    const platformMinimum = Deno.env.get("STRIPE_PLATFORM_MINIMUM_PRICE_ID");
    const implementation = Deno.env.get("STRIPE_IMPLEMENTATION_PRICE_ID");
    if (!core1to5 || !core6to20 || !core21plus || !implementation) {
      throw new Error("Missing required core Stripe price IDs in secrets");
    }

    const providerCount = 6;
    const selectedAddons = ["claims", "prior_auth"];
    const corePriceId = core6to20;

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", corePriceId);
    params.set("line_items[0][quantity]", String(providerCount));
    let lineIdx = 1;
    if (platformMinimum) {
      params.set(`line_items[${lineIdx}][price]`, platformMinimum);
      params.set(`line_items[${lineIdx}][quantity]`, "1");
      lineIdx += 1;
    }
    params.set(`line_items[${lineIdx}][price]`, implementation);
    params.set(`line_items[${lineIdx}][quantity]`, "1");
    lineIdx += 1;

    for (const addonId of selectedAddons) {
      const env = ADDON_PRICE_ENV_MAP[addonId];
      const monthly = Deno.env.get(env.monthly);
      const setup = Deno.env.get(env.setup);
      if (!monthly || !setup) throw new Error(`Missing add-on Stripe IDs for ${addonId}`);
      params.set(`line_items[${lineIdx}][price]`, monthly);
      params.set(`line_items[${lineIdx}][quantity]`, String(providerCount));
      lineIdx += 1;
      params.set(`line_items[${lineIdx}][price]`, setup);
      params.set(`line_items[${lineIdx}][quantity]`, "1");
      lineIdx += 1;
    }

    params.set("success_url", "https://defyb.org/tool?billing=success");
    params.set("cancel_url", "https://defyb.org/tool?billing=cancel");
    params.set("allow_promotion_codes", "true");
    params.set("metadata[source]", "stripe_launch_audit");

    const session = await stripeRequest("checkout/sessions", params);
    const lineItems = await stripeRequest(`checkout/sessions/${session.id}/line_items?limit=100`, undefined, "GET");
    const lineSummary = (lineItems?.data || []).map((li: any) => ({
      description: li?.description,
      quantity: li?.quantity || 0,
      unit_amount: li?.price?.unit_amount || 0,
      amount_subtotal: li?.amount_subtotal || 0,
      recurring: Boolean(li?.price?.recurring),
      lookup_key: li?.price?.lookup_key || null,
      price_id: li?.price?.id || null,
    }));

    return new Response(JSON.stringify({
      ok: true,
      webhook: {
        expected_url: expectedWebhookUrl,
        matched: Boolean(matchedEndpoint),
        endpoint_id: matchedEndpoint?.id || null,
        enabled_events: enabledEvents,
        missing_required_events: missingEvents,
      },
      smoke_checkout: {
        session_id: session.id,
        mode: session.mode,
        currency: session.currency,
        amount_total: session.amount_total,
        amount_subtotal: session.amount_subtotal,
        line_items: lineSummary,
      },
    }), {
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
