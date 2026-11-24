import { ensureSchema } from "../src/db/schema.js";
import { db } from "../src/db/client.js";

await ensureSchema();
for (const [index, title] of [
  "محاضرات / Lectures",
  "سكاشن / Sections",
  "ملخصات / Summaries",
  "امتحانات سابقة / Past Exams",
  "كتب / Books",
].entries()) {
  await db.execute({
    sql: "INSERT OR IGNORE INTO folders (title, sort_order) VALUES (?, ?)",
    args: [title, index],
  });
}
console.log("Turso schema is ready and default resource folders are seeded.");
