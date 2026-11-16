const { SlashCommandBuilder } = require('discord.js');
const { readSheet } = require('../utils/sheets');
const { getMemberRank, canAudit } = require('../utils/permissions');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('Inspect formal administrative and disciplinary audit history (Sergeant+)')
    .addUserOption(opt => opt.setName('user').setDescription('Target member to audit').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('limit')
        .setDescription('Number of records to retrieve (5-25)')
        .setMinValue(5)
        .setMaxValue(25)
    )
    .addStringOption(opt =>
      opt.setName('action')
        .setDescription('Filter by specific action type')
        .setRequired(false)
        .addChoices(
          { name: '⬆️ Promotions', value: 'PROMOTE' },
          { name: '⬇️ Demotions', value: 'DEMOTE' },
          { name: '⚠️ Strikes', value: 'STRIKE' },
          { name: '✅ Pardons', value: 'PARDON' },
          { name: '🔴 Discharges', value: 'DISCHARGE' },
          { name: '🛡️ Regimental Postings', value: 'REGIMENT' },
          { name: '⛔ Blacklists', value: 'BLACKLIST' },
          { name: '🔵 Leaves of Absence', value: 'LOA' },
        )
    ),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const limit = interaction.options.getInteger('limit') || 10;
    const actionFilter = interaction.options.getString('action');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canAudit(executorRank)) {
      return interaction.editReply({
        content: '❌ Insufficient authority. Only Non-Commissioned Officers (Sergeant+) and above can inspect audit dockets.',
      });
    }

    const auditRows = await readSheet('Audit_Log');
    if (auditRows.length <= 1) {
      return interaction.editReply({ content: 'ℹ️ No entries currently recorded in the audit docket.' });
    }

    const headers = auditRows[0];
    const targetIdx = headers.indexOf('Target_Discord');
    const actionIdx = headers.indexOf('Action');
    const dateIdx = headers.indexOf('Timestamp');
    const reasonIdx = headers.indexOf('Reason');
    const executorIdx = headers.indexOf('Executor_Discord');
    const oldRankIdx = headers.indexOf('Old_Rank');
    const newRankIdx = headers.indexOf('New_Rank');

    let filtered = auditRows
      .slice(1)
      .reverse()
      .filter(r => r[targetIdx] === targetUser.id);

    if (actionFilter) {
      filtered = filtered.filter(r => (r[actionIdx] || '').includes(actionFilter));
    }

    filtered = filtered.slice(0, limit);

    if (filtered.length === 0) {
      return interaction.editReply({
        content: `ℹ️ No audit history found for <@${targetUser.id}>${actionFilter ? ` matching action \`${actionFilter}\`` : ''}.`,
      });
    }

    const embed = RcmEmbed.base(`AUDIT TRAIL • ${targetUser.username}`)
      .setDescription(
        `Showing last **${filtered.length}** administrative records for <@${targetUser.id}>.\n` +
        `Audit Authority: <@${interaction.user.id}> (${executorRank.abbr})`
      );

    for (const row of filtered.slice(0, 10)) {
      const time = RcmEmbed.formatTimestamp(row[dateIdx], 'f');
      const action = row[actionIdx] || 'UNKNOWN';
      const by = row[executorIdx] ? `<@${row[executorIdx]}>` : 'SYSTEM';
      const oldR = row[oldRankIdx] || '—';
      const newR = row[newRankIdx] || '—';
      const reason = row[reasonIdx] || 'No justification logged';

      const changeInfo = (oldR !== '—' || newR !== '—') ? `\`${oldR}\` ➡️ \`${newR}\`\n` : '';

      embed.addFields({
        name: `📌 [${action}] • ${time}`,
        value: `${changeInfo}**By:** ${by}\n**Rationale:** *"${reason.length > 120 ? reason.slice(0, 120) + '...' : reason}"*`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};
