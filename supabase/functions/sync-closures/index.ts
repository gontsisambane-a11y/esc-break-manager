/**
 * sync-closures — Supabase Edge Function
 *
 * Reads the ESC School Closure Google Form responses sheet and upserts
 * recent/active closures into hub_closures. Runs on-demand (triggered
 * manually from the Hub or via a scheduled pg_cron job).
 *
 * Required secret: GOOGLE_SERVICE_ACCOUNT (same as sync-locations)
 *
 * Sheet: https://docs.google.com/spreadsheets/d/1JakUe4-Nj9z7WIOifImrgQ_ZULVjE2lg3z8EIfRVTZA
 *
 * Form columns (0-indexed):
 *   0  Timestamp
 *   1  Email
 *   2  Location
 *   3  Reason for Closure (category)
 *   4  Details / Description
 *   5  Partial or Full Closure
 *   6  Start Date of Closure
 *   7  Start Time of Closure
 *   8  Reopening Date
 *   9  Reopening Time
 *   10 Number of Classes Affected
 *
 * Only rows whose reopening date is within the last 14 days or in the
 * future are synced — older history is not surfaced in the Hub.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SPREADSHEET_ID = "1JakUe4-Nj9z7WIOifImrgQ_ZULVjE2lg3z8EIfRVTZA";
const SHEET_GID      = 303144083;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      return json({ error: "GOOGLE_SERVICE_ACCOUNT secret not set" }, 500);
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getGoogleAccessToken(serviceAccount);

    const spreadsheet = await fetchSpreadsheet(accessToken, SPREADSHEET_ID);
    const sheet = (spreadsheet.sheets || []).find(
      (s: any) => s.properties.sheetId === SHEET_GID
    ) || spreadsheet.sheets?.[0];

    if (!sheet) return json({ error: "Closure sheet not found" }, 500);

    const rows: string[][] = sheet.data?.[0]?.rowData?.map(
      (r: any) => r.values?.map((c: any) => c.formattedValue || "") || []
    ) || [];

    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - 14); // 14-day lookback

    const records = parseClosures(rows, windowStart);
    if (records.length === 0) {
      return json({ ok: true, upserted: 0, total: 0, message: "No recent closures found" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let upserted = 0;
    for (const rec of records) {
      const { error } = await supabase
        .from("hub_closures")
        .upsert(rec, { onConflict: "external_id" });
      if (error) console.error(`Upsert failed for ${rec.location_name} ${rec.start_date}:`, error.message);
      else upserted++;
    }

    return json({ ok: true, upserted, total: records.length });
  } catch (err) {
    console.error("sync-closures error:", err);
    return json({ error: String(err) }, 500);
  }
});

// ── Parser ────────────────────────────────────────────────────────────

function parseClosures(rows: string[][], windowStart: Date): any[] {
  const results: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const c = (n: number) => row[n]?.trim() || "";

    // Skip header row and empty rows
    const ts = c(0);
    if (!ts || /timestamp/i.test(ts)) continue;

    // Skip rows without a location or start date
    const location = c(2);
    if (!location || location.length < 2) continue;

    // Parse reopening date — skip if unparseable or too old
    const reopenRaw = c(8);
    const reopenDate = parseSheetDate(reopenRaw);
    if (!reopenDate || reopenDate < windowStart) continue;

    // Parse start date
    const startRaw = c(6);
    const startDate = parseSheetDate(startRaw) || reopenDate;

    const reason   = c(3);
    const details  = c(4);
    const fullReason = details
      ? `${reason}: ${details.substring(0, 300)}`
      : reason;

    const closureType = c(5).toLowerCase().includes("full") ? "Full" : "Partial";
    const classesRaw  = parseInt(c(10));
    const classesAffected = isNaN(classesRaw) ? null : classesRaw;

    // Stable external_id: timestamp + location slug
    const externalId = `${ts}|${location}`.replace(/\s+/g, "_").substring(0, 200);

    results.push({
      external_id:       externalId,
      location_name:     normalizeLocation(location),
      start_date:        fmtDate(startDate),
      end_date:          fmtDate(reopenDate),
      reason:            fullReason,
      closure_type:      closureType,
      classes_affected:  classesAffected,
    });
  }

  return results;
}

function normalizeLocation(name: string): string {
  // Normalize common name variations to match hub_locations
  const map: Record<string, string> = {
    "frisco - central":      "Frisco Central",
    "frisco central (mckinney)": "Frisco Central",
    "frisco - west":         "Frisco West",
    "saint street swim":     "Saint Street",
    "saint street":          "Saint Street",
    "aqua wave":             "AquaWave",
    "beaverton-tanasbourne": "Tanasbourne",
    "beaverton-washington square": "Beaverton",
    "all star swim academy": "All Star Swim Academy",
    "discover aquatics":     "Discover Aquatics",
    "swim to shore":         "Murrieta",
    "charlotte":             "Charlotte Swim Academy",
  };
  const key = name.toLowerCase().trim();
  return map[key] || name.trim();
}

// ── Date parsing ──────────────────────────────────────────────────────

function parseSheetDate(raw: string): Date | null {
  if (!raw) return null;
  raw = raw.trim();

  // Handle "M/D/YYYY HH:MM:SS" or "M/D/YYYY" or "M/D/YY"
  const parts = raw.split(" ")[0].split("/");
  if (parts.length < 3) return null;

  const month = parseInt(parts[0]);
  const day   = parseInt(parts[1]);
  let year    = parseInt(parts[2]);

  // Fix 2-digit years
  if (year < 100) year += 2000;
  // Fix obvious typos like 0026 → 2026
  if (year < 1000) year += 2000;
  // Clamp years to a sane range (2020–2030)
  if (year < 2020 || year > 2030) {
    year = new Date().getFullYear();
  }

  const d = new Date(year, month - 1, day);
  if (isNaN(d.getTime())) return null;
  return d;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ── Google API helpers ────────────────────────────────────────────────

async function getGoogleAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header  = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await importRsaKey(sa.private_key);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("Failed to get token: " + JSON.stringify(data));
  return data.access_token;
}

async function fetchSpreadsheet(token: string, id: string): Promise<any> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}?includeGridData=true`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Sheets API error: ${resp.status}`);
  return resp.json();
}

function base64url(data: string | ArrayBuffer): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function importRsaKey(pem: string): Promise<CryptoKey> {
  const body   = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8", binary.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
