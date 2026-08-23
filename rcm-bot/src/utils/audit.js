const { appendRow } = require('./sheets');

async function logAudit({ action, targetDiscord, targetRoblox, oldRank, newRank, oldStrikes, newStrikes, executorDiscord, executorRank, reason, robloxChanged }) {
  const timestamp = new Date().toISOString();
  await appendRow('Audit_Log', [
    timestamp,
    action,
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
}

module.exports = { logAudit };
