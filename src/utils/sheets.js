const { google } = require('googleapis');

let auth;
try {
  const keyJson = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
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

async function readSheet(sheetName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1000`,
  });
  return res.data.values || [];
}

async function appendRow(sheetName, values) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

async function updateRow(sheetName, rowIndex, values) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIndex}:Z${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [values] },
  });
}

async function getSheetId(sheetName) {
  const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = res.data.sheets.find(s => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  return sheet.properties.sheetId;
}

async function deleteRow(sheetName, rowIndex) {
  const sheetId = await getSheetId(sheetName);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex - 1,
            endIndex: rowIndex,
          },
        },
      }],
    },
  });
}

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

async function getMemberFromIndex(discordId) {
  const result = await findRowByDiscordId('Personnel_Index', discordId);
  if (!result) return null;
  const obj = {};
  result.headers.forEach((h, i) => obj[h] = result.row[i] || '');
  obj._rowIndex = result.rowIndex;
  return obj;
}

async function updatePersonnelIndex(discordId, updates) {
  const result = await findRowByDiscordId('Personnel_Index', discordId);
  if (!result) return false;
  const { row, rowIndex, headers } = result;

  for (const [key, value] of Object.entries(updates)) {
    const idx = headers.indexOf(key);
    if (idx !== -1) row[idx] = value;
  }
  await updateRow('Personnel_Index', rowIndex, row);
  return true;
}

module.exports = {
  readSheet,
  appendRow,
  updateRow,
  deleteRow,
  findRowByDiscordId,
  getMemberFromIndex,
  updatePersonnelIndex,
};
