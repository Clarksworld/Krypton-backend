import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { wallets } from "./wallets";
import { bankAccounts } from "./bank_accounts";
import { transactions } from "./transactions";
import { notifications } from "./notifications";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  username: text("username").unique(),
  phone: text("phone"),
  isEmailVerified: boolean("is_email_verified").default(false),
  emailVerifyToken: text("email_verify_token"),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires", { withTimezone: true }),
  twoFactorSecret: text("two_factor_secret"),
  isTwoFactorEnabled: boolean("is_two_factor_enabled").default(false),
  isAdmin: boolean("is_admin").default(false),
  last2faVerifiedAt: timestamp("last_2fa_verified_at", { withTimezone: true }),
  passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }),
  userIndex: serial("user_index").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  wallets: many(wallets),
  bankAccounts: many(bankAccounts),
  transactions: many(transactions),
  notifications: many(notifications),
  sessions: many(userSessions),
}));

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  dateOfBirth: text("date_of_birth"), // YYYY-MM-DD stored as text for simplicity
  country: text("country"),
  kycLevel: text("kyc_level").default("0"),    // 0 | 1 | 2
  kycStatus: text("kyc_status").default("unverified"), // unverified|pending|approved|failed
  privatePortfolio: boolean("private_portfolio").default(false),
  preferredCurrency: text("preferred_currency").default("USD"),
  address: text("address"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  deviceName: text("device_name"),
  location: text("location"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));
