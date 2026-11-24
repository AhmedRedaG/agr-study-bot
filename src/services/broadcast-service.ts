import type { Bot } from "grammy";
import type { Context } from "grammy";
import { env } from "../config/env.js";
import { StudyRepository } from "../repositories/study-repository.js";
import { UserRepository } from "../repositories/user-repository.js";

export interface BroadcastReport {
  attempted: number;
  delivered: number;
  blocked: number;
  failed: number;
}

export class BroadcastService {
  constructor(
    private readonly content = new StudyRepository(),
    private readonly users = new UserRepository(),
  ) {}

  async send(bot: Bot<Context>, message: Context["message"], target: "all" | "level" | "term", targetId?: number): Promise<BroadcastReport> {
    if (!message) throw new Error("A broadcast message is required.");
    const userIds = await this.content.usersForBroadcast(target, targetId);
    const report: BroadcastReport = { attempted: userIds.length, delivered: 0, blocked: 0, failed: 0 };
    for (const userId of userIds) {
      try {
        await bot.api.copyMessage(userId, message.chat.id, message.message_id);
        report.delivered += 1;
      } catch (error) {
        const description = error instanceof Error ? error.message : String(error);
        if (description.includes("403") || description.toLowerCase().includes("blocked")) {
          await this.users.setBlocked(userId, true);
          report.blocked += 1;
        } else {
          report.failed += 1;
          console.error(`Broadcast delivery failed for user ${userId}: ${description}`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, env.broadcastDelayMs));
    }
    return report;
  }
}
