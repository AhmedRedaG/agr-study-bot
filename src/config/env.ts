import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function optionalHttpUrl(name: string): string | undefined {
  const value = optional(name);
  if (!value) return undefined;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTP or HTTPS URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${name} must use HTTP or HTTPS.`);
  }
  return url.href;
}

function telegramSupportUrl(value: string): string {
  const handle = value.startsWith("@") ? value.slice(1) : value;
  if (/^[A-Za-z0-9_]{5,32}$/.test(handle)) {
    return `https://t.me/${handle}`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "SUPPORT_TELEGRAM must be a Telegram username or https://t.me URL.",
    );
  }
  if (
    url.protocol !== "https:" ||
    !["t.me", "telegram.me"].includes(url.hostname.toLowerCase()) ||
    url.pathname === "/"
  ) {
    throw new Error(
      "SUPPORT_TELEGRAM must be a Telegram username or https://t.me URL.",
    );
  }
  return url.href;
}

const configuredAdminIds = required("ADMIN_IDS")
  .split(",")
  .map((id) => Number(id.trim()));

if (
  configuredAdminIds.length === 0 ||
  configuredAdminIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
) {
  throw new Error(
    "ADMIN_IDS must contain at least one valid Telegram user ID.",
  );
}
const broadcastDelayMs = Number(process.env.BROADCAST_DELAY_MS ?? 45);
if (!Number.isFinite(broadcastDelayMs) || broadcastDelayMs < 0) {
  throw new Error("BROADCAST_DELAY_MS must be a non-negative number.");
}
const supportContact = optional("SUPPORT_CONTACT") ?? "راسلنا عبر هذا البوت";
const legacyTelegramContact =
  /^@[A-Za-z0-9_]{5,32}$/.test(supportContact) ||
  /^https:\/\/(?:t\.me|telegram\.me)\//i.test(supportContact)
    ? supportContact
    : undefined;
const supportTelegram =
  optional("SUPPORT_TELEGRAM") ??
  legacyTelegramContact;

export const env = {
  botToken: required("BOT_TOKEN"),
  databaseUrl: required("TURSO_DATABASE_URL"),
  databaseAuthToken: required("TURSO_AUTH_TOKEN"),
  adminIds: new Set(configuredAdminIds),
  webhookSecret: optional("WEBHOOK_SECRET_TOKEN"),
  archiveChannelId: optional("ARCHIVE_CHANNEL_ID"),
  requiredChannelId: optional("REQUIRED_CHANNEL_ID"),
  requiredChannelUsername: optional("REQUIRED_CHANNEL_USERNAME"),
  supportContact,
  supportTelegramUrl: supportTelegram
    ? telegramSupportUrl(supportTelegram)
    : undefined,
  supportEmail: optional("SUPPORT_EMAIL"),
  supportUrl: optionalHttpUrl("SUPPORT_URL"),
  officialChannelUrl: optionalHttpUrl("OFFICIAL_CHANNEL_URL"),
  appVersion: process.env.npm_package_version ?? "1.0.0",
  broadcastDelayMs: Math.max(35, broadcastDelayMs),
};

export function isAdmin(userId: number | undefined): boolean {
  return userId !== undefined && env.adminIds.has(userId);
}
