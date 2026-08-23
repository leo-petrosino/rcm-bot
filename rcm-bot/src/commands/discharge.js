const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getMemberFromIndex, readSheet, appendRow, deleteRow, updatePersonnelIndex } = require('../utils/sheets');
const { getMemberRank, canDischarge } = require('../utils/permissions');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');
const { RANKS } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('discharge')
    .setDescription('Discharge a member from RCM')
    .addUserOption(option => option.setName('user').setDescription('Member to discharge').setRequired(true))
    .addStringOption(option =>
      option.setName('type')
        .setDescription('Discharge type')
        .setRequired(true)
        .addChoices(
          { name: 'Honorable', value: 'Honorable' },
          { name: 'General', value: 'General' },
          { name: 'Dishonorable', value: 'Dishonorable' },
        ))
    .addStringOption(option => option.setName('reason').setDescription('Reason for discharge (min 30 chars)').setRequired(true)),
  cooldown: 10000,

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const type = interaction.options.getString('type');
    const reason = interaction.options.getString('reason');

    if (reason.length < 30) {
      return interaction.reply({ content: 'Reason must be at least 30 characters.', ephemeral: true });
    }

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.reply({ content: 'Target is not in the database.', ephemeral: true });
    }

    const targetLevel = parseInt(targetData.Rank_Level);

    if (!canDischarge(executorRank, targetLevel)) {
      return interaction.reply({ content: 'You do not have authority to discharge this member.', ephemeral: true });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm_discharge').setLabel('Confirm Discharge').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('cancel_discharge').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );

    const msg = await interaction.reply({
      content: `Are you sure you want to discharge <@${targetUser.id}> (${targetData.Current_Rank})?\n**Type:** ${type}\n**Reason:** ${reason}`,
      components: [row],
      ephemeral: true,
    });

    const filter = i => i.user.id === interaction.user.id;
    try {
      const confirmation = await msg.awaitMessageComponent({ filter, time: 30000 });

      if (confirmation.customId === 'cancel_discharge') {
        return confirmation.update({ content: 'Discharge cancelled.', components: [] });
      }

      await confirmation.deferUpdate();

      // Try to remove from Roblox group
      try {
        await setRank(targetData.Roblox_ID, 'Guest');
      } catch (err) {
        console.error('Roblox group removal failed:', err);
      }

      // Remove Discord roles
      try {
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        for (const rank of RANKS) {
          if (targetMember.roles.cache.has(rank.roleId)) {
            await targetMember.roles.remove(rank.roleId);
          }
        }
      } catch (err) {
        console.error('Discord role removal failed:', err);
      }

      // Move to Discharged sheet
      const oldSheet = targetData.Current_Sheet;
      const now = new Date().toISOString();

      try {
        const oldRows = await readSheet(oldSheet);
        const oldHeaders = oldRows[0];
        const discordIdx = oldHeaders.indexOf('Discord_ID');
        let oldRowData = null;
        let oldRowIndex = -1;
        for (let i = 1; i < oldRows.length; i++) {
          if (oldRows[i][discordIdx] === targetUser.id) {
            oldRowData = oldRows[i];
            oldRowIndex = i + 1;
            break;
          }
        }

        if (oldRowData) {
          await appendRow('Discharged', [
            targetUser.id,
            targetData.Roblox_ID,
            targetData.Roblox_Username,
            targetData.Current_Rank,
            targetData.Rank_Level,
            oldRowData[oldHeaders.indexOf('Branch')] || '',
            oldRowData[oldHeaders.indexOf('Join_Date')] || '',
            oldRowData[oldHeaders.indexOf('Last_Promotion')] || '',
            oldRowData[oldHeaders.indexOf('Strike_Count')] || '0',
            oldRowData[oldHeaders.indexOf('Total_Strikes')] || '0',
            type,
            now,
            reason,
          ]);
          await deleteRow(oldSheet, oldRowIndex);
        }
      } catch (err) {
        console.error('Move to Discharged sheet failed:', err);
      }

      await updatePersonnelIndex(targetUser.id, {
        Status: 'Discharged',
        Current_Sheet: 'Discharged',
        Last_Updated: now,
      });

      await logAudit({
        action: 'DISCHARGE',
        targetDiscord: targetUser.id,
        targetRoblox: targetData.Roblox_ID,
        oldRank: targetData.Current_Rank,
        newRank: `Discharged (${type})`,
        executorDiscord: interaction.user.id,
        executorRank: executorRank.name,
        reason,
        robloxChanged: true,
      });

      await confirmation.editReply({
        content: `✅ <@${targetUser.id}> has been discharged.\n**Type:** ${type}\n**Reason:** ${reason}`,
        components: [],
      });

    } catch {
      await interaction.editReply({ content: 'Discharge confirmation timed out.', components: [] });
    }
  },
};
