import { db } from "@/db/db";
import { attendanceTable, usersTable, shiftsTable, sitesTable, departmentsTable, positionsTable, leaveTable } from "@/db/schema";
import { and, eq, gte, lte, inArray, asc, aliasedTable } from "drizzle-orm"; // เพิ่ม aliasedTable
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      employeeIds, 
      startDate, 
      endDate, 
      format, 
      reportType 
    } = body;

    // 1. Validation เบื้องต้น
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ success: false, message: "กรุณาเลือกพนักงาน" }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: "กรุณาเลือกช่วงวันที่" }, { status: 400 });
    }

    // สร้าง Alias สำหรับตาราง Users เพื่อใช้ดึงชื่อผู้อนุมัติ
    const approverTable = aliasedTable(usersTable, "approver");

    // 2. Query ข้อมูลการลงเวลา
    const reportData = await db.select({
      id: attendanceTable.id,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      userId: attendanceTable.user_id,
      empCode: usersTable.empCode,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      currentDepartment: departmentsTable.name,
      currentPosition: positionsTable.name,
      currentSite: sitesTable.name,
      siteSnapName: attendanceTable.siteInNameSnapshot,
      departmentSnapName: attendanceTable.departmentNameSnapshot,
      shiftStartTimeSnapshot: attendanceTable.shiftStartTimeSnapshot,
      shiftEndTimeSnapshot: attendanceTable.shiftEndTimeSnapshot,
      isLate: attendanceTable.isLate,
      isEarlyExit: attendanceTable.isEarlyExit,
      remark: attendanceTable.remark,
    })
    .from(attendanceTable)
    .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
    .leftJoin(sitesTable, eq(attendanceTable.site_id, sitesTable.id))
    .leftJoin(shiftsTable, eq(attendanceTable.shift_id, shiftsTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
    .where(and(
      inArray(attendanceTable.user_id, employeeIds),
      gte(attendanceTable.date, startDate),
      lte(attendanceTable.date, endDate)
    ))
    .orderBy(asc(attendanceTable.date));

    // --- แก้ไขการดึงข้อมูลการลาเพื่อให้ได้ approvedByName ---
    const leaveDataRaw = await db.select({
      startDate: leaveTable.startDate,
      endDate: leaveTable.endDate,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      totalHours: leaveTable.totalHours,
      approvedBy: leaveTable.approvedBy,
      // ดึงชื่อจาก Alias table ที่เรา Join เข้าไป
      approvedByName: sql<string>`${approverTable.firstName} || ' ' || ${approverTable.lastName}`,
      user_id: leaveTable.user_id,
      type: leaveTable.type,
      reason: leaveTable.reason
    })
    .from(leaveTable)
    .innerJoin(usersTable, eq(leaveTable.user_id, usersTable.id))
    // Left Join ไปยัง Alias ของ usersTable เพื่อหาชื่อผู้อนุมัติ
    .leftJoin(approverTable, eq(leaveTable.approvedBy, approverTable.id))
    .where(and(
      inArray(leaveTable.user_id, employeeIds),
      eq(leaveTable.status, "approved"),
      gte(leaveTable.startDate, startDate),
      lte(leaveTable.endDate, endDate)
    ));

    // 3. ตรวจสอบว่าพบข้อมูลหรือไม่
    if ((!reportData || reportData.length === 0) && (!leaveDataRaw || leaveDataRaw.length === 0)) {
      return NextResponse.json({ 
        success: false, 
        message: "ไม่พบข้อมูลการลงเวลาหรือการลาในช่วงวันที่เลือก",
        data: [] 
      });
    }

    // 4. Transform ข้อมูล
    const finalData = reportData.map(item => {
      let statusText = "ไม่ได้ลงชื่อเข้า";
      if (item.checkIn && !item.checkOut) {
        statusText = "ไม่ได้ลงชื่อออก";
      } else if (item.checkIn && item.checkOut) {
        statusText = "สมบูรณ์";
      }
      return {
        ...item,
        fullName: `${item.firstName} ${item.lastName}`,
        statusText: statusText,
        exportFormat: format,
        generatedType: reportType
      };
    });

    const finalLeaveData = leaveDataRaw.map(leave => ({
      ...leave,
      startDate: leave.startDate,
      endDate: leave.endDate,
      fullName: `${leave.firstName} ${leave.lastName}`,
      approvedByName: leave.approvedByName || "ระบบอัตโนมัติ", // กรณีไม่มีคนอนุมัติ
      totalDays: (Number(leave.totalHours) / 8).toFixed(1),
    }));

    return NextResponse.json({ 
      success: true, 
      data: finalData, 
      leaveData: finalLeaveData 
    });

  } catch (error: any) {
    console.error("API Report Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์: " + (error.message || "") 
    }, { status: 500 });
  }
}