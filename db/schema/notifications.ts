import {
  pgTable,
  uuid,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  // trade | transaction | kyc | security | promo
  type: text("type"),
  isRead: boolean("is_read").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationSettings = pgTable("notification_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  tradeAlerts: boolean("trade_alerts").default(true),
  transactionAlerts: boolean("transaction_alerts").default(true),
  kycAlerts: boolean("kyc_alerts").default(true),
  securityAlerts: boolean("security_alerts").default(true),
  promoAlerts: boolean("promo_alerts").default(false),
  pushEnabled: boolean("push_enabled").default(true),
  emailEnabled: boolean("email_enabled").default(true),
});

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [notificationSettings.userId],
    references: [users.id],
  }),
}));
