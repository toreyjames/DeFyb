// Generate Report Function
// Creates scheduled reports (monthly scorecards, quarterly reviews, etc.)
// Schedule via pg_cron or external scheduler

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
    const { report_type, practice_id } = await req.json();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Generating ${report_type} report${practice_id ? ` for practice ${practice_id}` : ""}`);

    switch (report_type) {
      case "monthly_scorecards": {
        // Generate monthly scorecards for all managed practices
        const { data: practices, error } = await supabase
          .from("practices")
          .select("*")
          .eq("stage", "managed");

        if (error) throw error;

        const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

        for (const practice of practices || []) {
          // Create document record
          await supabase.from("documents").insert({
            practice_id: practice.id,
            type: "scorecard_monthly",
            title: `Monthly Scorecard - ${month}`,
            requires_signature: false,
          });

          // Create notification
          await supabase.from("notifications").insert({
            practice_id: practice.id,
            user_type: "client",
            type: "metric_update",
            title: "Monthly Scorecard Ready",
            message: `Your ${month} practice scorecard is now available in your portal.`,
          });

          // Queue email
          await supabase.from("email_log").insert({
            practice_id: practice.id,
            template: "scorecard",
            subject: "Your Monthly Practice Scorecard",
            recipient: practice.contact_email,
            status: "queued",
            metadata: {
              practice_name: practice.name,
              contact_name: practice.contact_name,
              health_score: practice.health_score,
              monthly_value: (practice.coding_uplift_monthly || 0) + (practice.revenue_recovered_monthly || 0),
              total_value: practice.total_value_delivered,
            },
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            generated: practices?.length || 0,
            type: "monthly_scorecards",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "quarterly_reviews": {
        // Generate QBR invites for practices due
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const { data: practices, error } = await supabase
          .from("practices")
          .select("*")
          .eq("stage", "managed")
          .or(`last_qbr_date.is.null,last_qbr_date.lt.${threeMonthsAgo.toISOString().split("T")[0]}`);

        if (error) throw error;

        for (const practice of practices || []) {
          // Create task for QBR
          await supabase.from("tasks").insert({
            practice_id: practice.id,
            title: "Schedule Quarterly Business Review",
            description: `QBR due for ${practice.name}. Last QBR: ${practice.last_qbr_date || "Never"}`,
            stage: "managed",
            priority: "high",
            auto_generated: true,
            trigger_event: "qbr_due",
          });

          // Create notification
          await supabase.from("notifications").insert({
            practice_id: practice.id,
            user_type: "team",
            type: "action_required",
            title: "QBR Due",
            message: `${practice.name} is due for a Quarterly Business Review.`,
          });
        }

        return new Response(
          JSON.stringify({
            success: true,
            generated: practices?.length || 0,
            type: "quarterly_reviews",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      case "financial_period": {
        // Generate financial period summary
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Get all payments for the period
        const { data: payments, error: paymentsError } = await supabase
          .from("payments")
          .select("*")
          .eq("status", "succeeded")
          .gte("paid_at", startOfMonth.toISOString())
          .lte("paid_at", endOfMonth.toISOString());

        if (paymentsError) throw paymentsError;

        // Get all expenses for the period
        const { data: expenses, error: expensesError } = await supabase
          .from("expenses")
          .select("*")
          .gte("expense_date", startOfMonth.toISOString().split("T")[0])
          .lte("expense_date", endOfMonth.toISOString().split("T")[0]);

        if (expensesError) throw expensesError;

        // Calculate totals
        const revenue = {
          assessment: payments?.filter((p) => p.type === "assessment").reduce((sum, p) => sum + p.amount, 0) || 0,
          implementation: payments
            ?.filter((p) => p.type.includes("implementation"))
            .reduce((sum, p) => sum + p.amount, 0) || 0,
          managed: payments
            ?.filter((p) => p.type === "managed_monthly")
            .reduce((sum, p) => sum + p.amount, 0) || 0,
          success_share: payments
            ?.filter((p) => p.type === "managed_success_share")
            .reduce((sum, p) => sum + p.amount, 0) || 0,
        };

        const expensesByCategory = {
          tools: expenses?.filter((e) => e.category === "tools").reduce((sum, e) => sum + e.amount, 0) || 0,
          contractors: expenses?.filter((e) => e.category === "contractors").reduce((sum, e) => sum + e.amount, 0) || 0,
          software: expenses?.filter((e) => e.category === "software").reduce((sum, e) => sum + e.amount, 0) || 0,
          travel: expenses?.filter((e) => e.category === "travel").reduce((sum, e) => sum + e.amount, 0) || 0,
          other: expenses
            ?.filter((e) => !["tools", "contractors", "software", "travel"].includes(e.category))
            .reduce((sum, e) => sum + e.amount, 0) || 0,
        };

        const totalRevenue = Object.values(revenue).reduce((a, b) => a + b, 0);
        const totalExpenses = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);
        const profit = totalRevenue - totalExpenses;

        // Get client count
        const { count: clientCount } = await supabase
          .from("practices")
          .select("*", { count: "exact", head: true })
          .eq("stage", "managed");

        // Calculate MRR
        const { data: managedPractices } = await supabase
          .from("practices")
          .select("monthly_rate")
          .eq("stage", "managed");

        const mrr = managedPractices?.reduce((sum, p) => sum + (p.monthly_rate || 0), 0) || 0;

        // Insert or update financial period
        await supabase.from("financial_periods").upsert({
          period_type: "monthly",
          period_start: startOfMonth.toISOString().split("T")[0],
          period_end: endOfMonth.toISOString().split("T")[0],
          revenue_assessment: revenue.assessment,
          revenue_implementation: revenue.implementation,
          revenue_managed: revenue.managed,
          revenue_success_share: revenue.success_share,
          revenue_total: totalRevenue,
          expenses_tools: expensesByCategory.tools,
          expenses_contractors: expensesByCategory.contractors,
          expenses_software: expensesByCategory.software,
          expenses_travel: expensesByCategory.travel,
          expenses_other: expensesByCategory.other,
          expenses_total: totalExpenses,
          profit,
          profit_margin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0,
          client_count: clientCount || 0,
          mrr,
          arr: mrr * 12,
        });

        return new Response(
          JSON.stringify({
            success: true,
            period: `${startOfMonth.toISOString().split("T")[0]} to ${endOfMonth.toISOString().split("T")[0]}`,
            revenue: totalRevenue,
            expenses: totalExpenses,
            profit,
            mrr,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      default:
        throw new Error(`Unknown report type: ${report_type}`);
    }
  } catch (error) {
    console.error("Report generation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
