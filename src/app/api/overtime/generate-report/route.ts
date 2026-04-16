import { db } from "@/db/db";
import { 
  overtimeTable, 
  overtimeRequestsTable, 
  usersTable, 
  departmentsTable,
  positionsTable,
  sitesTable
} from "@/db/schema";
import { and, eq, inArray, gte, lte, asc, sql, gt } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { 
      employeeIds, 
      startDate, 
      endDate, 
      departmentId, 
      positionId, 
      siteId, 
      format, 
      reportType 
    } = body;

    // 1. Validation
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ success: false, message: "กรุณาเลือกพนักงาน" }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: "กรุณาระบุวันที่" }, { status: 400 });
    }

    // 2. Query ข้อมูล OT (ตารางสรุป)
    const otRows = await db.select({
      id: overtimeTable.id,
      date: overtimeTable.date,
      userId: overtimeTable.userId,
      userName: overtimeTable.userName,
      empCode: usersTable.empCode,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      departmentName: departmentsTable.name,
      positionName: positionsTable.name,
      siteName: sitesTable.name,
      overtimeBefore: overtimeTable.overtimeBefore,
      overtimeAfter: overtimeTable.overtimeAfter,
      overtimeApproved: overtimeTable.overtimeApproved,
      status: overtimeTable.status,
      attendanceId: overtimeTable.attendanceId,
    })
    .from(overtimeTable)
    .innerJoin(usersTable, eq(overtimeTable.userId, usersTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
    .leftJoin(sitesTable, eq(usersTable.site_id, sitesTable.id))
    .where(and(
      inArray(overtimeTable.userId, employeeIds),
      gte(overtimeTable.date, startDate),
      lte(overtimeTable.date, endDate),
      gt(overtimeTable.overtimeApproved, 0),
      eq(overtimeTable.status, 'approved') 
    ))
    .orderBy(asc(overtimeTable.userId), asc(overtimeTable.date));

    // --- DEBUG 1: เช็คข้อมูลดิบจากหน้าด่าน Database ---
    console.log("--- [DEBUG 1] OT ROWS FROM DB ---");
    console.table(otRows.map(r => ({
      name: `${r.firstName} ${r.lastName}`,
      date: r.date,
      approvedVal: r.overtimeApproved,
      status: r.status
    })));

    if (!otRows || otRows.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: [], 
        summary: { approved: 0 },
        message: "ไม่พบข้อมูลการทำงานล่วงเวลาที่ได้รับการอนุมัติ" 
      });
    }

    // 3. ดึงข้อมูล Request
    const requests = await db.select({
      userId: overtimeRequestsTable.userId,
      date: overtimeRequestsTable.date,
      reason: overtimeRequestsTable.reason,
      status: overtimeRequestsTable.status,
      approvedAt: overtimeRequestsTable.approvedAt,
      approvedByName: sql<string>`(SELECT first_name || ' ' || last_name FROM ${usersTable} WHERE id = ${overtimeRequestsTable.approvedBy})`
    })
    .from(overtimeRequestsTable)
    .where(and(
      inArray(overtimeRequestsTable.userId, employeeIds),
      gte(overtimeRequestsTable.date, startDate),
      lte(overtimeRequestsTable.date, endDate),
      eq(overtimeRequestsTable.status, 'executed') 
    ));

    // --- DEBUG 2: เช็คฝั่งคำขอ ---
    console.log("--- [DEBUG 2] REQUESTS (EXECUTED) ---");
    console.table(requests.map(req => ({
      uId: req.userId,
      d: req.date,
      stat: req.status
    })));

    const requestMap = new Map();
    requests.forEach(req => {
      requestMap.set(`${req.userId}-${req.date}`, {
        reason: req.reason,
        approvedAt: req.approvedAt,
        approvedBy: req.approvedByName || "-"
      });
    });

    // 4. ประกอบร่างข้อมูล
    const finalData = otRows
      .map(row => {
        const reqInfo = requestMap.get(`${row.userId}-${row.date}`);
        return {
          ...row,
          fullName: `${row.firstName} ${row.lastName}`,
          requestReason: reqInfo?.reason || "-",
          approvedBy: reqInfo?.approvedBy || "-",
          approvedAt: reqInfo?.approvedAt || null,
          exportFormat: format,
          generatedType: reportType
        };
      })
      .filter(row => (Number(row.overtimeApproved) || 0) > 0);

    // --- DEBUG 3: ข้อมูลที่จะส่งออกไป UI ---
    console.log("--- [DEBUG 3] FINAL DATA TO UI ---");
    console.log(JSON.stringify(finalData, null, 2));

    const totalSummary = finalData.reduce((acc, curr) => ({
      approved: acc.approved + (Number(curr.overtimeApproved) || 0)
    }), { approved: 0 });

    return NextResponse.json({ 
      success: true, 
      data: finalData, 
      summary: totalSummary 
    });

  } catch (error: any) {
    console.error("FULL_ERROR_STACK:", error.stack);
    return NextResponse.json({ 
      success: false, 
      message: error.message || "Unknown Server Error" 
    }, { status: 500 });
  }
}