const { SlashCommandBuilder } = require('discord.js');
const { getMemberFromIndex, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank } = require('../utils/permissions');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loa')
    .setDescription('Request, approve, or conclude a Leave of Absence (LOA)')
    .addSubcommand(sub =>
      sub.setName('request')
        .setDescription('Request or log a Leave of Absence for yourself or another member')
        .addStringOption(opt => opt.setName('start').setDescription('Start date (YYYY-MM-DD)').setRequired(true))
        .addStringOption(opt => opt.setName('end').setDescription('End date (YYYY-MM-DD)').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Reason for absence').setRequired(true))
        .addUserOption(opt => opt.setName('user').setDescription('Officer use: member receiving LOA').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('return')
        .setDescription('Conclude a Leave of Absence and return to active status')
        .addUserOption(opt => opt.setName('user').setDescription('Officer use: member returning to active duty').setRequired(false))
    ),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user') || interaction.user;

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);
    const isOfficer = executorRank && executorRank.canPromote;

    // Non-officers can only manage their own LOA
    if (targetUser.id !== interaction.user.id && !isOfficer) {
      return interaction.editReply({
        content: '❌ Only commissioned officers can log or modify a Leave of Absence for another service member.',
      });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({
        content: '❌ Member is not indexed in the personnel database. Run `/verify` first.',
      });
    }

    const now = new Date().toISOString();

    if (subcommand === 'request') {
      const start = interaction.options.getString('start');
      const end = interaction.options.getString('end');
      const reason = interaction.options.getString('reason');

      await updatePersonnelIndex(targetUser.id, {
        Status: 'LOA',
        Last_Updated: now,
      });

      await logAudit({
        action: 'LOA_START',
        targetDiscord: targetUser.id,
        targetRoblox: targetData.Roblox_ID,
        executorDiscord: interaction.user.id,
        executorRank: executorRank ? executorRank.name : 'SELF',
        reason: `${start} to ${end}: ${reason}`,
        robloxChanged: false,
        client: interaction.client,
      });

      const embed = RcmEmbed.base('LEAVE OF ABSENCE REGISTERED')
        .setDescription(`An official military Leave of Absence (LOA) has been authorized for <@${targetUser.id}>.`)
        .addFields(
          { name: '🎖️ Member', value: `<@${targetUser.id}> (\`${targetData.Current_Rank}\`)`, inline: true },
          { name: '📋 Status', value: '🔵 `ON LEAVE (LOA)`', inline: true },
          { name: '📅 Leave Duration', value: `\`${start}\` ➡️ \`${end}\``, inline: true },
          { name: '👑 Authorized By', value: `<@${interaction.user.id}> (${executorRank ? executorRank.abbr : 'SELF'})`, inline: true },
          { name: '📜 Documented Rationale', value: `*"${reason}"*`, inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'return') {
      await updatePersonnelIndex(targetUser.id, {
        Status: 'Active',
        Last_Updated: now,
      });

      await logAudit({
        action: 'LOA_RETURN',
        targetDiscord: targetUser.id,
        targetRoblox: targetData.Roblox_ID,
        executorDiscord: interaction.user.id,
        executorRank: executorRank ? executorRank.name : 'SELF',
        reason: 'Returned to Active Duty',
        robloxChanged: false,
        client: interaction.client,
      });

      const embed = RcmEmbed.success('RETURN TO ACTIVE DUTY')
        .setDescription(`<@${targetUser.id}> has concluded their Leave of Absence and is returned to **Active Service** standing.`)
        .addFields(
          { name: '🎖️ Member', value: `<@${targetUser.id}> (\`${targetData.Current_Rank}\`)`, inline: true },
          { name: '📋 Restored Status', value: '🟢 `ACTIVE`', inline: true }
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
