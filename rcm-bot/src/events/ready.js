module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`[Discord] Bot ready as ${client.user.tag}`);
  },
};
