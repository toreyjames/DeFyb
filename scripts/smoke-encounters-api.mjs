import { createClient } from "@supabase/supabase-js";

const required = [
  ["SUPABASE_URL", process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL],
  ["SUPABASE_ANON_KEY", process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY],
  ["SMOKE_TEST_EMAIL", process.env.SMOKE_TEST_EMAIL],
  ["SMOKE_TEST_PASSWORD", process.env.SMOKE_TEST_PASSWORD],
];

const missing = required.filter(([, value]) => !value).map(([name]) => name);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.SMOKE_TEST_EMAIL;
const password = process.env.SMOKE_TEST_PASSWORD;

const client = createClient(supabaseUrl, supabaseAnonKey);

const invoke = async (path, method = "GET", body) => {
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error("Missing access token for smoke test session");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/encounters-api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`encounters-api ${method} ${path} failed: ${payload?.error || response.statusText}`);
  }
  return payload;
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async () => {
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Sign in failed: ${signInError.message}`);

  const encounterDate = new Date().toISOString().slice(0, 10);

  const created = await invoke("/encounters", "POST", {
    encounter_date: encounterDate,
    visit_type: "office_followup",
    patient_type: "established",
    pos: "11",
    telehealth: false,
    minutes: 28,
  });
  assert(created?.encounter_id, "Expected encounter_id from POST /encounters");

  const encounterId = created.encounter_id;

  const note = await invoke(`/encounters/${encounterId}/note`, "POST", {
    raw_note: "Follow-up visit. Chronic condition worsening. Medication management completed. MRI reviewed. Labs reviewed.",
    source: "manual",
  });
  assert(note?.status === "ok", "Expected status=ok from POST /encounters/{id}/note");

  const analyzed = await invoke(`/encounters/${encounterId}/analyze`, "POST", {
    current_code: "99213",
    payer_name: "FALLBACK",
    state: "NA",
  });
  assert(analyzed?.recommendation?.suggested_code, "Expected recommendation.suggested_code from analyze");
  assert(Number.isFinite(Number(analyzed?.revenue_impact?.delta_amount)), "Expected numeric revenue delta");

  const selected = await invoke(`/encounters/${encounterId}/select-code`, "POST", {
    selected_code: analyzed.recommendation.suggested_code,
    selection_reason: "smoke_test_accept",
  });
  assert(selected?.status === "ok", "Expected status=ok from select-code");

  const detail = await invoke(`/encounters/${encounterId}`, "GET");
  assert(detail?.encounter?.id === encounterId, "Expected encounter detail for created encounter");

  const list = await invoke("/encounters?limit=5", "GET");
  assert(Array.isArray(list?.encounters), "Expected encounters array from GET /encounters");

  const metrics = await invoke("/dashboard/metrics", "GET");
  assert(typeof metrics === "object" && metrics !== null, "Expected metrics object");

  console.log("encounters-api smoke test passed");
  console.log(
    JSON.stringify(
      {
        encounterId,
        suggestedCode: analyzed.recommendation.suggested_code,
        delta: analyzed.revenue_impact.delta_amount,
        listCount: list.encounters.length,
      },
      null,
      2,
    ),
  );
};

run().catch((err) => {
  console.error(`encounters-api smoke test failed: ${err.message}`);
  process.exit(1);
});
