const { appendRow } = require('./sheets');
const { RcmEmbed } = require('./embeds');

/**
 * Logs an action to Google Sheets Audit_Log and optionally broadcasts to Discord audit channel
 */
async function logAudit({
  action,
  targetDiscord,
  targetRoblox,
  oldRank,
  newRank,
  oldStrikes,
  newStrikes,
  executorDiscord,
  executorRank,
  reason,
  robloxChanged = false,
  client = null,
}) {
  const timestamp = new Date().toISOString();

  // 1. Append to Google Sheets Audit_Log
  try {
    await appendRow('Audit_Log', [
      timestamp,
      action || 'UNKNOWN',
      targetDiscord || '',
      targetRoblox || '',
      oldRank || '',
      newRank || '',
      oldStrikes !== undefined ? String(oldStrikes) : '',
      newStrikes !== undefined ? String(newStrikes) : '',
      executorDiscord || '',
      executorRank || '',
      reason || '',
      robloxChanged ? 'TRUE' : 'FALSE',
    ]);
  } catch (err) {
    console.error('[Audit] Failed to append to Google Sheets Audit_Log:', err.message);
  }

  // 2. Broadcast to Discord Audit channel if configured
  const auditChannelId = process.env.AUDIT_CHANNEL_ID;
  if (client && auditChannelId) {
    try {
      const channel = await client.channels.fetch(auditChannelId);
      if (channel && channel.isTextBased()) {
        const embed = RcmEmbed.base(`AUDIT DISPATCH • [${action}]`)
          .addFields(
            { name: 'Target', value: targetDiscord ? `<@${targetDiscord}>` : 'N/A', inline: true },
            { name: 'Executor', value: executorDiscord ? `<@${executorDiscord}> (${executorRank || 'N/A'})` : 'SYSTEM', inline: true },
            { name: 'Roblox Sync', value: robloxChanged ? '✅ Updated' : '➖ Unchanged', inline: true },
            { name: 'Details', value: `${oldRank ? `${oldRank} → ` : ''}${newRank || 'N/A'}`, inline: true },
            { name: 'Reason', value: reason || 'No rationale logged', inline: false }
          );
        await channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.warn('[Audit] Failed to broadcast audit to Discord channel:', err.message);
    }
  }
}

module.exports = { logAudit };
