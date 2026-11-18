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

const RANK_CLASS_SHEETS = [
  'Senior_Generals',
  'Division_Commanders',
  'Senior_Formation',
  'Senior_Officers',
  'Junior_Officers',
  'Subordinate_Officers',
  'Senior_NCOs',
  'Junior_NCOs',
  'Enlisted',
];

/**
 * Synchronizes a member's record in the 9 Class tabs.
 * If the member changes rank class, they are removed from other class tabs and appended to the new class tab.
 * If they remain in the same class, their row is updated in-place.
 */
async function syncMemberClassSheet({ discordId, targetRank, targetData = null, oldClassHint = null }) {
  if (!discordId || !targetRank) return;

  const { getRankByName, getRankByLevel } = require('../../config');
  let rankObj = targetRank;
  if (typeof targetRank === 'string') {
    rankObj = getRankByName(targetRank);
  } else if (typeof targetRank === 'number') {
    rankObj = getRankByLevel(targetRank);
  }
  if (!rankObj) return;

  const targetClassSheet = rankObj.class || rankObj.sheet;
  if (!RANK_CLASS_SHEETS.includes(targetClassSheet)) return;

  // Fetch target data from Personnel_Index if not passed
  let memberData = targetData;
  if (!memberData || !memberData.Roblox_ID) {
    memberData = await getMemberFromIndex(discordId);
  }
  if (!memberData) return;

  const now = new Date().toISOString();
  let foundInTargetSheet = false;

  // Check all 9 class sheets for any existing rows for this member
  for (const sheetName of RANK_CLASS_SHEETS) {
    try {
      const found = await findRowByDiscordId(sheetName, discordId);
      if (found) {
        if (sheetName === targetClassSheet) {
          // Update in-place in the target sheet
          const { row, rowIndex, headers } = found;
          const rankIdx = headers.indexOf('Rank') !== -1 ? headers.indexOf('Rank') : headers.indexOf('Current_Rank');
          if (rankIdx !== -1) row[rankIdx] = rankObj.name;
          const levelIdx = headers.indexOf('Rank_Level');
          if (levelIdx !== -1) row[levelIdx] = String(rankObj.level);
          const promoIdx = headers.indexOf('Last_Promotion');
          if (promoIdx !== -1) row[promoIdx] = now;
          const updatedIdx = headers.indexOf('Last_Updated');
          if (updatedIdx !== -1) row[updatedIdx] = now;

          await updateRow(sheetName, rowIndex, row);
          foundInTargetSheet = true;
        } else {
          // Stale entry in an old/wrong class sheet -> delete row
          await deleteRow(sheetName, found.rowIndex);
        }
      }
    } catch (err) {
      console.warn(`[Sheets] Warning checking ${sheetName} for ${discordId}:`, err.message);
    }
  }

  // If the member was not already in the target sheet, append them!
  if (!foundInTargetSheet) {
    try {
      await ensureSheetExists(targetClassSheet);
      const classRows = await readSheet(targetClassSheet);
      const { headers } = findHeaderRow(classRows, 'discord');

      const effectiveHeaders = headers.length > 0 ? headers : [
        'Discord_ID', 'Roblox_ID', 'Roblox_Username', 'Rank', 'Rank_Level',
        'Branch', 'Join_Date', 'Last_Promotion', 'Strike_Count', 'Total_Strikes',
        'Status', 'LOA_Until', 'Notes'
      ];

      const newRow = new Array(effectiveHeaders.length).fill('');
      const setCell = (colName, val) => {
        const idx = effectiveHeaders.findIndex(h => h.toLowerCase() === colName.toLowerCase());
        if (idx !== -1) newRow[idx] = String(val ?? '');
      };

      setCell('Discord_ID', discordId);
      setCell('Roblox_ID', memberData.Roblox_ID || '');
      setCell('Roblox_Username', memberData.Roblox_Username || '');
      setCell('Rank', rankObj.name);
      setCell('Current_Rank', rankObj.name);
      setCell('Rank_Level', String(rankObj.level));
      setCell('Branch', memberData.Regiment || memberData.Branch || 'Unassigned');
      setCell('Regiment', memberData.Regiment || memberData.Branch || 'Unassigned');
      setCell('Join_Date', memberData.Join_Date || now);
      setCell('Last_Promotion', now);
      setCell('Last_Updated', now);
      setCell('Strike_Count', memberData.Strike_Count || '0');
      setCell('Total_Strikes', memberData.Total_Strikes || memberData.Strike_Count || '0');
      setCell('Status', memberData.Status || 'Active');
      setCell('LOA_Until', memberData.LOA_Until || '');
      setCell('Notes', memberData.Notes || '');

      await appendRow(targetClassSheet, newRow);
    } catch (err) {
      console.error(`[Sheets] Error appending to class sheet ${targetClassSheet}:`, err.message);
    }
  }
}

/**
 * Removes a member from all 9 class sheets (used on discharge, blacklist, or LWA)
 */
async function removeMemberFromClassSheets(discordId) {
  if (!discordId) return;
  for (const sheetName of RANK_CLASS_SHEETS) {
    try {
      const found = await findRowByDiscordId(sheetName, discordId);
      if (found) {
        await deleteRow(sheetName, found.rowIndex);
      }
    } catch (err) {
      console.warn(`[Sheets] Warning removing ${discordId} from ${sheetName}:`, err.message);
    }
  }
}

/**
 * Fully reconciles all members from Personnel_Index into their respective Class sheets.
 */
async function syncAllClassSheets() {
  const { getRankByName, getRankByLevel } = require('../../config');
  const indexRows = await readSheet('Personnel_Index');
  if (indexRows.length === 0) return { synced: 0, moved: 0 };

  const { headerIndex, headers } = findHeaderRow(indexRows, 'discord');
  if (headerIndex === -1) return { synced: 0, moved: 0 };

  const discordIdx = headers.indexOf('Discord_ID');
  const robloxIdIdx = headers.indexOf('Roblox_ID');
  const userIdx = headers.indexOf('Roblox_Username');
  const rankIdx = headers.indexOf('Rank') !== -1 ? headers.indexOf('Rank') : headers.indexOf('Current_Rank');
  const levelIdx = headers.indexOf('Rank_Level');
  const regIdx = headers.indexOf('Regiment') !== -1 ? headers.indexOf('Regiment') : headers.indexOf('Branch');
  const statusIdx = headers.indexOf('Status');
  const joinIdx = headers.indexOf('Join_Date');
  const strikeIdx = headers.indexOf('Strike_Count');

  // Extract all active members from Personnel_Index
  const members = [];
  for (let i = headerIndex + 1; i < indexRows.length; i++) {
    const r = indexRows[i];
    if (!r || !r[discordIdx]) continue;
    const discordId = String(r[discordIdx]).trim();
    if (!discordId) continue;

    const rankName = r[rankIdx] || '';
    const rankLevel = parseInt(r[levelIdx] || '1', 10);
    const rankObj = getRankByName(rankName) || getRankByLevel(rankLevel) || getRankByLevel(1);

    members.push({
      discordId,
      robloxId: r[robloxIdIdx] || '',
      robloxUsername: r[userIdx] || '',
      rank: rankObj.name,
      rankLevel: String(rankObj.level),
      class: rankObj.class,
      regiment: r[regIdx] || 'Unassigned',
      status: r[statusIdx] || 'Active',
      joinDate: r[joinIdx] || '',
      strikeCount: r[strikeIdx] || '0',
    });
  }

  let movedCount = 0;

  // 1. Clean up stale / misplaced members from each class sheet
  for (const classSheet of RANK_CLASS_SHEETS) {
    try {
      const sheetRows = await readSheet(classSheet);
      const { headerIndex: classHdrIdx, headers: classHdrs } = findHeaderRow(sheetRows, 'discord');

      if (classHdrIdx !== -1 && sheetRows.length > classHdrIdx + 1) {
        let classDiscordIdx = classHdrs.indexOf('Discord_ID');
        if (classDiscordIdx === -1) {
          classDiscordIdx = classHdrs.findIndex(h => h.toLowerCase().includes('discord'));
        }
        if (classDiscordIdx !== -1) {
          for (let j = sheetRows.length - 1; j > classHdrIdx; j--) {
            const row = sheetRows[j];
            if (!row || !row[classDiscordIdx]) continue;
            const dId = String(row[classDiscordIdx]).trim();
            const expectedMember = members.find(m => m.discordId === dId);

            if (!expectedMember || expectedMember.class !== classSheet || expectedMember.status === 'Discharged') {
              await deleteRow(classSheet, j + 1);
              movedCount++;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Sheets] Warning cleaning up ${classSheet}:`, err.message);
    }
  }

  // 2. Ensure each active member is in their correct class sheet
  for (const m of members) {
    if (m.status === 'Discharged') continue;
    try {
      const found = await findRowByDiscordId(m.class, m.discordId);
      if (!found) {
        await ensureSheetExists(m.class);
        const classRows = await readSheet(m.class);
        const { headers: cHdrs } = findHeaderRow(classRows, 'discord');
        const effHdrs = cHdrs.length > 0 ? cHdrs : [
          'Discord_ID', 'Roblox_ID', 'Roblox_Username', 'Rank', 'Rank_Level',
          'Branch', 'Join_Date', 'Last_Promotion', 'Strike_Count', 'Total_Strikes',
          'Status', 'LOA_Until', 'Notes'
        ];
        const newRow = new Array(effHdrs.length).fill('');
        const setCell = (colName, val) => {
          const idx = effHdrs.findIndex(h => h.toLowerCase() === colName.toLowerCase());
          if (idx !== -1) newRow[idx] = String(val ?? '');
        };
        setCell('Discord_ID', m.discordId);
        setCell('Roblox_ID', m.robloxId);
        setCell('Roblox_Username', m.robloxUsername);
        setCell('Rank', m.rank);
        setCell('Current_Rank', m.rank);
        setCell('Rank_Level', m.rankLevel);
        setCell('Branch', m.regiment);
        setCell('Regiment', m.regiment);
        setCell('Join_Date', m.joinDate || new Date().toISOString());
        setCell('Last_Promotion', new Date().toISOString());
        setCell('Last_Updated', new Date().toISOString());
        setCell('Strike_Count', m.strikeCount);
        setCell('Total_Strikes', m.strikeCount);
        setCell('Status', m.status);

        await appendRow(m.class, newRow);
        movedCount++;
      } else {
        const { row, rowIndex, headers: cHdrs } = found;
        const rankIdxInClass = cHdrs.indexOf('Rank') !== -1 ? cHdrs.indexOf('Rank') : cHdrs.indexOf('Current_Rank');
        const levelIdxInClass = cHdrs.indexOf('Rank_Level');
        let needsUpdate = false;
        if (rankIdxInClass !== -1 && row[rankIdxInClass] !== m.rank) {
          row[rankIdxInClass] = m.rank;
          needsUpdate = true;
        }
        if (levelIdxInClass !== -1 && row[levelIdxInClass] !== m.rankLevel) {
          row[levelIdxInClass] = m.rankLevel;
          needsUpdate = true;
        }
        if (needsUpdate) {
          await updateRow(m.class, rowIndex, row);
          movedCount++;
        }
      }
    } catch (err) {
      console.warn(`[Sheets] Warning syncing member ${m.discordId} to ${m.class}:`, err.message);
    }
  }

  return { synced: members.length, moved: movedCount };
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
  RANK_CLASS_SHEETS,
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
  syncMemberClassSheet,
  removeMemberFromClassSheets,
  syncAllClassSheets,
  batchUpdateSpreadsheet,
};
