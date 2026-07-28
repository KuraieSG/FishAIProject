// Registers the bot's slash commands with Discord.
// Run this once whenever you add or change a command: `npm run deploy-commands`

require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('identify')
    .setDescription('Identify a fish from a photo and log it to the server catch log')
    .addAttachmentOption((opt) =>
      opt.setName('photo').setDescription('Photo of your catch').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('location').setDescription('Where you caught it (optional)').setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('uploadcatch')
    .setDescription('Manually log a catch (no AI identification) to the server catch log')
    .addAttachmentOption((opt) =>
      opt.setName('photo').setDescription('Photo of your catch').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('name').setDescription('Fish name').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('location').setDescription('Where you caught it').setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('catches')
    .setDescription("Show this server's recent catch log")
    .addIntegerOption((opt) =>
      opt.setName('count').setDescription('How many to show (default 10, max 25)').setRequired(false)
    )
    .addUserOption((opt) =>
      opt.setName('angler').setDescription('Only show catches from this person').setRequired(false)
    )
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`Registered ${commands.length} commands to guild ${guildId} (instant).`);
    } else {
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log(`Registered ${commands.length} commands globally (may take up to ~1 hour to appear).`);
    }
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
})();
