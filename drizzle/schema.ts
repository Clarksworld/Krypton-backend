import { pgTable, foreignKey, uuid, text, timestamp, unique, numeric, boolean, jsonb, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const kycSubmissions = pgTable("kyc_submissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	idType: text("id_type").notNull(),
	idNumber: text("id_number").notNull(),
	idDocUrl: text("id_doc_url"),
	selfieUrl: text("selfie_url"),
	status: text().default('pending'),
	rejectReason: text("reject_reason"),
	submittedAt: timestamp("submitted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "kyc_submissions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const wallets = pgTable("wallets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	assetId: uuid("asset_id").notNull(),
	balance: numeric({ precision: 28, scale:  8 }).default('0'),
	frozenBalance: numeric("frozen_balance", { precision: 28, scale:  8 }).default('0'),
	depositAddress: text("deposit_address"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "wallets_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assetId],
			foreignColumns: [cryptoAssets.id],
			name: "wallets_asset_id_crypto_assets_id_fk"
		}),
	unique("wallets_user_asset_unique").on(table.userId, table.assetId),
]);

export const cryptoAssets = pgTable("crypto_assets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	symbol: text().notNull(),
	name: text().notNull(),
	iconUrl: text("icon_url"),
	isActive: boolean("is_active").default(true),
	networks: jsonb(),
}, (table) => [
	unique("crypto_assets_symbol_unique").on(table.symbol),
]);

export const bankAccounts = pgTable("bank_accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	bankName: text("bank_name").notNull(),
	accountName: text("account_name").notNull(),
	accountNumber: text("account_number").notNull(),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "bank_accounts_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const transactions = pgTable("transactions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	type: text().notNull(),
	assetId: uuid("asset_id"),
	amount: numeric({ precision: 28, scale:  8 }).notNull(),
	fee: numeric({ precision: 28, scale:  8 }).default('0'),
	fiatAmount: numeric("fiat_amount", { precision: 20, scale:  2 }),
	fiatCurrency: text("fiat_currency").default('NGN'),
	status: text().default('pending'),
	reference: text(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "transactions_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assetId],
			foreignColumns: [cryptoAssets.id],
			name: "transactions_asset_id_crypto_assets_id_fk"
		}),
	unique("transactions_reference_unique").on(table.reference),
]);

export const p2PDisputes = pgTable("p2p_disputes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tradeId: uuid("trade_id").notNull(),
	raisedBy: uuid("raised_by").notNull(),
	reason: text().notNull(),
	evidenceUrls: jsonb("evidence_urls"),
	status: text().default('open'),
	resolution: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.tradeId],
			foreignColumns: [p2PTrades.id],
			name: "p2p_disputes_trade_id_p2p_trades_id_fk"
		}),
	foreignKey({
			columns: [table.raisedBy],
			foreignColumns: [users.id],
			name: "p2p_disputes_raised_by_users_id_fk"
		}),
]);

export const p2POffers = pgTable("p2p_offers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	makerId: uuid("maker_id").notNull(),
	type: text().notNull(),
	assetId: uuid("asset_id").notNull(),
	pricePerUnit: numeric("price_per_unit", { precision: 20, scale:  2 }).notNull(),
	availableQty: numeric("available_qty", { precision: 28, scale:  8 }).notNull(),
	minOrderFiat: numeric("min_order_fiat", { precision: 20, scale:  2 }).notNull(),
	maxOrderFiat: numeric("max_order_fiat", { precision: 20, scale:  2 }).notNull(),
	paymentMethod: text("payment_method").notNull(),
	paymentWindow: integer("payment_window").default(15),
	isActive: boolean("is_active").default(true),
	totalOrders: integer("total_orders").default(0),
	completionRate: numeric("completion_rate", { precision: 5, scale:  2 }).default('100'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.makerId],
			foreignColumns: [users.id],
			name: "p2p_offers_maker_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assetId],
			foreignColumns: [cryptoAssets.id],
			name: "p2p_offers_asset_id_crypto_assets_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	username: text(),
	phone: text(),
	isEmailVerified: boolean("is_email_verified").default(false),
	emailVerifyToken: text("email_verify_token"),
	passwordResetToken: text("password_reset_token"),
	passwordResetExpires: timestamp("password_reset_expires", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
	unique("users_username_unique").on(table.username),
]);

export const userProfiles = pgTable("user_profiles", {
	userId: uuid("user_id").primaryKey().notNull(),
	fullName: text("full_name"),
	avatarUrl: text("avatar_url"),
	dateOfBirth: text("date_of_birth"),
	country: text(),
	kycLevel: text("kyc_level").default('0'),
	kycStatus: text("kyc_status").default('unverified'),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_profiles_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const p2PTrades = pgTable("p2p_trades", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	offerId: uuid("offer_id").notNull(),
	makerId: uuid("maker_id").notNull(),
	takerId: uuid("taker_id").notNull(),
	assetId: uuid("asset_id").notNull(),
	cryptoAmount: numeric("crypto_amount", { precision: 28, scale:  8 }).notNull(),
	fiatAmount: numeric("fiat_amount", { precision: 20, scale:  2 }).notNull(),
	pricePerUnit: numeric("price_per_unit", { precision: 20, scale:  2 }).notNull(),
	status: text().default('pending'),
	bankAccountId: uuid("bank_account_id"),
	paymentSentAt: timestamp("payment_sent_at", { withTimezone: true, mode: 'string' }),
	paymentConfirmedAt: timestamp("payment_confirmed_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.offerId],
			foreignColumns: [p2POffers.id],
			name: "p2p_trades_offer_id_p2p_offers_id_fk"
		}),
	foreignKey({
			columns: [table.makerId],
			foreignColumns: [users.id],
			name: "p2p_trades_maker_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.takerId],
			foreignColumns: [users.id],
			name: "p2p_trades_taker_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.assetId],
			foreignColumns: [cryptoAssets.id],
			name: "p2p_trades_asset_id_crypto_assets_id_fk"
		}),
	foreignKey({
			columns: [table.bankAccountId],
			foreignColumns: [bankAccounts.id],
			name: "p2p_trades_bank_account_id_bank_accounts_id_fk"
		}),
]);

export const notificationSettings = pgTable("notification_settings", {
	userId: uuid("user_id").primaryKey().notNull(),
	tradeAlerts: boolean("trade_alerts").default(true),
	transactionAlerts: boolean("transaction_alerts").default(true),
	kycAlerts: boolean("kyc_alerts").default(true),
	securityAlerts: boolean("security_alerts").default(true),
	promoAlerts: boolean("promo_alerts").default(false),
	pushEnabled: boolean("push_enabled").default(true),
	emailEnabled: boolean("email_enabled").default(true),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notification_settings_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	title: text().notNull(),
	body: text().notNull(),
	type: text(),
	isRead: boolean("is_read").default(false),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "notifications_user_id_users_id_fk"
		}).onDelete("cascade"),
]);
