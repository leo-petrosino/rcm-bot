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
 * All 9 rank class tabs in the Canadian Armed Forces structure
 */
const CLASS_TABS = [
  { name: 'Senior_Generals', color: '#581845' },
  { name: 'Division_Commanders', color: '#900C3F' },
  { name: 'Senior_Formation', color: '#C70039' },
  { name: 'Senior_Officers', color: '#8B0000' },
  { name: 'Junior_Officers', color: '#1B4965' },
  { name: 'Subordinate_Officers', color: '#2B580C' },
  { name: 'Senior_NCOs', color: '#1E293B' },
  { name: 'Junior_NCOs', color: '#334155' },
  { name: 'Enlisted', color: '#0F172A' },
];

/**
 * Applies executive styling to the entire Royal Canadian Military Spreadsheet:
 * 1. Banner & Executive CAF Title Block on Personnel_Index
 * 2. Real-time KPI Metric Cards
 * 3. All 9 Class Tabs Formatted (Headers, Column Widths, Frozen Rows, Status Highlights)
 * 4. Distinct Regiment Roster Blocks
 * 5. Audit, Strike, Discharged, Blacklist, LWA, and Rank_Matrix Tabs
 */
async function formatEntireSpreadsheet() {
  console.log('[SheetsFormat] Initializing executive CAF spreadsheet formatting across all tabs...');

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
    ...CLASS_TABS.map(t => t.name),
  ];

  for (const tab of coreTabs) {
    await ensureSheetExists(tab);
  }

  // 1. Format Master Personnel_Index (Title Banner, KPI cards, Table)
  await formatPersonnelIndexSheet();

  // 2. Format Regiments Sheet (Blocks for all 5 regiments)
  await formatRegimentsSheet();

  // 3. Format all 9 Rank Class Tabs
  for (const tab of CLASS_TABS) {
    await formatClassSheet(tab.name, tab.color);
  }

  // 4. Format LWA tab
  await formatClassSheet('LWA', '#C2410C');

  // 5. Format Audit and Disciplinary logs
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

  await formatRankMatrixSheet();

  console.log('[SheetsFormat] Executive formatting successfully applied to all tabs!');
  return true;
}

/**
 * Formats the Master Personnel_Index sheet with CAF executive styling
 */
async function formatPersonnelIndexSheet() {
  const sheetId = await getSheetId('Personnel_Index');

  // Insert Header Banner & KPI Cards into Rows 1-7 (preserving existing rows 8+)
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
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 7, startColumnIndex: 7, endColumnIndex: 8 }],
          booleanRule: {
            condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'LWA' }] },
            format: {
              backgroundColor: hexToColor('#FEF3C7'),
              textFormat: { foregroundColor: hexToColor('#B45309'), bold: true },
            },
          },
        },
        index: 3,
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
}

/**
 * Formats any individual Rank Class tab (Enlisted, Senior_NCOs, Junior_Officers, etc.)
 */
async function formatClassSheet(sheetName, bannerColor = '#1E293B') {
  const sheetId = await getSheetId(sheetName);

  const defaultHeaders = [
    'Discord_ID', 'Roblox_ID', 'Roblox_Username', 'Rank', 'Rank_Level',
    'Branch', 'Join_Date', 'Last_Promotion', 'Strike_Count', 'Total_Strikes',
    'Status', 'LOA_Until', 'Notes'
  ];

  // Check if headers already exist
  const existingRows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:M1`,
  });

  if (!existingRows.data.values || existingRows.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:M1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [defaultHeaders] },
    });
  }

  const requests = [
    // Header row styling (Row 1)
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 13 },
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
    // Freeze header row
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    // Column widths
    ...setColumnWidthRequests(sheetId, [
      180, // Discord_ID
      120, // Roblox_ID
      160, // Roblox_Username
      180, // Rank
      80,  // Rank_Level
      130, // Branch
      120, // Join_Date
      120, // Last_Promotion
      90,  // Strike_Count
      90,  // Total_Strikes
      110, // Status
      110, // LOA_Until
      200, // Notes
    ]),
    // Conditional formatting for Status column (Index 10 / Col K)
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 10, endColumnIndex: 11 }],
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
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 10, endColumnIndex: 11 }],
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
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 10, endColumnIndex: 11 }],
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

  let currentRow = 4;
  const blockHeaderIndices = [];

  for (const reg of REGIMENTS) {
    blockHeaderIndices.push(currentRow - 1);
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
    initialValues.push(['', '', '', '', '', '', '', '']);
    initialValues.push(['', '', '', '', '', '', '', '']);
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
 * Formats Rank_Matrix sheet
 */
async function formatRankMatrixSheet() {
  const sheetId = await getSheetId('Rank_Matrix');

  const requests = [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
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
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    ...setColumnWidthRequests(sheetId, [70, 200, 100, 160, 140, 140, 180, 180]),
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
}

/**
 * Standard formatter for log/audit tabs (Audit_Log, Strike_Log, Discharged, Blacklist)
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
