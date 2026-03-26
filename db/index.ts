import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Prevent multiple instances in development (Next.js hot reload)
declare global {
  // eslint-disable-next-line no-var
  var _pgClient: postgres.Sql | undefined;
}

const client = global._pgClient ?? postgres(connectionString);
if (process.env.NODE_ENV !== "production") global._pgClient = client;

export const db = drizzle(client, { schema });
