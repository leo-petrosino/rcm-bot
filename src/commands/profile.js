const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getMemberFromIndex, readSheet } = require('../utils/sheets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View a member\'s service record')
    .addUserOption(option => 
      option.setName('user')
        .setDescription('Member to lookup')
        .setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user') || interaction.user;
    const member = await getMemberFromIndex(target.id);

    if (!member) {
      return interaction.reply({ content: 'Member not found in database. They may need to `/verify` first.', ephemeral: true });
    }

    // Get recent audit entries
    const auditRows = await readSheet('Audit_Log');
    let recentActions = 'None';
    if (auditRows.length > 1) {
      const headers = auditRows[0];
      const targetIdx = headers.indexOf('Target_Discord');
      const actionIdx = headers.indexOf('Action');
      const dateIdx = headers.indexOf('Timestamp');
      const filtered = auditRows.slice(1).reverse().filter(r => r[targetIdx] === target.id).slice(0, 3);
      if (filtered.length > 0) {
        recentActions = filtered.map(r => {
          const date = r[dateIdx] ? r[dateIdx].split('T')[0] : '?';
          return `${r[actionIdx]} (${date})`;
        }).join('\n');
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`${target.username} — Service Record`)
      .setColor(0xC41E3A)
      .addFields(
        { name: 'Rank', value: member.Current_Rank || 'Unknown', inline: true },
        { name: 'Class', value: member.Class || 'Unknown', inline: true },
        { name: 'Status', value: member.Status || 'Unknown', inline: true },
        { name: 'Roblox', value: `[${member.Roblox_Username}](https://www.roblox.com/users/${member.Roblox_ID}/profile)`, inline: false },
        { name: 'Strikes', value: member.Strike_Count || '0', inline: true },
        { name: 'Joined', value: member.Join_Date ? member.Join_Date.split('T')[0] : 'N/A', inline: true },
        { name: 'Last Promotion', value: member.Last_Promotion ? member.Last_Promotion.split('T')[0] : 'N/A', inline: true },
        { name: 'Recent Actions', value: recentActions, inline: false },
      )
      .setFooter({ text: `Discord ID: ${target.id}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
