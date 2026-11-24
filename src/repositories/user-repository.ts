import { db } from "../db/client.js";
import type { AdminState } from "../types/domain.js";

export interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
}

export class UserRepository {
  async upsert(user: TelegramUser): Promise<void> {
    await db.execute({
      sql: `INSERT INTO users (id, username, first_name) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET username = excluded.username,
              first_name = excluded.first_name, updated_at = CURRENT_TIMESTAMP`,
      args: [user.id, user.username ?? null, user.first_name],
    });
  }

  async preferredLevel(userId: number): Promise<{ levelId: number; termId: number | null } | undefined> {
    const result = await db.execute({ sql: "SELECT level_id, term_id FROM users WHERE id = ?", args: [userId] });
    const row = result.rows[0];
    if (!row || typeof row.level_id !== "number") return undefined;
    return { levelId: row.level_id, termId: typeof row.term_id === "number" ? row.term_id : null };
  }

  async savePreferredLevel(userId: number, levelId: number, termId: number | null): Promise<void> {
    await db.execute({
      sql: "UPDATE users SET level_id = ?, term_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      args: [levelId, termId, userId],
    });
  }

  async setBlocked(userId: number, blocked: boolean): Promise<void> {
    await db.execute({ sql: "UPDATE users SET blocked = ? WHERE id = ?", args: [blocked ? 1 : 0, userId] });
  }

  async getState(userId: number): Promise<AdminState | undefined> {
    const result = await db.execute({ sql: "SELECT state, expires_at FROM user_sessions WHERE user_id = ?", args: [userId] });
    const row = result.rows[0];
    if (!row || Number(row.expires_at) < Date.now()) {
      if (row) await this.clearState(userId);
      return undefined;
    }
    try {
      return JSON.parse(String(row.state)) as AdminState;
    } catch {
      await this.clearState(userId);
      return undefined;
    }
  }

  async setState(userId: number, state: AdminState, ttlMs = 30 * 60 * 1000): Promise<void> {
    await db.execute({
      sql: `INSERT INTO user_sessions (user_id, state, expires_at) VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET state = excluded.state,
              expires_at = excluded.expires_at, updated_at = CURRENT_TIMESTAMP`,
      args: [userId, JSON.stringify(state), Date.now() + ttlMs],
    });
  }

  async clearState(userId: number): Promise<void> {
    await db.execute({ sql: "DELETE FROM user_sessions WHERE user_id = ?", args: [userId] });
  }
}
