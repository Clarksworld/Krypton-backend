import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const kycSubmissions = pgTable("kyc_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  idType: text("id_type").notNull(), // passport | national_id | drivers_license
  idNumber: text("id_number").notNull(),
  idDocUrl: text("id_doc_url"),
  idBackUrl: text("id_back_url"),
  selfieUrl: text("selfie_url"),
  status: text("status").default("pending"), // pending | approved | failed
  rejectReason: text("reject_reason"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});
