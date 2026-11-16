const { SlashCommandBuilder } = require('discord.js');
const { REGIMENTS, getRegimentById } = require('../../config');
const { getRegimentSummaries, assignMemberToRegiment, removeMemberFromRegiment } = require('../utils/regiments');
const { getMemberRank, canManageRegiment } = require('../utils/permissions');
const { getMemberFromIndex, readSheet } = require('../utils/sheets');
const { setRank } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('regiment')
    .setDescription('Command and manage Royal Canadian Military regimental divisions')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all active Canadian Armed Forces regiments and their active strengths')
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View detailed dossier and roster of a specific regiment')
        .addStringOption(opt =>
          opt.setName('regiment')
            .setDescription('Select regiment to inspect')
            .setRequired(true)
            .addChoices(
              ...REGIMENTS.map(r => ({ name: `${r.emoji} ${r.name} (${r.id})`, value: r.id }))
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('assign')
        .setDescription('Assign a service member to a regiment (Captain+)')
        .addUserOption(opt => opt.setName('user').setDescription('Personnel to assign').setRequired(true))
        .addStringOption(opt =>
          opt.setName('regiment')
            .setDescription('Target regiment')
            .setRequired(true)
            .addChoices(
              ...REGIMENTS.map(r => ({ name: `${r.emoji} ${r.name} (${r.id})`, value: r.id }))
            )
        )
        .addStringOption(opt =>
          opt.setName('role')
            .setDescription('Regimental post or position')
            .setRequired(false)
            .addChoices(
              { name: '🎖️ Enlisted / Trooper / Guard', value: 'Enlisted' },
              { name: '🛡️ Non-Commissioned Officer (NCO)', value: 'NCO' },
              { name: '⭐ Regimental Sergeant Major (RSM)', value: 'RSM' },
              { name: '⚔️ Executive Officer (XO)', value: 'XO' },
              { name: '👑 Commanding Officer (CO)', value: 'CO' },
            )
        )
        .addStringOption(opt => opt.setName('notes').setDescription('Assignment orders / notes').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a member from their current regiment')
        .addUserOption(opt => opt.setName('user').setDescription('Personnel to remove').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Removal rationale').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('transfer')
        .setDescription('Transfer a member from their current regiment to another')
        .addUserOption(opt => opt.setName('user').setDescription('Personnel to transfer').setRequired(true))
        .addStringOption(opt =>
          opt.setName('target_regiment')
            .setDescription('New regiment')
            .setRequired(true)
            .addChoices(
              ...REGIMENTS.map(r => ({ name: `${r.emoji} ${r.name} (${r.id})`, value: r.id }))
            )
        )
        .addStringOption(opt => opt.setName('reason').setDescription('Transfer rationale').setRequired(true))
    ),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'list') {
      const summaries = await getRegimentSummaries();
      const embed = RcmEmbed.base('ROYAL CANADIAN MILITARY • REGIMENTAL ORDER OF BATTLE')
        .setDescription(
          'Official Canadian Armed Forces Regimental Divisions and Formations.\n' +
          'Personnel are organized into specialized commands under Regimental Headquarters.'
        );

      for (const reg of summaries) {
        embed.addFields({
          name: `${reg.emoji} ${reg.name} (\`${reg.id}\`)`,
          value:
            `• **Specialization:** ${reg.role}\n` +
            `• **Motto:** *${reg.motto}*\n` +
            `• **Active Strength:** \`${reg.activeStrength} Personnel\`\n` +
            `• **Roblox Group:** ${reg.robloxGroupId ? `[Linked Group #${reg.robloxGroupId}](https://www.roblox.com/groups/${reg.robloxGroupId})` : '*Integrated in Main Group*'}`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'view') {
      const regId = interaction.options.getString('regiment');
      const reg = getRegimentById(regId);
      if (!reg) return interaction.editReply({ content: '❌ Regiment not recognized.' });

      // Fetch active roster from Personnel_Index
      const rows = await readSheet('Personnel_Index');
      const roster = [];
      if (rows.length > 7) {
        const headers = rows[6];
        const regIdx = headers.indexOf('Regiment');
        const userIdx = headers.indexOf('Roblox_Username');
        const rankIdx = headers.indexOf('Current_Rank');
        const discIdx = headers.indexOf('Discord_ID');
        const statusIdx = headers.indexOf('Status');

        for (let i = 7; i < rows.length; i++) {
          if (rows[i][regIdx] === reg.id && rows[i][statusIdx] === 'Active') {
            roster.push({
              username: rows[i][userIdx],
              rank: rows[i][rankIdx],
              discordId: rows[i][discIdx],
            });
          }
        }
      }

      const rosterText = roster.length > 0
        ? roster.slice(0, 15).map(m => `• **${m.rank}** ${m.username} (<@${m.discordId}>)`).join('\n') + (roster.length > 15 ? `\n*...and ${roster.length - 15} more*` : '')
        : '*No active personnel currently assigned.*';

      const embed = RcmEmbed.regimental(reg, `DOSSIER • ${reg.name}`)
        .addFields(
          { name: '🎯 Operational Role', value: reg.role, inline: true },
          { name: '📜 Regimental Motto', value: `*${reg.motto}*`, inline: true },
          { name: '📊 Active Roster Count', value: `\`${roster.length} Personnel\``, inline: true },
          { name: '👥 Regimental Personnel Roster', value: rosterText, inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // Assign / Remove / Transfer require Captain+ authority
    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    if (!canManageRegiment(executorRank)) {
      return interaction.editReply({
        content: '❌ Insufficient authority. Only commissioned officers (Captain+) can execute regimental assignments and transfers.',
      });
    }

    if (subcommand === 'assign') {
      const targetUser = interaction.options.getUser('user');
      const regId = interaction.options.getString('regiment');
      const regRole = interaction.options.getString('role') || 'Enlisted';
      const notes = interaction.options.getString('notes') || '';

      try {
        const reg = await assignMemberToRegiment({
          discordId: targetUser.id,
          regimentId: regId,
          regimentalRole: regRole,
          executorDiscord: interaction.user.id,
          notes,
        });

        // If regiment has its own Roblox group and bot is authenticated, try setting rank
        if (reg.robloxGroupId) {
          const targetData = await getMemberFromIndex(targetUser.id);
          if (targetData?.Roblox_ID) {
            try {
              await setRank(targetData.Roblox_ID, regRole, reg.robloxGroupId);
            } catch (err) {
              console.warn('[Regiment] Could not update regimental group rank:', err.message);
            }
          }
        }

        await logAudit({
          action: 'REGIMENT_ASSIGN',
          targetDiscord: targetUser.id,
          executorDiscord: interaction.user.id,
          executorRank: executorRank.name,
          reason: `Assigned to ${reg.id} as ${regRole}. Notes: ${notes}`,
          robloxChanged: Boolean(reg.robloxGroupId),
          client: interaction.client,
        });

        const embed = RcmEmbed.regimental(reg, 'REGIMENTAL POSTING ORDER')
          .setDescription(`Service member <@${targetUser.id}> has been posted to **${reg.name}**.`)
          .addFields(
            { name: 'Regiment', value: `${reg.emoji} ${reg.name} (\`${reg.id}\`)`, inline: true },
            { name: 'Regimental Post', value: `\`${regRole}\``, inline: true },
            { name: 'Authorizing Officer', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
            { name: 'Assignment Directives', value: notes || '*Standard operational deployment*', inline: false }
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Regimental assignment failed: ${err.message}` });
      }
    }

    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');

      try {
        const oldReg = await removeMemberFromRegiment(targetUser.id, reason);
        await logAudit({
          action: 'REGIMENT_REMOVE',
          targetDiscord: targetUser.id,
          executorDiscord: interaction.user.id,
          executorRank: executorRank.name,
          reason: `Removed from ${oldReg}: ${reason}`,
          robloxChanged: false,
          client: interaction.client,
        });

        const embed = RcmEmbed.warning('REGIMENTAL RECALL ORDER')
          .setDescription(`<@${targetUser.id}> has been released from regimental assignment **${oldReg}**.`)
          .addFields(
            { name: 'Relieved By', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
            { name: 'Rationale', value: `*"${reason}"*`, inline: false }
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Removal failed: ${err.message}` });
      }
    }

    if (subcommand === 'transfer') {
      const targetUser = interaction.options.getUser('user');
      const targetRegId = interaction.options.getString('target_regiment');
      const reason = interaction.options.getString('reason');

      const targetReg = getRegimentById(targetRegId);
      if (!targetReg) return interaction.editReply({ content: '❌ Target regiment not recognized.' });

      try {
        const oldReg = await removeMemberFromRegiment(targetUser.id, reason);
        await assignMemberToRegiment({
          discordId: targetUser.id,
          regimentId: targetReg.id,
          regimentalRole: 'Enlisted',
          executorDiscord: interaction.user.id,
          notes: `Transferred from ${oldReg}: ${reason}`,
        });

        await logAudit({
          action: 'REGIMENT_TRANSFER',
          targetDiscord: targetUser.id,
          executorDiscord: interaction.user.id,
          executorRank: executorRank.name,
          reason: `Transfer from ${oldReg} to ${targetReg.id}: ${reason}`,
          robloxChanged: false,
          client: interaction.client,
        });

        const embed = RcmEmbed.regimental(targetReg, 'INTER-REGIMENTAL TRANSFER ORDER')
          .setDescription(`<@${targetUser.id}> has been transferred between regimental commands.`)
          .addFields(
            { name: 'Former Unit', value: `\`${oldReg}\``, inline: true },
            { name: 'New Unit', value: `${targetReg.emoji} **${targetReg.name}** (\`${targetReg.id}\`)`, inline: true },
            { name: 'Authorizing Authority', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
            { name: 'Transfer Rationale', value: `*"${reason}"*`, inline: false }
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Transfer failed: ${err.message}` });
      }
    }
  },
};
