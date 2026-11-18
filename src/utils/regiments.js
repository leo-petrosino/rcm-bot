const { REGIMENTS, getRegimentById } = require('../../config');
const { readSheet, appendRow, updateRow, getMemberFromIndex, updatePersonnelIndex, findRowByDiscordId } = require('./sheets');

/**
 * Returns summary stats for all 5 regiments
 */
async function getRegimentSummaries() {
  const rows = await readSheet('Personnel_Index');
  const counts = {};
  REGIMENTS.forEach(r => (counts[r.id] = 0));

  if (rows.length > 7) {
    const headers = rows[6]; // Table header row in Personnel_Index
    const regIdx = headers.indexOf('Regiment');
    const statusIdx = headers.indexOf('Status');

    for (let i = 7; i < rows.length; i++) {
      const regId = rows[i][regIdx];
      const status = rows[i][statusIdx];
      if (regId && counts[regId] !== undefined && status === 'Active') {
        counts[regId]++;
      }
    }
  }

  return REGIMENTS.map(reg => ({
    ...reg,
    activeStrength: counts[reg.id] || 0,
  }));
}

/**
 * Assigns a user to a regiment in Personnel_Index and Regiments tab
 */
async function assignMemberToRegiment({ discordId, regimentId, regimentalRole = 'Enlisted', executorDiscord, notes = '' }) {
  const reg = getRegimentById(regimentId);
  if (!reg) throw new Error(`Regiment "${regimentId}" not recognized.`);

  const member = await getMemberFromIndex(discordId);
  if (!member) throw new Error('Member is not in the personnel database.');

  const now = new Date().toISOString();

  // Update in Personnel_Index
  await updatePersonnelIndex(discordId, {
    Regiment: reg.id,
    Last_Updated: now,
  });

  // Update class sheet if present
  if (member.Class) {
    try {
      const foundInClass = await findRowByDiscordId(member.Class, discordId);
      if (foundInClass) {
        const { row, rowIndex, headers } = foundInClass;
        let col = headers.indexOf('Regiment');
        if (col === -1) col = headers.indexOf('Branch');
        if (col !== -1) {
          row[col] = reg.id;
          await updateRow(member.Class, rowIndex, row);
        }
      }
    } catch (err) {
      console.warn('[Regiments] Class sheet sync warning:', err.message);
    }
  }

  // Append entry in Regiments tab
  await appendRow('Regiments', [
    discordId,
    member.Roblox_ID || '',
    member.Roblox_Username || '',
    regimentalRole,
    member.Current_Rank || 'Cadet',
    'Active',
    now,
    notes || `Assigned by <@${executorDiscord}>`,
  ]);

  return reg;
}

/**
 * Removes a member from their current regiment
 */
async function removeMemberFromRegiment(discordId, reason = '') {
  const member = await getMemberFromIndex(discordId);
  if (!member) throw new Error('Member not found in database.');

  const oldRegiment = member.Regiment || 'None';
  const now = new Date().toISOString();

  await updatePersonnelIndex(discordId, {
    Regiment: 'Unassigned',
    Last_Updated: now,
  });

  // Update class sheet if present
  if (member.Class) {
    try {
      const foundInClass = await findRowByDiscordId(member.Class, discordId);
      if (foundInClass) {
        const { row, rowIndex, headers } = foundInClass;
        let col = headers.indexOf('Regiment');
        if (col === -1) col = headers.indexOf('Branch');
        if (col !== -1) {
          row[col] = 'Unassigned';
          await updateRow(member.Class, rowIndex, row);
        }
      }
    } catch (err) {
      console.warn('[Regiments] Class sheet sync warning:', err.message);
    }
  }

  return oldRegiment;
}

module.exports = {
  getRegimentSummaries,
  assignMemberToRegiment,
  removeMemberFromRegiment,
};
