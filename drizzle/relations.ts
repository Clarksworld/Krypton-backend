import { relations } from "drizzle-orm/relations";
import { users, kycSubmissions, wallets, cryptoAssets, bankAccounts, transactions, p2PTrades, p2PDisputes, p2POffers, userProfiles, notificationSettings, notifications } from "./schema";

export const kycSubmissionsRelations = relations(kycSubmissions, ({one}) => ({
	user: one(users, {
		fields: [kycSubmissions.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	kycSubmissions: many(kycSubmissions),
	wallets: many(wallets),
	bankAccounts: many(bankAccounts),
	transactions: many(transactions),
	p2PDisputes: many(p2PDisputes),
	p2POffers: many(p2POffers),
	userProfiles: many(userProfiles),
	p2PTrades_makerId: many(p2PTrades, {
		relationName: "p2PTrades_makerId_users_id"
	}),
	p2PTrades_takerId: many(p2PTrades, {
		relationName: "p2PTrades_takerId_users_id"
	}),
	notificationSettings: many(notificationSettings),
	notifications: many(notifications),
}));

export const walletsRelations = relations(wallets, ({one}) => ({
	user: one(users, {
		fields: [wallets.userId],
		references: [users.id]
	}),
	cryptoAsset: one(cryptoAssets, {
		fields: [wallets.assetId],
		references: [cryptoAssets.id]
	}),
}));

export const cryptoAssetsRelations = relations(cryptoAssets, ({many}) => ({
	wallets: many(wallets),
	transactions: many(transactions),
	p2POffers: many(p2POffers),
	p2PTrades: many(p2PTrades),
}));

export const bankAccountsRelations = relations(bankAccounts, ({one, many}) => ({
	user: one(users, {
		fields: [bankAccounts.userId],
		references: [users.id]
	}),
	p2PTrades: many(p2PTrades),
}));

export const transactionsRelations = relations(transactions, ({one}) => ({
	user: one(users, {
		fields: [transactions.userId],
		references: [users.id]
	}),
	cryptoAsset: one(cryptoAssets, {
		fields: [transactions.assetId],
		references: [cryptoAssets.id]
	}),
}));

export const p2PDisputesRelations = relations(p2PDisputes, ({one}) => ({
	p2PTrade: one(p2PTrades, {
		fields: [p2PDisputes.tradeId],
		references: [p2PTrades.id]
	}),
	user: one(users, {
		fields: [p2PDisputes.raisedBy],
		references: [users.id]
	}),
}));

export const p2PTradesRelations = relations(p2PTrades, ({one, many}) => ({
	p2PDisputes: many(p2PDisputes),
	p2POffer: one(p2POffers, {
		fields: [p2PTrades.offerId],
		references: [p2POffers.id]
	}),
	user_makerId: one(users, {
		fields: [p2PTrades.makerId],
		references: [users.id],
		relationName: "p2PTrades_makerId_users_id"
	}),
	user_takerId: one(users, {
		fields: [p2PTrades.takerId],
		references: [users.id],
		relationName: "p2PTrades_takerId_users_id"
	}),
	cryptoAsset: one(cryptoAssets, {
		fields: [p2PTrades.assetId],
		references: [cryptoAssets.id]
	}),
	bankAccount: one(bankAccounts, {
		fields: [p2PTrades.bankAccountId],
		references: [bankAccounts.id]
	}),
}));

export const p2POffersRelations = relations(p2POffers, ({one, many}) => ({
	user: one(users, {
		fields: [p2POffers.makerId],
		references: [users.id]
	}),
	cryptoAsset: one(cryptoAssets, {
		fields: [p2POffers.assetId],
		references: [cryptoAssets.id]
	}),
	p2PTrades: many(p2PTrades),
}));

export const userProfilesRelations = relations(userProfiles, ({one}) => ({
	user: one(users, {
		fields: [userProfiles.userId],
		references: [users.id]
	}),
}));

export const notificationSettingsRelations = relations(notificationSettings, ({one}) => ({
	user: one(users, {
		fields: [notificationSettings.userId],
		references: [users.id]
	}),
}));

export const notificationsRelations = relations(notifications, ({one}) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id]
	}),
}));