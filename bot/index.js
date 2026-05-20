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
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

// ── Config ──────────────────────────────────────────────────────────────────────
const DISCORD_TOKEN  = process.env.DISCORD_BOT_TOKEN;
const SHORT_API_BASE = "https://linkurlshort.page.gd";
const PREFIX         = "!";

// ── Cookie challenge solver ──────────────────────────────────────────────────────
// The site protects all requests with a slowAES-based JS cookie challenge.
// We fetch aes.js once, solve it in Node, then attach __test= to every POST.
let _cachedCookie = null;

async function getSolvedCookie(fetch) {
  if (_cachedCookie) return _cachedCookie;

  // 1. GET the homepage to retrieve the challenge values from the HTML
  const homeRes = await fetch(`${SHORT_API_BASE}/`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const homeHtml = await homeRes.text();

  // Extract the three hex strings passed to slowAES.decrypt(c, 2, a, b)
  const aMatch = homeHtml.match(/toNumbers\(['\"]([0-9a-f]{32})['\"]\)/g);
  if (!aMatch || aMatch.length < 3) throw new Error("Cookie challenge values not found");

  const extract = (s) => s.match(/['\"]([0-9a-f]{32})['\"]/)[1];
  const aHex = extract(aMatch[0]);
  const bHex = extract(aMatch[1]);
  const cHex = extract(aMatch[2]);

  // 2. Fetch the aes.js library from the site
  const aesRes  = await fetch(`${SHORT_API_BASE}/aes.js`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const aesCode = await aesRes.text();

  // 3. Run the AES decryption in a Node vm to get the cookie value
  const vm = require("vm");
  const ctx = {};
  vm.runInNewContext(aesCode, ctx);

  function toNumbers(d) {
    const e = [];
    d.replace(/(..)/g, (d) => e.push(parseInt(d, 16)));
    return e;
  }
  function toHex(arr) {
    return arr.map((b) => (b < 16 ? "0" : "") + b.toString(16)).join("");
  }

  const a = toNumbers(aHex);
  const b = toNumbers(bHex);
  const c = toNumbers(cHex);
  const cookieVal = toHex(ctx.slowAES.decrypt(c, 2, a, b));

  _cachedCookie = cookieVal;
  return cookieVal;
}

// ── Discord client ──────────────────────────────────────────────────────────────
// ── Welcomer config ─────────────────────────────────────────────────────────────
const WELCOME_CHANNEL_ID = "1506536157016494140";
const WELCOME_GIF        = "https://image2url.com/r2/default/gifs/1768488617981-bdc4c780-144f-4a40-8906-ddf01eadb705.gif";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", async () => {
  console.log(`[bot] Online as ${client.user.tag}`);
  client.user.setActivity("!hyperlink", { type: ActivityType.Listening });

  // Register /announce slash command globally
  const announceCommand = new SlashCommandBuilder()
    .setName("announce")
    .setDescription("Send a custom embed announcement to a channel")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to send the announcement in")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .toJSON();

  try {
    await client.application.commands.set([announceCommand]);
    console.log("[bot] Slash commands registered.");
  } catch (err) {
    console.error("[bot] Failed to register slash commands:", err.message);
  }
});

// ── Welcomer ────────────────────────────────────────────────────────────────────
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel || !channel.isTextBased()) return;

  const welcomeEmbed = new EmbedBuilder()
    .setDescription(
      "**─── <a:emoji_8:1506236357775720548> `ɪɴꜱᴀɴɪᴛʏ   | ɢᴀᴛᴇᴡᴀʏ` <a:emoji_8:1506236357775720548> ───\n\n" +
      "<a:emoji_3:1500695831169204295> ᴡᴇʟᴄᴏᴍᴇ ᴛᴏ ᴏᴜʀ ꜱᴇʀᴠᴇʀ ᴛʜᴀᴛ ʜᴀꜱ ᴍᴀɴʏ ꜰᴇᴀᴛᴜʀᴇꜱ ᴀɴᴅ ʙᴇꜱᴛ ꜱɪᴛᴇꜱ ᴇxɪꜱᴛ\n\n" +
      "<:emoji_4:1501269124330950787> ʙᴇꜱᴛ ʙᴇᴀᴍ ꜱɪᴛᴇꜱ ᴏꜰ ᴀʟʟ ᴛɪᴍᴇ**"
    )
    .setImage(WELCOME_GIF)
    .setFooter({
      text: `Welcome ${member.user.username}`,
      iconURL: member.user.displayAvatarURL({ dynamic: true }),
    });

  await channel.send({
    content: `<@${member.id}>`,
    embeds: [welcomeEmbed],
  });
});

// ── !server — Roblox server list ────────────────────────────────────────────────
// 30 categories, each with a label and 3 invite links
// NOTE: Each entry has 3 invite links. Replace any placeholders marked with
// "⚠️ REPLACE" with the real invite links from the game's official Discord.
const ROBLOX_SERVERS = [
  {
    id: "psx", label: "PSX",
    invites: [
      "https://discord.gg/psx",           // Official Pet Simulator X
      "https://discord.gg/YUK3tEfDQS",    // PSX Trading
      "https://discord.gg/petsimx",        // Community hub
    ],
  },
  {
    id: "adoptme", label: "Adopt Me",
    invites: [
      "https://discord.gg/adoptme",
      "https://discord.gg/5NQavmhH",
      "https://discord.gg/adoptmetrading",
    ],
  },
  {
    id: "bloxfruits", label: "Blox Fruits",
    invites: [
      "https://discord.gg/bloxfruits",
      "https://discord.gg/rKSetnGvBs",
      "https://discord.gg/bloxfruitstrading",
    ],
  },
  {
    id: "mm2", label: "MM2",
    invites: [
      "https://discord.gg/mm2",
      "https://discord.gg/MurderMystery2",
      "https://discord.gg/mm2trading",
    ],
  },
  {
    id: "pet99", label: "Pet Sim 99",
    invites: [
      "https://discord.gg/bHkhy8Rk53",
      "https://discord.gg/petsim99",
      "https://discord.gg/ps99trading",
    ],
  },
  {
    id: "royalhigh", label: "Royal High",
    invites: [
      "https://discord.gg/trhds",
      "https://discord.gg/royalhigh",
      "https://discord.gg/rh-trading",
    ],
  },
  {
    id: "brookhaven", label: "Brookhaven",
    invites: [
      "https://discord.gg/brookhaven",
      "https://discord.gg/BrookhavenRP",
      "https://discord.gg/brookhavenfans",
    ],
  },
  {
    id: "arsenal", label: "Arsenal",
    invites: [
      "https://discord.gg/arsenal",
      "https://discord.gg/arsenalrblx",
      "https://discord.gg/arsenaltrading",
    ],
  },
  {
    id: "jailbreak", label: "Jailbreak",
    invites: [
      "https://discord.gg/jailbreak",
      "https://discord.gg/RobloxJailbreak",
      "https://discord.gg/jailbreaktrading",
    ],
  },
  {
    id: "towerofhell", label: "Tower of Hell",
    invites: [
      "https://discord.gg/towerofhell",
      "https://discord.gg/toh",
      "https://discord.gg/tohcommunity",
    ],
  },
  {
    id: "bedwars", label: "Bedwars",
    invites: [
      "https://discord.gg/robloxbedwars",
      "https://discord.gg/bedwars",
      "https://discord.gg/bwrblx",
    ],
  },
  {
    id: "piggy", label: "Piggy",
    invites: [
      "https://discord.gg/piggy",
      "https://discord.gg/PiggyRoblox",
      "https://discord.gg/piggyfans",
    ],
  },
  {
    id: "shindo", label: "Shindo Life",
    invites: [
      "https://discord.gg/shindolife",
      "https://discord.gg/shindo",
      "https://discord.gg/shindotrading",
    ],
  },
  {
    id: "deepwoken", label: "Deepwoken",
    invites: [
      "https://discord.gg/deepwoken",
      "https://discord.gg/Deepwoken",
      "https://discord.gg/deepwokenfans",
    ],
  },
  {
    id: "doors", label: "Doors",
    invites: [
      "https://discord.gg/doors",
      "https://discord.gg/DoorsRoblox",
      "https://discord.gg/doorsfans",
    ],
  },
  {
    id: "evade", label: "Evade",
    invites: [
      "https://discord.gg/evade",
      "https://discord.gg/EvadeRoblox",
      "https://discord.gg/evadecommunity",
    ],
  },
  {
    id: "islands", label: "Islands",
    invites: [
      "https://discord.gg/islands",
      "https://discord.gg/IslandsRoblox",
      "https://discord.gg/islandstrading",
    ],
  },
  {
    id: "lumber", label: "Lumber Tycoon",
    invites: [
      "https://discord.gg/lt2",
      "https://discord.gg/LumberTycoon2",
      "https://discord.gg/lumbertycoon",
    ],
  },
  {
    id: "skyblock", label: "Skyblock",
    invites: [
      "https://discord.gg/skyblock",
      "https://discord.gg/RobloxSkyblock",
      "https://discord.gg/skyblockrblx",
    ],
  },
  {
    id: "dragon", label: "Dragon Adventures",
    invites: [
      "https://discord.gg/DragonAdventures",
      "https://discord.gg/dragon",
      "https://discord.gg/dragonadv",
    ],
  },
  {
    id: "vehicle", label: "Vehicle Legends",
    invites: [
      "https://discord.gg/VehicleLegends",
      "https://discord.gg/vehiclelegendsrblx",
      "https://discord.gg/vltrading",
    ],
  },
  {
    id: "flicker", label: "Flicker",
    invites: [
      "https://discord.gg/FlickerRoblox",
      "https://discord.gg/flicker",
      "https://discord.gg/flickerfans",
    ],
  },
  {
    id: "swordburst", label: "Sword Burst",
    invites: [
      "https://discord.gg/SwordBurst2",
      "https://discord.gg/swordburst",
      "https://discord.gg/sb2rblx",
    ],
  },
  {
    id: "tradingblox", label: "Blox Trading",
    invites: [
      "https://discord.gg/BloxTrading",
      "https://discord.gg/robloxtrading",
      "https://discord.gg/tradingblox",
    ],
  },
  {
    id: "ninjalegs", label: "Ninja Legends",
    invites: [
      "https://discord.gg/NinjaLegends",
      "https://discord.gg/ninjalegs",
      "https://discord.gg/nlfans",
    ],
  },
  {
    id: "fightingleg", label: "Fighting Legends",
    invites: [
      "https://discord.gg/FightingLegends",
      "https://discord.gg/fightingleg",
      "https://discord.gg/flfans",
    ],
  },
  {
    id: "arsenal2", label: "Arsenal Trading",
    invites: [
      "https://discord.gg/ArsenalTrading",
      "https://discord.gg/arsenaltrade",
      "https://discord.gg/atcommunity",
    ],
  },
  {
    id: "robux", label: "Robux Groups",
    invites: [
      "https://discord.gg/RobuxGroup",
      "https://discord.gg/robuxgroups",
      "https://discord.gg/robloxrobux",
    ],
  },
  {
    id: "funnymoments", label: "Funny Moments",
    invites: [
      "https://discord.gg/RobloxFunny",
      "https://discord.gg/funnymoments",
      "https://discord.gg/robloxmemes",
    ],
  },
  {
    id: "robloxcentral", label: "Roblox Central",
    invites: [
      "https://discord.gg/roblox",
      "https://discord.gg/RobloxCentral",
      "https://discord.gg/robloxhub",
    ],
  },
];

// Build button rows (max 5 buttons per row, max 5 rows per message = 25 per message)
function buildServerRows(servers) {
  const rows = [];
  for (let i = 0; i < servers.length; i += 5) {
    const chunk = servers.slice(i, i + 5);
    const row = new ActionRowBuilder().addComponents(
      chunk.map((s) =>
        new ButtonBuilder()
          .setCustomId(`server_${s.id}`)
          .setLabel(s.label)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji({ id: "1500695831169204295", name: "emoji_3", animated: true })
      )
    );
    rows.push(row);
  }
  return rows;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild)     return;

  const content = message.content.trim().toLowerCase();

  // ── !server ──
  if (content === `${PREFIX}server`) {
    const serverEmbed = new EmbedBuilder()
      .setDescription(
        "**─── <a:emoji_8:1506236357775720548> `ɪɴꜱᴀɴɪᴛʏ   | ꜱᴇʀᴠᴇʀꜱ` <a:emoji_8:1506236357775720548> ───\n\n" +
        "<a:emoji_3:1500695831169204295> ꜱᴇʀᴠᴇʀꜱ ᴜ ᴡᴀɴᴛ ᴛᴏ ʜɪᴛ/ʙᴇᴀᴍ ɪɴ\n\n" +
        "<:emoji_4:1501269124330950787> ᴀʟʟ ꜱᴇʀᴠᴇʀꜱ ʟᴏꜱᴛ ᴛᴏ ʙᴇᴀᴍ**"
      )
      .setImage("https://cdn.discordapp.com/attachments/1500676577183268914/1506552431855800391/5dba8cbd-8441-48ae-8b64-5e8f39555b90.gif?ex=6a0eadca&is=6a0d5c4a&hm=3e5d2141bbf449b3a387bb54e8b085b069e22815670186aa65fb1aef191fc055&")
      .setFooter({
        text: `Requested by ${message.author.username}`,
        iconURL: message.author.displayAvatarURL({ dynamic: true }),
      });

    // First 25 servers (5 rows)
    const firstBatch  = ROBLOX_SERVERS.slice(0, 25);
    // Last 5 servers (1 row) — sent as a follow-up
    const secondBatch = ROBLOX_SERVERS.slice(25);

    await message.reply({
      embeds: [serverEmbed],
      components: buildServerRows(firstBatch),
    });

    if (secondBatch.length > 0) {
      await message.channel.send({
        components: buildServerRows(secondBatch),
      });
    }
    return;
  }

  if (content !== `${PREFIX}hyperlink`) return;

  // Build the embed that prompts the user to submit a link
  const embed = new EmbedBuilder()
    .setDescription(
      "**─── <:emoji_1:1500680900428435646> `ɪɴꜱᴀɴɪᴛʏ   | ʜʏᴘᴇʀʟɪɴᴋ` <:emoji_1:1500680900428435646> ───\n\n" +
      "<a:emoji_3:1500695831169204295> ᴜꜱᴇ ᴛʜɪꜱ ᴛᴏᴏʟ ᴛᴏ ɢᴇɴᴇʀᴀᴛᴇ ʜʏᴘᴇʀʟɪɴᴋꜱ ᴛʜᴀᴛ ʙʏᴘᴀꜱꜱ ᴅɪꜱᴄᴏʀᴅ ᴡᴀʀɴɪɴɢꜱ\n\n" +
      "<:emoji_4:1501269124330950787> ʙᴇꜱᴛ ʜʏᴘᴇʀʟɪɴᴋ ᴏꜰ ᴀʟʟ ᴛɪᴍᴇ**"
    )
    .setImage("https://image2url.com/r2/default/gifs/1768488617981-bdc4c780-144f-4a40-8906-ddf01eadb705.gif")
    .setFooter({
      text: `Requested by ${message.author.username}`,
      iconURL: message.author.displayAvatarURL({ dynamic: true }),
    });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("hyperlink_submit")
      .setLabel("ʜʏᴘᴇʀʟɪɴᴋ")
      .setStyle(ButtonStyle.Primary)
      .setEmoji({ id: "1500695831169204295", name: "emoji_3", animated: true })
  );

  await message.reply({ embeds: [embed], components: [row] });
});

// ── Button / Modal interactions ─────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {

  // ── /announce slash command — open the announce modal ──
  if (interaction.isChatInputCommand() && interaction.commandName === "announce") {
    const targetChannel = interaction.options.getChannel("channel");

    const modal = new ModalBuilder()
      .setCustomId(`announce_modal:${targetChannel.id}`)
      .setTitle("Create Announcement Embed");

    const titleInput = new TextInputBuilder()
      .setCustomId("ann_title")
      .setLabel("Title (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. Server Update")
      .setRequired(false);

    const bodyInput = new TextInputBuilder()
      .setCustomId("ann_body")
      .setLabel("Body / Description")
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder("Write your announcement here...")
      .setRequired(true);

    const footerInput = new TextInputBuilder()
      .setCustomId("ann_footer")
      .setLabel("Footer text (optional)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("e.g. Insanity Network")
      .setRequired(false);

    const imageInput = new TextInputBuilder()
      .setCustomId("ann_image")
      .setLabel("Image URL (optional, shown as large image)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("https://example.com/banner.gif")
      .setRequired(false);

    const colorInput = new TextInputBuilder()
      .setCustomId("ann_color")
      .setLabel("Embed color hex (optional, e.g. #5865F2)")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("#5865F2")
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(bodyInput),
      new ActionRowBuilder().addComponents(footerInput),
      new ActionRowBuilder().addComponents(imageInput),
      new ActionRowBuilder().addComponents(colorInput),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── /announce modal submitted ──
  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId.startsWith("announce_modal:")
  ) {
    // Defer immediately so Discord does not time out (3 s limit)
    await interaction.deferReply({ ephemeral: true });

    try {
      const channelId    = interaction.customId.split(":")[1];
      const targetChannel = interaction.guild.channels.cache.get(channelId);

      if (!targetChannel || !targetChannel.isTextBased()) {
        await interaction.editReply({ content: "Could not find the target channel." });
        return;
      }

      // Safe reads — optional fields return empty string when left blank
      const safeGet = (id) => {
        try { return interaction.fields.getTextInputValue(id).trim(); }
        catch { return ""; }
      };

      const annTitle  = safeGet("ann_title");
      const annBody   = safeGet("ann_body");
      const annFooter = safeGet("ann_footer");
      const annImage  = safeGet("ann_image");
      const annColor  = safeGet("ann_color");

      if (!annBody) {
        await interaction.editReply({ content: "Body / Description cannot be empty." });
        return;
      }

      const embed = new EmbedBuilder().setDescription(annBody);

      if (annTitle) embed.setTitle(annTitle);
      if (annImage) embed.setImage(annImage);

      // Parse hex color
      if (annColor) {
        const hex = parseInt(annColor.replace("#", ""), 16);
        if (!isNaN(hex)) embed.setColor(hex);
      }

      // Footer: always include requester avatar
      const footerText = annFooter
        ? `${annFooter} • Announced by ${interaction.user.username}`
        : `Announced by ${interaction.user.username}`;

      embed.setFooter({
        text: footerText,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      });

      embed.setTimestamp();

      await targetChannel.send({ embeds: [embed] });

      await interaction.editReply({
        content: `Announcement sent to <#${channelId}>.`,
      });
    } catch (err) {
      console.error("[bot] /announce error:", err.message);
      await interaction.editReply({ content: "Something went wrong sending the announcement." });
    }
    return;
  }

  // ── Server category button pressed ──
  if (interaction.isButton() && interaction.customId.startsWith("server_")) {
    const serverId = interaction.customId.replace("server_", "");
    const server   = ROBLOX_SERVERS.find((s) => s.id === serverId);

    if (!server) {
      await interaction.reply({ content: "Unknown server category.", ephemeral: true });
      return;
    }

    const inviteLines = server.invites
      .map((link, i) => `**${i + 1}.** ${link}`)
      .join("\n");

    await interaction.reply({
      content: `<a:emoji_8:1506236357775720548> **${server.label} ꜱᴇʀᴠᴇʀꜱ**\n\n${inviteLines}`,
      ephemeral: true,
    });
    return;
  }

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
      const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

      // Step 1 — solve the AES cookie challenge
      const cookie = await getSolvedCookie(fetch);

      // Step 2 — POST the URL as a form with the solved cookie
      const res = await fetch(`${SHORT_API_BASE}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":   "Mozilla/5.0",
          "Cookie":       `__test=${cookie}`,
        },
        body: new URLSearchParams({ url: rawUrl }).toString(),
        redirect: "follow",
      });

      const html = await res.text();

      // Step 3 — extract FMT and SHORT_URL from the JS constants the site embeds
      // e.g. const FMT = "[text](https://linkurlshort.page.gd/index.php?r=XXXXX)";
      const fmtMatch      = html.match(/const FMT\s*=\s*"((?:[^"\\]|\\.)*)"/);
      const shortMatch    = html.match(/const SHORT_URL\s*=\s*"((?:[^"\\]|\\.)*)"/);

      if (!fmtMatch || !shortMatch) {
        await interaction.editReply({
          content: "Could not shorten that link. Make sure the URL starts with `https://` and try again.",
        });
        return;
      }

      // Unescape the JS string (site escapes slashes as \/)
      const fmt      = fmtMatch[1].replace(/\\\//g, "/");
      const shortUrl = shortMatch[1].replace(/\\\//g, "/");

      // Build result embed — no color so there is no left-bar tint
      const resultEmbed = new EmbedBuilder()
        .setDescription(
          `**ʟɪɴᴋ ʜɪᴅᴇ ᴄᴏᴘʏ ᴀɴᴅ ꜱʜᴀʀᴇ**\n\n` +
          `\`${fmt}\`\n\n` +
          `*ᴄᴏᴘʏ ᴛʜ�� ᴛᴇxᴛ ᴀʙᴏᴠᴇ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ʜʏᴘᴇʀʟɪɴᴋ*`
        )
        .setFooter({
          text: `Requested by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
        });

      // Send the fmt as a separate plain message so users can select & copy just the text
      await interaction.editReply({ embeds: [resultEmbed] });
      await interaction.followUp({ content: fmt, ephemeral: false });
    } catch (err) {
      console.error("[bot] hyperlink error:", err.message);
      await interaction.editReply({
        content: "Something went wrong while shortening your link. Please try again.",
      });
    }
  }
});

// ── Health-check HTTP server (required by Railway) ──────────────────────────────
const http = require("http");
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  })
  .listen(PORT, () => {
    console.log(`[bot] Health-check server listening on port ${PORT}`);
  });

// ── Start ───────────────────────────────────────────────────────────────────────
if (!DISCORD_TOKEN) {
  console.error("[bot] DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}

client.login(DISCORD_TOKEN);
