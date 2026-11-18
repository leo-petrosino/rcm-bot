const { SlashCommandBuilder } = require('discord.js');
const { readSheet, appendRow, updateRow, updatePersonnelIndex, getMemberFromIndex, findMemberByRoblox, removeMemberFromClassSheets } = require('../utils/sheets');
const { getMemberRank, canBlacklist } = require('../utils/permissions');
const { getUserId, getUsername, exileUser } = require('../utils/roblox');
const { logAudit } = require('../utils/audit');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blacklist')
    .setDescription('Manage community and Roblox military blacklists/bans (Colonel+)')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Place a user on the official blacklist / exile')
        .addStringOption(opt => opt.setName('target').setDescription('Roblox username, user ID, or @Discord mention').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Blacklist rationale').setRequired(true))
        .addStringOption(opt => opt.setName('proof').setDescription('Evidence URL / Link to screenshots or video').setRequired(false))
        .addBooleanOption(opt => opt.setName('exile_roblox').setDescription('Automatically exile from Roblox group?').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a user from the official blacklist')
        .addStringOption(opt => opt.setName('target').setDescription('Roblox username, user ID, or @Discord mention').setRequired(true))
        .addStringOption(opt => opt.setName('reason').setDescription('Pardon / Removal rationale').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('check')
        .setDescription('Check if a user is currently blacklisted')
        .addStringOption(opt => opt.setName('target').setDescription('Roblox username, user ID, or @Discord mention').setRequired(true))
    ),
  cooldown: 5000,

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const targetInput = interaction.options.getString('target');
    const reason = interaction.options.getString('reason');

    const executorMember = await interaction.guild.members.fetch(interaction.user.id);
    const executorRank = getMemberRank(executorMember);

    // Resolve target identity (could be Discord ID, Roblox username, or Roblox numeric ID)
    let robloxId = null;
    let robloxUsername = null;
    let discordId = null;

    // Check if target is a Discord mention <@123456789>
    const mentionMatch = targetInput.match(/<@!?(\d+)>/);
    if (mentionMatch) {
      discordId = mentionMatch[1];
      const member = await getMemberFromIndex(discordId);
      if (member) {
        robloxId = member.Roblox_ID;
        robloxUsername = member.Roblox_Username;
      }
    } else if (/^\d{5,15}$/.test(targetInput.trim())) {
      // Looks like a numeric Roblox or Discord ID
      const member = await getMemberFromIndex(targetInput.trim()) || await findMemberByRoblox(targetInput.trim());
      if (member) {
        discordId = member.Discord_ID;
        robloxId = member.Roblox_ID;
        robloxUsername = member.Roblox_Username;
      } else {
        robloxId = targetInput.trim();
        robloxUsername = await getUsername(robloxId).catch(() => 'Unknown');
      }
    } else {
      // Treat as Roblox username
      try {
        robloxId = await getUserId(targetInput.trim());
        robloxUsername = await getUsername(robloxId);
        const member = await findMemberByRoblox(robloxId);
        if (member) discordId = member.Discord_ID;
      } catch {
        robloxUsername = targetInput.trim();
      }
    }

    const rows = await readSheet('Blacklist');
    const headers = rows.length > 0 ? rows[0] : [];
    const robloxIdIdx = headers.indexOf('Roblox_ID');
    const discordIdIdx = headers.indexOf('Discord_ID');
    const statusIdx = headers.indexOf('Status');

    if (subcommand === 'check') {
      let foundRow = null;
      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (
            (robloxId && row[robloxIdIdx] === String(robloxId)) ||
            (discordId && row[discordIdIdx] === String(discordId))
          ) {
            if (row[statusIdx] === 'Active') {
              foundRow = row;
              break;
            }
          }
        }
      }

      if (foundRow) {
        const embed = RcmEmbed.danger('BLACKLIST RECORD FOUND')
          .setDescription(`⚠️ Target is currently **BLACKLISTED** from the Royal Canadian Military.`)
          .addFields(
            { name: '🌐 Roblox Account', value: `${foundRow[headers.indexOf('Roblox_Username')]} (\`${foundRow[robloxIdIdx]}\`)`, inline: true },
            { name: '💬 Discord', value: foundRow[discordIdIdx] ? `<@${foundRow[discordIdIdx]}>` : 'Unlinked', inline: true },
            { name: '📅 Date Enacted', value: RcmEmbed.formatTimestamp(foundRow[headers.indexOf('Date_Added')], 'f'), inline: true },
            { name: '👑 Issued By', value: `<@${foundRow[headers.indexOf('Added_By')]}>`, inline: true },
            { name: '📜 Violation Rationale', value: `*"${foundRow[headers.indexOf('Reason')]}"*`, inline: false },
            { name: '🔗 Proof Attachment', value: foundRow[headers.indexOf('Proof_Link')] || '*No URL documented*', inline: false }
          );
        return interaction.editReply({ embeds: [embed] });
      } else {
        const embed = RcmEmbed.success('NO BLACKLIST RECORD')
          .setDescription(`✅ Target (\`${targetInput}\`) is **not blacklisted**.`);
        return interaction.editReply({ embeds: [embed] });
      }
    }

    // Must be Colonel+ or Admin to add/remove
    if (!canBlacklist(executorRank)) {
      return interaction.editReply({
        content: '❌ Insufficient authority. Only Senior Command (Colonel+) can manage community blacklists.',
      });
    }

    if (subcommand === 'add') {
      const proof = interaction.options.getString('proof') || '';
      const shouldExile = interaction.options.getBoolean('exile_roblox') ?? true;
      const now = new Date().toISOString();

      let exiled = false;
      if (shouldExile && robloxId) {
        try {
          await exileUser(robloxId);
          exiled = true;
        } catch (err) {
          console.warn('[Blacklist] Roblox exile warning:', err.message);
        }
      }

      // Add to Blacklist sheet
      await appendRow('Blacklist', [
        String(robloxId || 'N/A'),
        robloxUsername || targetInput,
        String(discordId || 'N/A'),
        now,
        interaction.user.id,
        'Permanent',
        reason,
        proof,
        'Active',
      ]);

      if (discordId) {
        await updatePersonnelIndex(discordId, {
          Status: 'Blacklisted',
          Last_Updated: now,
        });
        await removeMemberFromClassSheets(discordId);
      }

      await logAudit({
        action: 'BLACKLIST_ADD',
        targetDiscord: discordId,
        targetRoblox: robloxId,
        executorDiscord: interaction.user.id,
        executorRank: executorRank.name,
        reason: `[EXILED: ${exiled ? 'YES' : 'NO'}] ${reason}`,
        robloxChanged: exiled,
        client: interaction.client,
      });

      const embed = RcmEmbed.danger('COMMUNITY BLACKLIST ENACTED')
        .setDescription(`An official military blacklist and ban has been registered.`)
        .addFields(
          { name: '🌐 Target Identity', value: `**${robloxUsername}** (\`${robloxId || 'N/A'}\`)`, inline: true },
          { name: '💬 Discord', value: discordId ? `<@${discordId}>` : 'Unlinked', inline: true },
          { name: '👑 Commanding Authority', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
          { name: '🛡️ Roblox Exile', value: exiled ? '✅ Exiled from Group' : '➖ Skipped or Failed', inline: true },
          { name: '📜 Official Rationale', value: `*"${reason}"*`, inline: false },
          { name: '🔗 Proof Dossier', value: proof ? `[Click to view proof](${proof})` : '*None provided*', inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'remove') {
      let rowIndex = -1;
      let blacklistedRow = null;

      if (rows.length > 1) {
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (
            (robloxId && row[robloxIdIdx] === String(robloxId)) ||
            (discordId && row[discordIdIdx] === String(discordId))
          ) {
            if (row[statusIdx] === 'Active') {
              blacklistedRow = row;
              rowIndex = i + 1;
              break;
            }
          }
        }
      }

      if (!blacklistedRow) {
        return interaction.editReply({ content: '❌ Target was not found on the active blacklist.' });
      }

      blacklistedRow[statusIdx] = 'Revoked';
      await updateRow('Blacklist', rowIndex, blacklistedRow);

      if (discordId) {
        await updatePersonnelIndex(discordId, {
          Status: 'Discharged',
          Last_Updated: new Date().toISOString(),
        });
      }

      await logAudit({
        action: 'BLACKLIST_REMOVE',
        targetDiscord: discordId,
        targetRoblox: robloxId,
        executorDiscord: interaction.user.id,
        executorRank: executorRank.name,
        reason,
        robloxChanged: false,
        client: interaction.client,
      });

      const embed = RcmEmbed.success('BLACKLIST RESTRICTION REVOKED')
        .setDescription(`The blacklist status for **${robloxUsername}** has been revoked.`)
        .addFields(
          { name: 'Target', value: `${robloxUsername} (\`${robloxId || 'N/A'}\`)`, inline: true },
          { name: 'Pardoned By', value: `<@${interaction.user.id}> (${executorRank.abbr})`, inline: true },
          { name: 'Rationale', value: `*"${reason}"*`, inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
