const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getMemberFromIndex, appendRow, updatePersonnelIndex, removeMemberFromClassSheets } = require('../utils/sheets');
const { getMemberRank, canDischarge } = require('../utils/permissions');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');
const { RANKS } = require('../../config');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('discharge')
    .setDescription('Formally discharge a member from the Royal Canadian Military (Captain+)')
    .addUserOption(option =>
      option.setName('user').setDescription('Service member to discharge').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Official classification of discharge')
        .setRequired(true)
        .addChoices(
          { name: '🎖️ Honorable Discharge', value: 'Honorable' },
          { name: '📋 General Discharge (Under Honorable Conditions)', value: 'General' },
          { name: '⚖️ Dishonorable Discharge (Administrative Separation)', value: 'Dishonorable' }
        )
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Discharge rationale (min 25 characters)').setRequired(true)
    ),
  cooldown: 10000,

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    const reason = interaction.options.getString('reason');

    if (reason.length < 25) {
      return interaction.reply({
        content: '⚠️ Official separation orders require a comprehensive rationale of at least 25 characters.',
        ephemeral: true,
      });
    }

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.reply({ content: '❌ Target is not indexed in the database.', ephemeral: true });
    }

    const targetLevel = parseInt(targetData.Rank_Level, 10);
    if (!canDischarge(executorRank, targetLevel)) {
      return interaction.reply({
        content: '❌ You do not have authority to discharge this service member.',
        ephemeral: true,
      });
    }

    // Interactive button row
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_discharge')
        .setLabel('Confirm Administrative Separation')
        .setStyle(type === 'Dishonorable' ? ButtonStyle.Danger : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('cancel_discharge')
        .setLabel('Cancel Order')
        .setStyle(ButtonStyle.Secondary)
    );

    const promptEmbed = RcmEmbed.warning('SEPARATION PROCEEDINGS INITIATED')
      .setDescription(
        `Are you sure you wish to issue an official **${type} Discharge** for <@${targetUser.id}> (**${targetData.Roblox_Username}**)?\n\n` +
        `• **Current Rank:** ${targetData.Current_Rank}\n` +
        `• **Regiment:** ${targetData.Regiment || 'Unassigned'}\n` +
        `• **Rationale:** *"${reason}"*`
      );

    const responseMsg = await interaction.reply({
      embeds: [promptEmbed],
      components: [row],
      ephemeral: true,
    });

    const filter = i => i.user.id === interaction.user.id;
    try {
      const confirmation = await responseMsg.awaitMessageComponent({ filter, time: 30000 });

      if (confirmation.customId === 'cancel_discharge') {
        return confirmation.update({
          content: '✅ Discharge proceedings cancelled. No changes made.',
          embeds: [],
          components: [],
        });
      }

      await confirmation.deferUpdate();

      // 1. Roblox group derank to Guest
      let robloxSuccess = false;
      try {
        await setRank(targetData.Roblox_ID, 'Guest');
        robloxSuccess = true;
      } catch (err) {
        console.error('[Discharge] Roblox derank failed:', err.message);
      }

      // 2. Remove Discord military roles
      try {
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        for (const r of RANKS) {
          if (r.roleId && targetMember.roles.cache.has(r.roleId)) {
            await targetMember.roles.remove(r.roleId);
          }
        }
      } catch (err) {
        console.warn('[Discharge] Discord role strip warning:', err.message);
      }

      const now = new Date().toISOString();

      // 3. Append to Discharged Sheet
      await appendRow('Discharged', [
        targetUser.id,
        targetData.Roblox_ID,
        targetData.Roblox_Username,
        targetData.Current_Rank,
        targetData.Rank_Level,
        targetData.Regiment || 'None',
        targetData.Join_Date || '',
        type,
        now,
        reason,
      ]);

      // 4. Update Personnel_Index status and remove from active class sheets
      await updatePersonnelIndex(targetUser.id, {
        Status: 'Discharged',
        Last_Updated: now,
      });

      await removeMemberFromClassSheets(targetUser.id);

      // 5. Log Audit
      await logAudit({
        action: 'DISCHARGE',
        targetDiscord: targetUser.id,
        targetRoblox: targetData.Roblox_ID,
        oldRank: targetData.Current_Rank,
        newRank: `Discharged (${type})`,
        executorDiscord: interaction.user.id,
        executorRank: executorRank.name,
        reason,
        robloxChanged: robloxSuccess,
        client: interaction.client,
      });

      const finalEmbed = RcmEmbed.danger(`OFFICIAL DISCHARGE • ${type.toUpperCase()}`)
        .setDescription(`An official discharge decree has been executed for <@${targetUser.id}>.`)
        .addFields(
          { name: '🎖️ Former Rank', value: targetData.Current_Rank, inline: true },
          { name: '📋 Separation Type', value: `\`${type} Discharge\``, inline: true },
          { name: '👑 Discharging Officer', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
          { name: '🌐 Roblox Status', value: robloxSuccess ? '✅ Group Rank Set to Guest' : '⚠️ Manual Derank Required', inline: true },
          { name: '📜 Official Record Rationale', value: `*"${reason}"*`, inline: false },
        );

      await confirmation.editReply({
        content: null,
        embeds: [finalEmbed],
        components: [],
      });
    } catch {
      await interaction.editReply({
        content: '⏱️ Discharge confirmation timed out. Action cancelled.',
        embeds: [],
        components: [],
      });
    }
  },
};
