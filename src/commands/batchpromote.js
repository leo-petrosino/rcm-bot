const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRankByLevel, getRankByName } = require('../../config');
const { getMemberFromIndex, readSheet, appendRow, updateRow, deleteRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank, canBatchPromote } = require('../utils/permissions');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('batchpromote')
    .setDescription('Promote multiple members at once (Captain+)')
    .addStringOption(option => option.setName('users').setDescription('Space-separated @mentions').setRequired(true))
    .addStringOption(option => option.setName('rank').setDescription('Exact rank name to promote to').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for batch promotion').setRequired(true)),
  cooldown: 30000,

  async execute(interaction) {
    await interaction.deferReply();

    const usersStr = interaction.options.getString('users');
    const rankName = interaction.options.getString('rank');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canBatchPromote(executorRank)) {
      return interaction.editReply({ content: 'You do not have authority to batch promote.' });
    }

    const newRank = getRankByName(rankName);
    if (!newRank) {
      return interaction.editReply({ content: `Rank "${rankName}" not found. Use the exact rank name.` });
    }

    // Parse mentions
    const mentionRegex = /<@!?(\d+)>/g;
    const matches = [...usersStr.matchAll(mentionRegex)];
    const userIds = [...new Set(matches.map(m => m[1]))];

    if (userIds.length === 0) {
      return interaction.editReply({ content: 'No valid mentions found. Use @User @User format.' });
    }

    if (userIds.length > 20) {
      return interaction.editReply({ content: 'Maximum 20 members per batch promotion.' });
    }

    const results = { success: [], failed: [] };

    for (const userId of userIds) {
      try {
        const targetData = await getMemberFromIndex(userId);
        if (!targetData) {
          results.failed.push({ id: userId, reason: 'Not in database' });
          continue;
        }

        const currentLevel = parseInt(targetData.Rank_Level);
        if (currentLevel + 1 !== newRank.level) {
          results.failed.push({ id: userId, reason: `Current rank is not one below ${newRank.name}` });
          continue;
        }

        if (newRank.level >= executorRank.level) {
          results.failed.push({ id: userId, reason: 'Promotion exceeds your authority' });
          continue;
        }

        // Roblox
        try {
          await setRank(targetData.Roblox_ID, newRank.name);
        } catch (err) {
          results.failed.push({ id: userId, reason: 'Roblox API failed' });
          continue;
        }

        // Discord role
        try {
          const targetMember = await interaction.guild.members.fetch(userId);
          const oldRank = getRankByLevel(currentLevel);
          if (oldRank) await targetMember.roles.remove(oldRank.roleId);
          await targetMember.roles.add(newRank.roleId);
        } catch (err) {
          console.error('Discord role failed for', userId);
        }

        // Cross-sheet or in-place update
        const oldSheet = targetData.Current_Sheet;
        const now = new Date().toISOString();

        if (oldSheet !== newRank.sheet) {
          const oldRows = await readSheet(oldSheet);
          const oldHeaders = oldRows[0];
          const discordIdx = oldHeaders.indexOf('Discord_ID');
          let oldRowData = null;
          let oldRowIndex = -1;
          for (let i = 1; i < oldRows.length; i++) {
            if (oldRows[i][discordIdx] === userId) {
              oldRowData = oldRows[i];
              oldRowIndex = i + 1;
              break;
            }
          }
          if (oldRowData) {
            await appendRow(newRank.sheet, [
              userId, targetData.Roblox_ID, targetData.Roblox_Username,
              newRank.name, String(newRank.level),
              oldRowData[oldHeaders.indexOf('Branch')] || '',
              oldRowData[oldHeaders.indexOf('Join_Date')] || '',
              now,
              oldRowData[oldHeaders.indexOf('Strike_Count')] || '0',
              oldRowData[oldHeaders.indexOf('Total_Strikes')] || '0',
              'Active', '', '',
            ]);
            await deleteRow(oldSheet, oldRowIndex);
          }
        } else {
          const rows = await readSheet(oldSheet);
          const headers = rows[0];
          const discordIdx = headers.indexOf('Discord_ID');
          for (let i = 1; i < rows.length; i++) {
            if (rows[i][discordIdx] === userId) {
              const row = rows[i];
              row[headers.indexOf('Rank')] = newRank.name;
              row[headers.indexOf('Rank_Level')] = String(newRank.level);
              row[headers.indexOf('Last_Promotion')] = now;
              await updateRow(oldSheet, i + 1, row);
              break;
            }
          }
        }

        await updatePersonnelIndex(userId, {
          Current_Rank: newRank.name,
          Rank_Level: String(newRank.level),
          Class: newRank.class,
          Current_Sheet: newRank.sheet,
          Last_Updated: now,
        });

        await logAudit({
          action: 'PROMOTE',
          targetDiscord: userId,
          targetRoblox: targetData.Roblox_ID,
          oldRank: getRankByLevel(currentLevel)?.name || '',
          newRank: newRank.name,
          executorDiscord: interaction.user.id,
          executorRank: executorRank.name,
          reason: `[BATCH] ${reason}`,
          robloxChanged: true,
        });

        results.success.push(userId);
      } catch (err) {
        console.error('Batch promote error for', userId, err);
        results.failed.push({ id: userId, reason: 'Unexpected error' });
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('Batch Promotion Results')
      .setColor(results.failed.length === 0 ? 0x00AA00 : 0xFFAA00)
      .addFields(
        { name: 'Target Rank', value: newRank.name, inline: true },
        { name: 'Successful', value: String(results.success.length), inline: true },
        { name: 'Failed', value: String(results.failed.length), inline: true },
      );

    if (results.success.length > 0) {
      embed.addFields({
        name: 'Promoted',
        value: results.success.map(id => `<@${id}>`).join(' ') || 'None',
        inline: false,
      });
    }

    if (results.failed.length > 0) {
      embed.addFields({
        name: 'Failed',
        value: results.failed.map(f => `<@${f.id}>: ${f.reason}`).join('\n') || 'None',
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
