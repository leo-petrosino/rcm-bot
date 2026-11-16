const { ActivityType, Events } = require('discord.js');
const { initRoblox, getGroupRoles } = require('../utils/roblox');
const { ROBLOX_GROUP_ID, RUNTIME_CACHE } = require('../../config');

module.exports = {
  name: Events.ClientReady || 'ready',
  once: true,
  async execute(client) {
    console.log(`[Discord] Authenticated as ${client.user.tag} (ID: ${client.user.id})`);

    // Set military presence
    client.user.setPresence({
      activities: [
        {
          name: 'Royal Canadian Military Command',
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });

    // Authenticate Roblox Logistics Account
    const robloxReady = await initRoblox();
    if (robloxReady) {
      console.log(`[Roblox] Logistics account verified for Group #${ROBLOX_GROUP_ID}`);
      // Pre-fetch roles into cache
      try {
        const roles = await getGroupRoles(ROBLOX_GROUP_ID);
        RUNTIME_CACHE.robloxRoles = roles;
        console.log(`[Roblox] Cached ${roles.length} group roles.`);
      } catch (err) {
        console.warn('[Roblox] Initial role cache warning:', err.message);
      }
    } else {
      console.warn('[Roblox] Logistics account offline. Check ROBLOX_COOKIE in environment.');
    }
  },
};
