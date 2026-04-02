import {
  pgTable,
  uuid,
  text,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const globalSettings = pgTable("global_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").unique().notNull(), // e.g. "withdrawal_fee_pct"
  value: text("value").notNull(),
  type: text("type").default("string"), // string | number | boolean | json
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
