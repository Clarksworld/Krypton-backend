import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const cryptoAssets = pgTable("crypto_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  symbol: text("symbol").unique().notNull(), // USDT, BTC, ETH
  name: text("name").notNull(),
  iconUrl: text("icon_url"),
  isActive: boolean("is_active").default(true),
  networks: jsonb("networks"), // [{name:"TRC20", addressRegex:"..."}]
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const cryptoAssetsRelations = relations(cryptoAssets, ({ many }) => ({
  wallets: many(wallets),
}));

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => cryptoAssets.id),
    balance: numeric("balance", { precision: 28, scale: 8 }).default("0"),
    frozenBalance: numeric("frozen_balance", { precision: 28, scale: 8 }).default("0"),
    depositAddress: text("deposit_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique("wallets_user_asset_unique").on(t.userId, t.assetId)]
);

export const walletsRelations = relations(wallets, ({ one }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  asset: one(cryptoAssets, {
    fields: [wallets.assetId],
    references: [cryptoAssets.id],
  }),
}));
