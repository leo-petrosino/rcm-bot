const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { formatEntireSpreadsheet } = require('../utils/sheetsFormat');
const { RcmEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('format-sheets')
    .setDescription('Apply executive Canadian Armed Forces block styling to the Google Spreadsheet (High Command)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  cooldown: 15000,

  async execute(interaction) {
    await interaction.deferReply();

    try {
      await formatEntireSpreadsheet();

      const embed = RcmEmbed.success('SPREADSHEET STYLING & BLOCKS APPLIED')
        .setDescription(
          'The entire Royal Canadian Military Google Spreadsheet has been formatted with executive CAF military styling.'
        )
        .addFields(
          { name: '🇨🇦 Executive Banner', value: 'Regimental Crimson `#8B0000` header block and title', inline: true },
          { name: '📊 KPI Summary Cards', value: 'Total Strength, Active, LOA, and Discipline blocks', inline: true },
          { name: '🛡️ Regimental Formations', value: 'Dedicated block sections for GGHG, JTF2, CMTC, CFMP, and GGFG', inline: true },
          { name: '🎨 Conditional Formatting', value: 'Automatic soft-color tags for Active, LOA, Discharged, and LWA', inline: true },
          { name: '📌 Pinned Navigation', value: 'Frozen header rows and custom column pixel widths', inline: true },
          { name: '📜 Audit & Disciplinary Tabs', value: 'Structured headers for Strike_Log, Audit_Log, Discharged, and Blacklist', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[FormatSheets] Error:', err);
      await interaction.editReply({
        content: `❌ Spreadsheet formatting failed: \`${err.message}\`. Ensure your Google Service Account has Editor permissions on the sheet.`,
      });
    }
  },
};
