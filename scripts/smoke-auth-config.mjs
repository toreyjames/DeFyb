const readBoolEnv = (name, defaultValue = true) => {
  const raw = process.env[name];
  if (raw == null) return defaultValue;
  return String(raw).toLowerCase() !== "false";
};

const expected = {
  google: readBoolEnv("VITE_ENABLE_GOOGLE_AUTH", true),
  azure: readBoolEnv("VITE_ENABLE_MICROSOFT_AUTH", true),
};

const managementToken = process.env.SUPABASE_MANAGEMENT_TOKEN;
const projectRef = process.env.SUPABASE_PROJECT_REF;

const logSummary = (config = null) => {
  console.log("Auth UX expectations:");
  console.log(`- Google button visible: ${expected.google}`);
  console.log(`- Microsoft button visible: ${expected.azure}`);
  if (!config) {
    console.log("No management API check executed.");
    return;
  }
  console.log("Supabase provider status:");
  console.log(`- external_google_enabled: ${Boolean(config.external_google_enabled)}`);
  console.log(`- external_azure_enabled: ${Boolean(config.external_azure_enabled)}`);
};

const run = async () => {
  if (!managementToken || !projectRef) {
    logSummary();
    console.log("Set SUPABASE_MANAGEMENT_TOKEN + SUPABASE_PROJECT_REF to verify provider config against UX flags.");
    return;
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    headers: { Authorization: `Bearer ${managementToken}` },
  });
  if (!response.ok) throw new Error(`Management API request failed (${response.status})`);
  const config = await response.json();
  logSummary(config);

  const mismatches = [];
  if (expected.google && !config.external_google_enabled) mismatches.push("Google button is enabled in UI flags but provider is disabled in Supabase.");
  if (expected.azure && !config.external_azure_enabled) mismatches.push("Microsoft button is enabled in UI flags but provider is disabled in Supabase.");
  if (!expected.google && config.external_google_enabled) mismatches.push("Google provider is enabled but hidden by UI flag.");
  if (!expected.azure && config.external_azure_enabled) mismatches.push("Microsoft provider is enabled but hidden by UI flag.");

  if (mismatches.length > 0) {
    console.error("Auth config mismatches:");
    mismatches.forEach((m) => console.error(`- ${m}`));
    process.exit(1);
  }

  console.log("Auth config smoke check passed.");
};

run().catch((err) => {
  console.error(`smoke-auth-config failed: ${err.message}`);
  process.exit(1);
});
