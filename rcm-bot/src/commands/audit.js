const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { readSheet } = require('../utils/sheets');
const { getMemberRank, canAudit } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('View audit history for a member')
    .addUserOption(option => option.setName('user').setDescription('Member to audit').setRequired(true))
    .addIntegerOption(option => option.setName('limit').setDescription('Number of entries (5-25)').setMinValue(5).setMaxValue(25))
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Filter by action type')
        .setRequired(false)
        .addChoices(
          { name: 'Promote', value: 'PROMOTE' },
          { name: 'Demote', value: 'DEMOTE' },
          { name: 'Strike', value: 'STRIKE' },
          { name: 'Pardon', value: 'PARDON' },
          { name: 'Discharge', value: 'DISCHARGE' },
          { name: 'LOA', value: 'LOA' },
          { name: 'Edit', value: 'EDIT' },
        )),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const limit = interaction.options.getInteger('limit') || 10;
    const actionFilter = interaction.options.getString('action');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canAudit(executorRank)) {
      return interaction.reply({ content: 'You do not have authority to view audit logs.', ephemeral: true });
    }

    const auditRows = await readSheet('Audit_Log');
    if (auditRows.length <= 1) {
      return interaction.reply({ content: 'No audit entries found.', ephemeral: true });
    }

    const headers = auditRows[0];
    const targetIdx = headers.indexOf('Target_Discord');
    const actionIdx = headers.indexOf('Action');
    const dateIdx = headers.indexOf('Timestamp');
    const reasonIdx = headers.indexOf('Reason');
    const executorIdx = headers.indexOf('Executor_Discord');
    const oldRankIdx = headers.indexOf('Old_Rank');
    const newRankIdx = headers.indexOf('New_Rank');

    let filtered = auditRows.slice(1).reverse().filter(r => r[targetIdx] === targetUser.id);
    if (actionFilter) {
      filtered = filtered.filter(r => r[actionIdx] === actionFilter);
    }
    filtered = filtered.slice(0, limit);

    if (filtered.length === 0) {
      return interaction.reply({ content: `No audit entries found for <@${targetUser.id}>${actionFilter ? ` with action type **${actionFilter}**` : ''}.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`Audit Log — ${targetUser.username}`)
      .setColor(0xC41E3A)
      .setDescription(`Showing last ${filtered.length} entries`)
      .setFooter({ text: `Discord ID: ${targetUser.id}` });

    for (const row of filtered.slice(0, 10)) {
      const date = row[dateIdx] ? row[dateIdx].split('T')[0] : '?';
      const action = row[actionIdx] || '?';
      const by = row[executorIdx] ? `<@${row[executorIdx]}>` : 'Unknown';
      const oldR = row[oldRankIdx] || '—';
      const newR = row[newRankIdx] || '—';
      const reason = row[reasonIdx] || 'No reason provided';

      embed.addFields({
        name: `${action} — ${date}`,
        value: `By: ${by}\n${oldR !== '—' && newR !== '—' ? `${oldR} → ${newR}\n` : ''}${reason.length > 100 ? reason.slice(0, 100) + '...' : reason}`,
        inline: false,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
