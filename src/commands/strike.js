const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMemberFromIndex, readSheet, appendRow, updateRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank, canStrike } = require('../utils/permissions');
const { logAudit } = require('../utils/audit');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Issue a strike to a member')
    .addUserOption(option => option.setName('user').setDescription('Member to strike').setRequired(true))
    .addStringOption(option =>
      option.setName('severity')
        .setDescription('Strike severity')
        .setRequired(true)
        .addChoices(
          { name: 'Minor (+1)', value: 'Minor' },
          { name: 'Major (+2)', value: 'Major' },
        ))
    .addStringOption(option => option.setName('reason').setDescription('Reason for strike (min 20 chars)').setRequired(true)),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const severity = interaction.options.getString('severity');
    const reason = interaction.options.getString('reason');

    if (reason.length < 20) {
      return interaction.editReply({ content: 'Reason must be at least 20 characters.' });
    }

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canStrike(executorRank)) {
      return interaction.editReply({ content: 'You do not have authority to issue strikes.' });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: 'Target is not in the database.' });
    }

    const currentStrikes = parseInt(targetData.Strike_Count || '0');
    const totalStrikes = parseInt(targetData.Total_Strikes || '0');
    const added = severity === 'Major' ? 2 : 1;
    const newStrikes = currentStrikes + added;
    const newTotal = totalStrikes + added;
    const now = new Date().toISOString();

    // Add to Strike_Log
    const strikeRows = await readSheet('Strike_Log');
    const strikeId = strikeRows.length;
    await appendRow('Strike_Log', [
      String(strikeId),
      targetUser.id,
      now,
      interaction.user.id,
      severity,
      reason,
      'Active',
      '',
      '',
    ]);

    // Update personnel sheet
    const sheetName = targetData.Current_Sheet;
    const rows = await readSheet(sheetName);
    const headers = rows[0];
    const discordIdx = headers.indexOf('Discord_ID');
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][discordIdx] === targetUser.id) {
        const row = rows[i];
        row[headers.indexOf('Strike_Count')] = String(newStrikes);
        row[headers.indexOf('Total_Strikes')] = String(newTotal);
        await updateRow(sheetName, i + 1, row);
        break;
      }
    }

    await updatePersonnelIndex(targetUser.id, {
      Strike_Count: String(newStrikes),
      Total_Strikes: String(newTotal),
      Last_Updated: now,
    });

    await logAudit({
      action: 'STRIKE',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldStrikes: currentStrikes,
      newStrikes: newStrikes,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason: `[${severity}] ${reason}`,
      robloxChanged: false,
    });

    let warning = '';
    if (newStrikes >= 6) {
      warning = '\n\n**⚠️ THRESHOLD REACHED:** This member now has 6+ strikes. **Discharge is recommended.**';
    } else if (newStrikes >= 5) {
      warning = '\n\n**⚠️ REVIEW REQUIRED:** This member has 5 strikes. High Command should review for discharge.';
    } else if (newStrikes >= 3) {
      warning = '\n\n**🚫 PROMOTION HOLD:** This member is blocked from promotion until strikes are pardoned.';
    }

    const embed = new EmbedBuilder()
      .setTitle('Strike Issued')
      .setColor(0xFF0000)
      .addFields(
        { name: 'Member', value: `<@${targetUser.id}>`, inline: true },
        { name: 'Severity', value: severity, inline: true },
        { name: 'Strike Count', value: `${currentStrikes} → **${newStrikes}**`, inline: true },
        { name: 'Issued By', value: `<@${interaction.user.id}>`, inline: true },
        { name: 'Reason', value: reason, inline: false },
      )
      .setDescription(warning || null)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
