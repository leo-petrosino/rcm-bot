const { SlashCommandBuilder } = require('discord.js');
const { getRankByLevel, getNextRank } = require('../../config');
const { getMemberFromIndex, updatePersonnelIndex, syncMemberClassSheet } = require('../utils/sheets');
const { getMemberRank, canPromote } = require('../utils/permissions');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a member one rank up the Canadian Armed Forces chain of command')
    .addUserOption(option =>
      option.setName('user').setDescription('Service member to promote').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Merit / Promotion rationale').setRequired(true)
    ),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!executorRank) {
      return interaction.editReply({
        content: '❌ You do not hold an authorized rank to issue promotions.',
      });
    }

    // Prevent self-promotion unless designated developer
    if (targetUser.id === interaction.user.id && !executorRank.isDeveloper) {
      return interaction.editReply({
        content: '❌ Self-promotion is strictly prohibited. You cannot promote yourself up the chain of command.',
      });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({
        content: `❌ Target <@${targetUser.id}> is not indexed in the database. They must run \`/verify\` first.`,
      });
    }

    // Check disciplinary hold
    const strikes = parseInt(targetData.Strike_Count || '0', 10);
    if (strikes >= 3) {
      return interaction.editReply({
        content: `🚫 **PROMOTION BLOCKED**: <@${targetUser.id}> currently has **${strikes} active strikes**. Members with 3+ strikes cannot receive promotions until pardoned.`,
      });
    }

    const currentLevel = parseInt(targetData.Rank_Level, 10);
    const newRank = getNextRank(currentLevel);

    if (!newRank) {
      return interaction.editReply({
        content: `⚠️ Target is already at the pinnacle rank (**${targetData.Current_Rank}**).`,
      });
    }

    if (!canPromote(executorRank, currentLevel, newRank.level)) {
      return interaction.editReply({
        content: `❌ Insufficient authority. As a **${executorRank.name}**, you cannot promote personnel to **${newRank.name}**.`,
      });
    }

    // 1. Update Roblox group rank first
    let robloxUpdated = false;
    try {
      await setRank(targetData.Roblox_ID, newRank.name);
      robloxUpdated = true;
    } catch (err) {
      console.error('[Promote] Roblox rank change failed:', err.message);
      return interaction.editReply({
        content: `❌ Roblox group rank update failed: \`${err.message}\`. Promotion halted. Verify logistics bot group permissions.`,
      });
    }

    // 2. Update Discord Roles
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
      console.warn('[Promote] Discord role update warning:', err.message);
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
      action: 'PROMOTE',
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

    // 5. Build Celebratory Citation Embed
    const embed = RcmEmbed.success('CANADIAN ARMED FORCES • PROMOTION CITATION')
      .setDescription(
        `By order of the Command Staff, <@${targetUser.id}> (**${targetData.Roblox_Username}**) ` +
        `has demonstrated commendable merit, leadership, and conduct, and is hereby promoted.`
      )
      .addFields(
        { name: '🎖️ Previous Rank', value: targetData.Current_Rank, inline: true },
        { name: '⬆️ Commissioned Rank', value: `**${newRank.name}** (\`${newRank.abbr}\`)`, inline: true },
        { name: '⚖️ Class', value: `\`${newRank.class}\``, inline: true },
        { name: '👑 Promoting Officer', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
        { name: '🌐 Roblox Sync', value: '✅ Group Rank Synchronized', inline: true },
        { name: '📜 Citation Rationale', value: `*"${reason}"*`, inline: false },
      )
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${targetData.Roblox_ID}&width=150&height=150&format=png`);

    await interaction.editReply({ embeds: [embed] });
  },
};
