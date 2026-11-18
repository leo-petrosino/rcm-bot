const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-verify')
    .setDescription('Deploy the persistent Royal Canadian Military verification dashboard into a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option
        .setName('channel')
        .setDescription('Channel to deploy the verification dashboard (defaults to current channel)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const embed = RcmEmbed.base('🇨🇦 ROYAL CANADIAN MILITARY • PERSONNEL VERIFICATION')
      .setDescription(
        `Welcome to the **Royal Canadian Military** Command Network.\n\n` +
        `To gain access to the military base, establish your service dossier, and receive your rank and regimental credentials, you must verify your Roblox identity.\n\n` +
        `### 📋 How to Verify:\n` +
        `1. Ensure your Roblox account is linked on [Bloxlink](https://blox.link/verify).\n` +
        `2. Click the **Verify with Roblox** button below.\n` +
        `3. The system will synchronize your group rank, assign your military roles, and index your service dossier.\n\n` +
        `*Need to link your account first? Use the **Link on Bloxlink** button below.*`
      )
      .addFields(
        { name: '🎖️ Auto-Rank Sync', value: 'Automatically aligns with your rank in the official Roblox Group', inline: true },
        { name: '🛡️ Service Dossier', value: 'Instantly indexes your active status into central headquarters', inline: true }
      )
      .setImage('https://cdn.discordapp.com/attachments/1536920332903125036/rcm-banner.png')
      .setFooter({ text: 'Royal Canadian Military Personnel Logistics • Armed Forces Command' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_verify_roblox')
        .setLabel('Verify with Roblox')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🔗'),
      new ButtonBuilder()
        .setLabel('Link on Bloxlink')
        .setStyle(ButtonStyle.Link)
        .setURL('https://blox.link/verify')
        .setEmoji('🌐')
    );

    try {
      await targetChannel.send({
        embeds: [embed],
        components: [row],
      });

      await interaction.editReply({
        content: `✅ Verification dashboard successfully deployed to <#${targetChannel.id}>.`,
      });
    } catch (err) {
      console.error('[SetupVerify] Error deploying dashboard:', err);
      await interaction.editReply({
        content: `❌ Failed to send dashboard to <#${targetChannel.id}>: \`${err.message}\`. Ensure the bot has Send Messages and Embed Links permissions in that channel.`,
      });
    }
  },
};
