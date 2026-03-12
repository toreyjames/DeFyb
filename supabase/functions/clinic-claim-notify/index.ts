import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const renderSubmittedEmail = (payload: {
  clinicName: string;
  ownerEmail: string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  notes?: string | null;
}) => ({
  subject: `Clinic claim request: ${payload.clinicName}`,
  html: `
    <div style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto;">
      <h2>New clinic claim request</h2>
      <p>A provider started a provisional workspace and requested clinic ownership approval.</p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Clinic</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.clinicName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Owner/Admin Email</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.ownerEmail}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Requester</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.requesterName || "Unknown"} (${payload.requesterEmail || "Unknown"})</td></tr>
        <tr><td style="padding: 8px;"><strong>Notes</strong></td><td style="padding: 8px;">${payload.notes || "None"}</td></tr>
      </table>
      <p style="margin-top: 16px;">Review this request in TEAM dashboard.</p>
    </div>
  `,
});

const renderDecisionEmail = (payload: {
  clinicName: string;
  ownerEmail: string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  status: "approved" | "rejected";
}) => {
  const approved = payload.status === "approved";
  return {
    subject: approved
      ? `Clinic claim approved: ${payload.clinicName}`
      : `Clinic claim update: ${payload.clinicName}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 620px; margin: 0 auto;">
        <h2>${approved ? "Clinic claim approved" : "Clinic claim was not approved"}</h2>
        <p>
          Clinic: <strong>${payload.clinicName}</strong><br>
          Owner/Admin: <strong>${payload.ownerEmail}</strong><br>
          Requester: <strong>${payload.requesterName || "Unknown"} (${payload.requesterEmail || "Unknown"})</strong>
        </p>
        <p>
          ${approved
            ? "The provisional workspace can now be treated as a full clinic-owned workspace."
            : "Please review owner/admin details and submit a corrected claim request if needed."}
        </p>
      </div>
    `,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !resendApiKey) {
      throw new Error("Function environment is not configured");
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

    const body = await req.json();
    const event = (body?.event || "").toString();
    const clinicName = (body?.clinicName || "").toString().trim();
    const ownerEmail = (body?.ownerEmail || "").toString().trim().toLowerCase();
    const requesterName = (body?.requesterName || "").toString().trim() || null;
    const requesterEmail = (body?.requesterEmail || "").toString().trim() || null;
    const notes = (body?.notes || "").toString().trim() || null;
    const status = (body?.status || "").toString().toLowerCase();

    if (!clinicName || !ownerEmail || !ownerEmail.includes("@")) {
      throw new Error("Clinic name and owner email are required");
    }

    let emailPayload: { subject: string; html: string };
    let to: string[] = ["torey@defyb.org"];
    if (event === "submitted") {
      emailPayload = renderSubmittedEmail({
        clinicName,
        ownerEmail,
        requesterName,
        requesterEmail,
        notes,
      });
      to = Array.from(new Set([...to, ownerEmail]));
    } else if (event === "decision" && (status === "approved" || status === "rejected")) {
      emailPayload = renderDecisionEmail({
        clinicName,
        ownerEmail,
        requesterName,
        requesterEmail,
        status,
      });
      to = Array.from(new Set([...to, ownerEmail, ...(requesterEmail ? [requesterEmail] : [])]));
    } else {
      throw new Error("Unsupported event type");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "DeFyb <onboarding@resend.dev>",
        to,
        subject: emailPayload.subject,
        html: emailPayload.html,
      }),
    });

    const result = await emailResponse.json().catch(() => ({}));
    if (!emailResponse.ok) {
      throw new Error(result?.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
