const { sheets, SPREADSHEET_ID, getSheetId, ensureSheetExists } = require('./sheets');
const { REGIMENTS } = require('../../config');

/**
 * Converts Hex (#RRGGBB) to Google Sheets Color object (values 0.0 - 1.0)
 */
function hexToColor(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return { red: r, green: g, blue: b };
}

/**
 * Applies executive styling to the entire Royal Canadian Military Spreadsheet:
 * 1. Banner & Executive CAF Title Block
 * 2. Real-time KPI Metric Cards
 * 3. Formatted Headers, Column Widths, and Row Freezing
 * 4. Conditional Status Highlighting (Active, LOA, Discharged, LWA)
 * 5. Distinct Regiment Roster Blocks
 */
async function formatEntireSpreadsheet() {
  console.log('[SheetsFormat] Initializing executive CAF spreadsheet formatting...');

  // Ensure all core tabs exist
  const coreTabs = [
    'Personnel_Index',
    'Regiments',
    'Rank_Matrix',
    'Audit_Log',
    'Strike_Log',
    'Discharged',
    'Blacklist',
    'LWA',
  ];

  for (const tab of coreTabs) {
    await ensureSheetExists(tab);
  }

  // 1. Format Personnel_Index (Master Personnel Roster)
  await formatPersonnelIndexSheet();

  // 2. Format Regiments Sheet (Block layout for all 5 regiments)
  await formatRegimentsSheet();

  // 3. Format Audit and Strike logs
  await formatLogSheet('Audit_Log', [
    'Timestamp', 'Action', 'Target_Discord', 'Target_Roblox', 'Old_Rank',
    'New_Rank', 'Old_Strikes', 'New_Strikes', 'Executor_Discord', 'Executor_Rank',
    'Reason', 'Roblox_Updated'
  ], '#8B0000');

  await formatLogSheet('Strike_Log', [
    'Strike_ID', 'Target_Discord', 'Date_Issued', 'Issued_By', 'Severity',
    'Reason', 'Status', 'Pardoned_By', 'Pardon_Date'
  ], '#B91C1C');

  await formatLogSheet('Discharged', [
    'Discord_ID', 'Roblox_ID', 'Roblox_Username', 'Last_Rank', 'Rank_Level',
    'Regiment', 'Join_Date', 'Discharge_Type', 'Discharge_Date', 'Reason'
  ], '#780000');

  await formatLogSheet('Blacklist', [
    'Roblox_ID', 'Roblox_Username', 'Discord_ID', 'Date_Added', 'Added_By',
    'Severity', 'Reason', 'Proof_Link', 'Status'
  ], '#1C1917');

  console.log('[SheetsFormat] Formatting successfully applied to all tabs!');
  return true;
}

/**
 * Formats the Master Personnel_Index sheet with CAF executive styling
 */
async function formatPersonnelIndexSheet() {
  const sheetId = await getSheetId('Personnel_Index');

  // Insert Header Banner & KPI Cards into Cells
  const initialValues = [
    ['🇨🇦 ROYAL CANADIAN MILITARY — PERSONNEL COMMAND ROSTER', '', '', '', '', '', '', '', '', '', ''],
    ['MASTER SERVICE INDEX • CLASSIFIED MIL-SIM LOGISTICS RECORD • AUTOMATICALLY SYNCHRONIZED', '', '', '', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', ''],
    ['TOTAL STRENGTH', 'ACTIVE FORCES', 'ON LEAVE (LOA)', 'DISCIPLINE ACTION', '', '', '', '', '', '', ''],
    ['=COUNTA(A8:A)', '=COUNTIF(H8:H, "Active")', '=COUNTIF(H8:H, "LOA")', '=COUNTIF(J8:J, ">=3")', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', '', '', '', ''],
    [
      'Discord_ID',
      'Roblox_ID',
      'Roblox_Username',
      'Current_Rank',
      'Rank_Level',
      'Class',
      'Regiment',
      'Status',
      'Join_Date',
      'Strike_Count',
      'Last_Updated',
    ],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Personnel_Index!A1:K7',
    valueInputOption: 'USER_ENTERED',
    resource: { values: initialValues },
  });

  const requests = [
    // 1. Merge Title Banner (A1:K1 and A2:K2)
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 11 },
        mergeType: 'MERGE_ALL',
      },
    },

    // 2. Format Title Banner Style (Crimson background #8B0000, white bold text)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor('#8B0000'),
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 13 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor('#5B0000'),
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: hexToColor('#E2E8F0'), italic: true, fontSize: 9 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },

    // 3. Format KPI Metric Header Labels (Row 4, index 3)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor('#1E293B'),
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: hexToColor('#CBD5E1'), bold: true, fontSize: 9 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },

    // 4. Format KPI Metric Values (Row 5, index 4)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 0, endColumnIndex: 4 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor('#F1F5F9'),
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: hexToColor('#0F172A'), bold: true, fontSize: 15 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },

    // 5. Format Column Headers (Row 7, index 6)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor('#1E293B'),
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },

    // 6. Freeze Header rows (Freeze at row 7)
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 7 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },

    // 7. Column Widths
    ...setColumnWidthRequests(sheetId, [
      180, // Discord ID
      120, // Roblox ID
      160, // Roblox Username
      180, // Current Rank
      90,  // Level
      140, // Class
      160, // Regiment
      110, // Status
      120, // Join Date
      100, // Strike Count
      150, // Last Updated
    ]),

    // 8. Conditional Formatting for Status
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 7, startColumnIndex: 7, endColumnIndex: 8 }],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Active' }] },
            format: {
              backgroundColor: hexToColor('#DCFCE7'),
              textFormat: { foregroundColor: hexToColor('#166534'), bold: true },
            },
          },
        },
        index: 0,
      },
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 7, startColumnIndex: 7, endColumnIndex: 8 }],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'LOA' }] },
            format: {
              backgroundColor: hexToColor('#DBEAFE'),
              textFormat: { foregroundColor: hexToColor('#1E40AF'), bold: true },
            },
          },
        },
        index: 1,
      },
    },
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 7, startColumnIndex: 7, endColumnIndex: 8 }],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Discharged' }] },
            format: {
              backgroundColor: hexToColor('#FEE2E2'),
              textFormat: { foregroundColor: hexToColor('#991B1B'), bold: true },
            },
          },
        },
        index: 2,
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
}

/**
 * Formats the Regiments sheet into dedicated styled blocks for each of the 5 regiments
 */
async function formatRegimentsSheet() {
  const sheetId = await getSheetId('Regiments');

  // Build multi-block initial data for the 5 regiments
  const initialValues = [
    ['🇨🇦 ROYAL CANADIAN MILITARY — REGIMENTAL FORMATIONS & DIVISIONS', '', '', '', '', '', '', ''],
    ['MASTER ROSTER DIVIDED BY REGIMENTAL COMMANDS', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
  ];

  let currentRow = 4; // 1-based row pointer
  const blockHeaderIndices = [];

  for (const reg of REGIMENTS) {
    blockHeaderIndices.push(currentRow - 1); // 0-based
    initialValues.push([
      `${reg.emoji} ${reg.name.toUpperCase()} (${reg.id})`,
      `ROLE: ${reg.role}`,
      `MOTTO: ${reg.motto}`,
      '', '', '', '', ''
    ]);
    initialValues.push([
      'Discord_ID', 'Roblox_ID', 'Roblox_Username', 'Regimental_Role',
      'Main_Rank', 'Status', 'Assigned_Date', 'Notes'
    ]);
    initialValues.push(['', '', '', '', '', '', '', '']); // space
    initialValues.push(['', '', '', '', '', '', '', '']); // space
    currentRow += 4;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Regiments!A1:H25',
    valueInputOption: 'USER_ENTERED',
    resource: { values: initialValues },
  });

  const requests = [
    // Title Banner
    {
      mergeCells: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        mergeType: 'MERGE_ALL',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor('#8B0000'),
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 13 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },
    ...setColumnWidthRequests(sheetId, [180, 120, 160, 160, 160, 100, 120, 200]),
  ];

  // Format each regiment block header
  for (let i = 0; i < REGIMENTS.length; i++) {
    const reg = REGIMENTS[i];
    const headerRow = blockHeaderIndices[i];
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: headerRow, endRowIndex: headerRow + 1, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor(reg.color || '#1E293B'),
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
    // Table column headers below block title
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: headerRow + 1, endRowIndex: headerRow + 2, startColumnIndex: 0, endColumnIndex: 8 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor('#1E293B'),
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 9 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat)',
      },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
}

/**
 * Standard formatter for log/audit tabs (Audit_Log, Strike_Log, Discharged, etc.)
 */
async function formatLogSheet(sheetName, headers, bannerColor = '#8B0000') {
  const sheetId = await getSheetId(sheetName);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:${String.fromCharCode(64 + headers.length)}1`,
    valueInputOption: 'USER_ENTERED',
    resource: { values: [headers] },
  });

  const requests = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexToColor(bannerColor),
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
          },
        },
        fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
      },
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
}

/**
 * Helper to build column width requests
 */
function setColumnWidthRequests(sheetId, widths) {
  return widths.map((width, index) => ({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'COLUMNS',
        startIndex: index,
        endIndex: index + 1,
      },
      properties: { pixelSize: width },
      fields: 'pixelSize',
    },
  }));
}

module.exports = {
  formatEntireSpreadsheet,
};
