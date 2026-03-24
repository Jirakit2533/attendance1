import { pgTable, foreignKey, uuid, varchar, date, text, timestamp, integer, type AnyPgColumn, time, unique, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const leaveStatus = pgEnum("leave_status", ['pending', 'approved', 'rejected'])
export const role = pgEnum("role", ['super_admin', 'admin', 'leader', 'employee'])


export const leave = pgTable("leave", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	departmentId: uuid("department_id"),
	siteId: uuid("site_id"),
	type: varchar({ length: 255 }).notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date").notNull(),
	reason: text().notNull(),
	status: leaveStatus().default('pending').notNull(),
	approvedById: uuid("approved_by_id"),
	approvedAt: timestamp("approved_at", { withTimezone: true, mode: 'string' }),
	rejectedById: uuid("rejected_by_id"),
	rejectedAt: timestamp("rejected_at", { withTimezone: true, mode: 'string' }),
	fileUrl: text("file_url"),
	fileId: text("file_id"),
	fileName: text("file_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`).notNull(),
	remark: text(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "leave_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "leave_department_id_departments_id_fk"
		}),
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [users.id],
			name: "leave_approved_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.rejectedById],
			foreignColumns: [users.id],
			name: "leave_rejected_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.siteId],
			foreignColumns: [sites.id],
			name: "leave_site_id_sites_id_fk"
		}),
]);

export const overtime = pgTable("overtime", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	userName: varchar("user_name", { length: 255 }).notNull(),
	shiftId: uuid("shift_id"),
	attendanceId: uuid("attendance_id"),
	status: varchar({ length: 20 }).default('pending'),
	date: date().notNull(),
	hours: integer().default(0).notNull(),
	approvedBy: uuid("approved_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "overtime_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "overtime_shift_id_shifts_id_fk"
		}),
	foreignKey({
			columns: [table.attendanceId],
			foreignColumns: [attendance.id],
			name: "overtime_attendance_id_attendance_id_fk"
		}),
	foreignKey({
			columns: [table.approvedBy],
			foreignColumns: [users.id],
			name: "overtime_approved_by_users_id_fk"
		}),
]);

export const departments = pgTable("departments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	companyId: uuid("company_id"),
	createdById: uuid("created_by_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`).notNull(),
	updateById: uuid("update_by_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	deletedById: uuid("deleted_by_id"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [company.id],
			name: "departments_company_id_company_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "departments_created_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.updateById],
			foreignColumns: [users.id],
			name: "departments_update_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.deletedById],
			foreignColumns: [users.id],
			name: "departments_deleted_by_id_users_id_fk"
		}),
]);

export const shifts = pgTable("shifts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	companyId: uuid("company_id"),
	siteId: uuid("site_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "shifts_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [company.id],
			name: "shifts_company_id_company_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.siteId],
			foreignColumns: [sites.id],
			name: "shifts_site_id_sites_id_fk"
		}),
]);

export const positions = pgTable("positions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	companyId: uuid("company_id"),
	createdById: uuid("created_by_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [company.id],
			name: "positions_company_id_company_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "positions_created_by_id_users_id_fk"
		}),
]);

export const superAdmins = pgTable("super_admins", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userName: varchar("user_name", { length: 255 }).notNull(),
	passwordHash: text("password_hash").notNull(),
	name: varchar({ length: 255 }).notNull(),
	role: text().default('superAdmin').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`),
}, (table) => [
	unique("super_admins_user_name_unique").on(table.userName),
]);

export const sites = pgTable("sites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	address: text(),
	coordinates: varchar({ length: 255 }),
	companyId: uuid("company_id"),
	createdById: uuid("created_by_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`).notNull(),
	updateById: uuid("update_by_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	departmentId: uuid("department_id"),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [company.id],
			name: "sites_company_id_company_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "sites_created_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.updateById],
			foreignColumns: [users.id],
			name: "sites_update_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "sites_department_id_departments_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userName: varchar("user_name", { length: 255 }).notNull(),
	passwordHash: text("password_hash").notNull(),
	role: varchar({ length: 255 }).notNull(),
	firstName: varchar("first_name", { length: 255 }).notNull(),
	lastName: varchar("last_name", { length: 255 }).notNull(),
	companyId: uuid("company_id"),
	departmentId: uuid("department_id"),
	positionId: uuid("position_id"),
	siteId: uuid("site_id"),
	avatarUrl: text("avatar_url"),
	avatarId: text("avatar_id"),
	createdById: uuid("created_by_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`).notNull(),
	updateById: uuid("update_by_id"),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	deletedById: uuid("deleted_by_id"),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [company.id],
			name: "users_company_id_company_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "users_department_id_departments_id_fk"
		}),
	foreignKey({
			columns: [table.positionId],
			foreignColumns: [positions.id],
			name: "users_position_id_positions_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [table.id],
			name: "users_created_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.updateById],
			foreignColumns: [table.id],
			name: "users_update_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.deletedById],
			foreignColumns: [table.id],
			name: "users_deleted_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.siteId],
			foreignColumns: [sites.id],
			name: "users_site_id_sites_id_fk"
		}).onDelete("set null"),
	unique("users_user_name_unique").on(table.userName),
]);

export const temporaryShifts = pgTable("temporary_shifts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	targetDate: date("target_date").notNull(),
	name: varchar({ length: 100 }).notNull(),
	startTime: time("start_time").notNull(),
	endTime: time("end_time").notNull(),
	siteId: uuid("site_id"),
	status: varchar({ length: 20 }).default('pending').notNull(),
	overtimeId: uuid("overtime_id"),
	remark: text(),
	createdById: uuid("created_by_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "temporary_shifts_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.overtimeId],
			foreignColumns: [overtime.id],
			name: "temporary_shifts_overtime_id_overtime_id_fk"
		}),
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "temporary_shifts_created_by_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.siteId],
			foreignColumns: [sites.id],
			name: "temporary_shifts_site_id_sites_id_fk"
		}),
]);

export const company = pgTable("company", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	companyCode: varchar("company_code", { length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	address: text(),
	phone: varchar({ length: 255 }),
	email: varchar({ length: 255 }),
	createdByName: varchar("created_by_name", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`).notNull(),
	updateByName: varchar("update_by_name", { length: 255 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	deletedByName: varchar("deleted_by_name", { length: 255 }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
	logoUrl: text("logo_url"),
	description: text(),
	adminCreatorId: uuid("admin_creator_id"),
}, (table) => [
	foreignKey({
			columns: [table.adminCreatorId],
			foreignColumns: [admins.id],
			name: "company_admin_creator_id_admins_id_fk"
		}),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [superAdmins.id],
			name: "company_user_id_super_admins_id_fk"
		}),
	unique("company_company_code_unique").on(table.companyCode),
]);

export const attendance = pgTable("attendance", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	departmentId: uuid("department_id"),
	siteId: uuid("site_id"),
	date: date().notNull(),
	checkIn: time("check_in"),
	imageIn: text("image_in").notNull(),
	imageInId: text("image_in_id"),
	locationIn: varchar("location_in", { length: 255 }).notNull(),
	checkOut: time("check_out"),
	shiftId: uuid("shift_id"),
	tempShiftId: uuid("temp_shift_id"),
	imageOut: text("image_out"),
	imageOutId: text("image_out_id"),
	locationOut: varchar("location_out", { length: 255 }),
	isLate: integer("is_late").default(0),
	isEarlyExit: text("is_early_exit"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`).notNull(),
	isOffsiteOut: text("is_offsite_out"),
	siteInNameSnapshot: varchar("site_in_name_snapshot", { length: 255 }),
	siteCoordinatesSnapshot: varchar("site_coordinates_snapshot", { length: 255 }),
	shiftStartTimeSnapshot: time("shift_start_time_snapshot"),
	shiftEndTimeSnapshot: time("shift_end_time_snapshot"),
	departmentNameSnapshot: varchar("department_name_snapshot", { length: 255 }),
	isOffsiteOutCoordinates: text("is_offsite_out_coordinates"),
	isOffsiteIn: text("is_offsite_in"),
	isOffsiteInCoordinates: text("is_offsite_in_coordinates"),
	siteOutNameSnapshot: varchar("site_out_name_snapshot", { length: 255 }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "attendance_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.departmentId],
			foreignColumns: [departments.id],
			name: "attendance_department_id_departments_id_fk"
		}),
	foreignKey({
			columns: [table.shiftId],
			foreignColumns: [shifts.id],
			name: "attendance_shift_id_shifts_id_fk"
		}),
	foreignKey({
			columns: [table.tempShiftId],
			foreignColumns: [temporaryShifts.id],
			name: "attendance_temp_shift_id_temporary_shifts_id_fk"
		}),
	foreignKey({
			columns: [table.siteId],
			foreignColumns: [sites.id],
			name: "attendance_site_id_sites_id_fk"
		}),
]);

export const admins = pgTable("admins", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id"),
	creatorId: uuid("creator_id"),
	companyId: uuid("company_id"),
	email: varchar({ length: 255 }),
	createdByName: varchar("created_by_name", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`timezone('Asia/Bangkok'::text, now())`).notNull(),
	updateByName: varchar("update_by_name", { length: 255 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	deletedByName: varchar("deleted_by_name", { length: 255 }),
	deletedAt: timestamp("deleted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "admins_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.creatorId],
			foreignColumns: [superAdmins.id],
			name: "admins_creator_id_super_admins_id_fk"
		}),
	foreignKey({
			columns: [table.companyId],
			foreignColumns: [company.id],
			name: "admins_company_id_company_id_fk"
		}).onDelete("cascade"),
]);
