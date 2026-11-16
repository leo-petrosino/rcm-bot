require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.GuildMember, Partials.User],
});

client.commands = new Collection();
client.cooldowns = new Collection();

// 1. Load Command Modules
const commandsPath = path.join(__dirname, 'src', 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.warn(`[WARNING] Command at ${filePath} is missing required "data" or "execute" export.`);
    }
  }
  console.log(`[Commands] Loaded ${client.commands.size} slash commands.`);
}

// 2. Load Event Handlers
const eventsPath = path.join(__dirname, 'src', 'events');
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args) => event.execute(...args, client));
    }
  }
  console.log(`[Events] Loaded ${eventFiles.length} event listeners.`);
}

// 3. Process Error Guards
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason);
});

process.on('uncaughtException', error => {
  console.error('[Uncaught Exception]', error);
});

// 4. Start Discord Bot
client.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('[Discord] Authentication failed:', err.message);
  process.exit(1);
});

module.exports = client;
