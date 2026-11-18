const { SlashCommandBuilder } = require('discord.js');
const { getRankByLevel, getPreviousRank } = require('../../config');
const { getMemberFromIndex, updatePersonnelIndex, syncMemberClassSheet } = require('../utils/sheets');
const { getMemberRank, canDemote } = require('../utils/permissions');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('demote')
    .setDescription('Demote a member one rank down the Canadian Armed Forces hierarchy')
    .addUserOption(option =>
      option.setName('user').setDescription('Service member to demote').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Disciplinary / Demotion rationale').setRequired(true)
    ),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!executorRank) {
      return interaction.editReply({ content: '❌ You do not hold an authorized rank.' });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: '❌ Target is not indexed in the database.' });
    }

    const currentLevel = parseInt(targetData.Rank_Level, 10);
    const newRank = getPreviousRank(currentLevel);

    if (!newRank) {
      return interaction.editReply({
        content: `⚠️ Target is already at the lowest rank (**${targetData.Current_Rank}**). Use \`/discharge\` if disciplinary separation is required.`,
      });
    }

    if (!canDemote(executorRank, currentLevel, newRank.level)) {
      return interaction.editReply({
        content: `❌ You do not have authority to demote personnel from **${targetData.Current_Rank}** to **${newRank.name}**.`,
      });
    }

    // 1. Roblox Rank Change
    let robloxUpdated = false;
    try {
      await setRank(targetData.Roblox_ID, newRank.name);
      robloxUpdated = true;
    } catch (err) {
      console.error('[Demote] Roblox rank change failed:', err.message);
      return interaction.editReply({
        content: `❌ Roblox group demotion failed: \`${err.message}\`. No alterations made.`,
      });
    }

    // 2. Discord Role Change
    try {
      const targetMember = await interaction.guild.members.fetch(targetUser.id);
      const oldRank = getRankByLevel(currentLevel);
      if (oldRank?.roleId && targetMember.roles.cache.has(oldRank.roleId)) {
        await targetMember.roles.remove(oldRank.roleId);
      }
      if (newRank.roleId) {
        await targetMember.roles.add(newRank.roleId);
      }
    } catch (err) {
      console.warn('[Demote] Discord role update warning:', err.message);
    }

    // 3. Update Personnel_Index and Sync Class Sheet
    const now = new Date().toISOString();
    await updatePersonnelIndex(targetUser.id, {
      Current_Rank: newRank.name,
      Rank_Level: String(newRank.level),
      Class: newRank.class,
      Last_Updated: now,
    });

    await syncMemberClassSheet({
      discordId: targetUser.id,
      targetRank: newRank,
      targetData,
      oldClassHint: targetData.Class,
    });

    // 4. Log Audit
    await logAudit({
      action: 'DEMOTE',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldRank: targetData.Current_Rank,
      newRank: newRank.name,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason,
      robloxChanged: robloxUpdated,
      client: interaction.client,
    });

    const embed = RcmEmbed.warning('CANADIAN ARMED FORCES • DEMOTION ORDER')
      .setDescription(`An official administrative demotion has taken effect for <@${targetUser.id}>.`)
      .addFields(
        { name: '🎖️ Former Rank', value: targetData.Current_Rank, inline: true },
        { name: '⬇️ Reduced Rank', value: `**${newRank.name}** (\`${newRank.abbr}\`)`, inline: true },
        { name: '👑 Demoting Officer', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
        { name: '🌐 Roblox Sync', value: '✅ Group Rank Synchronized', inline: true },
        { name: '📋 Action Rationale', value: `*"${reason}"*`, inline: false },
      )
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${targetData.Roblox_ID}&width=150&height=150&format=png`);

    await interaction.editReply({ embeds: [embed] });
  },
};
