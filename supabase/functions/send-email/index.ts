// Send Email Function
// Processes queued emails and sends them via Resend

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const isAuthorizedRequest = async (req: Request): Promise<boolean> => {
  const internalSecret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (internalSecret && req.headers.get("x-internal-secret") === internalSecret) {
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
  )?.toString().toLowerCase();
  const isTeamRole = role === "team" || role === "admin" || role === "owner";
  return isTeamRole;
};

// Email templates
const templates: Record<string, { subject: string; getBody: (data: any) => string }> = {
  welcome: {
    subject: "Welcome to DeFyb - Let's Transform Your Practice",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 28px; margin: 0 0 16px;">Welcome to DeFyb</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Thank you for your interest in transforming ${data.practice_name || "your practice"}.
            We've received your information and our team will be reaching out within 24 hours to schedule your free assessment.
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            In the meantime, here's what you can expect:
          </p>
          <ul style="color: #8b8f9a; line-height: 1.8;">
            <li>A personalized assessment of your practice's AI readiness</li>
            <li>ROI projections based on your specific situation</li>
            <li>A clear roadmap for implementation</li>
          </ul>
          <p style="color: #e2e4e9; margin-top: 24px;">
            Questions? Reply to this email or call us at (555) 123-4567.
          </p>
          <p style="color: #e8762b; font-weight: 600; margin-top: 24px;">
            — The DeFyb Team
          </p>
        </div>
      </div>
    `,
  },

  quote_sent: {
    subject: "Your DeFyb Quote is Ready",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 28px; margin: 0 0 16px;">Your Quote is Ready</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            We've prepared a customized quote for ${data.practice_name || "your practice"}.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #8b8f9a;">Implementation Fee:</span>
              <span style="color: #e2e4e9; font-weight: 600;">$${data.implementation_fee?.toLocaleString() || "TBD"}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
              <span style="color: #8b8f9a;">Monthly Managed:</span>
              <span style="color: #e2e4e9; font-weight: 600;">$${data.monthly_fee?.toLocaleString() || "TBD"}/mo</span>
            </div>
            <div style="border-top: 1px solid #e8762b; padding-top: 12px; margin-top: 12px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: #e8762b; font-weight: 600;">First Year Value:</span>
                <span style="color: #34d399; font-size: 20px; font-weight: 600;">$${data.total_value?.toLocaleString() || "TBD"}</span>
              </div>
            </div>
          </div>
          <p style="color: #8b8f9a; line-height: 1.6;">
            This quote is valid for 30 days. Ready to move forward? Reply to this email or schedule a call with us.
          </p>
          <a href="${data.quote_url || "#"}" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            View Full Quote
          </a>
        </div>
      </div>
    `,
  },

  payment_received: {
    subject: "Payment Received - Thank You!",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #34d399; font-size: 28px; margin: 0 0 16px;">Payment Received</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Thank you for your payment of <strong style="color: #34d399;">$${data.amount?.toLocaleString() || "0"}</strong>.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #8b8f9a; margin: 0;">
              <strong style="color: #e2e4e9;">Payment Type:</strong> ${data.payment_type || "Invoice"}<br>
              <strong style="color: #e2e4e9;">Date:</strong> ${new Date().toLocaleDateString()}<br>
              <strong style="color: #e2e4e9;">Reference:</strong> ${data.reference || "N/A"}
            </p>
          </div>
          <p style="color: #8b8f9a; line-height: 1.6;">
            ${data.next_steps || "Our team will be in touch about next steps."}
          </p>
          <p style="color: #e8762b; font-weight: 600; margin-top: 24px;">
            — The DeFyb Team
          </p>
        </div>
      </div>
    `,
  },

  stage_change: {
    subject: "Update on Your DeFyb Transformation",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 28px; margin: 0 0 16px;">Progress Update</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Great news! Your practice has moved to the <strong style="color: #e8762b;">${data.stage || "next"}</strong> stage.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #e2e4e9; font-weight: 600; margin: 0 0 8px;">${data.title || "Stage Update"}</p>
            <p style="color: #8b8f9a; margin: 0;">${data.message || "We're making progress on your transformation."}</p>
          </div>
          <a href="${data.portal_url || "https://de-fyb.vercel.app"}" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            View in Portal
          </a>
        </div>
      </div>
    `,
  },

  scorecard: {
    subject: "Your Monthly Practice Scorecard",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 28px; margin: 0 0 16px;">Monthly Scorecard</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Here's your monthly practice health report for ${data.practice_name || "your practice"}.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <div style="font-size: 48px; color: ${data.health_score >= 80 ? "#34d399" : data.health_score >= 60 ? "#f59e0b" : "#ef4444"}; font-weight: 600;">
              ${data.health_score || 0}
            </div>
            <div style="color: #8b8f9a; font-size: 14px;">Health Score</div>
          </div>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #34d399; font-size: 18px; font-weight: 600; margin: 0 0 12px;">
              Value Delivered This Month: $${data.monthly_value?.toLocaleString() || 0}
            </p>
            <p style="color: #8b8f9a; margin: 0;">
              Cumulative Value: $${data.total_value?.toLocaleString() || 0}
            </p>
          </div>
          <a href="${data.portal_url || "https://de-fyb.vercel.app"}" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            View Full Report
          </a>
        </div>
      </div>
    `,
  },

  // ============ ACTIVATION AGENT EMAILS ============

  activation_first_analysis: {
    subject: "Your first coding analysis is waiting",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 24px; margin: 0 0 16px;">Try your first encounter analysis</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            You signed up for DeFyb but haven't analyzed an encounter yet. Here's how it works:
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #e2e4e9; font-weight: 600; margin: 0 0 12px;">3 steps, 60 seconds:</p>
            <ol style="color: #8b8f9a; margin: 0; padding-left: 20px; line-height: 2;">
              <li>Paste any encounter note into the tool</li>
              <li>Get the recommended E/M code with rationale</li>
              <li>See exactly what revenue you may be missing</li>
            </ol>
          </div>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Most practices find their first undercoded encounter in the first try.
          </p>
          <a href="https://defyb.org" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Analyze Your First Encounter
          </a>
        </div>
      </div>
    `,
  },

  activation_repeat_usage: {
    subject: "You found something — keep going",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 24px; margin: 0 0 16px;">You've analyzed ${data.encounter_count} encounter${data.encounter_count !== 1 ? "s" : ""}</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            You've already run ${data.encounter_count} encounter${data.encounter_count !== 1 ? "s" : ""} through DeFyb. Practices that analyze 10+ encounters in their first week find consistent patterns — and that's where the real revenue recovery starts.
          </p>
          <div style="background: #34d39922; border-left: 4px solid #34d399; padding: 12px 16px; margin: 20px 0;">
            <p style="color: #34d399; font-weight: 600; margin: 0 0 4px;">Quick tip</p>
            <p style="color: #8b8f9a; margin: 0; font-size: 14px;">
              Try running a batch of 5 encounters from the same day. You'll see whether the pattern is provider-specific or practice-wide.
            </p>
          </div>
          <a href="https://defyb.org" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Continue Analyzing
          </a>
        </div>
      </div>
    `,
  },

  activation_conversion: {
    subject: "You've found ${data.estimated_recovery ? '$' + data.estimated_recovery.toLocaleString() : 'revenue'} in potential recovery",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #34d399; font-size: 24px; margin: 0 0 16px;">Your results so far</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            You've analyzed ${data.encounter_count} encounters. Here's what DeFyb has found:
          </p>
          <div style="background: #111318; padding: 24px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #8b8f9a; font-size: 12px; margin: 0 0 8px;">ESTIMATED ANNUAL RECOVERY</p>
            <p style="color: #34d399; font-size: 36px; font-weight: 600; margin: 0;">
              $${(data.estimated_recovery || 0).toLocaleString()}
            </p>
            <p style="color: #8b8f9a; font-size: 13px; margin: 8px 0 0;">
              Based on ${data.encounter_count} encounters analyzed
            </p>
          </div>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Upgrade to track this over time, get ongoing coding recommendations for every encounter, and start recovering that revenue consistently.
          </p>
          <a href="https://defyb.org" style="display: inline-block; background: #34d399; color: #0b0c0e; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Start Your Subscription
          </a>
          <p style="color: #8b8f9a; font-size: 13px; margin-top: 16px;">
            Starting at $299/provider/month. No implementation fee. Cancel anytime.
          </p>
        </div>
      </div>
    `,
  },

  // ============ UPSELL AGENT EMAILS ============

  upsell_claims: {
    subject: "Your encounter volume is ready for Claims AI",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 24px; margin: 0 0 16px;">Claims AI for ${data.practice_name || "your practice"}</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">Hi ${data.contact_name || "there"},</p>
          <p style="color: #8b8f9a; line-height: 1.6;">${data.reason}</p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Claims AI automates claim scrubbing, reduces denials, and catches errors before submission. At your volume, it pays for itself in avoided rework.
          </p>
          <div style="background: #111318; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #e8762b; font-size: 20px; font-weight: 600; margin: 0;">+$99/provider/month</p>
          </div>
          <a href="https://defyb.org" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Enable Claims AI
          </a>
        </div>
      </div>
    `,
  },

  upsell_prior_auth: {
    subject: "We found prior auth friction in your encounters",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 24px; margin: 0 0 16px;">Prior Auth Automation</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">Hi ${data.contact_name || "there"},</p>
          <p style="color: #8b8f9a; line-height: 1.6;">${data.reason}</p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Prior Auth Automation handles the back-and-forth with payers so your staff doesn't have to. Less phone time, faster approvals, fewer delays.
          </p>
          <div style="background: #111318; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #e8762b; font-size: 20px; font-weight: 600; margin: 0;">+$149/provider/month</p>
          </div>
          <a href="https://defyb.org" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Enable Prior Auth
          </a>
        </div>
      </div>
    `,
  },

  upsell_dme: {
    subject: "DME revenue opportunity detected",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 24px; margin: 0 0 16px;">DME Workflow</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">Hi ${data.contact_name || "there"},</p>
          <p style="color: #8b8f9a; line-height: 1.6;">${data.reason}</p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            The DME Workflow module helps you capture, track, and bill DME orders properly — closing a revenue gap most practices don't even realize they have.
          </p>
          <div style="background: #111318; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #e8762b; font-size: 20px; font-weight: 600; margin: 0;">+$199/provider/month</p>
          </div>
          <a href="https://defyb.org" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Enable DME Workflow
          </a>
        </div>
      </div>
    `,
  },

  upsell_scribe: {
    subject: "Connect your scribe to DeFyb",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 24px; margin: 0 0 16px;">Scribe Connector</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">Hi ${data.contact_name || "there"},</p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Connect your AI scribe (Suki, Ambience, HealOS, etc.) directly to DeFyb. Encounter notes flow in automatically — no more copy/paste.
          </p>
          <div style="background: #111318; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #e8762b; font-size: 20px; font-weight: 600; margin: 0;">+$49/provider/month</p>
          </div>
          <a href="https://defyb.org" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Enable Scribe Connector
          </a>
        </div>
      </div>
    `,
  },

  // ============ CHURN PREVENTION EMAILS ============

  churn_usage_drop: {
    subject: "We noticed you haven't analyzed encounters recently",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 24px; margin: 0 0 16px;">Everything okay?</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">Hi ${data.contact_name || "there"},</p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            It's been a while since ${data.practice_name || "your practice"} analyzed encounters in DeFyb. Every week without coding analysis is potential revenue left on the table.
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            If something isn't working or you need help, just reply to this email. We're here.
          </p>
          <a href="https://defyb.org" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Resume Analyzing
          </a>
        </div>
      </div>
    `,
  },

  churn_inactive: {
    subject: "Your DeFyb account misses you",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #e8762b; font-size: 24px; margin: 0 0 16px;">It's been a while</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">Hi ${data.contact_name || "there"},</p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            You haven't logged in to DeFyb recently. Your coding intelligence is still running — here's what you might be missing.
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Need help with anything? Want a quick walkthrough of new features? Reply here and we'll set something up.
          </p>
          <a href="https://defyb.org" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Log In
          </a>
        </div>
      </div>
    `,
  },

  invoice_overdue: {
    subject: "Payment Reminder - Action Required",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <h1 style="color: #ef4444; font-size: 28px; margin: 0 0 16px;">Payment Reminder</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            This is a friendly reminder that your invoice of <strong style="color: #ef4444;">$${data.amount?.toLocaleString() || 0}</strong> is ${data.days_overdue || 0} days overdue.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #8b8f9a; margin: 0;">
              <strong style="color: #e2e4e9;">Invoice #:</strong> ${data.invoice_number || "N/A"}<br>
              <strong style="color: #e2e4e9;">Due Date:</strong> ${data.due_date || "N/A"}<br>
              <strong style="color: #e2e4e9;">Amount:</strong> $${data.amount?.toLocaleString() || 0}
            </p>
          </div>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Please process this payment at your earliest convenience. If you have any questions or need to discuss payment arrangements, please reach out.
          </p>
          <a href="${data.payment_url || "#"}" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            Pay Now
          </a>
        </div>
      </div>
    `,
  },

  // ============ PILOT CHECK-IN EMAILS ============

  pilot_week1: {
    subject: "Week 1 Pilot Check-In - Scribe Selection",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <span style="font-size: 24px;">🎯</span>
            <h1 style="color: #60a5fa; font-size: 24px; margin: 0;">Week 1: Scribe Selection</h1>
          </div>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Welcome to Week 1 of your DeFyb pilot! This week, we're focused on selecting and setting up your AI scribe.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #e2e4e9; font-weight: 600; margin: 0 0 12px;">This Week's Goals:</p>
            <ul style="color: #8b8f9a; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Select your AI scribe vendor (${data.scribe_vendor || "to be determined"})</li>
              <li>Create your account</li>
              <li>Install the mobile app on your device</li>
              <li>Generate your first test note</li>
            </ul>
          </div>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Your DeFyb team will be in touch to help with any questions. Track your progress in the portal!
          </p>
          <a href="${data.portal_url || "https://defyb.org"}" style="display: inline-block; background: #60a5fa; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            View Pilot Progress
          </a>
        </div>
      </div>
    `,
  },

  pilot_week2: {
    subject: "Week 2 Pilot Check-In - EHR Integration",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <span style="font-size: 24px;">🔗</span>
            <h1 style="color: #f59e0b; font-size: 24px; margin: 0;">Week 2: EHR Integration</h1>
          </div>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Congrats on completing Week 1! Now we're connecting your AI scribe to ${data.ehr || "your EHR"} so notes flow seamlessly into patient charts.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #e2e4e9; font-weight: 600; margin: 0 0 12px;">This Week's Goals:</p>
            <ul style="color: #8b8f9a; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Complete EHR integration setup</li>
              <li>Sync a test patient note to the EHR</li>
              <li>Configure your preferred note templates</li>
              <li>Test the complete workflow</li>
            </ul>
          </div>
          <div style="background: #f59e0b22; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 20px 0;">
            <p style="color: #f59e0b; font-weight: 600; margin: 0 0 4px;">Pro Tip</p>
            <p style="color: #8b8f9a; margin: 0; font-size: 14px;">
              Start with your most common visit type when configuring templates. We can add more as you get comfortable.
            </p>
          </div>
          <a href="${data.portal_url || "https://defyb.org"}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            View Pilot Progress
          </a>
        </div>
      </div>
    `,
  },

  pilot_week3: {
    subject: "Week 3 Pilot Check-In - Full-Day Pilot",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <span style="font-size: 24px;">🚀</span>
            <h1 style="color: #34d399; font-size: 24px; margin: 0;">Week 3: Full-Day Pilot</h1>
          </div>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            This is the big week! You'll use your AI scribe for a full day of patients. We'll be available for support throughout.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #e2e4e9; font-weight: 600; margin: 0 0 12px;">This Week's Goals:</p>
            <ul style="color: #8b8f9a; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Complete a full clinic day using AI documentation</li>
              <li>Track time saved per encounter</li>
              <li>Note any adjustments needed</li>
              <li>Gather your initial impressions</li>
            </ul>
          </div>
          <div style="background: #34d39922; border-left: 4px solid #34d399; padding: 12px 16px; margin: 20px 0;">
            <p style="color: #34d399; font-weight: 600; margin: 0 0 4px;">What to Watch For</p>
            <p style="color: #8b8f9a; margin: 0; font-size: 14px;">
              How much time are you saving? Are notes complete on first pass? Any workflow friction points?
            </p>
          </div>
          ${data.pilot_date ? `
          <div style="background: #60a5fa22; padding: 12px 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #8b8f9a; margin: 0 0 4px; font-size: 12px;">SCHEDULED PILOT DAY</p>
            <p style="color: #60a5fa; font-size: 18px; font-weight: 600; margin: 0;">${data.pilot_date}</p>
          </div>
          ` : ""}
          <a href="${data.portal_url || "https://defyb.org"}" style="display: inline-block; background: #34d399; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            View Pilot Progress
          </a>
        </div>
      </div>
    `,
  },

  pilot_week4: {
    subject: "Week 4 Pilot Check-In - Coding Analysis & Decision",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <span style="font-size: 24px;">📊</span>
            <h1 style="color: #e8762b; font-size: 24px; margin: 0;">Week 4: Analysis & Decision</h1>
          </div>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Final week! We're analyzing your pilot results and preparing the go/no-go decision meeting.
          </p>
          <div style="background: #111318; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #e2e4e9; font-weight: 600; margin: 0 0 12px;">This Week's Goals:</p>
            <ul style="color: #8b8f9a; margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>Complete coding analysis of pilot notes</li>
              <li>Identify E/M coding uplift opportunities</li>
              <li>Calculate projected annual ROI</li>
              <li>Make go/no-go decision together</li>
            </ul>
          </div>
          ${data.time_saved ? `
          <div style="background: #34d39922; padding: 16px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <p style="color: #8b8f9a; margin: 0 0 8px; font-size: 12px;">PRELIMINARY RESULTS</p>
            <p style="color: #34d399; font-size: 24px; font-weight: 600; margin: 0;">${data.time_saved} saved per patient</p>
          </div>
          ` : ""}
          <p style="color: #8b8f9a; line-height: 1.6;">
            We'll schedule a brief call this week to review results and discuss next steps.
          </p>
          <a href="${data.portal_url || "https://defyb.org"}" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            View Full Results
          </a>
        </div>
      </div>
    `,
  },

  pilot_complete: {
    subject: "Pilot Complete - Your Results Are In!",
    getBody: (data) => `
      <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0b0c0e; padding: 24px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">🎉</span>
          </div>
          <h1 style="color: #34d399; font-size: 28px; margin: 0 0 16px; text-align: center;">Pilot Complete!</h1>
          <p style="color: #e2e4e9; line-height: 1.6;">
            Hi ${data.contact_name || "there"},
          </p>
          <p style="color: #8b8f9a; line-height: 1.6;">
            Congratulations on completing your 4-week DeFyb pilot! Here's a summary of your results:
          </p>
          <div style="background: #111318; padding: 24px; border-radius: 8px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; text-align: center;">
              <div>
                <p style="color: #8b8f9a; font-size: 12px; margin: 0 0 4px;">TIME SAVED</p>
                <p style="color: #60a5fa; font-size: 24px; font-weight: 600; margin: 0;">${data.time_saved || "—"}</p>
              </div>
              <div>
                <p style="color: #8b8f9a; font-size: 12px; margin: 0 0 4px;">NOTES GENERATED</p>
                <p style="color: #34d399; font-size: 24px; font-weight: 600; margin: 0;">${data.notes_count || "—"}</p>
              </div>
            </div>
            ${data.decision ? `
            <div style="border-top: 1px solid #2a2e38; margin-top: 16px; padding-top: 16px; text-align: center;">
              <p style="color: #8b8f9a; font-size: 12px; margin: 0 0 8px;">DECISION</p>
              <p style="color: ${data.decision === "go" ? "#34d399" : data.decision === "conditional" ? "#f59e0b" : "#ef4444"}; font-size: 20px; font-weight: 600; margin: 0;">
                ${data.decision === "go" ? "GO - Proceeding to Full Implementation" :
                  data.decision === "conditional" ? "CONDITIONAL - Proceeding with Adjustments" :
                  "NO GO"}
              </p>
            </div>
            ` : ""}
          </div>
          <p style="color: #8b8f9a; line-height: 1.6;">
            ${data.decision === "go" ?
              "We're excited to move forward with full implementation! Your DeFyb team will be in touch to discuss next steps." :
              data.decision === "conditional" ?
              "We've identified some adjustments to make before full rollout. Let's discuss the path forward." :
              "Thank you for piloting with us. We'll follow up to discuss your feedback and any future opportunities."}
          </p>
          <a href="${data.portal_url || "https://defyb.org"}" style="display: inline-block; background: #e8762b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">
            View Full Report
          </a>
        </div>
      </div>
    `,
  },
};

serve(async (req) => {
  // Handle CORS preflight
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
    const { email_id, template, recipient, data } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    // Get template
    const emailTemplate = templates[template];
    if (!emailTemplate) {
      throw new Error(`Unknown template: ${template}`);
    }

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DeFyb <torey@defyb.org>",
        to: [recipient],
        subject: emailTemplate.subject,
        html: emailTemplate.getBody(data),
      }),
    });

    const result = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(result.message || "Failed to send email");
    }

    // Update email log if email_id provided
    if (email_id) {
      await supabase
        .from("email_log")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_id: result.id,
        })
        .eq("id", email_id);
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
