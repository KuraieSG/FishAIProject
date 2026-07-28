require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const express = require('express');
const Jimp = require('jimp');

const { identifyFish } = require('./identify');
const { addCatch, getCatches } = require('./storage');

// ---------- Tiny health-check server ----------
// Render's free web-service tier expects something listening on a port.
// This also gives you a URL you can ping with an uptime service to help
// keep the bot from being marked idle (see README for details/limits).
const app = express();
app.get('/', (_req, res) => res.send('Fish ID bot is running.'));
app.listen(process.env.PORT || 3000);

// ---------- Discord client ----------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'identify') {
    await handleIdentify(interaction);
  } else if (interaction.commandName === 'uploadcatch') {
    await handleUploadCatch(interaction);
  } else if (interaction.commandName === 'catches') {
    await handleCatches(interaction);
  }
});

async function handleIdentify(interaction) {
  await interaction.deferReply();

  const attachment = interaction.options.getAttachment('photo');
  const location = interaction.options.getString('location');

  if (!attachment || !attachment.contentType || !attachment.contentType.startsWith('image/')) {
    await interaction.editReply('Please attach an image file (JPG or PNG) with the `/identify` command.');
    return;
  }

  try {
    // Download the attachment
    const imgResponse = await fetch(attachment.url);
    if (!imgResponse.ok) throw new Error('Could not download that attachment.');
    const arrayBuffer = await imgResponse.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Resize down so the request stays small and fast
    const image = await Jimp.read(inputBuffer);
    image.scaleToFit(1024, 1024);
    const outputBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    const base64Image = outputBuffer.toString('base64');

    const result = await identifyFish(base64Image, 'image/jpeg');
    const candidates = Array.isArray(result.candidates) ? result.candidates.slice(0, 3) : [];

    if (candidates.length === 0) {
      await interaction.editReply("Couldn't get a reading on that photo — try a clearer, well-lit shot of the whole fish.");
      return;
    }

    const top = candidates[0];

    const barColor = top.confidence_percent >= 66 ? 0x3f6b3f
      : top.confidence_percent >= 33 ? 0x8a6a1e
      : 0xa23e32;

    const embed = new EmbedBuilder()
      .setColor(barColor)
      .setTitle(top.common_name || 'Unknown species')
      .setDescription(top.scientific_name ? `*${top.scientific_name}*` : null)
      .setThumbnail(attachment.url)
      .setFooter({ text: `Logged by ${interaction.user.username}${location ? ' · ' + location : ''}` })
      .setTimestamp();

    // Ranked guesses field
    const rankLines = candidates.map((c, i) => {
      const medal = ['🥇', '🥈', '🥉'][i] || '';
      const pct = typeof c.confidence_percent === 'number' ? `${Math.round(c.confidence_percent)}%` : '—';
      return `${medal} **${c.common_name || 'Unknown'}** ${c.scientific_name ? `_(${c.scientific_name})_` : ''} — ${pct}`;
    });
    embed.addFields({ name: 'Best guesses', value: rankLines.join('\n') });

    // Details for the top guess
    embed.addFields(
      { name: 'Habitat', value: top.habitat || '—', inline: true },
      { name: 'Typical size', value: top.typical_size || '—', inline: true },
      { name: 'Diet', value: top.diet || '—', inline: true }
    );
    if (top.fun_fact) embed.addFields({ name: 'Note', value: top.fun_fact });

    // Caution for any of the 3 candidates, not just the top guess
    const cautions = candidates
      .filter((c) => c.caution)
      .map((c) => `**${c.common_name}:** ${c.caution}`);
    if (cautions.length > 0) {
      embed.addFields({ name: '⚠ Caution', value: cautions.join('\n') });
    }

    await interaction.editReply({ embeds: [embed] });
    
  } catch (err) {
    console.error('Identify error:', err);
    await interaction.editReply(
      `Sorry, I couldn't identify that photo (${err.message || 'unknown error'}). Try a clearer, well-lit photo of the whole fish.`
    );
  }
}

async function handleUploadCatch(interaction) {
  const attachment = interaction.options.getAttachment('photo');
  const name = interaction.options.getString('name');
  const location = interaction.options.getString('location');

  if (!attachment || !attachment.contentType || !attachment.contentType.startsWith('image/')) {
    await interaction.reply({
      content: 'Please attach an image file (JPG or PNG) with `/uploadcatch`.',
      ephemeral: true
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xc89b3c)
    .setTitle(name)
    .setThumbnail(attachment.url)
    .addFields({ name: 'Location', value: location })
    .setFooter({ text: `Logged by ${interaction.user.username}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });

  if (interaction.guildId) {
    addCatch(interaction.guildId, {
      userId: interaction.user.id,
      username: interaction.user.username,
      name,
      scientificName: '',
      confidence: 'manual entry',
      alternates: [],
      location,
      imageUrl: attachment.url,
      timestamp: Date.now()
    });
  }
}

async function handleCatches(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'This command only works inside a server.', ephemeral: true });
    return;
  }

  const count = Math.min(interaction.options.getInteger('count') || 10, 25);
  const angler = interaction.options.getUser('angler');

  const list = getCatches(interaction.guildId, { userId: angler ? angler.id : null, limit: count });

  if (list.length === 0) {
    await interaction.reply('No catches logged yet — be the first with `/uploadcatch`!');
    return;
  }

  const lines = list.map((c, i) => {
    const date = new Date(c.timestamp).toLocaleDateString();
    const loc = c.location ? ` · ${c.location}` : '';
    const alt = c.alternates && c.alternates.length > 0 ? `\n_could also be: ${c.alternates.join(', ')}_` : '';
    return `**${i + 1}. ${c.name}** ${c.scientificName ? `_(${c.scientificName})_` : ''} — ${c.confidence || ''}\n` +
      `caught by <@${c.userId}> · ${date}${loc}${alt}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xc89b3c)
    .setTitle(angler ? `Catch log — ${angler.username}` : 'Catch log')
    .setDescription(lines.join('\n\n'));

  await interaction.reply({ embeds: [embed] });
}

client.login(process.env.DISCORD_TOKEN);
