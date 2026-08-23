const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMemberFromIndex, readSheet, updateRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank, canEditProfile } = require('../utils/permissions');
const { logAudit } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editprofile')
    .setDescription('Edit a member\'s database record (Major+)')
    .addUserOption(option => option.setName('user').setDescription('Member to edit').setRequired(true))
    .addStringOption(option =>
      option.setName('field')
        .setDescription('Field to edit')
        .setRequired(true)
        .addChoices(
          { name: 'Branch', value: 'Branch' },
          { name: 'Notes', value: 'Notes' },
          { name: 'Roblox_ID', value: 'Roblox_ID' },
          { name: 'Join_Date', value: 'Join_Date' },
        ))
    .addStringOption(option => option.setName('value').setDescription('New value').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for edit').setRequired(true)),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const field = interaction.options.getString('field');
    const value = interaction.options.getString('value');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canEditProfile(executorRank)) {
      return interaction.editReply({ content: 'You do not have authority to edit profiles.' });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: 'Target is not in the database.' });
    }

    const sheetName = targetData.Current_Sheet;
    const rows = await readSheet(sheetName);
    const headers = rows[0];
    const discordIdx = headers.indexOf('Discord_ID');
    let oldValue = '';

    for (let i = 1; i < rows.length; i++) {
      if (rows[i][discordIdx] === targetUser.id) {
        const row = rows[i];
        const fieldIdx = headers.indexOf(field);
        if (fieldIdx !== -1) {
          oldValue = row[fieldIdx] || '';
          row[fieldIdx] = value;
          await updateRow(sheetName, i + 1, row);
        }
        break;
      }
    }

    const now = new Date().toISOString();
    await updatePersonnelIndex(targetUser.id, {
      Last_Updated: now,
    });

    await logAudit({
      action: 'EDIT',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldRank: `${field}: ${oldValue}`,
      newRank: `${field}: ${value}`,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason,
      robloxChanged: false,
    });

    const embed = new EmbedBuilder()
      .setTitle('Profile Edited')
      .setColor(0xFFA500)
      .addFields(
        { name: 'Member', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Field', value: field, inline: true },
        { name: 'Old Value', value: oldValue || '—', inline: false },
        { name: 'New Value', value: value, inline: false },
        { name: 'By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason, inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
