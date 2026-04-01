import {
  pgTable,
  uuid,
  text,
  numeric,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { cryptoAssets } from "./wallets";

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // deposit | withdrawal | internal_transfer | sell | p2p_buy | p2p_sell | fee
  type: text("type").notNull(),
  assetId: uuid("asset_id").references(() => cryptoAssets.id),
  amount: numeric("amount", { precision: 28, scale: 8 }).notNull(),
  fee: numeric("fee", { precision: 28, scale: 8 }).default("0"),
  fiatAmount: numeric("fiat_amount", { precision: 20, scale: 2 }),
  fiatCurrency: text("fiat_currency").default("NGN"),
  // pending | processing | completed | failed
  status: text("status").default("pending"),
  reference: text("reference").unique(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  asset: one(cryptoAssets, {
    fields: [transactions.assetId],
    references: [cryptoAssets.id],
  }),
}));
