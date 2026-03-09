import { pgTable, varchar, timestamp, uuid, text, date, pgEnum } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm"; 
import { emailAddress } from "effect/FastCheck";


export const roleEnum = pgEnum("role", ["super_admin", "admin", "leader", "employee"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected"]);

export const superAdminTable = pgTable("super_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userName: varchar("user_name", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: text("role").default("superAdmin").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`), 
});

export const companyTable = pgTable("company", {
  id: uuid("id").primaryKey().defaultRandom(),
  creatorId: uuid("user_id").references(() => superAdminTable.id),
  companyCode: varchar("company_code", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 255 }),
  email: varchar("email", { length: 255 }),
  createdByName: varchar("created_by_name", { length: 255 }),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`).notNull(), 
  updateByName: varchar("update_by_name", { length: 255 }), 
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('Asia/Bangkok', now())`), 
  deletedByName: varchar("deleted_by_name", { length: 255 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const adminsTable = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  creatorId: uuid("creator_id").references(() => superAdminTable.id),
  company: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }),
  createdByName: varchar("created_by_name", { length: 255 }), 
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`).notNull(), 
  updateByName: varchar("update_by_name", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('Asia/Bangkok', now())`), 
  deletedByName: varchar("deleted_by_name", { length: 255 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const departmentsTable = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }), 
  createdBy: uuid("created_by_id").references(() => usersTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`).notNull(), 
  updateBy: uuid("update_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('Asia/Bangkok', now())`), 
  deletedBy: uuid("deleted_by_id").references(() => usersTable.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const sitesTable = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  coodinates: varchar("coordinates", { length: 255 }),
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }), 
  createdBy: uuid("created_by_id").references(() => usersTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`).notNull(), 
  updateBy: uuid("update_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('Asia/Bangkok', now())`), 
});

export const positionsTable = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  company_id: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }), 
  createdBy: uuid("created_by_id").references(() => usersTable.id), 
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`).notNull(), 
});

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  userName: varchar("user_name", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 255 }).notNull(), 
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departmentsTable.id),
  positionId: uuid("position_id").references(() => positionsTable.id), 
  site_id: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  avatarUrl: text("avatar_url"), 
  avatarId: text("avatar_id"),
  createdBy: uuid("created_by_id").references(() => usersTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`).notNull(), 
  updateBy: uuid("update_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('Asia/Bangkok', now())`), 
  deletedBy: uuid("deleted_by_id").references(() => usersTable.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const attendanceTable = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => usersTable.id),
  department_id: uuid("department_id").references(() => departmentsTable.id),
  site_id: uuid("site_id").references(() => sitesTable.id),
  date: date("date").notNull(),
  checkIn: text("check_in"),
  imageIn: text("image_in").notNull(),   
  imageInId: text("image_in_id"), 
  locationIn: varchar("location_in", { length: 255 }).notNull(),
  checkOut: text("check_out"),
  imageOut: text("image_out"),
  imageOutId: text("image_out_id"),
  locationOut: varchar("location_out", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`).notNull(), 
});

export const leaveTable = pgTable("leave", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => usersTable.id),
  department_id: uuid("department_id").references(() => departmentsTable.id),
  site_id: uuid("site_id").references(() => sitesTable.id),
  type: varchar("type", { length: 255 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason").notNull(),
  status: leaveStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }), 
  rejectedBy: uuid("rejected_by_id").references(() => usersTable.id),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }), 
  fileUrl: text("file_url"), 
  fileId: text("file_id"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`timezone('Asia/Bangkok', now())`).notNull(), 
});

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  site: one(sitesTable, {
    fields: [usersTable.site_id],
    references: [sitesTable.id],
  }),
  leaves: many(leaveTable),
  attendances: many(attendanceTable),
}));

export const leaveRelations = relations(leaveTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [leaveTable.user_id],
    references: [usersTable.id],
  }),
  approver: one(usersTable, {
    fields: [leaveTable.approvedBy],
    references: [usersTable.id],
  }),
}));