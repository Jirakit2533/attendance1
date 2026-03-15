import { NextResponse } from "next/server"
import { db } from "@/db/db"
import { attendanceTable, usersTable, sitesTable, departmentsTable } from "@/db/schema"
import { and, between, eq, inArray } from "drizzle-orm"

export async function POST(req: Request) {

  const body = await req.json()

  const {
    employeeIds,
    startDate,
    endDate,
    departmentId,
    siteId
  } = body

  const conditions: any[] = []

  if (employeeIds?.length) {
    conditions.push(inArray(attendanceTable.user_id, employeeIds))
  }

  if (startDate && endDate) {
    conditions.push(between(attendanceTable.date, startDate, endDate))
  }

  if (departmentId) {
    conditions.push(eq(usersTable.departmentId, departmentId))
  }

  if (siteId && siteId !== "none") {
    conditions.push(eq(usersTable.siteId, siteId))
  }

  const data = await db
    .select({
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,

      userId: usersTable.id,
      employeeName: usersTable.firstName,

      avatarUrl: usersTable.avatarUrl,

      siteName: sitesTable.name,
      departmentName: departmentsTable.name
    })
    .from(attendanceTable)

    .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
    .leftJoin(sitesTable, eq(usersTable.siteId, sitesTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))

    .where(and(...conditions))

  return NextResponse.json(data)
}