/**
 * Royal Canadian Military (RCM) - Bot Configuration
 * Contains standard Canadian Armed Forces (CAF) rank structure, regimental definitions,
 * theme palettes, and system constants.
 */

const RANKS = [
  // Senior Generals
  { level: 19, name: 'General Chief of the Defence Staff', abbr: 'GEN CDS', class: 'Senior_Generals', sheet: 'Personnel_Index', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true, canBlacklist: true, canManageRegiment: true },
  { level: 18, name: 'Lieutenant General', abbr: 'LTG', class: 'Senior_Generals', sheet: 'Personnel_Index', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true, canBlacklist: true, canManageRegiment: true },
  { level: 17, name: 'Major General Division Commander', abbr: 'MGEN', class: 'Division_Commanders', sheet: 'Personnel_Index', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true, canBlacklist: true, canManageRegiment: true },
  
  // Senior Officers / Senior Formation
  { level: 16, name: 'Brigadier General', abbr: 'BGEN', class: 'Senior_Formation', sheet: 'Personnel_Index', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true, canBlacklist: true, canManageRegiment: true },
  { level: 15, name: 'Colonel', abbr: 'COL', class: 'Senior_Formation', sheet: 'Personnel_Index', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true, canBlacklist: true, canManageRegiment: true },
  { level: 14, name: 'Lieutenant Colonel', abbr: 'LTCOL', class: 'Senior_Officers', sheet: 'Personnel_Index', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true, canBlacklist: true, canManageRegiment: true },
  { level: 13, name: 'Major', abbr: 'MAJ', class: 'Senior_Officers', sheet: 'Personnel_Index', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: true, canBatchPromote: true, canAudit: true, canBlacklist: false, canManageRegiment: true },
  
  // Junior Officers
  { level: 12, name: 'Captain', abbr: 'CPT', class: 'Junior_Officers', sheet: 'Personnel_Index', canPromote: true, canStrike: true, canDischarge: true, canEditProfile: false, canBatchPromote: true, canAudit: true, canBlacklist: false, canManageRegiment: true },
  { level: 11, name: 'Lieutenant', abbr: 'LT', class: 'Junior_Officers', sheet: 'Personnel_Index', canPromote: true, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true, canBlacklist: false, canManageRegiment: false },
  { level: 10, name: 'Second Lieutenant', abbr: '2LT', class: 'Junior_Officers', sheet: 'Personnel_Index', canPromote: true, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true, canBlacklist: false, canManageRegiment: false },
  
  // Subordinate Officers
  { level: 9, name: 'Officer Cadet', abbr: 'OCdt', class: 'Subordinate_Officers', sheet: 'Personnel_Index', canPromote: true, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true, canBlacklist: false, canManageRegiment: false },
  
  // Senior NCOs
  { level: 8, name: 'Chief Warrant Officer', abbr: 'CWO', class: 'Senior_NCOs', sheet: 'Personnel_Index', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true, canBlacklist: false, canManageRegiment: false },
  { level: 7, name: 'Master Warrant Officer', abbr: 'MWO', class: 'Senior_NCOs', sheet: 'Personnel_Index', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true, canBlacklist: false, canManageRegiment: false },
  { level: 6, name: 'Warrant Officer', abbr: 'WO', class: 'Senior_NCOs', sheet: 'Personnel_Index', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true, canBlacklist: false, canManageRegiment: false },
  { level: 5, name: 'Sergeant', abbr: 'SGT', class: 'Senior_NCOs', sheet: 'Personnel_Index', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: true, canBlacklist: false, canManageRegiment: false },
  
  // Junior NCOs
  { level: 4, name: 'Master Corporal', abbr: 'MCpl', class: 'Junior_NCOs', sheet: 'Personnel_Index', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: false, canBlacklist: false, canManageRegiment: false },
  { level: 3, name: 'Corporal', abbr: 'Cpl', class: 'Junior_NCOs', sheet: 'Personnel_Index', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: false, canBlacklist: false, canManageRegiment: false },
  
  // Enlisted
  { level: 2, name: 'Private', abbr: 'Pte', class: 'Enlisted', sheet: 'Personnel_Index', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: false, canBlacklist: false, canManageRegiment: false },
  { level: 1, name: 'Cadet', abbr: 'Cdt', class: 'Enlisted', sheet: 'Personnel_Index', canPromote: false, canStrike: false, canDischarge: false, canEditProfile: false, canBatchPromote: false, canAudit: false, canBlacklist: false, canManageRegiment: false },
];

/**
 * Regimental Organization definitions for Royal Canadian Military
 */
const REGIMENTS = [
  {
    id: 'GGHG',
    name: "Governor General's Horse Guards",
    shortName: 'GGHG',
    role: 'Armoured Reconnaissance & Cavalry',
    motto: 'Nulli Secundus (Second to None)',
    color: '#8B1E0F', // Regimental Maroon / Red
    emoji: '🐎',
    robloxGroupId: process.env.ROBLOX_GGHG_GROUP_ID || null,
  },
  {
    id: 'JTF2',
    name: 'Joint Task Force 2 (Special Forces)',
    shortName: 'JTF2',
    role: 'Special Operations & Counter-Terrorism',
    motto: 'Facta Non Verba (Deeds, Not Words)',
    color: '#1A1A1A', // Tactical Black / Dark Gray
    emoji: '🗡️',
    robloxGroupId: process.env.ROBLOX_JTF2_GROUP_ID || null,
  },
  {
    id: 'CMTC',
    name: 'Canadian Military Training Company',
    shortName: 'CMTC',
    role: 'Recruit Induction, Doctrine & NCO Development',
    motto: 'Ad Victoriam Per Doctrinam (To Victory Through Doctrine)',
    color: '#1B4D3E', // Military Forest Green
    emoji: '🎖️',
    robloxGroupId: process.env.ROBLOX_CMTC_GROUP_ID || null,
  },
  {
    id: 'CFMP',
    name: 'Canadian Forces Military Police',
    shortName: 'CFMP',
    role: 'Military Justice, Force Protection & Policing',
    motto: 'Securitas (Security)',
    color: '#0B2545', // Deep Navy / Police Blue
    emoji: '🛡️',
    robloxGroupId: process.env.ROBLOX_CFMP_GROUP_ID || null,
  },
  {
    id: 'GGFG',
    name: "Governor General's Foot Guards",
    shortName: 'GGFG',
    role: 'Senior Household Infantry & Ceremonial Guard',
    motto: 'Civitas et Imperium (State and Empire)',
    color: '#B22222', // Scarlet Red
    emoji: '💂',
    robloxGroupId: process.env.ROBLOX_GGFG_GROUP_ID || null,
  },
];

const THEME = {
  primary: 0x9B111E,   // Regimental Crimson
  secondary: 0x1E293B, // Tactical Charcoal
  success: 0x16A34A,   // Olive / Commendation Green
  warning: 0xD97706,   // Discipline Amber
  danger: 0xDC2626,    // Court Martial / Discharge Red
  accent: 0xD4AF37,    // Commonwealth Gold
  info: 0x2563EB,      // Royal Canadian Air/Sea Blue
};

// Dynamic runtime role cache (populated from Discord & Roblox)
const RUNTIME_CACHE = {
  ranks: [...RANKS],
  robloxRoles: [],
  discordRoles: new Map(),
  lastSync: null,
};

function getRankByLevel(level) {
  return RUNTIME_CACHE.ranks.find(r => r.level === Number(level)) || null;
}

function getRankByRoleId(roleId) {
  return RUNTIME_CACHE.ranks.find(r => r.roleId === roleId) || null;
}

function getRankByName(name) {
  if (!name) return null;
  const clean = name.trim().toLowerCase();
  return (
    RUNTIME_CACHE.ranks.find(
      r => r.name.toLowerCase() === clean || r.abbr.toLowerCase() === clean
    ) || null
  );
}

function getNextRank(currentLevel) {
  return getRankByLevel(Number(currentLevel) + 1);
}

function getPreviousRank(currentLevel) {
  return getRankByLevel(Number(currentLevel) - 1);
}

function getRegimentById(id) {
  if (!id) return null;
  const clean = id.trim().toUpperCase();
  return (
    REGIMENTS.find(
      reg => reg.id === clean || reg.shortName.toUpperCase() === clean || reg.name.toLowerCase() === id.toLowerCase()
    ) || null
  );
}

module.exports = {
  RANKS,
  REGIMENTS,
  THEME,
  RUNTIME_CACHE,
  GUILD_ID: process.env.GUILD_ID || '1536920332903125036',
  ROBLOX_GROUP_ID: process.env.ROBLOX_GROUP_ID || '10872992',
  getRankByLevel,
  getRankByRoleId,
  getRankByName,
  getNextRank,
  getPreviousRank,
  getRegimentById,
};
