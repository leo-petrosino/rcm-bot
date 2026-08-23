require('dotenv').config();
const noblox = require('noblox.js');

async function main() {
  try {
    await noblox.setCookie(process.env.ROBLOX_COOKIE);
    const roles = await noblox.getRoles(parseInt(process.env.ROBLOX_GROUP_ID));
    console.log('\nRoblox Group Roles:');
    console.log('====================');
    for (const role of roles) {
      console.log(`Rank: ${role.rank} | ID: ${role.id} | Name: ${role.name}`);
    }
    console.log('\nCopy the correct rank numbers into config.js if needed.');
  } catch (err) {
    console.error('Failed to fetch roles:', err.message);
  }
}

main();
