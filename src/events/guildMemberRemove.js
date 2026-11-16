const { getMemberFromIndex, appendRow, updatePersonnelIndex } = require('../utils/sheets');
const { logAudit } = require('../utils/audit');
const { GUILD_ID } = require('../../config');

module.exports = {
  name: 'guildMemberRemove',
  once: false,
  async execute(member, client) {
    if (member.guild.id !== (process.env.GUILD_ID || GUILD_ID)) return;

    const targetData = await getMemberFromIndex(member.id);
    if (!targetData) return;

    // Skip if already formally discharged, blacklisted, or already marked LWA
    if (
      targetData.Status === 'Discharged' ||
      targetData.Status === 'LWA' ||
      targetData.Status === 'Blacklisted'
    ) {
      return;
    }

    const now = new Date().toISOString();

    try {
      // Record in LWA tab
      await appendRow('LWA', [
        member.id,
        targetData.Roblox_ID || '',
        targetData.Roblox_Username || '',
        targetData.Current_Rank || 'Cadet',
        targetData.Rank_Level || '1',
        targetData.Regiment || 'None',
        targetData.Join_Date || '',
        'LWA',
        now,
        'Departed Discord server without official discharge decree',
      ]);

      // Update Personnel_Index
      await updatePersonnelIndex(member.id, {
        Status: 'LWA',
        Last_Updated: now,
      });

      // Log Audit
      await logAudit({
        action: 'LWA',
        targetDiscord: member.id,
        targetRoblox: targetData.Roblox_ID,
        oldRank: targetData.Current_Rank,
        newRank: 'LWA (Deserter)',
        executorDiscord: 'SYSTEM',
        executorRank: 'SYSTEM',
        reason: 'Member severed Discord membership without authorization (LWA)',
        robloxChanged: false,
        client,
      });

      console.log(`[LWA Watchdog] Flagged ${member.user.tag} (${member.id}) as Left Without Discharge (LWA).`);
    } catch (err) {
      console.error('[LWA Watchdog] Error handling departing member:', err.message);
    }
  },
};
