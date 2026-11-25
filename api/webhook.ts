import { webhookCallback } from "grammy";
import { waitUntil } from "@vercel/functions";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "../src/config/env.js";
import { bot, registerBotCommands } from "../src/bot/index.js";
import { ensureSchema } from "../src/db/schema.js";
import { withBackgroundScheduler } from "../src/services/background-tasks.js";

export const config = { api: { bodyParser: false } };

const handleUpdate = webhookCallback(bot, "http");

export default async function webhook(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" });
    response.end("Method Not Allowed");
    return;
  }
  if (
    env.webhookSecret &&
    request.headers["x-telegram-bot-api-secret-token"] !== env.webhookSecret
  ) {
    response.writeHead(401);
    response.end("Unauthorized");
    return;
  }
  await ensureSchema();
  await registerBotCommands();
  await withBackgroundScheduler(waitUntil, () => handleUpdate(request, response));
}
