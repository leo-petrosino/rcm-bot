const { google } = require('googleapis');

let auth;
try {
  const keyJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
  auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} catch {
  auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Memory cache for sheet metadata (sheet IDs)
const sheetIdCache = new Map();

/**
 * Gets sheet ID by title, caching results
 */
async function getSheetId(sheetName) {
  if (sheetIdCache.has(sheetName)) {
    return sheetIdCache.get(sheetName);
  }
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  for (const s of res.data.sheets) {
    sheetIdCache.set(s.properties.title, s.properties.sheetId);
  }
  if (!sheetIdCache.has(sheetName)) {
    throw new Error(`Sheet tab "${sheetName}" not found in spreadsheet.`);
  }
  return sheetIdCache.get(sheetName);
}

/**
 * Ensures a sheet tab exists; creates it if missing
 */
async function ensureSheetExists(sheetName, defaultHeaders = []) {
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const exists = res.data.sheets.some(s => s.properties.title === sheetName);
    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [
            {
              addSheet: {
                properties: { title: sheetName },
              },
            },
          ],
        },
      });
      sheetIdCache.clear();
      if (defaultHeaders.length > 0) {
        await appendRow(sheetName, defaultHeaders);
      }
    }
  } catch (err) {
    console.error(`[Sheets] Failed to ensure sheet ${sheetName}:`, err.message);
  }
}

/**
 * Reads all rows from a sheet tab
 */
async function readSheet(sheetName, range = 'A1:Z5000') {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${range}`,
    });
    return res.data.values || [];
  } catch (err) {
    console.error(`[Sheets] Error reading "${sheetName}":`, err.message);
    return [];
  }
}

/**
 * Appends a row of values to a sheet tab safely below all headers and existing data
 */
async function appendRow(sheetName, values) {
  const rows = await readSheet(sheetName);

  // Find where the table header row is (if present)
  const { headerIndex } = findHeaderRow(rows, 'discord');

  // Find the last row with actual data
  let lastDataRow = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i] && rows[i].some(cell => String(cell || '').trim() !== '')) {
      lastDataRow = i + 1;
      break;
    }
  }

  // Determine the next row index (1-based)
  // Ensure it is strictly after the header row (headerIndex + 1 is 1-based header)
  let nextRow = lastDataRow + 1;
  if (headerIndex !== -1 && nextRow <= headerIndex + 1) {
    nextRow = headerIndex + 2;
  }
  if (nextRow < 1) nextRow = 1;

  return await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${nextRow}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

/**
 * Updates a specific row index (1-based) in a sheet tab
 */
async function updateRow(sheetName, rowIndex, values) {
  return await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

/**
 * Deletes a row by index (1-based)
 */
async function deleteRow(sheetName, rowIndex) {
  const sheetId = await getSheetId(sheetName);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}

/**
 * Dynamically finds the table header row in a sheet (even if banners or KPI rows precede it)
 */
function findHeaderRow(rows, identifier = 'discord') {
  if (!rows || rows.length === 0) return { headerIndex: -1, headers: [] };
  const target = identifier.toLowerCase();

  // Search first 15 rows for the header containing target (e.g. 'discord')
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    if (row && row.some(cell => String(cell || '').toLowerCase().includes(target))) {
      return {
        headerIndex: i,
        headers: row.map(c => String(c || '').trim()),
      };
    }
  }

  // Fallback: look for common header keywords in first 15 rows
  const commonKeywords = ['roblox', 'user', 'rank', 'action', 'timestamp', 'date', 'name', 'id'];
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const row = rows[i];
    if (row && row.some(cell => commonKeywords.some(kw => String(cell || '').toLowerCase().includes(kw)))) {
      return {
        headerIndex: i,
        headers: row.map(c => String(c || '').trim()),
      };
    }
  }

  // Fallback to row 0 if not explicitly detected
  return {
    headerIndex: 0,
    headers: (rows[0] || []).map(c => String(c || '').trim()),
  };
}

/**
 * Searches for a member by Discord ID across a specific sheet tab
 */
async function findRowByDiscordId(sheetName, discordId) {
  const rows = await readSheet(sheetName);
  if (rows.length === 0) return null;

  const { headerIndex, headers } = findHeaderRow(rows, 'discord');
  if (headerIndex === -1) return null;

  let discordIdIndex = headers.indexOf('Discord_ID');
  if (discordIdIndex === -1) {
    discordIdIndex = headers.findIndex(h => h.toLowerCase().includes('discord'));
  }
  if (discordIdIndex === -1) return null;

  const targetClean = String(discordId).trim();

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (row && String(row[discordIdIndex] || '').trim() === targetClean) {
      return {
        row,
        rowIndex: i + 1, // 1-based sheet row index
        headers,
        headerRowIndex: headerIndex + 1,
      };
    }
  }
  return null;
}

/**
 * Searches for a member by Roblox ID or Username across Personnel_Index
 */
async function findMemberByRoblox(robloxIdOrUsername) {
  const rows = await readSheet('Personnel_Index');
  if (rows.length === 0) return null;

  const { headerIndex, headers } = findHeaderRow(rows, 'discord');
  if (headerIndex === -1) return null;

  const robloxIdIdx = headers.indexOf('Roblox_ID');
  const robloxUserIdx = headers.indexOf('Roblox_Username');

  const query = String(robloxIdOrUsername).trim().toLowerCase();

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (
      (robloxIdIdx !== -1 && String(row[robloxIdIdx] || '').trim().toLowerCase() === query) ||
      (robloxUserIdx !== -1 && String(row[robloxUserIdx] || '').trim().toLowerCase() === query)
    ) {
      const obj = {};
      headers.forEach((h, idx) => (obj[h] = row[idx] || ''));
      obj._rowIndex = i + 1;
      return obj;
    }
  }
  return null;
}

/**
 * Primary rank class sheets used as fallbacks if a member is not in Personnel_Index
 */
const CLASS_SHEETS = [
  'Enlisted',
  'Junior_NCOs',
  'Senior_NCOs',
  'Subordinate_Officers',
  'Junior_Officers',
  'Senior_Officers',
  'Senior_Formation',
  'Division_Commanders',
  'Senior_Generals',
  'LWA',
  'Discharged',
];

/**
 * Fetches structured member object by Discord ID, with cross-tab fallback
 */
async function getMemberFromIndex(discordId) {
  // 1. Try Personnel_Index first
  let result = await findRowByDiscordId('Personnel_Index', discordId);

  // 2. Fallback: Search across class tabs if not present in Personnel_Index
  if (!result) {
    for (const sheetName of CLASS_SHEETS) {
      result = await findRowByDiscordId(sheetName, discordId);
      if (result) break;
    }
  }

  if (!result) return null;

  const obj = {};
  result.headers.forEach((h, i) => (obj[h] = result.row[i] || ''));
  obj._rowIndex = result.rowIndex;

  // Normalize field names across old and new sheets
  obj.Current_Rank = obj.Current_Rank || obj.Rank || 'Cadet';
  obj.Rank = obj.Current_Rank;
  obj.Rank_Level = String(obj.Rank_Level || '1');
  obj.Class = obj.Class || obj.Branch || 'Enlisted';
  obj.Regiment = obj.Regiment || obj.Branch || 'Unassigned';
  obj.Status = obj.Status || 'Active';
  obj.Strike_Count = obj.Strike_Count || '0';
  obj.Total_Strikes = obj.Total_Strikes || obj.Strike_Count || '0';

  return obj;
}

/**
 * Updates columns for a member in Personnel_Index
 */
async function updatePersonnelIndex(discordId, updates) {
  const result = await findRowByDiscordId('Personnel_Index', discordId);
  if (!result) return false;
  const { row, rowIndex, headers } = result;

  for (const [key, value] of Object.entries(updates)) {
    let idx = headers.indexOf(key);
    if (idx !== -1) {
      row[idx] = value;
    } else {
      // Check alternative keys (e.g. Rank vs Current_Rank)
      if (key === 'Current_Rank') {
        const altIdx = headers.indexOf('Rank');
        if (altIdx !== -1) row[altIdx] = value;
      }
    }
  }
  await updateRow('Personnel_Index', rowIndex, row);
  return true;
}

/**
 * Directly executes a batchUpdate against the spreadsheet
 */
async function batchUpdateSpreadsheet(requests) {
  if (!requests || requests.length === 0) return;
  return await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
}

module.exports = {
  sheets,
  SPREADSHEET_ID,
  getSheetId,
  ensureSheetExists,
  readSheet,
  appendRow,
  updateRow,
  deleteRow,
  findHeaderRow,
  findRowByDiscordId,
  findMemberByRoblox,
  getMemberFromIndex,
  updatePersonnelIndex,
  batchUpdateSpreadsheet,
};
