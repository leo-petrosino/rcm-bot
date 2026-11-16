const noblox = require('noblox.js');
const { ROBLOX_GROUP_ID, REGIMENTS } = require('../../config');

let isLoggedIn = false;
let botUser = null;

/**
 * Initializes Noblox session with the configured logistics account cookie
 */
async function initRoblox() {
  if (!process.env.ROBLOX_COOKIE) {
    console.warn('[Roblox] ROBLOX_COOKIE is not defined in environment.');
    return false;
  }

  try {
    botUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
    isLoggedIn = true;
    console.log(`[Roblox] Successfully authenticated logistics account: ${botUser.UserName} (${botUser.UserID})`);
    return true;
  } catch (err) {
    isLoggedIn = false;
    console.error('[Roblox] Authentication failed:', err.message);
    return false;
  }
}

/**
 * Checks if the bot is currently authenticated with Roblox
 */
function isRobloxReady() {
  return isLoggedIn;
}

/**
 * Resolves a Roblox username to a numeric user ID
 */
async function getUserId(username) {
  if (!username) throw new Error('Username is required');
  return await noblox.getIdFromUsername(username.trim());
}

/**
 * Resolves a numeric Roblox user ID to a current username
 */
async function getUsername(userId) {
  if (!userId) throw new Error('User ID is required');
  return await noblox.getUsernameFromId(parseInt(userId, 10));
}

/**
 * Fetches roles for a specific Roblox group (defaults to Main RCM Group)
 */
async function getGroupRoles(groupId = ROBLOX_GROUP_ID) {
  if (!groupId) return [];
  try {
    return await noblox.getRoles(parseInt(groupId, 10));
  } catch (err) {
    console.error(`[Roblox] Failed to fetch roles for group ${groupId}:`, err.message);
    return [];
  }
}

/**
 * Fetches all roles across Main Group and all configured Regimental Groups
 */
async function getAllGroupRanks() {
  const result = {
    main: {
      groupId: ROBLOX_GROUP_ID,
      roles: await getGroupRoles(ROBLOX_GROUP_ID),
    },
    regiments: {},
  };

  for (const reg of REGIMENTS) {
    if (reg.robloxGroupId) {
      result.regiments[reg.id] = {
        name: reg.name,
        groupId: reg.robloxGroupId,
        roles: await getGroupRoles(reg.robloxGroupId),
      };
    }
  }

  return result;
}

/**
 * Gets a user's current rank number and role name in a group
 */
async function getUserRankInGroup(userId, groupId = ROBLOX_GROUP_ID) {
  try {
    const rankNumber = await noblox.getRankInGroup(parseInt(groupId, 10), parseInt(userId, 10));
    const roleName = await noblox.getRankNameInGroup(parseInt(groupId, 10), parseInt(userId, 10));
    return { rankNumber, roleName };
  } catch (err) {
    return { rankNumber: 0, roleName: 'Guest' };
  }
}

/**
 * Updates a member's rank in a Roblox group (main or regimental)
 */
async function setRank(userId, rankNameOrNumber, groupId = ROBLOX_GROUP_ID) {
  if (!isLoggedIn) {
    const success = await initRoblox();
    if (!success) {
      throw new Error('Roblox logistics session is not authenticated.');
    }
  }

  const targetGroupId = parseInt(groupId || ROBLOX_GROUP_ID, 10);
  const targetUserId = parseInt(userId, 10);

  return await noblox.setRank(targetGroupId, targetUserId, rankNameOrNumber);
}

/**
 * Exiles (kicks) a user from a Roblox group
 */
async function exileUser(userId, groupId = ROBLOX_GROUP_ID) {
  if (!isLoggedIn) await initRoblox();
  const targetGroupId = parseInt(groupId || ROBLOX_GROUP_ID, 10);
  const targetUserId = parseInt(userId, 10);
  return await noblox.exile(targetGroupId, targetUserId);
}

/**
 * Fetches user thumbnail URL
 */
async function getUserAvatarUrl(userId) {
  try {
    const [thumb] = await noblox.getPlayerThumbnail(parseInt(userId, 10), 150, 'png', false, 'headshot');
    return thumb?.imageUrl || null;
  } catch {
    return null;
  }
}

module.exports = {
  initRoblox,
  isRobloxReady,
  getUserId,
  getUsername,
  getGroupRoles,
  getAllGroupRanks,
  getUserRankInGroup,
  setRank,
  exileUser,
  getUserAvatarUrl,
};
