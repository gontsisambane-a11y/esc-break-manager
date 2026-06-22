/**
 * sync-locations — Supabase Edge Function
 *
 * Reads the ESC Location Information Google Sheet using a Google service
 * account, parses every location tab, and upserts into hub_locations.
 *
 * Required Supabase secrets (set via Dashboard → Settings → Secrets):
 *   GOOGLE_SERVICE_ACCOUNT  — full JSON content of the service account key file
 *
 * Invoke manually:
 *   POST /functions/v1/sync-locations
 *   Authorization: Bearer <SUPABASE_ANON_KEY>   (or service role key)
 *
 * Schedule automatically (pg_cron — run in SQL editor):
 *   select cron.schedule(
 *     'sync-locations-daily',
 *     '0 6 * * *',   -- 6 AM UTC every day
 *     $$select net.http_post(
 *       url := 'https://uektpsmcgagzxfoxavex.supabase.co/functions/v1/sync-locations',
 *       headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>","Content-Type":"application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     )$$
 *   );
 *
 * Setup:
 *   1. Google Cloud Console → create project → enable "Google Sheets API"
 *   2. IAM & Admin → Service Accounts → create → download JSON key
 *   3. Share the Google Sheet with the service account email (view-only)
 *   4. Supabase Dashboard → Settings → Edge Function Secrets →
 *      add GOOGLE_SERVICE_ACCOUNT = <paste entire JSON key content>
 *   5. Deploy: supabase functions deploy sync-locations
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SPREADSHEET_ID = "1xAb9r3YmSdx1CfsrXLlJKVIsRhZwz2jWjZ2W90XzWBI";
const OVERVIEW_GID   = 73304273;

// Fields we explicitly NEVER store (safety net against accidental password sync)
const BLOCKED_FIELD_PATTERNS = [/password/i, /passcode/i, /secret/i, /credential/i];

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

    // Fetch entire spreadsheet metadata + data in one request
    const spreadsheet = await fetchSpreadsheet(accessToken, SPREADSHEET_ID);
    const sheets = spreadsheet.sheets || [];

    // Find the overview sheet by gid
    const overviewSheet = sheets.find(
      (s: any) => s.properties.sheetId === OVERVIEW_GID
    );

    // Parse location list from the overview tab (region tables)
    const locationList = parseOverviewSheet(overviewSheet);

    // Build a map from location name → tab data
    const locationTabMap = buildLocationTabMap(sheets, locationList);

    // Build upsert records
    const records = locationList
      .map((entry) => {
        const tabData = locationTabMap[entry.name.toLowerCase()] || {};
        return buildRecord(entry, tabData);
      })
      .filter(Boolean);

    // Upsert into hub_locations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let updated = 0;
    for (const record of records) {
      const { error } = await supabase
        .from("hub_locations")
        .upsert(record, { onConflict: "name" });
      if (error) console.error(`Failed to upsert ${record.name}:`, error.message);
      else updated++;
    }

    return json({ ok: true, updated, total: records.length });
  } catch (err) {
    console.error("sync-locations error:", err);
    return json({ error: String(err) }, 500);
  }
});

// ── Google API helpers ────────────────────────────────────────────────

async function getGoogleAccessToken(sa: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));

  const unsigned = `${header}.${payload}`;
  const key = await importRsaKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(sig)}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error("Failed to get token: " + JSON.stringify(data));
  return data.access_token;
}

async function fetchSpreadsheet(token: string, id: string): Promise<any> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}?includeGridData=true`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`Sheets API error: ${resp.status}`);
  return resp.json();
}

// ── Sheet parsing ─────────────────────────────────────────────────────

function parseOverviewSheet(sheet: any): Array<{ name: string; region: string }> {
  if (!sheet) return [];
  const rows: any[][] = sheet.data?.[0]?.rowData?.map(
    (r: any) => r.values?.map((c: any) => c.formattedValue || "") || []
  ) || [];

  const locations: { name: string; region: string }[] = [];
  let i = 0;
  while (i < Math.min(rows.length, 30)) {
    const row = rows[i];
    const uppers = row.filter((c: string) => c && c === c.toUpperCase() && c.length > 2);
    if (uppers.length >= 2) {
      const regions = row;
      let j = i + 1;
      while (j < rows.length) {
        const nameRow = rows[j];
        const hasContent = nameRow.some((c: string) => c && c.trim().length > 0);
        if (!hasContent) break;
        const nextUppers = nameRow.filter((c: string) => c && c === c.toUpperCase() && c.length > 2);
        if (nextUppers.length >= 2) break;
        nameRow.forEach((cell: string, ci: number) => {
          const name = cell?.trim();
          const region = regions[ci]?.trim();
          if (name && region) {
            locations.push({ name, region: toTitleCase(region) });
          }
        });
        j++;
      }
      i = j;
    } else {
      i++;
    }
  }
  return locations;
}

function buildLocationTabMap(
  sheets: any[],
  locationList: { name: string }[]
): Record<string, any> {
  const map: Record<string, any> = {};
  const locationNames = locationList.map((l) => l.name.toLowerCase());

  for (const sheet of sheets) {
    const tabName: string = sheet.properties?.title || "";
    // Try to match tab name to a location name (tab pattern: "Anderson Mill (Austin)")
    const locName = locationNames.find((n) => tabName.toLowerCase().startsWith(n));
    if (!locName) continue;

    const rows: string[][] = sheet.data?.[0]?.rowData?.map(
      (r: any) => r.values?.map((c: any) => c.formattedValue || "") || []
    ) || [];

    map[locName] = parseLocationTab(rows);
  }
  return map;
}

function parseLocationTab(rows: string[][]): Record<string, any> {
  const data: Record<string, any> = {};
  const hours: Record<string, string> = {};
  const instructors: any[] = [];
  const DAY_NAMES = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const c = (n: number) => row[n]?.trim() || "";

    // Block sensitive rows
    if (BLOCKED_FIELD_PATTERNS.some((p) => p.test(c(0)) || p.test(c(1)))) continue;

    // Address row
    if (c(0).toLowerCase() === "address" && c(1)) {
      data.addr = c(1);
      if (c(4)) data.direct_phone = c(4);
      const zip = c(1).match(/\b(\d{5})\b(?!.*\d{5})/);
      if (zip) data.zip = zip[1];
    }

    // Manager rows
    const pos = c(0).toUpperCase();
    if (["GM","OM","RD","DO"].includes(pos)) {
      if (pos === "GM" && c(1)) { data.gm_name = c(1); if (c(2)?.includes("@")) data.gm_email = c(2); }
      if (pos === "OM" && c(1)) { data.om_name = c(1); if (c(2)?.includes("@")) data.om_email = c(2); }
      if (pos === "RD" && c(1)) data.rd_name = c(1);
      // Hours often on same row
      const day = c(3).toLowerCase();
      if (DAY_NAMES.includes(day) && c(4)) hours[day] = c(4);
    }

    // Standalone hour rows
    const day0 = c(0).toLowerCase();
    if (DAY_NAMES.includes(day0) && c(1)) hours[day0] = c(1);
    const day3 = c(3).toLowerCase();
    if (DAY_NAMES.includes(day3) && c(4)) hours[day3] = c(4);

    // Pool specs
    if (c(0).toLowerCase() === "dimensions" && c(1)) data.pool_dim = c(1);
    if (c(0).toLowerCase() === "depth" && c(1)) data.pool_depth = c(1);

    // Instructors (rows after "Instructor Info" header)
    if (c(0).toLowerCase() === "instructor info") {
      for (let k = i + 2; k < rows.length && k < i + 60; k++) {
        const ir = rows[k];
        const name = ir[0]?.trim();
        if (!name || name.toLowerCase().includes("sammy starfish")) continue;
        if (BLOCKED_FIELD_PATTERNS.some((p) => p.test(name))) break;
        instructors.push({
          name,
          level: ir[1]?.trim() || "",
          pronouns: ir[2]?.trim() || "",
          description: ir[3]?.trim() || "",
          special_needs: ir[4]?.trim() || "",
          languages: ir[5]?.trim() || "",
        });
      }
    }
  }

  if (Object.keys(hours).length > 0) data.hours = hours;
  if (instructors.length > 0) data.instructors = instructors;
  return data;
}

function buildRecord(entry: { name: string; region: string }, tabData: Record<string, any>) {
  const rec: Record<string, any> = {
    name: entry.name,
    region: entry.region,
  };
  const allowed = ["addr","zip","direct_phone","gm_name","gm_email","om_name","om_email","rd_name","hours","pool_dim","pool_depth","instructors"];
  for (const k of allowed) {
    if (tabData[k] !== undefined) rec[k] = tabData[k];
  }
  return rec;
}

// ── Crypto utilities ──────────────────────────────────────────────────

function base64url(data: string | ArrayBuffer): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function importRsaKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function toTitleCase(str: string): string {
  return str.split(" ").map((w) =>
    w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join(" ");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
