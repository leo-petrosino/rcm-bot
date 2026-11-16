const { SlashCommandBuilder } = require('discord.js');
const { getUserId, getUsername, getUserRankInGroup } = require('../utils/roblox');
const { appendRow, findRowByDiscordId } = require('../utils/sheets');
const { getRankByLevel, getRankByName, ROBLOX_GROUP_ID } = require('../../config');
const { RcmEmbed } = require('../utils/embeds');
const { logAudit } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link your Roblox account to the Royal Canadian Military personnel index')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your exact Roblox username')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const robloxUsername = interaction.options.getString('username');
    const discordId = interaction.user.id;

    // Check if already registered
    const existing = await findRowByDiscordId('Personnel_Index', discordId);
    if (existing) {
      return interaction.editReply({
        content: '⚠️ You are already registered in the Royal Canadian Military service index. Use `/profile` to view your record.',
      });
    }

    try {
      const robloxId = await getUserId(robloxUsername);
      const confirmedUsername = await getUsername(robloxId);

      // Check current rank in Roblox group
      const { roleName, rankNumber } = await getUserRankInGroup(robloxId, ROBLOX_GROUP_ID);

      // If user is already ranked in the Roblox group, try to map that rank; otherwise start as Cadet (Level 1)
      let initialRank = getRankByName(roleName) || getRankByLevel(1);
      const now = new Date().toISOString();

      // Append to Personnel_Index
      await appendRow('Personnel_Index', [
        discordId,
        String(robloxId),
        confirmedUsername,
        initialRank.name,
        String(initialRank.level),
        initialRank.class,
        'Unassigned', // Regiment
        'Active',     // Status
        now,          // Join Date
        '0',          // Strike Count
        now,          // Last Updated
      ]);

      // Assign Discord Role if available
      try {
        const member = await interaction.guild.members.fetch(discordId);
        if (initialRank.roleId) {
          await member.roles.add(initialRank.roleId);
        }
      } catch (err) {
        console.warn('[Verify] Could not assign Discord role:', err.message);
      }

      await logAudit({
        action: 'VERIFY',
        targetDiscord: discordId,
        targetRoblox: String(robloxId),
        newRank: initialRank.name,
        executorDiscord: interaction.user.id,
        executorRank: 'SELF',
        reason: `Initial verification for ${confirmedUsername} (${robloxId})`,
        client: interaction.client,
      });

      const embed = RcmEmbed.success('Verification Complete • Service Record Established')
        .setDescription(`Welcome to the **Royal Canadian Military**, **${confirmedUsername}**.\nYour military personnel dossier has been indexed into the central registry.`)
        .addFields(
          { name: '🎖️ Assigned Rank', value: `**${initialRank.name}** (${initialRank.abbr})`, inline: true },
          { name: '🏷️ Rank Class', value: `\`${initialRank.class}\``, inline: true },
          { name: '🌐 Roblox Profile', value: `[${confirmedUsername}](https://www.roblox.com/users/${robloxId}/profile)`, inline: true },
          { name: '🛡️ Regiment', value: '*Unassigned (Awaiting placement)*', inline: false },
        )
        .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[Verify] Error:', err);
      await interaction.editReply({
        content: `❌ Could not verify Roblox account \`${robloxUsername}\`. Please check spelling and try again.`,
      });
    }
  },
};
