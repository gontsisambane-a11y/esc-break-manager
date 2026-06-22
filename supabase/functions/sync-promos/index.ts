/**
 * sync-promos — Supabase Edge Function
 *
 * Reads the "Active Promotions" table from the ESC Hub Reference Google Sheet
 * and upserts into hub_promos (matched on promo code).
 *
 * Required secret: GOOGLE_SERVICE_ACCOUNT (same service account used by sync-locations)
 * The sheet must be shared with the service account email (view-only).
 *
 * Sheet: https://docs.google.com/spreadsheets/d/1tX40PMVtWWm8YUBkvM1oLtu9lNLyIilIEnS074va2jA
 *
 * Invoke manually:
 *   POST /functions/v1/sync-promos
 *   Authorization: Bearer <SUPABASE_ANON_KEY>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SPREADSHEET_ID = "1tX40PMVtWWm8YUBkvM1oLtu9lNLyIilIEnS074va2jA";
const SHEET_GID      = 0; // first/main sheet

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

    if (!sheet) return json({ error: "Sheet not found" }, 500);

    const rows: string[][] = sheet.data?.[0]?.rowData?.map(
      (r: any) => r.values?.map((c: any) => c.formattedValue || "") || []
    ) || [];

    const promos = parsePromos(rows);
    if (promos.length === 0) return json({ error: "No promos found in sheet" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let upserted = 0;
    for (const promo of promos) {
      const { error } = await supabase
        .from("hub_promos")
        .upsert(promo, { onConflict: "code" });
      if (error) console.error(`Failed to upsert "${promo.title}":`, error.message);
      else upserted++;
    }

    // Mark promos NOT in the sheet as inactive (expired/removed)
    const activeCodes = promos.map((p) => p.code);
    await supabase
      .from("hub_promos")
      .update({ active: false })
      .not("code", "in", `(${activeCodes.map((c) => `"${c}"`).join(",")})`)
      .eq("active", true);

    return json({ ok: true, upserted, total: promos.length });
  } catch (err) {
    console.error("sync-promos error:", err);
    return json({ error: String(err) }, 500);
  }
});

// ── Parser ────────────────────────────────────────────────────────────

function parsePromos(rows: string[][]): any[] {
  // Find the subheader row: contains "Exp" and "Promo Code" and "Promotion Details"
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const joined = rows[i].join("|").toLowerCase();
    if (joined.includes("promo code") && joined.includes("promotion details")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  // Find column indices
  const hrow = rows[headerIdx];
  const expCol    = hrow.findIndex((c) => /^exp/i.test(c.trim()));
  const codeCol   = hrow.findIndex((c) => /promo code/i.test(c));
  const detailCol = hrow.findIndex((c) => /promotion details/i.test(c));
  if (expCol === -1 || codeCol === -1 || detailCol === -1) return [];

  const promos: any[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const detail = row[detailCol]?.trim();
    if (!detail) break; // blank row ends the table

    const rawExp  = row[expCol]?.trim() || "";
    const rawCode = row[codeCol]?.trim() || "";

    // Extract title: first line or first sentence of detail
    const firstLine = detail.split(/\n/)[0].trim();
    const title = firstLine.length > 80
      ? firstLine.substring(0, 77) + "…"
      : firstLine;

    // Parse expiry date — sheet uses "M/D" format, assume current/next year
    let expires_on: string | null = null;
    if (rawExp && rawExp.toLowerCase() !== "none") {
      const parts = rawExp.split("/");
      if (parts.length >= 2) {
        const month = parseInt(parts[0]);
        const day   = parseInt(parts[1]);
        const now   = new Date();
        let year    = now.getFullYear();
        // If the date has already passed this year, assume next year
        const candidate = new Date(year, month - 1, day);
        if (candidate < now) year++;
        expires_on = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    // Determine proactive from detail text
    const proactive = /may offer proactively|offer proactively/i.test(detail);
    const requiresMention = /do not proactively offer|customer must mention/i.test(detail);

    // Derive a stable code for code-less promos (use title slug)
    const code = rawCode && !/no code|auto|icp/i.test(rawCode)
      ? rawCode
      : slugify(title);

    // Rules = the full detail text
    const rules = detail;

    promos.push({
      title,
      code,
      rules,
      expires_on,
      proactive,
      requires_mention: requiresMention,
      active: true,
    });
  }
  return promos;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 60);
}

// ── Google API helpers (shared with sync-locations) ───────────────────

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
