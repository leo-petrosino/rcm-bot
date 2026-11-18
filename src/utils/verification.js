const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getRobloxUserFromDiscord } = require('./bloxlink');
const { getUsername, getUserRankInGroup, getUserId } = require('./roblox');
const { appendRow, findRowByDiscordId, syncMemberClassSheet } = require('./sheets');
const { getRankByName, getRankByLevel, ROBLOX_GROUP_ID, formatMilitaryNickname } = require('../../config');
const { RcmEmbed } = require('./embeds');
const { logAudit } = require('./audit');

/**
 * Handles the complete verification workflow for a Discord member
 * @param {import('discord.js').ButtonInteraction | import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} [manualUsername] - Optional manual username fallback
 */
async function handleVerification(interaction, manualUsername = null) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const discordId = interaction.user.id;

  // 1. Check if already registered
  const existing = await findRowByDiscordId('Personnel_Index', discordId);
  if (existing) {
    // Refresh nickname and roles if possible
    try {
      const member = interaction.member || (await interaction.guild.members.fetch(discordId));
      const headers = existing.headers;
      const rankIdx = headers.indexOf('Rank') !== -1 ? headers.indexOf('Rank') : headers.indexOf('Current_Rank');
      const userIdx = headers.indexOf('Roblox_Username');
      const currentRankName = existing.row[rankIdx] || 'Cadet';
      const robloxName = existing.row[userIdx] || member.user.username;
      const rankObj = getRankByName(currentRankName) || getRankByLevel(1);

      if (member && member.manageable) {
        const expectedNick = formatMilitaryNickname(rankObj.abbr, robloxName);
        if (member.nickname !== expectedNick) {
          await member.setNickname(expectedNick).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[Verification] Role/nickname refresh warning:', err.message);
    }

    return interaction.editReply({
      content: '⚠️ You are already verified and indexed in the Royal Canadian Military central roster. Use `/profile` to view your military dossier.',
    });
  }

  let robloxId = null;
  let confirmedUsername = null;

  // 2. Resolve Roblox Identity
  if (manualUsername) {
    // Manual fallback
    try {
      robloxId = await getUserId(manualUsername);
      confirmedUsername = await getUsername(robloxId);
    } catch {
      return interaction.editReply({
        content: `❌ Could not find a Roblox account with username \`${manualUsername}\`. Please check spelling and try again.`,
      });
    }
  } else {
    // Bloxlink automatic verification
    const bloxlinkRes = await getRobloxUserFromDiscord(discordId, interaction.guild.id);

    if (!bloxlinkRes.linked) {
      if (bloxlinkRes.notLinked) {
        const notLinkedEmbed = RcmEmbed.warning('BLOXLINK ACCOUNT LINK REQUIRED')
          .setDescription(
            `Welcome to the **Royal Canadian Military**!\n\n` +
            `Your Discord account is not yet linked to a Roblox account on **Bloxlink**.\n\n` +
            `### 🔗 Quick Link Steps:\n` +
            `1. Click the **Link on Bloxlink** button below.\n` +
            `2. Sign in with Roblox and authorize your Discord account.\n` +
            `3. Come back to this channel and click **Verify with Roblox** again!`
          )
          .setFooter({ text: 'RCM Logistics • Automated Verification Gate' });

        const linkRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Link on Bloxlink')
            .setStyle(ButtonStyle.Link)
            .setURL('https://blox.link/verify')
            .setEmoji('🌐'),
          new ButtonBuilder()
            .setCustomId('btn_verify_roblox')
            .setLabel('Retry Verification')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄')
        );

        return interaction.editReply({
          embeds: [notLinkedEmbed],
          components: [linkRow],
        });
      }

      // Other Bloxlink error (e.g. missing API key or network)
      return interaction.editReply({
        content: `❌ Verification error: \`${bloxlinkRes.error}\`\nIf you have a Roblox account, an administrator can also manually verify you using \`/verify username:[roblox_username]\`.`,
      });
    }

    robloxId = bloxlinkRes.robloxId;
    confirmedUsername = bloxlinkRes.username;
    if (!confirmedUsername && robloxId) {
      try {
        confirmedUsername = await getUsername(robloxId);
      } catch {
        confirmedUsername = `Robloxian_${robloxId}`;
      }
    }
  }

  try {
    // 3. Check current group rank in RCM Group
    let initialRank = getRankByLevel(1); // Default Cadet (Level 1)
    try {
      const { roleName } = await getUserRankInGroup(robloxId, ROBLOX_GROUP_ID);
      const matchedRank = getRankByName(roleName);
      if (matchedRank) {
        initialRank = matchedRank;
      }
    } catch (err) {
      console.warn('[Verification] Roblox group rank lookup warning:', err.message);
    }

    const now = new Date().toISOString();

    // 4. Append to Personnel_Index
    await appendRow('Personnel_Index', [
      discordId,
      String(robloxId),
      confirmedUsername,
      initialRank.name,
      String(initialRank.level),
      initialRank.class,
      'Unassigned', // Regiment
      'Active',     // Status
      now,          // Join Date
      '0',          // Strike Count
      now,          // Last Updated
    ]);

    // 5. Append/Sync into initial Rank Class Sheet (e.g. Enlisted)
    await syncMemberClassSheet({
      discordId,
      targetRank: initialRank,
      targetData: {
        Roblox_ID: String(robloxId),
        Roblox_Username: confirmedUsername,
        Current_Rank: initialRank.name,
        Rank_Level: String(initialRank.level),
        Class: initialRank.class,
        Regiment: 'Unassigned',
        Status: 'Active',
        Join_Date: now,
        Strike_Count: '0',
        Total_Strikes: '0',
      },
    });

    // 6. Assign Discord Role and Update Nickname
    let roleAssigned = false;
    let nickUpdated = false;
    const formattedNickname = formatMilitaryNickname(initialRank.abbr, confirmedUsername);

    try {
      const member = interaction.member || (await interaction.guild.members.fetch(discordId));
      if (member) {
        if (initialRank.roleId) {
          await member.roles.add(initialRank.roleId).catch(() => {});
          roleAssigned = true;
        }

        if (member.manageable) {
          await member.setNickname(formattedNickname).catch(() => {});
          nickUpdated = true;
        }
      }
    } catch (err) {
      console.warn('[Verification] Discord role or nickname assignment warning:', err.message);
    }

    // 7. Audit log
    await logAudit({
      action: 'VERIFY',
      targetDiscord: discordId,
      targetRoblox: String(robloxId),
      newRank: initialRank.name,
      executorDiscord: interaction.user.id,
      executorRank: 'SELF (Bloxlink)',
      reason: `Automated military enlistment for ${confirmedUsername} (${robloxId})`,
      client: interaction.client,
    });

    // 8. Success Embed
    const embed = RcmEmbed.success('🇨🇦 VERIFICATION COMPLETE • SERVICE DOSSIER ESTABLISHED')
      .setDescription(
        `Welcome to the **Royal Canadian Military**, **${confirmedUsername}**.\n` +
        `Your Roblox account has been authenticated, military credentials issued, and service dossier indexed.`
      )
      .addFields(
        { name: '🎖️ Commissioned Rank', value: `**${initialRank.name}** (\`${initialRank.abbr}\`)`, inline: true },
        { name: '🏷️ Military Class', value: `\`${initialRank.class}\``, inline: true },
        { name: '🌐 Roblox Profile', value: `[${confirmedUsername}](https://www.roblox.com/users/${robloxId}/profile)`, inline: true },
        { name: '🏷️ Server Call-sign', value: `\`${formattedNickname}\``, inline: true },
        { name: '🛡️ Regiment', value: '*Unassigned (Awaiting Placement)*', inline: true },
        { name: '📊 Service Registry', value: '✅ Master Dossier Indexed', inline: true }
      )
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=150&height=150&format=png`);

    await interaction.editReply({ embeds: [embed], components: [] });
  } catch (err) {
    console.error('[Verification] Error completing verification:', err);
    await interaction.editReply({
      content: `❌ An unexpected error occurred during military enlistment: \`${err.message}\`. Please contact Command Staff.`,
      components: [],
    });
  }
}

module.exports = {
  handleVerification,
};
