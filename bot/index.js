require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
} = require("discord.js");
const fetch = require("node-fetch");

// ── Config ──────────────────────────────────────────────────────────────────────
const DISCORD_TOKEN   = process.env.DISCORD_BOT_TOKEN;
const SESSION_COOKIE  = process.env.LOGGED_TG_SESSION_COOKIE;
const STATS_CHANNEL   = process.env.STATS_CHANNEL_ID ?? null;
const PREFIX          = "!";

const SESSION_URL = "https://logged.tg/api/session";
const API_BASE    = "https://api.injuries.to";

// ── Auth helpers ────────────────────────────────────────────────────────────────

async function getSession() {
  if (!SESSION_COOKIE) throw new Error("LOGGED_TG_SESSION_COOKIE is not set.");

  const res = await fetch(SESSION_URL, {
    headers: {
      Cookie:        SESSION_COOKIE,
      "User-Agent":  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      Referer:       "https://logged.tg/dashboard",
      Accept:        "application/json",
    },
  });

  const text = await res.text();
  console.log("[v0] Session status:", res.status);
  console.log("[v0] Session response (first 500 chars):", text.slice(0, 500));

  if (!res.ok) throw new Error(`Session fetch failed (${res.status}) — cookie may be expired.`);

  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Session returned non-JSON: ${text.slice(0, 200)}`); }

  console.log("[v0] Session top-level keys:", Object.keys(data));
  return data;
}

async function apiGet(path, id, token) {
  const url = `${API_BASE}${path}`;
  console.log("[v0] API GET:", url, "id:", id, "token:", token ? token.slice(0, 8) + "..." : "NONE");

  const res = await fetch(url, {
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

  const text = await res.text();
  console.log("[v0] API", path, "status:", res.status, "response (first 500):", text.slice(0, 500));

  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) throw new Error(`API ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

// ── Stats fetcher ───────────────────────────────────────────────────────────────

async function fetchStats() {
  const sessionData = await getSession();

  // Extract auth tokens from session
  const authArr = sessionData?.Auth
    ?? sessionData?.userSettings?.Auth
    ?? sessionData?.user?.Auth
    ?? null;

  console.log("[v0] authArr:", JSON.stringify(authArr)?.slice(0, 100));

  if (!authArr) throw new Error("Auth tokens not found in session — cookie may be expired.");

  const id    = Array.isArray(authArr) ? String(authArr[0]) : String(authArr.Id ?? authArr.id ?? "");
  const token = Array.isArray(authArr) ? String(authArr[1]) : String(authArr.Token ?? authArr.token ?? "");

  if (!id || !token) throw new Error("Auth.Id or Auth.Token missing in session.");

  console.log("[v0] Got auth id:", id, "token:", token.slice(0, 8) + "...");

  // Try common dashboard/stats endpoints
  let data;
  for (const path of ["/api/auth", "/api/user", "/api/dashboard", "/v2/user", "/api/omni"]) {
    try {
      data = await apiGet(path, id, token);
      if (data && !data.error && !data.message && Object.keys(data).length > 2) {
        console.log("[v0] Got data from path:", path, "keys:", Object.keys(data));
        break;
      }
    } catch (e) {
      console.log("[v0] Path", path, "failed:", e.message);
      data = null;
    }
  }

  if (!data) throw new Error("Could not fetch stats from any endpoint. Check logs for details.");

  const userSettings = sessionData?.userSettings ?? sessionData?.user ?? {};

  // Walk common response shapes
  const mainData     = data?.omniData?.Main ?? data?.Main ?? data?.data ?? data;
  const inner        = mainData?.Data ?? mainData;
  const profile      = data?.omniData?.Profile?.Header ?? data?.Profile?.Header ?? {};
  const totals       = inner?.Totals       ?? data?.Totals       ?? {};
  const collectibles = inner?.Collectibles ?? data?.Collectibles ?? {};
  const billing      = inner?.Billing      ?? data?.Billing      ?? {};
  const groups       = inner?.Groups       ?? data?.Groups       ?? {};
  const cookies      = inner?.Cookies      ?? data?.Cookies      ?? {};

  console.log("[v0] totals:", JSON.stringify(totals));

  return {
    userName:     String(userSettings?.userName    ?? profile?.Username    ?? "Unknown"),
    displayName:  String(userSettings?.displayName ?? profile?.DisplayName ?? userSettings?.userName ?? "Unknown"),
    isPremium:    Boolean(userSettings?.IsPremium  ?? profile?.IsPremium   ?? false),
    avatar:       String(data?.userAvatar ?? ""),

    visits:       Number(totals?.Visits   ?? 0),
    accounts:     Number(totals?.Accounts ?? 0),
    summary:      Number(totals?.Summary  ?? 0),
    rap:          Number(totals?.Rap      ?? 0),
    balance:      Number(totals?.Balance  ?? 0),

    rapItems:     Number(collectibles?.Limiteds?.Rap ?? 0),
    hasKorblox:   Boolean(collectibles?.Korblox  ?? false),
    hasHeadless:  Boolean(collectibles?.Headless ?? false),

    subActive:    Boolean(billing?.Subscription?.Has     ?? false),
    subExpires:   String(billing?.Subscription?.Expires  ?? ""),
    billingTotal: Number(billing?.Total                  ?? 0),
    credit:       Number(billing?.Credit?.Balance        ?? 0),

    groupsOwned:  Array.isArray(groups?.Owned) ? groups.Owned.length : Number(groups?.Owned ?? 0),
    groupBalance: Number(groups?.Balance ?? 0),
    groupPending: Number(groups?.Pending ?? 0),

    cookieStatus: cookies?.Security ? "Valid" : "None",
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
  return `R\$ ${fmt(n)}`;
}

// ── Embed builder ───────────────────────────────────────────────────────────────

function buildStatsEmbed(stats, requester) {
  const color = stats.isPremium ? 0xf5a623 : 0x5865f2;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${stats.displayName}  |  logged.tg`)
    .setURL("https://logged.tg/dashboard")
    .setDescription(
      `**Username:** \`${stats.userName}\`` +
      (stats.isPremium ? "  —  **Premium**" : "")
    )
    .addFields(
      { name: "Total Hits",  value: `\`\`\`${fmt(stats.accounts)}\`\`\``, inline: true },
      { name: "Site Visits", value: `\`\`\`${fmt(stats.visits)}\`\`\``,   inline: true },
      { name: "Summary",     value: `\`\`\`${robux(stats.summary)}\`\`\``,inline: true },

      { name: "Total RAP",    value: `\`\`\`${robux(stats.rap)}\`\`\``,      inline: true },
      { name: "Balance",      value: `\`\`\`${robux(stats.balance)}\`\`\``,  inline: true },
      { name: "Limiteds RAP", value: `\`\`\`${robux(stats.rapItems)}\`\`\``, inline: true },

      {
        name:  "Rare Items",
        value: `Korblox:  ${stats.hasKorblox  ? "Yes" : "No"}\nHeadless: ${stats.hasHeadless ? "Yes" : "No"}`,
        inline: false,
      },

      {
        name:  "Subscription",
        value: `Active: ${stats.subActive ? "Yes" : "No"}` +
               (stats.subExpires ? `\nExpires: ${stats.subExpires}` : ""),
        inline: true,
      },
      {
        name:  "Billing",
        value: `Total:  ${robux(stats.billingTotal)}\nCredit: ${robux(stats.credit)}`,
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: true },

      {
        name:  "Groups",
        value: `Owned:   **${stats.groupsOwned}**\nBalance: ${robux(stats.groupBalance)}\nPending: ${robux(stats.groupPending)}`,
        inline: true,
      },
      {
        name:  "Cookie Status",
        value: stats.cookieStatus === "Valid" ? "Valid" : "None",
        inline: true,
      },
      { name: "\u200b", value: "\u200b", inline: true }
    )
    .setFooter({
      text:    `Requested by ${requester.tag}  •  logged.tg`,
      iconURL: requester.displayAvatarURL({ dynamic: true }),
    })
    .setTimestamp();

  if (stats.avatar?.startsWith("http")) {
    embed.setThumbnail(stats.avatar);
  }

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
  console.log(`[logged.tg bot] Logged in as ${client.user.tag}`);
  client.user.setActivity("logged.tg/dashboard", { type: ActivityType.Watching });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild)     return;

  const content = message.content.trim();
  if (!content.startsWith(PREFIX)) return;

  const command = content.slice(PREFIX.length).trim().split(/\s+/)[0].toLowerCase();

  // ── !stats ─────────────────────────────────────────────────────────────────
  if (command === "stats") {
    if (STATS_CHANNEL && message.channel.id !== STATS_CHANNEL) return;

    await message.channel.sendTyping();

    try {
      const stats = await fetchStats();
      const embed = buildStatsEmbed(stats, message.author);
      await message.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[logged.tg bot] !stats error:", err.message);
      await message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle("Failed to fetch stats")
            .setDescription(
              `Your session cookie may have expired. Grab a fresh one from your browser.\n\n\`\`\`${err.message.slice(0, 350)}\`\`\``
            )
            .setTimestamp(),
        ],
      });
    }
    return;
  }

  // ── !help ──────────────────────────────────────────────────────────────────
  if (command === "help") {
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle("logged.tg Stats Bot — Commands")
          .addFields(
            { name: "`!stats`", value: "Fetch live stats from your logged.tg dashboard.", inline: false },
            { name: "`!help`",  value: "Show this help message.",                          inline: false }
          )
          .setTimestamp(),
      ],
    });
  }
});

// ── Start ───────────────────────────────────────────────────────────────────────

if (!DISCORD_TOKEN) {
  console.error("[logged.tg bot] ERROR: DISCORD_BOT_TOKEN is not set.");
  process.exit(1);
}
if (!SESSION_COOKIE) {
  console.error("[logged.tg bot] ERROR: LOGGED_TG_SESSION_COOKIE is not set.");
  process.exit(1);
}

client.login(DISCORD_TOKEN);
