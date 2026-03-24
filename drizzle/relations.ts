import { relations } from "drizzle-orm/relations";
import { users, leave, departments, sites, overtime, shifts, attendance, company, positions, temporaryShifts, admins, superAdmins } from "./schema";

export const leaveRelations = relations(leave, ({one}) => ({
	user_userId: one(users, {
		fields: [leave.userId],
		references: [users.id],
		relationName: "leave_userId_users_id"
	}),
	department: one(departments, {
		fields: [leave.departmentId],
		references: [departments.id]
	}),
	user_approvedById: one(users, {
		fields: [leave.approvedById],
		references: [users.id],
		relationName: "leave_approvedById_users_id"
	}),
	user_rejectedById: one(users, {
		fields: [leave.rejectedById],
		references: [users.id],
		relationName: "leave_rejectedById_users_id"
	}),
	site: one(sites, {
		fields: [leave.siteId],
		references: [sites.id]
	}),
}));

export const usersRelations = relations(users, ({one, many}) => ({
	leaves_userId: many(leave, {
		relationName: "leave_userId_users_id"
	}),
	leaves_approvedById: many(leave, {
		relationName: "leave_approvedById_users_id"
	}),
	leaves_rejectedById: many(leave, {
		relationName: "leave_rejectedById_users_id"
	}),
	overtimes_userId: many(overtime, {
		relationName: "overtime_userId_users_id"
	}),
	overtimes_approvedBy: many(overtime, {
		relationName: "overtime_approvedBy_users_id"
	}),
	departments_createdById: many(departments, {
		relationName: "departments_createdById_users_id"
	}),
	departments_updateById: many(departments, {
		relationName: "departments_updateById_users_id"
	}),
	departments_deletedById: many(departments, {
		relationName: "departments_deletedById_users_id"
	}),
	shifts: many(shifts),
	positions: many(positions, {
		relationName: "positions_createdById_users_id"
	}),
	sites_createdById: many(sites, {
		relationName: "sites_createdById_users_id"
	}),
	sites_updateById: many(sites, {
		relationName: "sites_updateById_users_id"
	}),
	company: one(company, {
		fields: [users.companyId],
		references: [company.id]
	}),
	department: one(departments, {
		fields: [users.departmentId],
		references: [departments.id],
		relationName: "users_departmentId_departments_id"
	}),
	position: one(positions, {
		fields: [users.positionId],
		references: [positions.id],
		relationName: "users_positionId_positions_id"
	}),
	user_createdById: one(users, {
		fields: [users.createdById],
		references: [users.id],
		relationName: "users_createdById_users_id"
	}),
	users_createdById: many(users, {
		relationName: "users_createdById_users_id"
	}),
	user_updateById: one(users, {
		fields: [users.updateById],
		references: [users.id],
		relationName: "users_updateById_users_id"
	}),
	users_updateById: many(users, {
		relationName: "users_updateById_users_id"
	}),
	user_deletedById: one(users, {
		fields: [users.deletedById],
		references: [users.id],
		relationName: "users_deletedById_users_id"
	}),
	users_deletedById: many(users, {
		relationName: "users_deletedById_users_id"
	}),
	site: one(sites, {
		fields: [users.siteId],
		references: [sites.id],
		relationName: "users_siteId_sites_id"
	}),
	temporaryShifts_userId: many(temporaryShifts, {
		relationName: "temporaryShifts_userId_users_id"
	}),
	temporaryShifts_createdById: many(temporaryShifts, {
		relationName: "temporaryShifts_createdById_users_id"
	}),
	attendances: many(attendance),
	admins: many(admins),
}));

export const departmentsRelations = relations(departments, ({one, many}) => ({
	leaves: many(leave),
	company: one(company, {
		fields: [departments.companyId],
		references: [company.id]
	}),
	user_createdById: one(users, {
		fields: [departments.createdById],
		references: [users.id],
		relationName: "departments_createdById_users_id"
	}),
	user_updateById: one(users, {
		fields: [departments.updateById],
		references: [users.id],
		relationName: "departments_updateById_users_id"
	}),
	user_deletedById: one(users, {
		fields: [departments.deletedById],
		references: [users.id],
		relationName: "departments_deletedById_users_id"
	}),
	sites: many(sites),
	users: many(users, {
		relationName: "users_departmentId_departments_id"
	}),
	attendances: many(attendance),
}));

export const sitesRelations = relations(sites, ({one, many}) => ({
	leaves: many(leave),
	shifts: many(shifts),
	company: one(company, {
		fields: [sites.companyId],
		references: [company.id]
	}),
	user_createdById: one(users, {
		fields: [sites.createdById],
		references: [users.id],
		relationName: "sites_createdById_users_id"
	}),
	user_updateById: one(users, {
		fields: [sites.updateById],
		references: [users.id],
		relationName: "sites_updateById_users_id"
	}),
	department: one(departments, {
		fields: [sites.departmentId],
		references: [departments.id]
	}),
	users: many(users, {
		relationName: "users_siteId_sites_id"
	}),
	temporaryShifts: many(temporaryShifts),
	attendances: many(attendance),
}));

export const overtimeRelations = relations(overtime, ({one, many}) => ({
	user_userId: one(users, {
		fields: [overtime.userId],
		references: [users.id],
		relationName: "overtime_userId_users_id"
	}),
	shift: one(shifts, {
		fields: [overtime.shiftId],
		references: [shifts.id]
	}),
	attendance: one(attendance, {
		fields: [overtime.attendanceId],
		references: [attendance.id]
	}),
	user_approvedBy: one(users, {
		fields: [overtime.approvedBy],
		references: [users.id],
		relationName: "overtime_approvedBy_users_id"
	}),
	temporaryShifts: many(temporaryShifts),
}));

export const shiftsRelations = relations(shifts, ({one, many}) => ({
	overtimes: many(overtime),
	user: one(users, {
		fields: [shifts.userId],
		references: [users.id]
	}),
	company: one(company, {
		fields: [shifts.companyId],
		references: [company.id]
	}),
	site: one(sites, {
		fields: [shifts.siteId],
		references: [sites.id]
	}),
	attendances: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({one, many}) => ({
	overtimes: many(overtime),
	user: one(users, {
		fields: [attendance.userId],
		references: [users.id]
	}),
	department: one(departments, {
		fields: [attendance.departmentId],
		references: [departments.id]
	}),
	shift: one(shifts, {
		fields: [attendance.shiftId],
		references: [shifts.id]
	}),
	temporaryShift: one(temporaryShifts, {
		fields: [attendance.tempShiftId],
		references: [temporaryShifts.id]
	}),
	site: one(sites, {
		fields: [attendance.siteId],
		references: [sites.id]
	}),
}));

export const companyRelations = relations(company, ({one, many}) => ({
	departments: many(departments),
	shifts: many(shifts),
	positions: many(positions),
	sites: many(sites),
	users: many(users),
	admin: one(admins, {
		fields: [company.adminCreatorId],
		references: [admins.id],
		relationName: "company_adminCreatorId_admins_id"
	}),
	superAdmin: one(superAdmins, {
		fields: [company.userId],
		references: [superAdmins.id]
	}),
	admins: many(admins, {
		relationName: "admins_companyId_company_id"
	}),
}));

export const positionsRelations = relations(positions, ({one, many}) => ({
	company: one(company, {
		fields: [positions.companyId],
		references: [company.id]
	}),
	user: one(users, {
		fields: [positions.createdById],
		references: [users.id],
		relationName: "positions_createdById_users_id"
	}),
	users: many(users, {
		relationName: "users_positionId_positions_id"
	}),
}));

export const temporaryShiftsRelations = relations(temporaryShifts, ({one, many}) => ({
	user_userId: one(users, {
		fields: [temporaryShifts.userId],
		references: [users.id],
		relationName: "temporaryShifts_userId_users_id"
	}),
	overtime: one(overtime, {
		fields: [temporaryShifts.overtimeId],
		references: [overtime.id]
	}),
	user_createdById: one(users, {
		fields: [temporaryShifts.createdById],
		references: [users.id],
		relationName: "temporaryShifts_createdById_users_id"
	}),
	site: one(sites, {
		fields: [temporaryShifts.siteId],
		references: [sites.id]
	}),
	attendances: many(attendance),
}));

export const adminsRelations = relations(admins, ({one, many}) => ({
	companies: many(company, {
		relationName: "company_adminCreatorId_admins_id"
	}),
	user: one(users, {
		fields: [admins.userId],
		references: [users.id]
	}),
	superAdmin: one(superAdmins, {
		fields: [admins.creatorId],
		references: [superAdmins.id]
	}),
	company: one(company, {
		fields: [admins.companyId],
		references: [company.id],
		relationName: "admins_companyId_company_id"
	}),
}));

export const superAdminsRelations = relations(superAdmins, ({many}) => ({
	companies: many(company),
	admins: many(admins),
}));