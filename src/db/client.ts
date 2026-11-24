import { createClient } from "@libsql/client";
import { env } from "../config/env.js";

export const db = createClient({
  url: env.databaseUrl,
  ...(env.databaseUrl.startsWith("file:") ? {} : { authToken: env.databaseAuthToken }),
});
