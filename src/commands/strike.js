const { SlashCommandBuilder } = require('discord.js');
const { getMemberFromIndex, readSheet, appendRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank, canStrike } = require('../utils/permissions');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('strike')
    .setDescription('Issue a formal disciplinary strike to a service member')
    .addUserOption(option =>
      option.setName('user').setDescription('Personnel being cited').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('severity')
        .setDescription('Disciplinary severity level')
        .setRequired(true)
        .addChoices(
          { name: 'Minor Infraction (+1 Strike)', value: 'Minor' },
          { name: 'Major Violation (+2 Strikes)', value: 'Major' }
        )
    )
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Explicit infraction rationale (min 20 characters)')
        .setRequired(true)
    ),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const severity = interaction.options.getString('severity');
    const reason = interaction.options.getString('reason');

    if (reason.length < 20) {
      return interaction.editReply({
        content: '⚠️ Official disciplinary citations require a detailed rationale of at least 20 characters.',
      });
    }

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canStrike(executorRank)) {
      return interaction.editReply({
        content: '❌ You do not hold disciplinary citation authority (Requires Captain+).',
      });
    }

    if (targetUser.id === interaction.user.id && !executorRank.isDeveloper) {
      return interaction.editReply({
        content: '❌ You cannot issue a disciplinary strike against yourself.',
      });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: '❌ Target is not indexed in the personnel database.' });
    }

    const currentStrikes = parseInt(targetData.Strike_Count || '0', 10);
    const addedStrikes = severity === 'Major' ? 2 : 1;
    const newStrikes = currentStrikes + addedStrikes;
    const now = new Date().toISOString();

    // 1. Append to Strike_Log
    const strikeRows = await readSheet('Strike_Log');
    const strikeId = `STK-${strikeRows.length || 1}`;
    await appendRow('Strike_Log', [
      strikeId,
      targetUser.id,
      now,
      interaction.user.id,
      severity,
      reason,
      'Active',
      '',
      '',
    ]);

    // 2. Update Personnel_Index
    await updatePersonnelIndex(targetUser.id, {
      Strike_Count: String(newStrikes),
      Last_Updated: now,
    });

    // 3. Log Audit
    await logAudit({
      action: 'STRIKE',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldStrikes: currentStrikes,
      newStrikes,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason: `[${severity.toUpperCase()}] ${reason}`,
      robloxChanged: false,
      client: interaction.client,
    });

    // Escalation warnings
    let warningBanner = '';
    if (newStrikes >= 6) {
      warningBanner = '\n\n🚨 **MAXIMUM THRESHOLD EXCEEDED**: Service member has accumulated **6+ active strikes**. **Immediate Administrative Discharge / Court Martial recommended.**';
    } else if (newStrikes >= 5) {
      warningBanner = '\n\n⚠️ **HIGH COMMAND REVIEW**: Member has reached **5 active strikes**. Conduct review docket initiated.';
    } else if (newStrikes >= 3) {
      warningBanner = '\n\n🚫 **PROMOTION SUSPENSION**: Member is now placed on **administrative promotion hold** until strikes are pardoned.';
    }

    const embed = RcmEmbed.warning('DISCIPLINARY INFRACTION CITED')
      .setDescription(
        `A disciplinary strike has been officially registered against <@${targetUser.id}> (${targetData.Roblox_Username}).` +
        warningBanner
      )
      .addFields(
        { name: '🎖️ Member', value: `<@${targetUser.id}> (\`${targetData.Current_Rank}\`)`, inline: true },
        { name: '⚖️ Infraction Level', value: `\`${severity} (+${addedStrikes})\``, inline: true },
        { name: '📊 Cumulative Strikes', value: `\`${currentStrikes}\` ➡️ **\`${newStrikes}\` Strikes**, inline: true` },
        { name: '👑 Citing Officer', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
        { name: '🆔 Citation Docket ID', value: `\`${strikeId}\``, inline: true },
        { name: '📋 Violation Details', value: `*"${reason}"*`, inline: false }
      )
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${targetData.Roblox_ID}&width=150&height=150&format=png`);

    await interaction.editReply({ embeds: [embed] });
  },
};
