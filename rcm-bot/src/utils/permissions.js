const { getRankByLevel, getRankByRoleId } = require('../../config');

function getMemberRank(member) {
  if (!member || !member.roles) return null;
  for (let level = 19; level >= 1; level--) {
    const rank = getRankByLevel(level);
    if (rank && member.roles.cache.has(rank.roleId)) {
      return rank;
    }
  }
  return null;
}

function canPromote(executorRank, targetCurrentLevel, newLevel) {
  if (!executorRank || !executorRank.canPromote) return false;
  if (targetCurrentLevel >= executorRank.level) return false;
  if (newLevel >= executorRank.level) return false;
  if (newLevel !== targetCurrentLevel + 1) return false;
  return true;
}

function canDemote(executorRank, targetCurrentLevel, newLevel) {
  if (!executorRank || !executorRank.canPromote) return false;
  if (targetCurrentLevel >= executorRank.level) return false;
  if (newLevel < 1) return false;
  if (newLevel !== targetCurrentLevel - 1) return false;
  return true;
}

function canStrike(executorRank) {
  return executorRank && executorRank.canStrike;
}

function canPardon(executorRank, issuerRankLevel) {
  if (!executorRank) return false;
  return executorRank.level >= issuerRankLevel;
}

function canDischarge(executorRank, targetCurrentLevel) {
  return executorRank && executorRank.canDischarge && targetCurrentLevel < executorRank.level;
}

function canEditProfile(executorRank) {
  return executorRank && executorRank.canEditProfile;
}

function canBatchPromote(executorRank) {
  return executorRank && executorRank.canBatchPromote;
}

function canAudit(executorRank) {
  return executorRank && executorRank.canAudit;
}

module.exports = {
  getMemberRank,
  canPromote,
  canDemote,
  canStrike,
  canPardon,
  canDischarge,
  canEditProfile,
  canBatchPromote,
  canAudit,
};
