require('dotenv').config();
const noblox = require('noblox.js');
const { sanitizeCookie } = require('../src/utils/roblox');

async function testRoblox() {
  console.log('\n========================================');
  console.log('ROBLOX AUTHENTICATION DIAGNOSTIC TOOL');
  console.log('========================================\n');

  const rawCookie = process.env.ROBLOX_COOKIE;
  if (!rawCookie) {
    console.error('❌ ROBLOX_COOKIE is not defined in your .env file!');
    process.exit(1);
  }

  console.log(`Raw cookie length in .env: ${rawCookie.length} characters`);
  const cleanCookie = sanitizeCookie(rawCookie);
  console.log(`Sanitized cookie length:   ${cleanCookie.length} characters`);
  console.log(`Has warning header:       ${cleanCookie.toLowerCase().includes('warning:-') ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Prefix preview:           ${cleanCookie.substring(0, 25)}...`);
  console.log(`Suffix preview:           ...${cleanCookie.substring(cleanCookie.length - 15)}`);

  console.log('\nAttempting handshake with Roblox API...');
  try {
    const user = await noblox.setCookie(cleanCookie);
    console.log('\n✅ AUTHENTICATION SUCCESSFUL!');
    console.log(`Username: ${user.UserName || user.name}`);
    console.log(`User ID:  ${user.UserID || user.id}`);
    console.log('The logistics bot account is fully online and ready.\n');
  } catch (err) {
    console.error('\n❌ AUTHENTICATION FAILED!');
    console.error('Error message:', err.message);
    console.log('\nCommon causes:');
    console.log('1. Roblox IP-Lock: Roblox binds cookies to the IP that generated the login.');
    console.log('   When generated on a home PC and used on a VPS, Roblox blocks the session.');
    console.log('   Solution: Create an SSH SOCKS tunnel from your PC to your server so your browser uses the server IP.');
    console.log('2. The account was logged out in the browser after copying the cookie.');
    console.log('3. Cookie was partially copied or truncated.\n');
  }
}

testRoblox();
