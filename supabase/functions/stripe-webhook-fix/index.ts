import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bootstrap-token",
};

const REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

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
  if (!resp.ok) throw new Error(data?.error?.message || `Stripe request failed: ${path}`);
  return data;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  const expectedToken = Deno.env.get("STRIPE_BOOTSTRAP_TOKEN");
  const token = req.headers.get("x-bootstrap-token") || "";
  if (!expectedToken || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 401,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const endpointUrl = `${supabaseUrl}/functions/v1/stripe-webhook`;
    const list = await stripeRequest("webhook_endpoints?limit=100", undefined, "GET");
    const endpoint = (list?.data || []).find((ep: any) => ep?.url === endpointUrl);
    if (!endpoint?.id) throw new Error(`Webhook endpoint not found for ${endpointUrl}`);

    const params = new URLSearchParams();
    REQUIRED_WEBHOOK_EVENTS.forEach((ev, idx) => params.set(`enabled_events[${idx}]`, ev));
    const updated = await stripeRequest(`webhook_endpoints/${endpoint.id}`, params, "POST");

    return new Response(JSON.stringify({
      ok: true,
      endpoint_id: endpoint.id,
      url: endpointUrl,
      enabled_events: updated?.enabled_events || [],
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
