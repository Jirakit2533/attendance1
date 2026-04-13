import { pgTable, varchar, timestamp, uuid, text, date, pgEnum, time, integer, jsonb, doublePrecision} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { retry } from "effect/STM";


export const roleEnum = pgEnum("role", ["super_admin", "admin", "leader", "employee"]);
export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected", "expired"]);
export const workingStatusEnum = pgEnum("working_status", ["normal", "extra"]);
export const otStatusEnum = pgEnum("ot_status", ["pending", "approved", "rejected", "expired", "executed"]);

export const superAdminTable = pgTable("super_admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userName: varchar("user_name", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: roleEnum("role").default("super_admin").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`), 
});

export const companyTable = pgTable("company", {
  id: uuid("id").primaryKey().defaultRandom(),
  superAdminCreatorId: uuid("superAdminCreator_id").references(() => superAdminTable.id),
  companyCode: varchar("company_code", { length: 255 }).notNull().unique(),
  companyPrefix: varchar("company_prefix", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  address: text("address"),
  phone: varchar("phone", { length: 255 }),
  email: varchar("email", { length: 255 }),
  logoUrl: text("logo_url"),
  otRoundingOption: varchar("ot_rounding_option", { length: 30 }).notNull(),
  createdByName: varchar("created_by_name", { length: 255 }),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`).notNull(), 
  updateByName: varchar("update_by_name", { length: 255 }), 
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('UTC', now())`), 
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
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`).notNull(), 
  updateByName: varchar("update_by_name", { length: 255 }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('UTC', now())`), 
  deletedByName: varchar("deleted_by_name", { length: 255 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const departmentsTable = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }), 
  createdBy: uuid("created_by_id").references(() => usersTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`).notNull(), 
  updateBy: uuid("update_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('UTC', now())`), 
  deletedBy: uuid("deleted_by_id").references(() => usersTable.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const sitesTable = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  coordinates: varchar("coordinates", { length: 255 }),
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }), 
  departmentId: uuid("department_id").references(() => departmentsTable.id),
  createdBy: uuid("created_by_id").references(() => usersTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`).notNull(), 
  updateBy: uuid("update_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('UTC', now())`), 
});

export const positionsTable = pgTable("positions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  company_id: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }), 
  createdBy: uuid("created_by_id").references(() => usersTable.id), 
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`).notNull(), 
});

export const shiftsTable = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id),
  startTime: time("start_time").notNull(), // 08:00:00
  endTime: time("end_time").notNull(),     // 17:00:00
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }),          // แยกตามบริษัท
  siteId: uuid("site_id").references(() => sitesTable.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const overtimeTable = pgTable("overtime", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id),
  userName: varchar("user_name", { length: 255 }).notNull(),
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }),
  shiftId: uuid("shift_id").references(() => shiftsTable.id),
  attendanceId: uuid("attendance_id").references(() => attendanceTable.id).unique(), // เชื่อมกับบันทึกเวลาวันนั้น
  status: otStatusEnum("status").default("pending").notNull(), // สถานะ OT: pending, approved, rejected
  date: date("date").notNull(),
  overtimeBefore: integer("overtime_before").notNull().default(0),
  overtimeAfter: integer("overtime_after").notNull().default(0),
  overtimeApproved: integer("overtime_approved").notNull().default(0), 
  overtimeRejected: integer("overtime_rejected").notNull().default(0),
  otRoundingOption: varchar("ot_rounding_option", { length: 30 }).notNull(),
});

export const overtimeRequestsTable = pgTable("overtime_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id),
  userName: varchar("user_name", { length: 255 }).notNull(),
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departmentsTable.id),
  siteId: uuid("site_id").references(() => sitesTable.id),
  shiftId: uuid("shift_id").references(() => shiftsTable.id),
  overtimeByRequest: integer("overtime_by_request").notNull(),
  timeStart: time("time_start").notNull(),
  timeEnd: time("time_end").notNull(),
  date: date("date").notNull(),
  requestedWorkers: jsonb("requested_workers").$type<string[]>().default([]),
  reason: text("reason").notNull(),
  remarks: text("remarks"),
  status: otStatusEnum("status").default("pending").notNull(),
  approvedAt: timestamp("approved_at", { withTimezone: true }).default(sql`timezone('UTC', now())`),
  approvedBy: uuid("approved_by").references(() => usersTable.id),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }).default(sql`timezone('UTC', now())`),
  rejectedBy: uuid("rejected_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`),
  createdBy: uuid("created_by").references(() => usersTable.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: uuid("deleted_by").references(() => usersTable.id),
})

export const temporaryShiftsTable = pgTable("temporary_shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  targetDate: date("target_date").notNull(), 
  name: varchar("name", { length: 100 }).notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  siteId: uuid("site_id").references(() => sitesTable.id),
  status: varchar("status", { length: 20 }).default("pending").notNull(), 
  overtimeId: uuid("overtime_id").references(() => overtimeTable.id),
  remark: text("remark"),
  createdBy: uuid("created_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`),
});

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  empCode: varchar("emp_code", { length: 255 }),
  userName: varchar("user_name", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").default("employee").notNull(),  
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  companyId: uuid("company_id").references(() => companyTable.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departmentsTable.id),
  positionId: uuid("position_id").references(() => positionsTable.id), 
  site_id: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  avatarUrl: text("avatar_url"), 
  avatarId: text("avatar_id"),
  createdBy: uuid("created_by_id").references(() => usersTable.id),
  created_at: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`).notNull(), 
  updateBy: uuid("update_by_id").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdateFn(() => sql`timezone('UTC', now())`), 
  deletedBy: uuid("deleted_by_id").references(() => usersTable.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const attendanceTable = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => usersTable.id),
  department_id: uuid("department_id").references(() => departmentsTable.id),
  shift_id: uuid("shift_id").references(() => shiftsTable.id),
  site_id: uuid("site_id").references(() => sitesTable.id),
  temp_shift_id: uuid("temp_shift_id").references(() => temporaryShiftsTable.id),
  siteInNameSnapshot: varchar("site_in_name_snapshot", { length: 255 }),
  siteOutNameSnapshot: varchar("site_out_name_snapshot", { length: 255 }),
  siteCoordinatesSnapshot: varchar("site_coordinates_snapshot", { length: 255 }),
  shiftStartTimeSnapshot: time("shift_start_time_snapshot"),
  shiftEndTimeSnapshot: time("shift_end_time_snapshot"),
  departmentNameSnapshot: varchar("department_name_snapshot", { length: 255 }),
  date: date("date").notNull(),
  checkIn: time("check_in"),
  imageIn: text("image_in").notNull(),   
  imageInId: text("image_in_id"), 
  locationIn: varchar("location_in", { length: 255 }).notNull(),
  checkOut: time("check_out"),
  imageOut: text("image_out"),
  imageOutId: text("image_out_id"),
  locationOut: varchar("location_out", { length: 255 }),
  isLate: integer("is_late").default(0),      // 0 = ปกติ, 1 = สาย
  isEarlyExit: text("is_early_exit", { length: 255 }), // 0 = ปกติ, 1 = ออกสาย
  isOffsiteIn: text("is_offsite_in", { length: 255 }), // 0 = ปกติ, 1 = ออกไซต์
  isOffsiteInCoordinates: text("is_offsite_in_coordinates", { length: 255 }), 
  isOffsiteOut: text("is_offsite_out", { length: 255 }), // 0 = ปกติ, 1 = ออกไซต์
  isOffsiteOutCoordinates: text("is_offsite_out_coordinates", { length: 255 }), 
  workingStatusEnum: workingStatusEnum("working_status").default("normal"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`).notNull(), 
});

export const leaveTable = pgTable("leave", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").references(() => usersTable.id),
  department_id: uuid("department_id").references(() => departmentsTable.id),
  site_id: uuid("site_id").references(() => sitesTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  startTime: time("start_time"), 
  endTime: time("end_time"),
  reason: text("reason").notNull(),
  totalHours: doublePrecision("total_hours").notNull().default(0),
  status: leaveStatusEnum("status").notNull().default("pending"),
  approvedBy: uuid("approved_by_id").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }), 
  rejectedBy: uuid("rejected_by_id").references(() => usersTable.id),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }), 
  remark: text("remark"),
  fileUrl: text("file_url"), 
  fileId: text("file_id"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`timezone('UTC', now())`).notNull(), 
});

export const logTable = pgTable("logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id"), 
  userName: varchar("user_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }),
  action: varchar("action", { length: 50 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  details: jsonb("details"),
  loginAt: timestamp("login_at", { withTimezone: true }),
  logoutAt: timestamp("logout_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`timezone('UTC', now())`)
    .notNull(),
});

export const automationLogTable = pgTable("automation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobName: varchar("job_name", { length: 255 }).notNull(),
  date: date("date").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).default(sql`timezone('UTC', now())`),
  endAt: timestamp("end_at", { withTimezone: true }),
  durationMs: integer("duration_ms"), 
  readCount: integer("read_count").default(0).notNull(),     
  changeCount: integer("change_count").default(0).notNull(),
  executedCount: integer("executed_count").default(0).notNull(), 
  deletedCount: integer("deleted_count").default(0).notNull(), 
  status: varchar("status", { length: 50 }).default("success").notNull(), 
  retryCount: integer("retry_count").default(0).notNull(),
  details: jsonb("details"), // เก็บข้อมูลดิบอื่นๆ เช่น JSON payload
});

export const usersRelations = relations(usersTable, ({ one, many }) => ({
  company: one(companyTable, {
    fields: [usersTable.companyId],
    references: [companyTable.id],
  }),
  department: one(departmentsTable, {
    fields: [usersTable.departmentId],
    references: [departmentsTable.id],
  }),
  position: one(positionsTable, {
    fields: [usersTable.positionId],
    references: [positionsTable.id],
  }),
  site: one(sitesTable, {
    fields: [usersTable.site_id],
    references: [sitesTable.id],
  }),
  leaves: many(leaveTable),
  attendances: many(attendanceTable),
  overtimeRequests: many(overtimeRequestsTable),
  shifts: many(shiftsTable),
  adminProfile: one(adminsTable, {
    fields: [usersTable.id],
    references: [adminsTable.user_id],
  }),
}));

// 2. Company Relations
export const companyRelations = relations(companyTable, ({ many }) => ({
  admins: many(adminsTable),
  departments: many(departmentsTable),
  sites: many(sitesTable),
  users: many(usersTable),
  positions: many(positionsTable),
  overtimeRequests: many(overtimeRequestsTable),
}));

// 3. Attendance Relations
