const { EmbedBuilder } = require('discord.js');
const { THEME } = require('../../config');

/**
 * Standardized Canadian Armed Forces / RCM Aesthetic Embed Builder
 */
class RcmEmbed {
  /**
   * Base embed configured with CAF styling
   */
  static base(title, color = THEME.primary) {
    return new EmbedBuilder()
      .setColor(color)
      .setTitle(`🇨🇦  ${title}`)
      .setFooter({
        text: 'Royal Canadian Military • Logistics & Personnel Command',
        iconURL: 'https://images.rbxcdn.com/f04c64d85226be8f94d352ba1473faec.png', // Roblox icon fallback
      })
      .setTimestamp();
  }

  /**
   * Success / Promotion / Commendation embed
   */
  static success(title, description = '') {
    const embed = RcmEmbed.base(title, THEME.success);
    if (description) embed.setDescription(description);
    return embed;
  }

  /**
   * Warning / Discipline / Strike embed
   */
  static warning(title, description = '') {
    const embed = RcmEmbed.base(title, THEME.warning);
    if (description) embed.setDescription(description);
    return embed;
  }

  /**
   * Danger / Court Martial / Discharge / Blacklist embed
   */
  static danger(title, description = '') {
    const embed = RcmEmbed.base(title, THEME.danger);
    if (description) embed.setDescription(description);
    return embed;
  }

  /**
   * Regimental announcement or dossier embed
   */
  static regimental(regiment, title, description = '') {
    const hex = regiment.color ? parseInt(regiment.color.replace('#', ''), 16) : THEME.primary;
    const embed = new EmbedBuilder()
      .setColor(hex)
      .setTitle(`${regiment.emoji} [${regiment.id}] ${title}`)
      .setFooter({
        text: `${regiment.name} • ${regiment.motto}`,
      })
      .setTimestamp();
    if (description) embed.setDescription(description);
    return embed;
  }

  /**
   * Formats a unix timestamp into Discord date representation
   */
  static formatTimestamp(date, style = 'F') {
    if (!date) return 'N/A';
    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    if (isNaN(timestamp)) return 'N/A';
    return `<t:${timestamp}:${style}>`;
  }

  /**
   * Generates a visual status badge
   */
  static statusBadge(status) {
    switch ((status || '').toUpperCase()) {
      case 'ACTIVE':
        return '🟢 `ACTIVE`';
      case 'LOA':
        return '🔵 `ON LEAVE (LOA)`';
      case 'DISCHARGED':
        return '🔴 `DISCHARGED`';
      case 'LWA':
        return '🟠 `LWA (DESERTER)`';
      case 'BLACKLISTED':
        return '⛔ `BLACKLISTED`';
      case 'SUSPENDED':
        return '⚠️ `SUSPENDED`';
      default:
        return '⚪ `UNVERIFIED`';
    }
  }
}

module.exports = { RcmEmbed };
