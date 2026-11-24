import { bot } from "./bot/index.js";
import { ensureSchema } from "./db/schema.js";

await ensureSchema();
await bot.start({
  onStart: (info) => console.log(`AGR Study bot started as @${info.username}`),
});
