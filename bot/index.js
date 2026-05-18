require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
} = require("discord.js");
const fetch = require("node-fetch");

// ── Config ──────────────────────────────────────────────────────────────────────
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const AUTH_TOKEN    = process.env.AUTH_TOKEN;
const PREFIX        = "!";

const SESSION_URL = "https://logged.tg/api/session";
const API_BASE    = "https://api.injuries.to";

// ── Auth: exchange session cookie for x-id / x-token ───────────────────────────

async function getAuthTokens() {
  if (!AUTH_TOKEN) throw new Error("AUTH_TOKEN is not set.");

  const res = await fetch(SESSION_URL, {
    headers: {
      Cookie:       `AUTH_TOKEN=${AUTH_TOKEN}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      Referer:      "https://logged.tg/dashboard",
      Accept:       "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Session fetch failed (${res.status}) — cookie may be expired.`);
  }

  const data = await res.json();

  // The session endpoint returns Auth as [id, token] or { Id, Token }
  const authArr = data?.Auth ?? data?.userSettings?.Auth ?? null;
  if (!authArr) throw new Error("Auth tokens not found in session response.");

  const id    = Array.isArray(authArr) ? String(authArr[0]) : String(authArr.Id    ?? authArr.id    ?? "");
  const token = Array.isArray(authArr) ? String(authArr[1]) : String(authArr.Token ?? authArr.token ?? "");

  if (!id || !token) throw new Error("id or token missing from session Auth field.");

  return { id, token, raw: data };
}

// ── Fetch dashboard stats ───────────────────────────────────────────────────────

async function fetchStats() {
  const { id, token, raw: sessionData } = await getAuthTokens();

  const res = await fetch(`${API_BASE}/api/auth`, {
    headers: {
      "x-id":         id,
      "x-token":      token,
      "content-type": "application/json; charset=utf-8",
      "User-Agent":   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      Origin:         "https://logged.tg",
      Referer:        "https://logged.tg/dashboard",
      Accept:         "application/json",
    },
  });

  if (!res.ok) throw new Error(`Stats API returned ${res.status}.`);

  const data = await res.json();

  // Navigate common response shapes
  const mainData     = data?.omniData?.Main ?? data?.Main ?? data?.data ?? data;
  const inner        = mainData?.Data ?? mainData;
  const profile      = data?.omniData?.Profile?.Header ?? data?.Profile?.Header ?? {};
  const userSettings = sessionData?.userSettings ?? sessionData?.user ?? data?.userSettings ?? {};
  const totals       = inner?.Totals       ?? data?.Totals       ?? {};
  const collectibles = inner?.Collectibles ?? data?.Collectibles ?? {};

  return {
    userName:    String(userSettings?.userName    ?? profile?.Username    ?? "Unknown"),
    displayName: String(userSettings?.displayName ?? profile?.DisplayName ?? userSettings?.userName ?? "Unknown"),
    avatar:      String(data?.userAvatar ?? ""),

    hits:     Number(totals?.Accounts ?? 0),
    summary:  Number(totals?.Summary  ?? 0),
    balance:  Number(totals?.Balance  ?? 0),
    rap:      Number(totals?.Rap      ?? 0),
    rapItems: Number(collectibles?.Limiteds?.Rap ?? 0),
  };
}

// ── Format helpers ──────────────────────────────────────────────────────────────

function fmt(n) {
  const num = Number(n ?? 0);
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000)     return (num / 1_000).toFixed(1)     + "K";
  return num.toLocaleString("en-US");
}

function robux(n) {
  return `R$ ${fmt(n)}`;
}

// ── Embed builder ───────────────────────────────────────────────────────────────

function buildStatsEmbed(stats, requester) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("logged.tg — Dashboard Stats")
    .setURL("https://logged.tg/dashboard")
    .addFields(
      { name: "Total Hits",    value: `\`${fmt(stats.hits)}\``,      inline: true },
      { name: "Summary",       value: `\`${robux(stats.summary)}\``, inline: true },
      { name: "\u200b",        value: "\u200b",                      inline: true },
      { name: "Robux Balance", value: `\`${robux(stats.balance)}\``, inline: true },
      { name: "Total RAP",     value: `\`${robux(stats.rap)}\``,     inline: true },
      { name: "Limiteds RAP",  value: `\`${robux(stats.rapItems)}\``,inline: true }
    )
    .setFooter({
      text:    `Requested by ${requester.tag}`,
      iconURL: requester.displayAvatarURL({ dynamic: true }),
    })
    .setTimestamp();

  if (stats.avatar?.startsWith("http")) embed.setThumbnail(stats.avatar);

  return embed;
}

// ── Discord client ──────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`[logged.tg bot] Online as ${client.user.tag}`);
  client.user.setActivity("logged.tg/dashboard", { type: ActivityType.Watching });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild)     return;

  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const command = content.slice(PREFIX.length).trim().split(/\s+/)[0].toLowerCase();

  if (command === "stats") {
    await message.channel.sendTyping();

    try {
      const stats = await fetchStats();
      await message.reply({ embeds: [buildStatsEmbed(stats, message.author)] });
    } catch (err) {
      console.error("[logged.tg bot] !stats error:", err.message);
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("Failed to fetch stats")
            .setDescription(
              `Could not reach logged.tg. The AUTH_TOKEN may be expired.\n\n\`\`\`${err.message.slice(0, 300)}\`\`\``
            )
            .setTimestamp(),
        ],
      });
    }
  }
});

// ── Start ───────────────────────────────────────────────────────────────────────

if (!DISCORD_TOKEN) {
  console.error("[logged.tg bot] DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}

if (!AUTH_TOKEN) {
  console.error("[logged.tg bot] AUTH_TOKEN is not set.");
  process.exit(1);
}

client.login(DISCORD_TOKEN);
