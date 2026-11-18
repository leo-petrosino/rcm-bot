const { SlashCommandBuilder } = require('discord.js');
const { getMemberFromIndex, readSheet, updateRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank, canPardon } = require('../utils/permissions');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pardon')
    .setDescription('Pardon an active disciplinary strike from a service member')
    .addUserOption(option =>
      option.setName('user').setDescription('Personnel being pardoned').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Pardon justification rationale').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('strike_id')
        .setDescription('Optional specific docket ID (e.g. STK-1). Defaults to most recent active strike')
        .setRequired(false)
    ),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const strikeIdQuery = interaction.options.getString('strike_id');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (targetUser.id === interaction.user.id && !executorRank.isDeveloper) {
      return interaction.editReply({
        content: '❌ Self-pardons are prohibited. Only an independent superior officer may pardon disciplinary records.',
      });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: '❌ Target is not indexed in the personnel database.' });
    }

    const strikeRows = await readSheet('Strike_Log');
    if (strikeRows.length <= 1) {
      return interaction.editReply({ content: 'ℹ️ No strikes are currently recorded in the log.' });
    }

    const headers = strikeRows[0];
    const idIdx = headers.indexOf('Strike_ID');
    const targetIdx = headers.indexOf('Target_Discord');
    const statusIdx = headers.indexOf('Status');
    const issuerIdx = headers.indexOf('Issued_By');
    const severityIdx = headers.indexOf('Severity');

    let strikeRow = null;
    let strikeRowIndex = -1;

    // Search for matching strike
    for (let i = strikeRows.length - 1; i >= 1; i--) {
      const row = strikeRows[i];
      if (row[targetIdx] === targetUser.id && row[statusIdx] === 'Active') {
        if (!strikeIdQuery || row[idIdx] === strikeIdQuery.trim().toUpperCase()) {
          strikeRow = row;
          strikeRowIndex = i + 1;
          break;
        }
      }
    }

    if (!strikeRow) {
      return interaction.editReply({
        content: `❌ No active strikes found for <@${targetUser.id}>${strikeIdQuery ? ` matching docket \`${strikeIdQuery}\`` : ''}.`,
      });
    }

    // Verify chain of command authority
    const issuerId = strikeRow[issuerIdx];
    let issuerRankLevel = 1;
    try {
      const issuerMember = await interaction.guild.members.fetch(issuerId);
      const issuerRank = getMemberRank(issuerMember);
      if (issuerRank) issuerRankLevel = issuerRank.level;
    } catch {
      // Issuer might have left
      issuerRankLevel = 1;
    }

    if (!canPardon(executorRank, issuerRankLevel)) {
      return interaction.editReply({
        content: '❌ Insufficient authority. Under CAF military justice, you must be of equal or higher rank than the citing officer to grant a pardon.',
      });
    }

    const currentStrikes = parseInt(targetData.Strike_Count || '0', 10);
    const severity = strikeRow[severityIdx] || 'Minor';
    const removedCount = severity === 'Major' ? 2 : 1;
    const newStrikes = Math.max(0, currentStrikes - removedCount);
    const now = new Date().toISOString();

    // 1. Update Strike_Log
    strikeRow[statusIdx] = 'Pardoned';
    const pardonedByIdx = headers.indexOf('Pardoned_By');
    const pardonDateIdx = headers.indexOf('Pardon_Date');
    if (pardonedByIdx !== -1) strikeRow[pardonedByIdx] = interaction.user.id;
    if (pardonDateIdx !== -1) strikeRow[pardonDateIdx] = now;
    await updateRow('Strike_Log', strikeRowIndex, strikeRow);

    // 2. Update Personnel_Index
    await updatePersonnelIndex(targetUser.id, {
      Strike_Count: String(newStrikes),
      Last_Updated: now,
    });

    // 3. Log Audit
    await logAudit({
      action: 'PARDON',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldStrikes: currentStrikes,
      newStrikes,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason: `[DOCKET ${strikeRow[idIdx]}] ${reason}`,
      robloxChanged: false,
      client: interaction.client,
    });

    const embed = RcmEmbed.success('DISCIPLINARY PARDON GRANTED')
      .setDescription(
        `An official executive pardon has been registered for <@${targetUser.id}> (${targetData.Roblox_Username}).`
      )
      .addFields(
        { name: '🎖️ Member', value: `<@${targetUser.id}> (\`${targetData.Current_Rank}\`)`, inline: true },
        { name: '⚖️ Pardoned Infraction', value: `\`${severity} (-${removedCount} Strikes)\``, inline: true },
        { name: '📊 Adjusted Active Strikes', value: `\`${currentStrikes}\` ➡️ **\`${newStrikes}\` Strikes**, inline: true` },
        { name: '👑 Reviewing Authority', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
        { name: '🆔 Cleared Docket', value: `\`${strikeRow[idIdx]}\``, inline: true },
        { name: '📜 Pardon Justification', value: `*"${reason}"*`, inline: false }
      );

    await interaction.editReply({ embeds: [embed] });
  },
};
