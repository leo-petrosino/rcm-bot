const { RUNTIME_CACHE, getRankByLevel, getRankByName } = require('../../config');
const { PermissionFlagsBits } = require('discord.js');

/**
 * Checks if a member or Discord ID is designated as an authorized developer
 */
function isDeveloper(memberOrId) {
  if (!memberOrId) return false;
  const id = typeof memberOrId === 'string' ? memberOrId : memberOrId.id;

  // 1. Check DEVELOPER_IDS in env (comma-separated list of Discord IDs)
  const devIds = (process.env.DEVELOPER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (devIds.includes(id)) return true;

  // 2. Check DEVELOPER_ID or OWNER_ID
  if (process.env.DEVELOPER_ID && process.env.DEVELOPER_ID.trim() === id) return true;
  if (process.env.OWNER_ID && process.env.OWNER_ID.trim() === id) return true;

  // 3. Check Discord Server Owner
  if (typeof memberOrId === 'object' && memberOrId.guild && memberOrId.guild.ownerId === id) {
    return true;
  }

  return false;
}

/**
 * Virtual rank granted to developers for supreme command authority
 */
const DEVELOPER_RANK = {
  level: 99,
  name: 'Developer / Supreme Command',
  abbr: 'DEV',
  class: 'Developer',
  canPromote: true,
  canStrike: true,
  canDischarge: true,
  canEditProfile: true,
  canBatchPromote: true,
  canAudit: true,
  canBlacklist: true,
  canManageRegiment: true,
  isDeveloper: true,
};

/**
 * Resolves a Discord GuildMember's current highest recognized CAF rank
 */
function getMemberRank(member) {
  if (!member) return null;

  // Developer bypass strictly for designated developer IDs
  if (isDeveloper(member)) {
    return DEVELOPER_RANK;
  }

  if (!member.roles) return null;

  // Scan from highest level (19) down to level 1
  for (let level = 19; level >= 1; level--) {
    const rank = getRankByLevel(level);
    if (!rank) continue;

    // Check by role ID if mapped
    if (rank.roleId && member.roles.cache.has(rank.roleId)) {
      return rank;
    }

    // Fallback: Check by exact role name or abbreviation match in member's roles
    const matchedRole = member.roles.cache.find(
      r => r.name.toLowerCase() === rank.name.toLowerCase() || r.name.toLowerCase() === rank.abbr.toLowerCase()
    );
    if (matchedRole) {
      rank.roleId = matchedRole.id; // Dynamically bind role ID
      return rank;
    }
  }

  return null;
}

/**
 * Checks if executor can promote target to new rank level
 */
function canPromote(executorRank, targetCurrentLevel, newLevel) {
  if (!executorRank) return false;
  // Developer override
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;

  if (!executorRank.canPromote) return false;
  const targetLevel = Number(targetCurrentLevel);
  const nextLevel = Number(newLevel);
  const execLevel = Number(executorRank.level);

  if (isNaN(targetLevel) || isNaN(nextLevel) || isNaN(execLevel)) return false;
  if (targetLevel >= execLevel) return false;
  if (nextLevel >= execLevel) return false;
  if (nextLevel !== targetLevel + 1) return false;
  return true;
}

/**
 * Checks if executor can demote target
 */
function canDemote(executorRank, targetCurrentLevel, newLevel) {
  if (!executorRank) return false;
  // Developer override
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;

  if (!executorRank.canPromote) return false;
  const targetLevel = Number(targetCurrentLevel);
  const nextLevel = Number(newLevel);
  const execLevel = Number(executorRank.level);

  if (isNaN(targetLevel) || isNaN(nextLevel) || isNaN(execLevel)) return false;
  if (targetLevel >= execLevel) return false;
  if (nextLevel < 1) return false;
  if (nextLevel >= targetLevel) return false;
  return true;
}

/**
 * Checks direct rank setting authority (Major+ or Developer)
 */
function canSetRank(executorRank, newLevel) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;

  if (executorRank.level < 13) return false; // Major+
  if (newLevel >= executorRank.level) return false;
  return true;
}

/**
 * Checks strike authority (Captain+ or Developer)
 */
function canStrike(executorRank) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;
  return Boolean(executorRank.canStrike);
}

/**
 * Checks pardon authority (Equal or higher rank than issuer, or Developer)
 */
function canPardon(executorRank, issuerRankLevel) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;
  return executorRank.level >= (issuerRankLevel || 1);
}

/**
 * Checks discharge authority (Captain+ or Developer)
 */
function canDischarge(executorRank, targetCurrentLevel) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;
  if (!executorRank.canDischarge) return false;
  return targetCurrentLevel < executorRank.level;
}

/**
 * Checks profile edit authority (Major+ or Developer)
 */
function canEditProfile(executorRank) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;
  return Boolean(executorRank.canEditProfile);
}

/**
 * Checks batch promote authority (Captain+ or Developer)
 */
function canBatchPromote(executorRank) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;
  return Boolean(executorRank.canBatchPromote);
}

/**
 * Checks audit log view authority (Sergeant+ or Developer)
 */
function canAudit(executorRank) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;
  return Boolean(executorRank.canAudit);
}

/**
 * Checks regiment management authority (Captain+ or Developer)
 */
function canManageRegiment(executorRank) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;
  return Boolean(executorRank.canManageRegiment);
}

/**
 * Checks community blacklist authority (Colonel+ or Developer)
 */
function canBlacklist(executorRank) {
  if (!executorRank) return false;
  if (executorRank.isDeveloper || executorRank.level >= 90) return true;
  return Boolean(executorRank.canBlacklist || executorRank.level >= 15);
}

module.exports = {
  isDeveloper,
  getMemberRank,
  canPromote,
  canDemote,
  canSetRank,
  canStrike,
  canPardon,
  canDischarge,
  canEditProfile,
  canBatchPromote,
  canAudit,
  canManageRegiment,
  canBlacklist,
};
