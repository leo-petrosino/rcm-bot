const RANKS = [
  { level: 19, name: 'General Chief of the Defence Staff', abbr: 'GEN CDS', class: 'Senior_Generals', sheet: 'Senior_Generals', roleId: '1536926538916696144', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true },
  { level: 18, name: 'Lieutenant General', abbr: 'LTG', class: 'Senior_Generals', sheet: 'Senior_Generals', roleId: '1536926542947684354', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true },
  { level: 17, name: 'Major General Division Commander', abbr: 'MGEN', class: 'Division_Commanders', sheet: 'Division_Commanders', roleId: '1536926541492125766', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true },
  { level: 16, name: 'Brigadier General', abbr: 'BGEN', class: 'Senior_Formation', sheet: 'Senior_Formation', roleId: '1536925819685838918', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true },
  { level: 15, name: 'Colonel', abbr: 'COL', class: 'Senior_Formation', sheet: 'Senior_Formation', roleId: '1537496715194671214', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true },
  { level: 14, name: 'Lieutenant Colonel', abbr: 'LTCOL', class: 'Senior_Officers', sheet: 'Senior_Officers', roleId: '1536925818125811854', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true },
  { level: 13, name: 'Major', abbr: 'MAJ', class: 'Senior_Officers', sheet: 'Senior_Officers', roleId: '1536925818792579072', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true },
  { level: 12, name: 'Captain', abbr: 'CPT', class: 'Junior_Officers', sheet: 'Junior_Officers', roleId: '1536925814413721720', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: false, canBatchPromote: true, canAudit: true },
  { level: 11, name: 'Lieutenant', abbr: 'LT', class: 'Junior_Officers', sheet: 'Junior_Officers', roleId: '1536925820541734982', canPromote: true, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true },
  { level: 10, name: 'Second Lieutenant', abbr: '2LT', class: 'Junior_Officers', sheet: 'Junior_Officers', roleId: '1536925811121061919', canPromote: true, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true },
  { level: 9, name: 'Officer Cadet', abbr: 'OCdt', class: 'Subordinate_Officers', sheet: 'Subordinate_Officers', roleId: '1536925820973752430', canPromote: true, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true },
  { level: 8, name: 'Chief Warrant Officer', abbr: 'CWO', class: 'Senior_NCOs', sheet: 'Senior_NCOs', roleId: '1536924353059495956', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true },
  { level: 7, name: 'Master Warrant Officer', abbr: 'MWO', class: 'Senior_NCOs', sheet: 'Senior_NCOs', roleId: '1536924361905143868', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true },
  { level: 6, name: 'Warrant Officer', abbr: 'WO', class: 'Senior_NCOs', sheet: 'Senior_NCOs', roleId: '1536924362333233182', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true },
  { level: 5, name: 'Sergeant', abbr: 'SGT', class: 'Senior_NCOs', sheet: 'Senior_NCOs', roleId: '1536924362974822430', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true },
  { level: 4, name: 'Master Corporal', abbr: 'MCpl', class: 'Junior_NCOs', sheet: 'Junior_NCOs', roleId: '1536924364300357733', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: false },
  { level: 3, name: 'Corporal', abbr: 'Cpl', class: 'Junior_NCOs', sheet: 'Junior_NCOs', roleId: '1536924364472197160', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: false },
  { level: 2, name: 'Private', abbr: 'Pte', class: 'Enlisted', sheet: 'Enlisted', roleId: '1536924368297263104', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: false },
  { level: 1, name: 'Cadet', abbr: 'Cdt', class: 'Enlisted', sheet: 'Enlisted', roleId: '1536924368871890954', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: false },
];

const GUILD_ID = '1536920332903125036';
const ROBLOX_GROUP_ID = '10872992';

function getRankByLevel(level) {
  return RANKS.find(r => r.level === level) || null;
}

function getRankByRoleId(roleId) {
  return RANKS.find(r => r.roleId === roleId) || null;
}

function getRankByName(name) {
  return RANKS.find(r => r.name === name || r.abbr === name) || null;
}

function getNextRank(currentLevel) {
  return getRankByLevel(currentLevel + 1);
}

function getPreviousRank(currentLevel) {
  return getRankByLevel(currentLevel - 1);
}

module.exports = {
  RANKS,
  GUILD_ID,
  ROBLOX_GROUP_ID,
  getRankByLevel,
  getRankByRoleId,
  getRankByName,
  getNextRank,
  getPreviousRank,
};
