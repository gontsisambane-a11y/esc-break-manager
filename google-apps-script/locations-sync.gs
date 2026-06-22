/**
 * Emler Hub — Locations Sync Script
 *
 * Deploy this as a Google Apps Script Web App attached to the locations
 * spreadsheet. Once deployed, copy the web app URL into SHEET_SYNC_URL
 * in App.jsx.
 *
 * Setup:
 *  1. Open the spreadsheet → Extensions → Apps Script
 *  2. Paste this entire file, replacing any existing code
 *  3. Click Deploy → New deployment → Web app
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  4. Authorize and copy the deployment URL
 *  5. Paste that URL into SHEET_SYNC_URL in App.jsx
 *
 * The script re-reads the sheet on every request, so the Hub always
 * reflects the current state of the spreadsheet with no manual steps.
 */

var SPREADSHEET_ID = "1xAb9r3YmSdx1CfsrXLlJKVIsRhZwz2jWjZ2W90XzWBI";
var SHEET_GID      = 73304273;

// Partner brand names that appear as region headers in the sheet.
// Locations under these headers are partner schools, not Emler-owned.
var PARTNER_BRANDS = [
  "AQUAFIN", "AQUA WAVE", "KINGS SWIM ACADEMY",
  "LITTLE FLIPPERS", "NJSWIM", "SWIMKIDS"
];

/**
 * HTTP GET handler — returns location list as JSON.
 * The Hub fetches this URL on every load.
 */
function doGet() {
  var locations = parseLocations();
  var output = ContentService.createTextOutput(JSON.stringify(locations));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Parse the authoritative location list from the summary tables at the
 * top of the sheet (roughly the first 30 rows).
 *
 * Sheet layout (rows 1–30):
 *   Row 1:   AUSTIN | COLORADO | DALLAS | DFW1 | DFW2 | GIG HARBOR | GREAT LAKES
 *   Rows 2–6: location names under each region column
 *   (blank row)
 *   Row 8:   AQUAFIN | AQUA WAVE | …  (partner brands)
 *   Rows 9–14: partner location names
 *   (blank row)
 *   Row 17:  HOUSTON | INDIANA | MIDWEST | …
 *   Rows 18–24: location names
 *
 * A "header row" is identified by having ≥2 cells that are non-empty
 * and entirely uppercase.
 */
function parseLocations() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheets().filter(function(s) {
    return s.getSheetId() === SHEET_GID;
  })[0];

  if (!sheet) {
    // Fallback: use the first sheet
    sheet = ss.getSheets()[0];
  }

  // Read the first 30 rows, all columns
  var data = sheet.getRange(1, 1, 30, sheet.getLastColumn()).getValues();

  var locations = [];
  var i = 0;

  while (i < data.length) {
    var row = data[i];

    // Detect a region header row: at least 2 non-empty uppercase strings
    var headers = row.filter(function(c) {
      return c && typeof c === "string" && c.trim() === c.trim().toUpperCase() && c.trim().length > 2;
    });

    if (headers.length >= 2) {
      var regionRow = row;
      var j = i + 1;

      // Collect location name rows until blank row or another header row
      while (j < data.length) {
        var nameRow = data[j];
        var hasContent = nameRow.some(function(c) { return c && String(c).trim().length > 0; });
        if (!hasContent) break;

        // Stop if this row itself looks like another header row
        var nextHeaders = nameRow.filter(function(c) {
          return c && typeof c === "string" && c.trim() === c.trim().toUpperCase() && c.trim().length > 2;
        });
        if (nextHeaders.length >= 2) break;

        nameRow.forEach(function(cell, colIdx) {
          var name   = cell ? String(cell).trim() : "";
          var region = regionRow[colIdx] ? String(regionRow[colIdx]).trim() : "";
          if (name && region) {
            locations.push({ name: name, region: toTitleCase(region) });
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

function toTitleCase(str) {
  // "AUSTIN" → "Austin", "DFW1" → "DFW1", "SAN ANTONIO" → "San Antonio"
  // Preserve all-uppercase abbreviations (3 chars or fewer) as-is
  return str.split(" ").map(function(word) {
    if (word.length <= 3 && word === word.toUpperCase()) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}
