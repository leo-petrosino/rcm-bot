const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMemberFromIndex, readSheet, updateRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank, canPardon } = require('../utils/permissions');
const { logAudit } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pardon')
    .setDescription('Pardon (remove) the most recent active strike from a member')
    .addUserOption(option => option.setName('user').setDescription('Member to pardon').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for pardon').setRequired(true)),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: 'Target is not in the database.' });
    }

    // Find most recent active strike
    const strikeRows = await readSheet('Strike_Log');
    if (strikeRows.length <= 1) {
      return interaction.editReply({ content: 'No strikes found for this member.' });
    }

    const headers = strikeRows[0];
    const targetIdx = headers.indexOf('Target_Discord');
    const statusIdx = headers.indexOf('Status');
    const issuedByIdx = headers.indexOf('Issued_By');

    let strikeRowIndex = -1;
    let strikeRow = null;

    for (let i = strikeRows.length - 1; i >= 1; i--) {
      if (strikeRows[i][targetIdx] === targetUser.id && strikeRows[i][statusIdx] === 'Active') {
        strikeRow = strikeRows[i];
        strikeRowIndex = i + 1;
        break;
      }
    }

    if (!strikeRow) {
      return interaction.editReply({ content: 'No active strikes to pardon for this member.' });
    }

    const issuerId = strikeRow[issuedByIdx];
    const issuerMember = await interaction.guild.members.fetch(issuerId).catch(() => null);
    const issuerRank = issuerMember ? getMemberRank(issuerMember) : null;

    if (!canPardon(executorRank, issuerRank ? issuerRank.level : 999)) {
      return interaction.editReply({ content: 'You do not have authority to pardon this strike. You must be equal or higher rank than the issuer.' });
    }

    const currentStrikes = parseInt(targetData.Strike_Count || '0');
    const severity = strikeRow[headers.indexOf('Severity')];
    const removed = severity === 'Major' ? 2 : 1;
    const newStrikes = Math.max(0, currentStrikes - removed);
    const now = new Date().toISOString();

    // Update strike log
    strikeRow[statusIdx] = 'Pardoned';
    strikeRow[headers.indexOf('Pardoned_By')] = interaction.user.id;
    strikeRow[headers.indexOf('Pardon_Date')] = now;
    await updateRow('Strike_Log', strikeRowIndex, strikeRow);

    // Update personnel sheet
    const sheetName = targetData.Current_Sheet;
    const rows = await readSheet(sheetName);
    const pHeaders = rows[0];
    const discordIdx = pHeaders.indexOf('Discord_ID');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][discordIdx] === targetUser.id) {
        const row = rows[i];
        row[pHeaders.indexOf('Strike_Count')] = String(newStrikes);
        await updateRow(sheetName, i + 1, row);
        break;
      }
    }

    await updatePersonnelIndex(targetUser.id, {
      Strike_Count: String(newStrikes),
      Last_Updated: now,
    });

    await logAudit({
      action: 'PARDON',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldStrikes: currentStrikes,
      newStrikes: newStrikes,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason,
      robloxChanged: false,
    });

    const embed = new EmbedBuilder()
      .setTitle('Strike Pardoned')
      .setColor(0x00AA00)
      .addFields(
        { name: 'Member', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Strike Severity', value: severity, inline: true },
        { name: 'Strike Count', value: `${currentStrikes} → **${newStrikes}**`, inline: true },
        { name: 'Pardoned By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason, inline: false },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
