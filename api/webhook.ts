import { webhookCallback } from "grammy";
import { waitUntil } from "@vercel/functions";
import { env } from "../src/config/env.js";
import { bot } from "../src/bot/index.js";
import { ensureSchema } from "../src/db/schema.js";
import { withBackgroundScheduler } from "../src/services/background-tasks.js";

const handleUpdate = webhookCallback(bot, "std/http");

export default async function webhook(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }
  if (
    env.webhookSecret &&
    request.headers.get("x-telegram-bot-api-secret-token") !== env.webhookSecret
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  await ensureSchema();
  return withBackgroundScheduler(waitUntil, () => handleUpdate(request));
}
