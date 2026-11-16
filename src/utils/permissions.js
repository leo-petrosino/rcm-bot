const { RUNTIME_CACHE, getRankByLevel, getRankByName } = require('../../config');
const { PermissionFlagsBits } = require('discord.js');

/**
 * Resolves a Discord GuildMember's current highest recognized CAF rank
 */
function getMemberRank(member) {
  if (!member || !member.roles) return null;

  // Check if member is a guild administrator (can bypass or act as highest rank)
  const isAdmin = member.permissions && member.permissions.has(PermissionFlagsBits.Administrator);

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

  // If guild admin has no specific rank role, default to Level 19 authority
  if (isAdmin) {
    return getRankByLevel(19);
  }

  return null;
}

/**
 * Checks if executor can promote target to new rank level
 */
function canPromote(executorRank, targetCurrentLevel, newLevel) {
  if (!executorRank || !executorRank.canPromote) return false;
  // Promoters cannot promote anyone to or above their own rank
  if (targetCurrentLevel >= executorRank.level) return false;
  if (newLevel >= executorRank.level) return false;
  // Standard promotion is exactly +1 level
  if (newLevel !== targetCurrentLevel + 1) return false;
  return true;
}

/**
 * Checks if executor can demote target
 */
function canDemote(executorRank, targetCurrentLevel, newLevel) {
  if (!executorRank || !executorRank.canPromote) return false;
  if (targetCurrentLevel >= executorRank.level) return false;
  if (newLevel < 1) return false;
  if (newLevel >= targetCurrentLevel) return false;
  return true;
}

/**
 * Checks direct rank setting authority (Major+ or Admin)
 */
function canSetRank(executorRank, newLevel) {
  if (!executorRank) return false;
  if (executorRank.level < 13) return false; // Major+
  if (newLevel >= executorRank.level) return false;
  return true;
}

/**
 * Checks strike authority (Captain+)
 */
function canStrike(executorRank) {
  return Boolean(executorRank && executorRank.canStrike);
}

/**
 * Checks pardon authority (Equal or higher rank than issuer)
 */
function canPardon(executorRank, issuerRankLevel) {
  if (!executorRank) return false;
  return executorRank.level >= (issuerRankLevel || 1);
}

/**
 * Checks discharge authority (Captain+)
 */
function canDischarge(executorRank, targetCurrentLevel) {
  if (!executorRank || !executorRank.canDischarge) return false;
  return targetCurrentLevel < executorRank.level;
}

/**
 * Checks profile edit authority (Major+)
 */
function canEditProfile(executorRank) {
  return Boolean(executorRank && executorRank.canEditProfile);
}

/**
 * Checks batch promote authority (Captain+)
 */
function canBatchPromote(executorRank) {
  return Boolean(executorRank && executorRank.canBatchPromote);
}

/**
 * Checks audit log view authority (Sergeant+)
 */
function canAudit(executorRank) {
  return Boolean(executorRank && executorRank.canAudit);
}

/**
 * Checks regiment management authority (Captain+)
 */
function canManageRegiment(executorRank) {
  return Boolean(executorRank && executorRank.canManageRegiment);
}

/**
 * Checks community blacklist authority (Colonel+)
 */
function canBlacklist(executorRank) {
  return Boolean(executorRank && (executorRank.canBlacklist || executorRank.level >= 15));
}

module.exports = {
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
