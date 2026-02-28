import { integer, pgTable, varchar, timestamp, uuid, text, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const superAdminTable = pgTable("super_admins", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id"),
    userName: varchar("user_name", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    createdBy: uuid("created_by_id"),
});

export const companyTable = pgTable("company", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => superAdminTable.id),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address").notNull(),
    createdBy: uuid("created_by_id").references(() => superAdminTable.id),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updateBy: uuid("update_by_id").references(() => superAdminTable.id),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

export const adminsTable = pgTable("admins", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => usersTable.id),
    company: uuid("company_id").references(() => companyTable.id),
    createdBy: uuid("created_by_id").references(() => superAdminTable.id),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updateBy: uuid("update_by_id").references(() => superAdminTable.id),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
    deletedBy: uuid("deleted_by_id").references(() => superAdminTable.id),
    deletedAt: timestamp("deleted_at"),
});

export const sitesTable = pgTable("sites", {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    coodinates: varchar("coordinates", { length: 255 }),
    createdBy: uuid("created_by_id").references(() => usersTable.id),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updateBy: uuid("update_by_id").references(() => usersTable.id),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
});

export const usersTable = pgTable("users", {
    id: uuid("id").primaryKey().defaultRandom(),
    userName: varchar("user_name", { length: 255 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: varchar("role", { length: 255 }).notNull(),
    firstName: varchar("first_name", { length: 255 }).notNull(),
    lastName: varchar("last_name", { length: 255 }).notNull(),
    department: varchar("department", { length: 255 }).notNull(),
    position: varchar("position", { length: 255 }).notNull(),
    site_id: uuid("site_id").references(() => sitesTable.id),
    createdBy: uuid("created_by_id").references(() => usersTable.id),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updateBy: uuid("update_by_id").references(() => usersTable.id),
    updatedAt: timestamp("updated_at").$onUpdate(() => new Date()),
    deletedBy: uuid("deleted_by_id").references(() => usersTable.id),
    deletedAt: timestamp("deleted_at"),
});

export const attendanceTable = pgTable("attendance", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => usersTable.id),
    date: date("date").notNull(),
    checkIn: timestamp("check_in").notNull(),
    imageIn: text("image_in").notNull(),
    locationIn: varchar("location_in", { length: 255 }).notNull(),
    checkOut: timestamp("check_out"),
    imageOut: text("image_out"),
    locationOut: varchar("location_out", { length: 255 }),
});

export const leaveTable = pgTable("leave", {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => usersTable.id),
    type: varchar("type", { length: 255 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 255 }).notNull().default("pending"),
    approvedBy: uuid("approved_by_id").references(() => usersTable.id),
});



export const roleEnum = pgEnum("role", ["super_admin", "admin", "leader", "employee"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected"]);

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