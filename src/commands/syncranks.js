const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { getGroupRoles, getAllGroupRanks } = require('../utils/roblox');
const { RUNTIME_CACHE, ROBLOX_GROUP_ID, RANKS, REGIMENTS } = require('../../config');
const { readSheet, appendRow, updateRow, ensureSheetExists } = require('../utils/sheets');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync-ranks')
    .setDescription('Dynamically pull and synchronize rank structures from Discord & Roblox (High Command)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 10000,

  async execute(interaction) {
    await interaction.deferReply();

    try {
      // 1. Pull Discord Roles
      const discordRoles = interaction.guild.roles.cache;

      // 2. Pull Main Group Roblox Roles
      const robloxRoles = await getGroupRoles(ROBLOX_GROUP_ID);
      if (robloxRoles.length === 0) {
        return interaction.editReply({
          content: '⚠️ Failed to pull roles from Roblox. Verify `ROBLOX_GROUP_ID` and logistics bot authentication status.',
        });
      }

      RUNTIME_CACHE.robloxRoles = robloxRoles;

      // 3. Auto-match Roblox roles and Discord roles to the CAF 19-rank hierarchy
      let matchedCount = 0;
      const matrixRows = [
        ['Level', 'Rank_Name', 'Abbr', 'Class', 'Roblox_Rank_Number', 'Roblox_Role_ID', 'Discord_Role_ID', 'Discord_Role_Name']
      ];

      for (const rank of RUNTIME_CACHE.ranks) {
        // Find matching Roblox role (by name or abbreviation)
        const matchedRoblox = robloxRoles.find(
          rr => rr.name.toLowerCase() === rank.name.toLowerCase() ||
                rr.name.toLowerCase().includes(rank.abbr.toLowerCase())
        );

        if (matchedRoblox) {
          rank.robloxRankNumber = matchedRoblox.rank;
          rank.robloxRoleId = matchedRoblox.id;
        }

        // Find matching Discord role (by name or abbreviation)
        const matchedDiscord = discordRoles.find(
          dr => dr.name.toLowerCase() === rank.name.toLowerCase() ||
                dr.name.toLowerCase() === rank.abbr.toLowerCase() ||
                dr.name.toLowerCase().includes(rank.name.toLowerCase())
        );

        if (matchedDiscord) {
          rank.roleId = matchedDiscord.id;
          matchedCount++;
        }

        matrixRows.push([
          String(rank.level),
          rank.name,
          rank.abbr,
          rank.class,
          String(rank.robloxRankNumber || 'N/A'),
          String(rank.robloxRoleId || 'N/A'),
          String(rank.roleId || 'N/A'),
          matchedDiscord ? matchedDiscord.name : 'Unmapped',
        ]);
      }

      RUNTIME_CACHE.lastSync = new Date().toISOString();

      // 4. Write Rank_Matrix to Google Sheets
      await ensureSheetExists('Rank_Matrix');
      // Overwrite/sync entire Rank_Matrix sheet
      const { sheets, SPREADSHEET_ID } = require('../utils/sheets');
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Rank_Matrix!A1:H25',
        valueInputOption: 'USER_ENTERED',
        resource: { values: matrixRows },
      });

      // 5. Check Regimental groups if configured
      const regimentalResults = [];
      for (const reg of REGIMENTS) {
        if (reg.robloxGroupId) {
          const roles = await getGroupRoles(reg.robloxGroupId);
          regimentalResults.push(`• **${reg.id}:** Found ${roles.length} roles`);
        }
      }

      const embed = RcmEmbed.success('DYNAMIC HIERARCHY SYNCHRONIZED')
        .setDescription(
          `Successfully scanned and aligned rank matrices between **Roblox Group #${ROBLOX_GROUP_ID}** and Discord **${interaction.guild.name}**.`
        )
        .addFields(
          { name: '🌐 Roblox Group Roles Pulled', value: `\`${robloxRoles.length} Roles Indexed\``, inline: true },
          { name: '💬 Discord Roles Matched', value: `\`${matchedCount} / ${RUNTIME_CACHE.ranks.length} Ranks Linked\``, inline: true },
          { name: '📊 Google Sheet Synced', value: '`Rank_Matrix` tab updated', inline: true },
          {
            name: '🛡️ Regimental Groups',
            value: regimentalResults.length > 0 ? regimentalResults.join('\n') : '*No external regimental group IDs configured*',
            inline: false,
          }
        )
        .setFooter({ text: `Last synchronized: ${new Date().toLocaleTimeString()}` });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[SyncRanks] Error:', err);
      await interaction.editReply({ content: `❌ Dynamic synchronization error: ${err.message}` });
    }
  },
};
