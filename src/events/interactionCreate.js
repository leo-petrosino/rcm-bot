const { Collection } = require('discord.js');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    // 1. Handle Autocomplete
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command || !command.autocomplete) return;

      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(`[Autocomplete Error] ${interaction.commandName}:`, err);
      }
      return;
    }

    // 2. Handle Chat Slash Commands
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Cooldown management
    const { cooldowns } = client;
    if (!cooldowns.has(command.data.name)) {
      cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const defaultCooldown = 3000;
    const cooldownAmount = command.cooldown ?? defaultCooldown;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      if (now < expirationTime) {
        const expiredTimestamp = Math.round(expirationTime / 1000);
        return interaction.reply({
          content: `⏳ Please wait. Command \`/${command.data.name}\` is on cooldown. Available <t:${expiredTimestamp}:R>.`,
          ephemeral: true,
        });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[Command Execution Error] /${interaction.commandName}:`, error);
      const reply = {
        content: `❌ An unexpected operational error occurred while executing \`/${interaction.commandName}\`.`,
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  },
};
