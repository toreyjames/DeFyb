import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CMS_PFS_FILE", "CMS_PFS_VERSION", "CMS_EFFECTIVE_DATE"];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const boolFromEnv = (name, fallback = false) => {
  const value = String(process.env[name] || "").trim().toLowerCase();
  if (!value) return fallback;
  return value === "1" || value === "true" || value === "yes";
};

const csvFile = path.resolve(process.env.CMS_PFS_FILE);
if (!fs.existsSync(csvFile)) {
  console.error(`CSV file not found: ${csvFile}`);
  process.exit(1);
}

const version = String(process.env.CMS_PFS_VERSION).trim();
const effectiveDate = String(process.env.CMS_EFFECTIVE_DATE).trim();
const activate = boolFromEnv("CMS_ACTIVATE", false);
const allowAllCodes = boolFromEnv("CMS_ALLOW_ALL_CODES", false);

const codeColumnHint = process.env.CMS_CODE_COLUMN || "";
const amountColumnHint = process.env.CMS_AMOUNT_COLUMN || "";
const stateColumnHint = process.env.CMS_STATE_COLUMN || "";
const localityColumnHint = process.env.CMS_LOCALITY_COLUMN || "";

const supportedCodes = new Set(["99202", "99203", "99204", "99213", "99214", "99215", "99024"]);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  const flushCell = () => {
    row.push(cell);
    cell = "";
  };

  const flushRow = () => {
    if (row.length === 1 && row[0] === "") {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\"") {
      if (inQuotes && text[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      flushCell();
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      flushCell();
      flushRow();
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    flushCell();
    flushRow();
  }

  return rows;
};

const normalizeHeader = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, "_");

const chooseColumn = (headers, hint, candidates) => {
  if (hint) {
    const idx = headers.findIndex((h) => normalizeHeader(h) === normalizeHeader(hint));
    if (idx >= 0) return idx;
  }
  for (const candidate of candidates) {
    const idx = headers.findIndex((h) => normalizeHeader(h) === candidate);
    if (idx >= 0) return idx;
  }
  return -1;
};

const asCurrency = (value) => {
  if (value == null) return null;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const main = async () => {
  const raw = fs.readFileSync(csvFile, "utf8");
  const table = parseCsv(raw);
  if (table.length < 2) {
    throw new Error("CSV must contain header + at least one data row");
  }

  const headers = table[0];
  const rows = table.slice(1);

  const codeIdx = chooseColumn(headers, codeColumnHint, ["hcpcs_code", "cpt_code", "code", "hcpcs"]);
  const amountIdx = chooseColumn(headers, amountColumnHint, ["allowed_amount", "nonfacility_amount", "payment_amount", "amount"]);
  const stateIdx = chooseColumn(headers, stateColumnHint, ["state", "carrier_state"]);
  const localityIdx = chooseColumn(headers, localityColumnHint, ["locality", "locality_name", "mac_locality"]);

  if (codeIdx < 0 || amountIdx < 0) {
    throw new Error(
      `Could not detect required columns. Headers found: ${headers.join(", ")}. Set CMS_CODE_COLUMN and CMS_AMOUNT_COLUMN.`,
    );
  }

  const payload = [];
  for (const row of rows) {
    const code = String(row[codeIdx] || "").trim();
    if (!code) continue;
    if (!allowAllCodes && !supportedCodes.has(code)) continue;

    const amount = asCurrency(row[amountIdx]);
    if (amount == null) continue;

    const state = stateIdx >= 0 ? String(row[stateIdx] || "").trim().toUpperCase() : "";
    const locality = localityIdx >= 0 ? String(row[localityIdx] || "").trim() : "";

    payload.push({
      payer_name: "CMS_PFS",
      state,
      locality,
      cpt_code: code,
      allowed_amount: amount,
      effective_date: effectiveDate,
      version,
      source: "cms_pfs",
    });
  }

  if (payload.length === 0) {
    throw new Error("No rate rows were parsed. Check column mapping and source file format.");
  }

  const versionPayload = {
    source: "cms_pfs",
    version,
    effective_date: effectiveDate,
    ...(activate ? { status: "active" } : {}),
    metadata_json: {
      file_name: path.basename(csvFile),
      imported_rows: payload.length,
      imported_at: new Date().toISOString(),
    },
  };

  const { data: versionRow, error: versionError } = await supabase
    .from("fee_schedule_versions")
    .upsert(versionPayload, { onConflict: "source,version" })
    .select("id, source, version, status")
    .single();
  if (versionError) throw versionError;

  if (activate) {
    const { error: archiveError } = await supabase
      .from("fee_schedule_versions")
      .update({ status: "archived" })
      .eq("source", "cms_pfs")
      .neq("id", versionRow.id)
      .eq("status", "active");
    if (archiveError) throw archiveError;
  }

  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize).map((row) => ({
      ...row,
      fee_schedule_version_id: versionRow.id,
    }));
    const { error: upsertError } = await supabase.from("payer_rates").upsert(batch, {
      onConflict: "payer_name,state,locality,cpt_code,effective_date,source,version",
    });
    if (upsertError) throw upsertError;
    inserted += batch.length;
  }

  const codeCount = new Set(payload.map((row) => row.cpt_code)).size;
  console.log(
    JSON.stringify(
      {
        ok: true,
        source: "cms_pfs",
        version: versionRow.version,
        status: activate ? "active" : versionRow.status,
        effective_date: effectiveDate,
        rows_upserted: inserted,
        distinct_codes: codeCount,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(`CMS import failed: ${error.message || error}`);
  process.exit(1);
});
