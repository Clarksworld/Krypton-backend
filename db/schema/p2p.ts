import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { cryptoAssets } from "./wallets";
import { bankAccounts } from "./bank_accounts";

export const p2pOffers = pgTable("p2p_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  makerId: uuid("maker_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // buy | sell
  assetId: uuid("asset_id")
    .notNull()
    .references(() => cryptoAssets.id),
  pricePerUnit: numeric("price_per_unit", { precision: 20, scale: 2 }).notNull(),
  availableQty: numeric("available_qty", { precision: 28, scale: 8 }).notNull(),
  minOrderFiat: numeric("min_order_fiat", { precision: 20, scale: 2 }).notNull(),
  maxOrderFiat: numeric("max_order_fiat", { precision: 20, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(), // bank_transfer
  paymentWindow: integer("payment_window").default(15), // minutes
  isActive: boolean("is_active").default(true),
  totalOrders: integer("total_orders").default(0),
  completionRate: numeric("completion_rate", { precision: 5, scale: 2 }).default("100"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const p2pOffersRelations = relations(p2pOffers, ({ one, many }) => ({
  maker: one(users, {
    fields: [p2pOffers.makerId],
    references: [users.id],
  }),
  asset: one(cryptoAssets, {
    fields: [p2pOffers.assetId],
    references: [cryptoAssets.id],
  }),
  trades: many(p2pTrades),
}));

export const p2pTrades = pgTable("p2p_trades", {
  id: uuid("id").primaryKey().defaultRandom(),
  offerId: uuid("offer_id")
    .notNull()
    .references(() => p2pOffers.id),
  makerId: uuid("maker_id")
    .notNull()
    .references(() => users.id),
  takerId: uuid("taker_id")
    .notNull()
    .references(() => users.id),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => cryptoAssets.id),
  cryptoAmount: numeric("crypto_amount", { precision: 28, scale: 8 }).notNull(),
  fiatAmount: numeric("fiat_amount", { precision: 20, scale: 2 }).notNull(),
  pricePerUnit: numeric("price_per_unit", { precision: 20, scale: 2 }).notNull(),
  // pending|payment_sent|payment_confirmed|completed|cancelled|disputed
  status: text("status").default("pending"),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id),
  escrowLocked: boolean("escrow_locked").default(false),
  escrowReleased: boolean("escrow_released").default(false),
  paymentSentAt: timestamp("payment_sent_at", { withTimezone: true }),
  paymentConfirmedAt: timestamp("payment_confirmed_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const p2pTradesRelations = relations(p2pTrades, ({ one, many }) => ({
  offer: one(p2pOffers, {
    fields: [p2pTrades.offerId],
    references: [p2pOffers.id],
  }),
  maker: one(users, {
    fields: [p2pTrades.makerId],
    references: [users.id],
  }),
  taker: one(users, {
    fields: [p2pTrades.takerId],
    references: [users.id],
  }),
  asset: one(cryptoAssets, {
    fields: [p2pTrades.assetId],
    references: [cryptoAssets.id],
  }),
  messages: many(p2pMessages),
  disputes: many(p2pDisputes),
}));

export const p2pMessages = pgTable("p2p_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeId: uuid("trade_id")
    .notNull()
    .references(() => p2pTrades.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const p2pMessagesRelations = relations(p2pMessages, ({ one }) => ({
  trade: one(p2pTrades, {
    fields: [p2pMessages.tradeId],
    references: [p2pTrades.id],
  }),
  sender: one(users, {
    fields: [p2pMessages.senderId],
    references: [users.id],
  }),
}));

export const p2pDisputes = pgTable("p2p_disputes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeId: uuid("trade_id")
    .notNull()
    .references(() => p2pTrades.id),
  raisedBy: uuid("raised_by")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  evidenceUrls: jsonb("evidence_urls"),
  status: text("status").default("open"), // open | resolved
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const p2pDisputesRelations = relations(p2pDisputes, ({ one }) => ({
  trade: one(p2pTrades, {
    fields: [p2pDisputes.tradeId],
    references: [p2pTrades.id],
  }),
  user: one(users, {
    fields: [p2pDisputes.raisedBy],
    references: [users.id],
  }),
}));
