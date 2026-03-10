import fs from "fs";

const now = new Date();
const stamp = now.toISOString();

const reportPath = process.argv[2] || "autopilot-report.md";

const appPath = "src/App.jsx";
const app = fs.readFileSync(appPath, "utf8");

const checks = [];

const safeCheck = (name, pass, detail) => {
  checks.push({ name, pass, detail });
};

const hasPracticeLogin = app.includes("const PracticeLogin");
const hasTeamLogin = app.includes("const TeamLogin");
const hasRevenueTool = app.includes("const RevenueCaptureTool");
const hasAuthNormalizer = app.includes("const normalizeAuthError");

safeCheck("Practice login component exists", hasPracticeLogin, hasPracticeLogin ? "Found PracticeLogin" : "Missing PracticeLogin");
safeCheck("Team login component exists", hasTeamLogin, hasTeamLogin ? "Found TeamLogin" : "Missing TeamLogin");
safeCheck("Revenue capture tool exists", hasRevenueTool, hasRevenueTool ? "Found RevenueCaptureTool" : "Missing RevenueCaptureTool");
safeCheck("Auth error normalization exists", hasAuthNormalizer, hasAuthNormalizer ? "Found normalizeAuthError" : "Missing normalizeAuthError");

const landingCTA = app.includes("Login to Start the Tool");
safeCheck("Landing CTA points to tool", landingCTA, landingCTA ? "Found tool CTA text" : "CTA text not found");

const recommendations = [];
const appLower = app.toLowerCase();

if (!appLower.includes("copy billing summary") || !appLower.includes("copy note additions")) {
  recommendations.push({
    priority: "P1",
    item: "Add one-click copy actions in the Revenue Capture Tool",
    why: "Doctors need immediate output reuse without manual highlighting.",
    outcome: "Reduces per-encounter admin friction by removing copy/paste effort.",
  });
}

if (!/recent analyses|analysis history|last 20/i.test(appLower)) {
  recommendations.push({
    priority: "P1",
    item: "Add recent encounter analysis history",
    why: "Clinics need quick review of prior coding suggestions and deltas.",
    outcome: "Improves trust and repeat usage during clinic day.",
  });
}

if (!/manual review required/i.test(appLower)) {
  recommendations.push({
    priority: "P1",
    item: "Add low-confidence guardrail",
    why: "Not every note should auto-suggest high-confidence billing changes.",
    outcome: "Protects compliance posture and user trust.",
  });
}

if (!/\?team=1/.test(app) || !/\?tool=1/.test(app)) {
  recommendations.push({
    priority: "P2",
    item: "Verify explicit route intents remain intact",
    why: "OAuth return routes must stay deterministic for team vs practice.",
    outcome: "Prevents misrouting after auth callback.",
  });
}

if (/logoClicks|3 clicks/.test(app)) {
  recommendations.push({
    priority: "P2",
    item: "Add explicit /team login route in addition to hidden multi-click",
    why: "Hidden access is brittle for support and QA.",
    outcome: "Faster team access troubleshooting without affecting public UX.",
  });
}

let liveStatus = "not checked";
let liveDetail = "Skipped live fetch";

try {
  const res = await fetch("https://defyb.org", { redirect: "follow" });
  const body = await res.text();
  const okContent = body.includes("Defying the death of small practices") && body.includes("Login to Start the Tool");
  liveStatus = res.ok && okContent ? "healthy" : "degraded";
  liveDetail = `HTTP ${res.status}; content markers: ${okContent ? "present" : "missing"}`;
  safeCheck("Live site reachable with expected core copy", res.ok && okContent, liveDetail);
} catch (err) {
  liveStatus = "degraded";
  liveDetail = `Live fetch failed: ${err.message}`;
  safeCheck("Live site reachable with expected core copy", false, liveDetail);
}

const passed = checks.filter((c) => c.pass).length;
const failed = checks.length - passed;

const lines = [];
lines.push(`# DeFyb Wiggum Autopilot Report`);
lines.push("");
lines.push(`Generated: ${stamp}`);
lines.push(`Live status: **${liveStatus}** (${liveDetail})`);
lines.push("");
lines.push("## Verification");
for (const c of checks) {
  lines.push(`- ${c.pass ? "[PASS]" : "[FAIL]"} ${c.name} — ${c.detail}`);
}
lines.push("");
lines.push(`Summary: ${passed} passed, ${failed} failed.`);
lines.push("");
lines.push("## Priority Backlog (Doctor Ease-of-Use)");
if (recommendations.length === 0) {
  lines.push("- No new priority items detected by current heuristics.");
} else {
  for (const r of recommendations) {
    lines.push(`- ${r.priority}: ${r.item}`);
    lines.push(`  Why: ${r.why}`);
    lines.push(`  Expected outcome: ${r.outcome}`);
  }
}

const report = `${lines.join("\n")}\n`;
fs.writeFileSync(reportPath, report, "utf8");
console.log(report);
