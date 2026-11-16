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
      // Clear cache so next lookup sees it
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
 * Appends a row of values to a sheet tab
 */
async function appendRow(sheetName, values) {
  return await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
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
 * Searches for a member by Discord ID across Personnel_Index
 */
async function findRowByDiscordId(sheetName, discordId) {
  const rows = await readSheet(sheetName);
  if (rows.length === 0) return null;
  const headers = rows[0];
  const discordIdIndex = headers.indexOf('Discord_ID');
  if (discordIdIndex === -1) return null;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][discordIdIndex] === discordId) {
      return { row: rows[i], rowIndex: i + 1, headers };
    }
  }
  return null;
}

/**
 * Searches for a member by Roblox ID or Username across Personnel_Index
 */
async function findMemberByRoblox(robloxIdOrUsername) {
  const rows = await readSheet('Personnel_Index');
  if (rows.length <= 1) return null;
  const headers = rows[0];
  const robloxIdIdx = headers.indexOf('Roblox_ID');
  const robloxUserIdx = headers.indexOf('Roblox_Username');

  const query = String(robloxIdOrUsername).trim().toLowerCase();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (
      (robloxIdIdx !== -1 && row[robloxIdIdx] === query) ||
      (robloxUserIdx !== -1 && (row[robloxUserIdx] || '').toLowerCase() === query)
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
 * Fetches structured member object from Personnel_Index
 */
async function getMemberFromIndex(discordId) {
  const result = await findRowByDiscordId('Personnel_Index', discordId);
  if (!result) return null;
  const obj = {};
  result.headers.forEach((h, i) => (obj[h] = result.row[i] || ''));
  obj._rowIndex = result.rowIndex;
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
  findRowByDiscordId,
  findMemberByRoblox,
  getMemberFromIndex,
  updatePersonnelIndex,
  batchUpdateSpreadsheet,
};
