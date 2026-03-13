import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-token",
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

const getPriceByLookupKey = async (lookupKey: string) => {
  const params = new URLSearchParams();
  params.set("lookup_keys[]", lookupKey);
  params.set("limit", "1");
  const result = await stripeRequest(`prices?${params.toString()}`, undefined, "GET");
  return result?.data?.[0] || null;
};

const ensureProduct = async (name: string, metadata: Record<string, string>) => {
  const params = new URLSearchParams();
  params.set("name", name);
  Object.entries(metadata).forEach(([k, v]) => params.set(`metadata[${k}]`, v));
  return stripeRequest("products", params);
};

const ensurePrice = async ({
  lookupKey,
  unitAmountCents,
  currency = "usd",
  recurringMonthly = false,
  productId,
}: {
  lookupKey: string;
  unitAmountCents: number;
  currency?: string;
  recurringMonthly?: boolean;
  productId: string;
}) => {
  const existing = await getPriceByLookupKey(lookupKey);
  if (existing) return existing;

  const params = new URLSearchParams();
  params.set("lookup_key", lookupKey);
  params.set("transfer_lookup_key", "true");
  params.set("unit_amount", String(unitAmountCents));
  params.set("currency", currency);
  params.set("product", productId);
  if (recurringMonthly) params.set("recurring[interval]", "month");
  return stripeRequest("prices", params);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") throw new Error("Method not allowed");
    const expectedToken = Deno.env.get("STRIPE_BOOTSTRAP_TOKEN");
    if (!expectedToken) throw new Error("STRIPE_BOOTSTRAP_TOKEN is not configured");
    const token = req.headers.get("x-bootstrap-token") || "";
    if (token !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const definitions = [
      { key: "STRIPE_CORE_1_5_PRICE_ID", productName: "DeFyb Core (1-5 providers)", lookup: "defyb_core_1_5_monthly_v1", amount: 29900, recurring: true },
      { key: "STRIPE_CORE_6_20_PRICE_ID", productName: "DeFyb Core (6-20 providers)", lookup: "defyb_core_6_20_monthly_v1", amount: 27900, recurring: true },
      { key: "STRIPE_CORE_21_PLUS_PRICE_ID", productName: "DeFyb Core (21+ providers)", lookup: "defyb_core_21_plus_monthly_v1", amount: 24900, recurring: true },
      { key: "STRIPE_PLATFORM_MINIMUM_PRICE_ID", productName: "DeFyb Platform Minimum", lookup: "defyb_platform_minimum_monthly_v1", amount: 59900, recurring: true },
      { key: "STRIPE_IMPLEMENTATION_PRICE_ID", productName: "DeFyb Core Implementation", lookup: "defyb_core_implementation_one_time_v1", amount: 250000, recurring: false },
      { key: "STRIPE_ADDON_CLAIMS_MONTHLY_PRICE_ID", productName: "DeFyb Add-on: Claims AI", lookup: "defyb_addon_claims_monthly_v1", amount: 9900, recurring: true },
      { key: "STRIPE_ADDON_CLAIMS_SETUP_PRICE_ID", productName: "DeFyb Add-on: Claims AI Setup", lookup: "defyb_addon_claims_setup_v1", amount: 75000, recurring: false },
      { key: "STRIPE_ADDON_PRIOR_AUTH_MONTHLY_PRICE_ID", productName: "DeFyb Add-on: Prior Auth Automation", lookup: "defyb_addon_prior_auth_monthly_v1", amount: 14900, recurring: true },
      { key: "STRIPE_ADDON_PRIOR_AUTH_SETUP_PRICE_ID", productName: "DeFyb Add-on: Prior Auth Setup", lookup: "defyb_addon_prior_auth_setup_v1", amount: 100000, recurring: false },
      { key: "STRIPE_ADDON_DME_MONTHLY_PRICE_ID", productName: "DeFyb Add-on: DME Workflow", lookup: "defyb_addon_dme_monthly_v1", amount: 19900, recurring: true },
      { key: "STRIPE_ADDON_DME_SETUP_PRICE_ID", productName: "DeFyb Add-on: DME Setup", lookup: "defyb_addon_dme_setup_v1", amount: 150000, recurring: false },
      { key: "STRIPE_ADDON_SCRIBE_CONNECTOR_MONTHLY_PRICE_ID", productName: "DeFyb Add-on: Scribe Connector", lookup: "defyb_addon_scribe_connector_monthly_v1", amount: 4900, recurring: true },
      { key: "STRIPE_ADDON_SCRIBE_CONNECTOR_SETUP_PRICE_ID", productName: "DeFyb Add-on: Scribe Connector Setup", lookup: "defyb_addon_scribe_connector_setup_v1", amount: 50000, recurring: false },
    ];

    const output: Record<string, string> = {};

    for (const item of definitions) {
      const product = await ensureProduct(item.productName, {
        source: "defyb-bootstrap",
        lookup_key: item.lookup,
      });
      const price = await ensurePrice({
        lookupKey: item.lookup,
        unitAmountCents: item.amount,
        recurringMonthly: item.recurring,
        productId: product.id,
      });
      output[item.key] = price.id;
    }

    return new Response(JSON.stringify({ ok: true, prices: output }), {
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
