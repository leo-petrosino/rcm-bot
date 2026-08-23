const noblox = require('noblox.js');
const { ROBLOX_GROUP_ID } = require('../../config');

const groupId = parseInt(ROBLOX_GROUP_ID);

async function getUserId(username) {
  return await noblox.getIdFromUsername(username);
}

async function getUsername(userId) {
  return await noblox.getUsernameFromId(parseInt(userId));
}

async function setRank(userId, rankNameOrNumber) {
  return await noblox.setRank(groupId, parseInt(userId), rankNameOrNumber);
}

async function getRoles() {
  return await noblox.getRoles(groupId);
}

async function getRankInGroup(userId) {
  return await noblox.getRankInGroup(groupId, parseInt(userId));
}

module.exports = {
  getUserId,
  getUsername,
  setRank,
  getRoles,
  getRankInGroup,
};
