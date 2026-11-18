const { SlashCommandBuilder } = require('discord.js');
const { getRankByName, getRankByLevel } = require('../../config');
const { getMemberFromIndex, updatePersonnelIndex, syncMemberClassSheet } = require('../utils/sheets');
const { getMemberRank, canBatchPromote } = require('../utils/permissions');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('batchpromote')
    .setDescription('Mass promote multiple members simultaneously (Captain+)')
    .addStringOption(option =>
      option.setName('users')
        .setDescription('Space-separated @mentions of personnel')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('rank')
        .setDescription('Target rank to promote to')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Promotion ceremony rationale').setRequired(true)
    ),
  cooldown: 15000,

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

    const usersStr = interaction.options.getString('users');
    const rankName = interaction.options.getString('rank');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canBatchPromote(executorRank)) {
      return interaction.editReply({
        content: '❌ You do not have authority to execute batch promotions (Requires Captain+).',
      });
    }

    const targetRank = getRankByName(rankName);
    if (!targetRank) {
      return interaction.editReply({ content: `❌ Target rank \`${rankName}\` not found.` });
    }

    if (targetRank.level >= executorRank.level) {
      return interaction.editReply({
        content: `❌ You cannot batch promote members to a rank equal to or above your own (**${executorRank.name}**).`,
      });
    }

    // Extract user mentions
    const mentionRegex = /<@!?(\d+)>/g;
    const matches = [...usersStr.matchAll(mentionRegex)];
    const userIds = [...new Set(matches.map(m => m[1]))];

    if (userIds.length === 0) {
      return interaction.editReply({
        content: '❌ No valid user mentions found. Format: `/batchpromote users:@Member1 @Member2 rank:Private reason:...`',
      });
    }

    if (userIds.length > 20) {
      return interaction.editReply({ content: '⚠️ Maximum limit is 20 personnel per batch operation.' });
    }

    const results = { successful: [], failed: [] };
    const now = new Date().toISOString();

    for (const userId of userIds) {
      try {
        const targetData = await getMemberFromIndex(userId);
        if (!targetData) {
          results.failed.push({ id: userId, reason: 'Unverified / Not in database' });
          continue;
        }

        const strikes = parseInt(targetData.Strike_Count || '0', 10);
        if (strikes >= 3) {
          results.failed.push({ id: userId, reason: `Active disciplinary hold (${strikes} strikes)` });
          continue;
        }

        const currentLevel = parseInt(targetData.Rank_Level, 10);
        if (currentLevel + 1 !== targetRank.level) {
          results.failed.push({
            id: userId,
            reason: `Current level ${currentLevel} is not immediately below target rank ${targetRank.name}`,
          });
          continue;
        }

        // Roblox group rank update
        try {
          await setRank(targetData.Roblox_ID, targetRank.name);
        } catch (err) {
          results.failed.push({ id: userId, reason: `Roblox error: ${err.message}` });
          continue;
        }

        // Discord role update
        try {
          const targetMember = await interaction.guild.members.fetch(userId);
          const oldRank = getRankByLevel(currentLevel);
          if (oldRank?.roleId && targetMember.roles.cache.has(oldRank.roleId)) {
            await targetMember.roles.remove(oldRank.roleId);
          }
          if (targetRank.roleId) {
            await targetMember.roles.add(targetRank.roleId);
          }
        } catch (err) {
          console.warn('[BatchPromote] Discord role warning:', err.message);
        }

        // Sheet update
        await updatePersonnelIndex(userId, {
          Current_Rank: targetRank.name,
          Rank_Level: String(targetRank.level),
          Class: targetRank.class,
          Last_Updated: now,
        });

        await syncMemberClassSheet({
          discordId: userId,
          targetRank,
          targetData,
          oldClassHint: targetData.Class,
        });

        // Audit log
        await logAudit({
          action: 'PROMOTE',
          targetDiscord: userId,
          targetRoblox: targetData.Roblox_ID,
          oldRank: targetData.Current_Rank,
          newRank: targetRank.name,
          executorDiscord: interaction.user.id,
          executorRank: executorRank.name,
          reason: `[MASS CEREMONY] ${reason}`,
          robloxChanged: true,
          client: interaction.client,
        });

        results.successful.push({ id: userId, username: targetData.Roblox_Username });
      } catch (err) {
        results.failed.push({ id: userId, reason: err.message });
      }
    }

    const embed = RcmEmbed.base('MASS PROMOTION CEREMONY REPORT')
      .setDescription(
        `Batch promotion directive enacted by <@${interaction.user.id}> (**${executorRank.name}**).\n` +
        `Target Rank: **${targetRank.name}** (\`${targetRank.abbr}\`)\n` +
        `Rationale: *"${reason}"*`
      )
      .addFields(
        {
          name: `✅ Successfully Promoted (${results.successful.length})`,
          value: results.successful.length > 0
            ? results.successful.map(s => `• <@${s.id}> (\`${s.username}\`)`).join('\n')
            : '*None*',
          inline: false,
        },
        {
          name: `❌ Failed / Skipped (${results.failed.length})`,
          value: results.failed.length > 0
            ? results.failed.map(f => `• <@${f.id}>: *${f.reason}*`).join('\n')
            : '*None*',
          inline: false,
        }
      );

    await interaction.editReply({ embeds: [embed] });
  },
};
