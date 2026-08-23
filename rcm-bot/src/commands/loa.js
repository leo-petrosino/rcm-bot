const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMemberFromIndex, readSheet, updateRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank } = require('../utils/permissions');
const { logAudit } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Request or manage Leave of Absence')
    .addStringOption(option => option.setName('start').setDescription('Start date (YYYY-MM-DD)').setRequired(true))
    .addStringOption(option => option.setName('end').setDescription('End date (YYYY-MM-DD)').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for LOA').setRequired(true))
    .addUserOption(option => option.setName('user').setDescription('Officer use: manage LOA for another member').setRequired(false)),

  async execute(interaction) {
    const start = interaction.options.getString('start');
    const end = interaction.options.getString('end');
    const reason = interaction.options.getString('reason');
    const targetUser = interaction.options.getUser('user');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);
    const isOfficer = executorRank && executorRank.canPromote;

    const subject = targetUser || interaction.user;

    // If targeting another user, must be officer
    if (targetUser && targetUser.id !== interaction.user.id && !isOfficer) {
      return interaction.reply({ content: 'Only officers can manage LOA for other members.', ephemeral: true });
    }

    const targetData = await getMemberFromIndex(subject.id);
    if (!targetData) {
      return interaction.reply({ content: 'Member not found in database.', ephemeral: true });
    }

    const now = new Date().toISOString();
    const sheetName = targetData.Current_Sheet;

    // Update personnel sheet
    try {
      const rows = await readSheet(sheetName);
      const headers = rows[0];
      const discordIdx = headers.indexOf('Discord_ID');
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][discordIdx] === subject.id) {
          const row = rows[i];
          row[headers.indexOf('Status')] = 'LOA';
          row[headers.indexOf('LOA_Until')] = end;
          await updateRow(sheetName, i + 1, row);
          break;
        }
      }
    } catch (err) {
      console.error('LOA sheet update failed:', err);
    }

    await updatePersonnelIndex(subject.id, {
      Status: 'LOA',
      Last_Updated: now,
    });

    await logAudit({
      action: 'LOA',
      targetDiscord: subject.id,
      targetRoblox: targetData.Roblox_ID,
      executorDiscord: interaction.user.id,
      executorRank: executorRank ? executorRank.name : 'Unknown',
      reason: `${start} to ${end}: ${reason}`,
      robloxChanged: false,
    });

    const embed = new EmbedBuilder()
      .setTitle('Leave of Absence')
      .setColor(0x0099FF)
      .addFields(
        { name: 'Member', value: `<@${subject.id}>`, inline: true },
        { name: 'Status', value: 'LOA Approved', inline: true },
        { name: 'Period', value: `${start} → ${end}`, inline: false },
        { name: 'Reason', value: reason, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
