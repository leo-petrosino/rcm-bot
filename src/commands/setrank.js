const { SlashCommandBuilder } = require('discord.js');
const { getRankByName, getRankByLevel } = require('../../config');
const { getMemberFromIndex, updatePersonnelIndex, syncMemberClassSheet } = require('../utils/sheets');
const { getMemberRank, canSetRank } = require('../utils/permissions');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrank')
    .setDescription('Directly commission or adjust a member to an exact rank (High Command / Major+)')
    .addUserOption(option =>
      option.setName('user').setDescription('Service member to adjust').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('rank')
        .setDescription('Exact rank name or abbreviation')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Executive commission rationale').setRequired(true)
    ),
  cooldown: 5000,

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const { RUNTIME_CACHE } = require('../../config');
    const filtered = RUNTIME_CACHE.ranks.filter(
      r => r.name.toLowerCase().includes(focusedValue) || r.abbr.toLowerCase().includes(focusedValue)
    );
    await interaction.respond(
      filtered.slice(0, 25).map(r => ({ name: `${r.name} (${r.abbr})`, value: r.name }))
    );
  },

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const rankQuery = interaction.options.getString('rank');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    const targetRank = getRankByName(rankQuery);
    if (!targetRank) {
      return interaction.editReply({
        content: `❌ Unknown rank \`${rankQuery}\`. Please select a valid rank from autocomplete.`,
      });
    }

    if (!canSetRank(executorRank, targetRank.level)) {
      return interaction.editReply({
        content: `❌ Insufficient authority. Only senior command staff (Major+) can directly set ranks, and you cannot assign a rank equal to or above your own.`,
      });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: '❌ Target is not indexed in the database. They must verify first.' });
    }

    // 1. Roblox Rank Change
    let robloxUpdated = false;
    try {
      await setRank(targetData.Roblox_ID, targetRank.name);
      robloxUpdated = true;
    } catch (err) {
      console.error('[SetRank] Roblox rank update error:', err.message);
      return interaction.editReply({
        content: `❌ Roblox group update failed: \`${err.message}\`. No alterations made.`,
      });
    }

    // 2. Discord Roles
    try {
      const targetMember = await interaction.guild.members.fetch(targetUser.id);
      const oldRank = getRankByLevel(parseInt(targetData.Rank_Level, 10));
      if (oldRank?.roleId && targetMember.roles.cache.has(oldRank.roleId)) {
        await targetMember.roles.remove(oldRank.roleId);
      }
      if (targetRank.roleId) {
        await targetMember.roles.add(targetRank.roleId);
      }
    } catch (err) {
      console.warn('[SetRank] Discord role update warning:', err.message);
    }

    // 3. Update Personnel_Index and Sync Class Sheet
    const now = new Date().toISOString();
    await updatePersonnelIndex(targetUser.id, {
      Current_Rank: targetRank.name,
      Rank_Level: String(targetRank.level),
      Class: targetRank.class,
      Last_Updated: now,
    });

    await syncMemberClassSheet({
      discordId: targetUser.id,
      targetRank,
      targetData,
      oldClassHint: targetData.Class,
    });

    // 4. Log Audit
    await logAudit({
      action: 'SETRANK',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldRank: targetData.Current_Rank,
      newRank: targetRank.name,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason: `[EXECUTIVE APPOINTMENT] ${reason}`,
      robloxChanged: robloxUpdated,
      client: interaction.client,
    });

    const embed = RcmEmbed.base('EXECUTIVE COMMISSION DIRECTIVE')
      .setDescription(`An executive commission adjustment has been enacted for <@${targetUser.id}>.`)
      .addFields(
        { name: '🎖️ Former Rank', value: targetData.Current_Rank, inline: true },
        { name: '🎯 Appointed Rank', value: `**${targetRank.name}** (\`${targetRank.abbr}\`)`, inline: true },
        { name: '👑 Commanding Authority', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
        { name: '🌐 Roblox Sync', value: '✅ Group Rank Synchronized', inline: true },
        { name: '📜 Executive Rationale', value: `*"${reason}"*`, inline: false },
      )
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${targetData.Roblox_ID}&width=150&height=150&format=png`);

    await interaction.editReply({ embeds: [embed] });
  },
};
