const { SlashCommandBuilder } = require('discord.js');
const { getMemberFromIndex, updatePersonnelIndex, findRowByDiscordId, updateRow } = require('../utils/sheets');
const { getMemberRank, canEditProfile } = require('../utils/permissions');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editprofile')
    .setDescription("Modify a member's personnel dossier records (Major+)")
    .addUserOption(opt => opt.setName('user').setDescription('Personnel to edit').setRequired(true))
    .addStringOption(opt =>
      opt.setName('field')
        .setDescription('Record field to modify')
        .setRequired(true)
        .addChoices(
          { name: '🛡️ Regiment', value: 'Regiment' },
          { name: '🌐 Roblox ID', value: 'Roblox_ID' },
          { name: '👤 Roblox Username', value: 'Roblox_Username' },
          { name: '📅 Join Date (YYYY-MM-DD)', value: 'Join_Date' },
        )
    )
    .addStringOption(opt => opt.setName('value').setDescription('New value to set').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Administrative justification').setRequired(true)),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const targetUser = interaction.options.getUser('user');
    const field = interaction.options.getString('field');
    const value = interaction.options.getString('value');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canEditProfile(executorRank)) {
      return interaction.editReply({
        content: '❌ Insufficient authority. Only senior field officers (Major+) can modify personnel dossiers.',
      });
    }

    const targetData = await getMemberFromIndex(targetUser.id);
    if (!targetData) {
      return interaction.editReply({ content: '❌ Target is not indexed in the personnel database.' });
    }

    const oldValue = targetData[field] || 'None';
    const now = new Date().toISOString();

    await updatePersonnelIndex(targetUser.id, {
      [field]: value,
      Last_Updated: now,
    });

    // Update in class sheet if present
    if (targetData.Class) {
      try {
        const foundInClass = await findRowByDiscordId(targetData.Class, targetUser.id);
        if (foundInClass) {
          const { row, rowIndex, headers } = foundInClass;
          let col = headers.indexOf(field);
          if (col === -1 && field === 'Regiment') col = headers.indexOf('Branch');
          if (col !== -1) {
            row[col] = value;
            const updatedIdx = headers.indexOf('Last_Updated');
            if (updatedIdx !== -1) row[updatedIdx] = now;
            await updateRow(targetData.Class, rowIndex, row);
          }
        }
      } catch (err) {
        console.warn('[EditProfile] Class sheet sync warning:', err.message);
      }
    }

    await logAudit({
      action: 'EDIT_PROFILE',
      targetDiscord: targetUser.id,
      targetRoblox: targetData.Roblox_ID,
      oldRank: `${field}: ${oldValue}`,
      newRank: `${field}: ${value}`,
      executorDiscord: interaction.user.id,
      executorRank: executorRank.name,
      reason,
      robloxChanged: false,
      client: interaction.client,
    });

    const embed = RcmEmbed.base('PERSONNEL DOSSIER AMENDED')
      .setDescription(`Administrative amendments have been recorded for <@${targetUser.id}>.`)
      .addFields(
        { name: 'Target Member', value: `<@${targetUser.id}> (\`${targetData.Current_Rank}\`)`, inline: true },
        { name: 'Modified Field', value: `\`${field}\``, inline: true },
        { name: 'Former Value', value: `\`${oldValue}\``, inline: true },
        { name: 'Updated Value', value: `\`${value}\``, inline: true },
        { name: 'Authorizing Officer', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
        { name: 'Administrative Justification', value: `*"${reason}"*`, inline: false }
      );

    await interaction.editReply({ embeds: [embed] });
  },
};
