const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserId, getUsername } = require('../utils/roblox');
const { appendRow, findRowByDiscordId } = require('../utils/sheets');
const { getRankByLevel } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link your Roblox account to the RCM database')
    .addStringOption(option => 
      option.setName('username')
        .setDescription('Your exact Roblox username')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const robloxUsername = interaction.options.getString('username');
    const discordId = interaction.user.id;

    const existing = await findRowByDiscordId('Personnel_Index', discordId);
    if (existing) {
      return interaction.editReply({ content: 'You are already verified in the database.' });
    }

    try {
      const robloxId = await getUserId(robloxUsername);
      const confirmedUsername = await getUsername(robloxId);

      const defaultRank = getRankByLevel(1);
      const now = new Date().toISOString();

      await appendRow('Personnel_Index', [
        discordId,
        robloxId,
        confirmedUsername,
        defaultRank.name,
        String(defaultRank.level),
        defaultRank.class,
        defaultRank.sheet,
        'Active',
        now,
      ]);

      await appendRow(defaultRank.sheet, [
        discordId,
        robloxId,
        confirmedUsername,
        defaultRank.name,
        String(defaultRank.level),
        '',
        now,
        '',
        '0',
        '0',
        'Active',
        '',
        '',
      ]);

      const member = await interaction.guild.members.fetch(discordId);
      await member.roles.add(defaultRank.roleId);

      const embed = new EmbedBuilder()
        .setTitle('Verification Complete')
        .setColor(0xC41E3A)
        .setDescription(`Welcome to RCM, **${confirmedUsername}**.`)
        .addFields(
          { name: 'Rank', value: defaultRank.name, inline: true },
          { name: 'Class', value: defaultRank.class, inline: true },
        )
        .setFooter({ text: 'Your record has been created in the database.' });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: 'Could not find that Roblox username. Check spelling and try again.' });
    }
  },
};
