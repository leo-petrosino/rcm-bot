const { SlashCommandBuilder } = require('discord.js');
const { handleVerification } = require('../utils/verification');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Link your Roblox account to the Royal Canadian Military personnel index')
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('Your exact Roblox username (optional: auto-detects from Bloxlink if omitted)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const robloxUsername = interaction.options.getString('username');
    await handleVerification(interaction, robloxUsername);
  },
};

