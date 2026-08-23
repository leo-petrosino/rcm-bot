const { getMemberFromIndex, readSheet, appendRow, deleteRow, updatePersonnelIndex } = require('../utils/sheets');
const { logAudit } = require('../utils/audit');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member, client) {
    if (member.guild.id !== process.env.GUILD_ID) return;

    const targetData = await getMemberFromIndex(member.id);
    if (!targetData) return;
    if (targetData.Status === 'Discharged' || targetData.Status === 'LWA') return;

    const oldSheet = targetData.Current_Sheet;
    const now = new Date().toISOString();

    try {
      const oldRows = await readSheet(oldSheet);
      const oldHeaders = oldRows[0];
      const discordIdx = oldHeaders.indexOf('Discord_ID');
      let oldRowData = null;
      let oldRowIndex = -1;

      for (let i = 1; i < oldRows.length; i++) {
        if (oldRows[i][discordIdx] === member.id) {
          oldRowData = oldRows[i];
          oldRowIndex = i + 1;
          break;
        }
      }

      if (oldRowData) {
        await appendRow('LWA', [
          member.id,
          targetData.Roblox_ID,
          targetData.Roblox_Username,
          targetData.Current_Rank,
          targetData.Rank_Level,
          oldRowData[oldHeaders.indexOf('Branch')] || '',
          oldRowData[oldHeaders.indexOf('Join_Date')] || '',
          oldRowData[oldHeaders.indexOf('Last_Promotion')] || '',
          oldRowData[oldHeaders.indexOf('Strike_Count')] || '0',
          oldRowData[oldHeaders.indexOf('Total_Strikes')] || '0',
          'LWA',
          now,
          'Left Discord server without discharge',
        ]);
        await deleteRow(oldSheet, oldRowIndex);
      }
    } catch (err) {
      console.error('LWA move failed:', err);
    }

    await updatePersonnelIndex(member.id, {
      Status: 'LWA',
      Current_Sheet: 'LWA',
      Last_Updated: now,
    });

    await logAudit({
      action: 'LWA',
      targetDiscord: member.id,
      targetRoblox: targetData.Roblox_ID,
      oldRank: targetData.Current_Rank,
      newRank: 'LWA',
      executorDiscord: 'SYSTEM',
      executorRank: 'SYSTEM',
      reason: 'Member left Discord server',
      robloxChanged: false,
    });

    console.log(`[LWA] ${member.user.tag} (${member.id}) flagged as Left Without Discharge`);
  },
};
