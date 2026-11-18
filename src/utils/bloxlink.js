const https = require('https');

/**
 * Queries Bloxlink API v4 to resolve a Discord user ID to a linked Roblox account
 * @param {string} discordId
 * @param {string} [guildId]
 * @returns {Promise<{ linked: boolean, robloxId?: string, username?: string, notLinked?: boolean, error?: string }>}
 */
async function getRobloxUserFromDiscord(discordId, guildId) {
  const apiKey = process.env.BLOXLINK_API_KEY;
  if (!apiKey) {
    return {
      linked: false,
      error: 'BLOXLINK_API_KEY is not configured in the bot environment. Please add it to your .env file.',
    };
  }

  // Use guild-specific endpoint if guildId provided, otherwise global
  const endpoint = guildId
    ? `https://api.blox.link/v4/public/guilds/${guildId}/discord-to-roblox/${discordId}`
    : `https://api.blox.link/v4/public/discord-to-roblox/${discordId}`;

  return new Promise((resolve) => {
    const req = https.get(
      endpoint,
      {
        headers: {
          Authorization: apiKey.trim(),
          'User-Agent': 'RCM-Logistics-Bot/1.0',
        },
        timeout: 10000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);

            if (res.statusCode === 200 && (data.robloxId || data.robloxID)) {
              const robloxId = String(data.robloxId || data.robloxID);
              const username = data.resolved?.roblox?.name || null;
              return resolve({
                linked: true,
                robloxId,
                username,
              });
            }

            if (res.statusCode === 404) {
              return resolve({
                linked: false,
                notLinked: true,
                error: 'Account is not linked to Bloxlink.',
              });
            }

            if (res.statusCode === 401 || res.statusCode === 403) {
              return resolve({
                linked: false,
                error: `Bloxlink API authorization failure (${res.statusCode}). Check BLOXLINK_API_KEY in .env.`,
              });
            }

            return resolve({
              linked: false,
              error: data.error || `Bloxlink service returned HTTP ${res.statusCode}`,
            });
          } catch (e) {
            resolve({ linked: false, error: `Invalid response from Bloxlink: ${e.message}` });
          }
        });
      }
    );

    req.on('error', (err) => {
      resolve({ linked: false, error: `Network error connecting to Bloxlink: ${err.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ linked: false, error: 'Connection to Bloxlink timed out.' });
    });
  });
}

module.exports = {
  getRobloxUserFromDiscord,
};
