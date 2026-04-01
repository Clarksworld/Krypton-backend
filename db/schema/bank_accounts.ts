import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  accountNumber: text("account_number").notNull(),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  user: one(users, {
    fields: [bankAccounts.userId],
    references: [users.id],
  }),
}));
