const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getRankByLevel, getNextRank } = require('../../config');
const { getMemberFromIndex, readSheet, appendRow, updateRow, deleteRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank, canPromote } = require('../utils/permissions');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('promote')
    .setDescription('Promote a member one rank')
    .addUserOption(option => option.setName('user').setDescription('Member to promote').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for promotion').setRequired(true)),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!executorRank) {
      return interaction.editReply({ content: 'You do not have a recognized rank.' });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: 'Target is not in the database. They must `/verify` first.' });
    }

    const currentLevel = parseInt(targetData.Rank_Level);
    const newRank = getNextRank(currentLevel);

    if (!newRank) {
      return interaction.editReply({ content: 'Target is already at the highest rank.' });
    }

    if (!canPromote(executorRank, currentLevel, newRank.level)) {
      return interaction.editReply({ content: `You cannot promote this member to **${newRank.name}**. Insufficient authority or invalid rank jump.` });
    }

    // Change Roblox rank first
    try {
      await setRank(targetData.Roblox_ID, newRank.name);
    } catch (err) {
      console.error('Roblox rank change failed:', err);
      return interaction.editReply({ content: 'Failed to update Roblox group rank. No changes were made. Check the bot account permissions.' });
    }

    // Update Discord role
    try {
      const targetMember = await interaction.guild.members.fetch(targetUser.id);
      const oldRank = getRankByLevel(currentLevel);
      if (oldRank) await targetMember.roles.remove(oldRank.roleId);
      await targetMember.roles.add(newRank.roleId);
    } catch (err) {
      console.error('Discord role update failed:', err);
      // Continue — Roblox is already changed, we should still update DB
    }

    const oldSheet = targetData.Current_Sheet;
    const now = new Date().toISOString();

    // Cross-sheet move if class changed
    if (oldSheet !== newRank.sheet) {
      try {
        const oldRows = await readSheet(oldSheet);
        const oldHeaders = oldRows[0];
        const discordIdx = oldHeaders.indexOf('Discord_ID');
        let oldRowData = null;
        let oldRowIndex = -1;
        for (let i = 1; i < oldRows.length; i++) {
          if (oldRows[i][discordIdx] === targetUser.id) {
            oldRowData = oldRows[i];
            oldRowIndex = i + 1;
            break;
          }
        }

        if (oldRowData) {
          await appendRow(newRank.sheet, [
            targetUser.id,
            targetData.Roblox_ID,
            targetData.Roblox_Username,
            newRank.name,
            String(newRank.level),
            oldRowData[oldHeaders.indexOf('Branch')] || '',
            oldRowData[oldHeaders.indexOf('Join_Date')] || '',
            now,
            oldRowData[oldHeaders.indexOf('Strike_Count')] || '0',
            oldRowData[oldHeaders.indexOf('Total_Strikes')] || '0',
            'Active',
            oldRowData[oldHeaders.indexOf('LOA_Until')] || '',
            oldRowData[oldHeaders.indexOf('Notes')] || '',
          ]);
          await deleteRow(oldSheet, oldRowIndex);
        }
      } catch (err) {
        console.error('Cross-sheet move failed:', err);
      }
    } else {
      // Update in-place
      try {
        const rows = await readSheet(oldSheet);
        const headers = rows[0];
        const discordIdx = headers.indexOf('Discord_ID');
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][discordIdx] === targetUser.id) {
            const row = rows[i];
            row[headers.indexOf('Rank')] = newRank.name;
            row[headers.indexOf('Rank_Level')] = String(newRank.level);
            row[headers.indexOf('Last_Promotion')] = now;
            await updateRow(oldSheet, i + 1, row);
            break;
          }
        }
      } catch (err) {
        console.error('In-sheet update failed:', err);
      }
    }

    // Update Personnel_Index
    await updatePersonnelIndex(targetUser.id, {
      Current_Rank: newRank.name,
      Rank_Level: String(newRank.level),
      Class: newRank.class,
      Current_Sheet: newRank.sheet,
      Last_Updated: now,
    });

    // Log audit
    await logAudit({
      action: 'PROMOTE',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldRank: getRankByLevel(currentLevel)?.name || '',
      newRank: newRank.name,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason,
      robloxChanged: true,
    });

    const embed = new EmbedBuilder()
      .setTitle('Promotion Executed')
      .setColor(0x00AA00)
      .addFields(
        { name: 'Member', value: `<@${targetUser.id}>`, inline: true },
        { name: 'From', value: getRankByLevel(currentLevel)?.name || 'Unknown', inline: true },
        { name: 'To', value: newRank.name, inline: true },
        { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason, inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
