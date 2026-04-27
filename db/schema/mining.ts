import {
  pgTable,
  uuid,
  text,
  numeric,
  timestamp,
  boolean,
  unique
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const miningStats = pgTable("mining_stats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }).unique(),
  balance: numeric("balance", { precision: 28, scale: 8 }).default("0"),
  miningRate: numeric("mining_rate", { precision: 28, scale: 8 }).default("0.5"), // base tokens per hour
  lastClaimedAt: timestamp("last_claimed_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const miningUpgrades = pgTable("mining_upgrades", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(), // e.g. "Starter Boost", "Turbo Boost"
  description: text("description"),
  priceUsdt: numeric("price_usdt", { precision: 20, scale: 2 }).notNull(),
  miningRate: numeric("mining_rate", { precision: 28, scale: 8 }).notNull(), // New rate after upgrade
  durationDays: numeric("duration_days").default("30"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userMiningUpgrades = pgTable("user_mining_upgrades", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  upgradeId: uuid("upgrade_id")
    .notNull()
    .references(() => miningUpgrades.id),
  txHash: text("tx_hash").notNull(),
  status: text("status").default("pending"), // pending | active | expired
  startedAt: timestamp("started_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull().unique(),
  description: text("description"),
  type: text("type").default("social"), // social | video | puzzle
  rewardAmount: numeric("reward_amount", { precision: 28, scale: 8 }).notNull(),
  puzzleData: text("puzzle_data"), // JSON string for { question, options: [] }
  correctAnswer: text("correct_answer"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userTasks = pgTable(
  "user_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [unique("user_task_unique").on(t.userId, t.taskId)]
);

export const miningRelations = relations(users, ({ one, many }) => ({
  miningStats: one(miningStats, {
    fields: [users.id],
    references: [miningStats.userId],
  }),
  userTasks: many(userTasks),
  userMiningUpgrades: many(userMiningUpgrades),
}));

export const userMiningUpgradeRelations = relations(userMiningUpgrades, ({ one }) => ({
  user: one(users, {
    fields: [userMiningUpgrades.userId],
    references: [users.id],
  }),
  upgrade: one(miningUpgrades, {
    fields: [userMiningUpgrades.upgradeId],
    references: [miningUpgrades.id],
  }),
}));

export const miningStatsRelations = relations(miningStats, ({ one }) => ({
  user: one(users, {
    fields: [miningStats.userId],
    references: [users.id],
  }),
}));

export const userTasksRelations = relations(userTasks, ({ one }) => ({
  user: one(users, {
    fields: [userTasks.userId],
    references: [users.id],
  }),
  task: one(tasks, {
    fields: [userTasks.taskId],
    references: [tasks.id],
  }),
}));
