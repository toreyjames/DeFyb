// Stripe Webhook Handler
// Handles payment events from Stripe

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const encoder = new TextEncoder();

const parseStripeSignature = (header: string) => {
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  return { timestamp, signatures };
};

const verifyStripeSignature = async (payload: string, header: string, secret: string) => {
  const { timestamp, signatures } = parseStripeSignature(header);
  if (!timestamp || signatures.length === 0) return false;

  // Stripe recommends a 5 minute tolerance window.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const expected = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");

  return signatures.includes(expected);
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const allowUnverified = Deno.env.get("ALLOW_UNVERIFIED_STRIPE_WEBHOOK") === "true";

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    if (!webhookSecret && !allowUnverified) {
      return new Response(JSON.stringify({ error: "STRIPE_WEBHOOK_SECRET is not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 503,
      });
    }

    if (webhookSecret) {
      const isValid = await verifyStripeSignature(body, signature, webhookSecret);
      if (!isValid) {
        return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        });
      }
    } else {
      console.warn("Processing unverified Stripe webhook because ALLOW_UNVERIFIED_STRIPE_WEBHOOK=true");
    }

    const event = JSON.parse(body);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer;
        const subscriptionId = session.subscription || null;
        const customerEmail = session.customer_details?.email || null;

        if (customerId && customerEmail) {
          const userId = session.metadata?.user_id;
          if (userId) {
            await supabase
              .from("billing_profiles")
              .upsert({
                user_id: userId,
                email: customerEmail,
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                billing_status: "active",
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id" });
          }

          await supabase
            .from("practices")
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              payment_status: "current",
            })
            .eq("contact_email", customerEmail);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;

        // Update payment record
        await supabase
          .from("payments")
          .update({
            status: "succeeded",
            paid_at: new Date().toISOString(),
            stripe_charge_id: paymentIntent.latest_charge,
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        // Get practice info
        const { data: payment } = await supabase
          .from("payments")
          .select("practice_id, type, amount")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .single();

        if (payment) {
          // Update practice payment status
          await supabase
            .from("practices")
            .update({
              payment_status: "current",
              last_payment_date: new Date().toISOString().split("T")[0],
            })
            .eq("id", payment.practice_id);

          // Create notification
          await supabase.from("notifications").insert({
            practice_id: payment.practice_id,
            user_type: "team",
            type: "payment_received",
            title: "Payment Received",
            message: `$${(payment.amount / 100).toLocaleString()} ${payment.type} payment received`,
          });

          // Log email to send
          await supabase.from("email_log").insert({
            practice_id: payment.practice_id,
            template: "payment_received",
            subject: "Payment Received - Thank You!",
            recipient: "", // Will be filled by email sender
            status: "queued",
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const { data: existingPayment } = await supabase
          .from("payments")
          .select("practice_id, retry_count")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .single();

        // Update payment record
        await supabase
          .from("payments")
          .update({
            status: "failed",
            failure_reason: paymentIntent.last_payment_error?.message,
            retry_count: (existingPayment?.retry_count || 0) + 1,
            last_retry_at: new Date().toISOString(),
          })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (existingPayment) {
          // Create team notification
          await supabase.from("notifications").insert({
            practice_id: existingPayment.practice_id,
            user_type: "team",
            type: "action_required",
            title: "Payment Failed",
            message: paymentIntent.last_payment_error?.message || "Payment could not be processed",
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;

        // Update payment record if exists
        await supabase
          .from("payments")
          .update({
            status: "succeeded",
            paid_at: new Date().toISOString(),
          })
          .eq("stripe_invoice_id", invoice.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        // Update practice payment status
        if (invoice.customer) {
          await supabase
            .from("practices")
            .update({ payment_status: "overdue" })
            .eq("stripe_customer_id", invoice.customer);

          await supabase
            .from("billing_profiles")
            .update({ billing_status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_customer_id", invoice.customer);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const subStatus = subscription.status || "active";

        // Update practice with subscription info
        await supabase
          .from("practices")
          .update({
            stripe_subscription_id: subscription.id,
            next_billing_date: new Date(subscription.current_period_end * 1000).toISOString().split("T")[0],
            monthly_rate: subscription.items.data[0]?.price?.unit_amount / 100,
            payment_status: subStatus === "past_due" ? "overdue" : "current",
          })
          .eq("stripe_customer_id", subscription.customer);

        await supabase
          .from("billing_profiles")
          .update({
            stripe_subscription_id: subscription.id,
            billing_status: subStatus,
            monthly_amount: (subscription.items.data[0]?.price?.unit_amount || 29900) / 100,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", subscription.customer);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        // Update practice
        await supabase
          .from("practices")
          .update({
            stripe_subscription_id: null,
            payment_status: "none",
          })
          .eq("stripe_customer_id", subscription.customer);

        await supabase
          .from("billing_profiles")
          .update({
            stripe_subscription_id: null,
            billing_status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_customer_id", subscription.customer);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
