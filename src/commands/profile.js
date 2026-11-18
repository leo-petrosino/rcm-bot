const { SlashCommandBuilder } = require('discord.js');
const { getMemberFromIndex, readSheet, findHeaderRow } = require('../utils/sheets');
const { getRegimentById } = require('../../config');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription("View an RCM service member's military dossier")
    .addUserOption(option =>
      option.setName('user')
        .setDescription('Member to inspect (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await getMemberFromIndex(targetUser.id);

    if (!member) {
      return interaction.editReply({
        content: `❌ No service record found for <@${targetUser.id}>. They must link their account using \`/verify\`.`,
      });
    }

    // Resolve regiment
    const regiment = getRegimentById(member.Regiment);
    const regimentDisplay = regiment
      ? `${regiment.emoji} **${regiment.name}** (\`${regiment.id}\`)`
      : '*(Unassigned)*';

    // Retrieve recent actions from Audit_Log
    const auditRows = await readSheet('Audit_Log');
    let recentActions = '• *No recent administrative entries*';

    if (auditRows.length > 1) {
      const { headerIndex, headers } = findHeaderRow(auditRows, 'action');
      if (headerIndex !== -1) {
        const targetIdx = headers.indexOf('Target_Discord');
        const actionIdx = headers.indexOf('Action');
        const dateIdx = headers.indexOf('Timestamp');

        const userAudits = auditRows
          .slice(headerIndex + 1)
          .reverse()
          .filter(r => r[targetIdx] === targetUser.id)
          .slice(0, 3);

      if (userAudits.length > 0) {
        recentActions = userAudits
          .map(r => {
            const time = RcmEmbed.formatTimestamp(r[dateIdx], 'd');
            return `• \`${r[actionIdx]}\` — ${time}`;
          })
          .join('\n');
      }
    }
  }

    const strikes = parseInt(member.Strike_Count || '0', 10);
    const strikeDisplay = strikes === 0
      ? '🟢 `0 Strikes (Clean Record)`'
      : strikes < 3
      ? `🟡 \`${strikes} Active Strikes\``
      : `🔴 \`${strikes} Active Strikes (FLAGGED)\``;

    const embed = RcmEmbed.base(`MILITARY SERVICE RECORD • ${member.Roblox_Username}`)
      .setDescription(
        `**Canadian Armed Forces Service Dossier**\n` +
        `Current Status: ${RcmEmbed.statusBadge(member.Status)}\n` +
        `Discord Identity: <@${targetUser.id}>`
      )
      .addFields(
        {
          name: '🎖️ Rank & Classification',
          value: `**${member.Current_Rank}** (Level ${member.Rank_Level})\nClass: \`${member.Class || 'General Service'}\``,
          inline: true,
        },
        {
          name: '🛡️ Regimental Assignment',
          value: regimentDisplay,
          inline: true,
        },
        {
          name: '🌐 Roblox Record',
          value: `[${member.Roblox_Username}](https://www.roblox.com/users/${member.Roblox_ID}/profile)\nID: \`${member.Roblox_ID}\``,
          inline: true,
        },
        {
          name: '📅 Enlistment Date',
          value: RcmEmbed.formatTimestamp(member.Join_Date, 'D') + ` (${RcmEmbed.formatTimestamp(member.Join_Date, 'R')})`,
          inline: true,
        },
        {
          name: '⚖️ Disciplinary Standing',
          value: strikeDisplay,
          inline: true,
        },
        {
          name: '🕒 Last Service Update',
          value: RcmEmbed.formatTimestamp(member.Last_Updated, 'R'),
          inline: true,
        },
        {
          name: '📜 Recent Record Actions',
          value: recentActions,
          inline: false,
        }
      )
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${member.Roblox_ID}&width=150&height=150&format=png`);

    await interaction.editReply({ embeds: [embed] });
  },
};
