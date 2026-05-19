require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  ActivityType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
} = require("discord.js");

// ── Config ──────────────────────────────────────────────────────────────────────
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;
const SHORT_API_BASE = "https://linkurlshort.page.gd";
const PREFIX         = "!";

// ── Discord client ──────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`[bot] Online as ${client.user.tag}`);
  client.user.setActivity("!hyperlink", { type: ActivityType.Listening });
});

// ── !hyperlink command ──────────────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild)     return;

  const content = message.content.trim().toLowerCase();
  if (content !== `${PREFIX}hyperlink`) return;

  // Build the embed that prompts the user to submit a link
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Hide a Link with Hyperlink")
    .setDescription(
      "Want to disguise a long URL as a clean hyperlink?\n\n" +
      "Click **Submit Link** below, paste your URL, and the bot will return a formatted hyperlink you can share anywhere."
    )
    .addFields(
      { name: "How it works", value: "Your URL is posted to **linkurlshort.page.gd** and returned as a masked hyperlink.", inline: false },
      { name: "Privacy", value: "The link is visible only to you in this message reply.", inline: false }
    )
    .setFooter({ text: "Powered by linkurlshort.page.gd" })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("hyperlink_submit")
      .setLabel("Submit Link")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("🔗")
  );

  await message.reply({ embeds: [embed], components: [row] });
});

// ── Button / Modal interactions ─────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  // ── Button pressed: open modal ──
  if (interaction.isButton() && interaction.customId === "hyperlink_submit") {
    const modal = new ModalBuilder()
      .setCustomId("hyperlink_modal")
      .setTitle("Submit a Link to Shorten");

    const urlInput = new TextInputBuilder()
      .setCustomId("url_input")
      .setLabel("Paste your URL here")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://example.com/very/long/url")
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(urlInput)
    );

    await interaction.showModal(modal);
    return;
  }

  // ── Modal submitted ──
  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === "hyperlink_modal"
  ) {
    const rawUrl = interaction.fields.getTextInputValue("url_input").trim();

    await interaction.deferReply({ ephemeral: false });

    try {
      // POST to linkurlshort.page.gd
      const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

      const res = await fetch(`${SHORT_API_BASE}/api/shorten`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ url: rawUrl }),
      });

      let shortUrl = null;
      let displayText = null;

      if (res.ok) {
        const data = await res.json().catch(() => null);
        // Common response shapes: { short_url }, { shortUrl }, { url }, { result }
        shortUrl = data?.short_url || data?.shortUrl || data?.url || data?.result || null;
      }

      // Fallback: even if API fails, wrap the original URL in a hyperlink format
      const targetUrl = shortUrl || rawUrl;
      displayText     = shortUrl ? "Click here (hidden link)" : "Click here";

      const resultEmbed = new EmbedBuilder()
        .setColor(shortUrl ? 0x57f287 : 0xfee75c)
        .setTitle(shortUrl ? "Your hyperlink is ready!" : "Hyperlink Created (original URL)")
        .setDescription(
          `Here is your disguised hyperlink:\n\n` +
          `**[${displayText}](${targetUrl})**\n\n` +
          `Copy the markdown above and paste it in any Discord message to show a masked link.`
        )
        .addFields(
          { name: "Original URL", value: `\`${rawUrl}\``, inline: false },
          { name: "Short / Hidden URL", value: `\`${targetUrl}\``, inline: false },
          { name: "Markdown to copy", value: `\`\`\`[${displayText}](${targetUrl})\`\`\``, inline: false }
        )
        .setFooter({ text: `Requested by ${interaction.user.username} • linkurlshort.page.gd` })
        .setTimestamp();

      await interaction.editReply({ embeds: [resultEmbed] });
    } catch (err) {
      console.error("[bot] hyperlink error:", err.message);
      await interaction.editReply({
        content: "Something went wrong while shortening your link. Please try again.",
      });
    }
  }
});

// ── Start ───────────────────────────────────────────────────────────────────────
if (!DISCORD_TOKEN) {
  console.error("[bot] DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}

client.login(DISCORD_TOKEN);
