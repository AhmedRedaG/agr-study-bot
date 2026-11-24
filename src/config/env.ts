import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

const configuredAdminIds = required("ADMIN_IDS").split(",").map((id) => Number(id.trim()));

if (configuredAdminIds.length === 0 || configuredAdminIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
  throw new Error("ADMIN_IDS must contain at least one valid Telegram user ID.");
}
const broadcastDelayMs = Number(process.env.BROADCAST_DELAY_MS ?? 45);
if (!Number.isFinite(broadcastDelayMs) || broadcastDelayMs < 0) {
  throw new Error("BROADCAST_DELAY_MS must be a non-negative number.");
}

export const env = {
  botToken: required("BOT_TOKEN"),
  databaseUrl: required("TURSO_DATABASE_URL"),
  databaseAuthToken: required("TURSO_AUTH_TOKEN"),
  adminIds: new Set(configuredAdminIds),
  webhookSecret: optional("WEBHOOK_SECRET_TOKEN"),
  archiveChannelId: optional("ARCHIVE_CHANNEL_ID"),
  requiredChannelId: optional("REQUIRED_CHANNEL_ID"),
  requiredChannelUsername: optional("REQUIRED_CHANNEL_USERNAME"),
  supportContact: optional("SUPPORT_CONTACT") ?? "راسلنا عبر هذا البوت",
  appVersion: process.env.npm_package_version ?? "1.0.0",
  broadcastDelayMs: Math.max(35, broadcastDelayMs),
};

export function isAdmin(userId: number | undefined): boolean {
  return userId !== undefined && env.adminIds.has(userId);
}
