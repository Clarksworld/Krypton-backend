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
  miningRate: numeric("mining_rate", { precision: 28, scale: 8 }).default("0.5"), // tokens per hour
  lastClaimedAt: timestamp("last_claimed_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  rewardAmount: numeric("reward_amount", { precision: 28, scale: 8 }).notNull(),
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
}));
