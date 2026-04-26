import { db } from "@/db/db";
import { 
  overtimeRequestsTable, 
  overtimeTable,
  usersTable, 
  departmentsTable, 
  positionsTable, 
  sitesTable 
} from "@/db/schema";
import { and, eq, gte, lte, inArray, asc, aliasedTable, isNull, gt } from "drizzle-orm"; 
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

    // 1. Validation 
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ success: false, message: "กรุณาเลือกพนักงาน" }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: "กรุณาเลือกช่วงวันที่" }, { status: 400 });
    }

    // สร้าง Alias สำหรับตาราง Users เพื่อดึงชื่อผู้อนุมัติ
    const approverTable = aliasedTable(usersTable, "approver");

    // 2. Query ข้อมูล
    const otData = await db.select({
      id: overtimeRequestsTable.id,
      date: overtimeRequestsTable.date,
      timeStart: overtimeRequestsTable.timeStart,
      timeEnd: overtimeRequestsTable.timeEnd,
      userId: overtimeRequestsTable.userId,
      empCode: usersTable.empCode,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      departmentName: departmentsTable.name,
      positionName: positionsTable.name,
      siteName: sitesTable.name,
      // ข้อมูล OT จาก Request
      overtimeByRequest: overtimeRequestsTable.overtimeByRequest, 
      status: overtimeRequestsTable.status,
      reason: overtimeRequestsTable.reason,
      remarks: overtimeRequestsTable.remarks,
      // ข้อมูล OT ที่อนุมัติจริงจาก overtimeTable
      otHours: overtimeTable.overtimeApproved,
      otStatus: overtimeTable.status,
      // ข้อมูลผู้อนุมัติ
      approvedBy: overtimeRequestsTable.approvedBy, 
      approvedByName: sql<string>`${approverTable.firstName} || ' ' || ${approverTable.lastName}`,
    })
    .from(overtimeRequestsTable)
    .innerJoin(usersTable, eq(overtimeRequestsTable.userId, usersTable.id))
    // Join กับ overtimeTable เพื่อเอาจำนวนชั่วโมงที่ Approve จริง
    .innerJoin(overtimeTable, and(
      eq(overtimeRequestsTable.userId, overtimeTable.userId),
      eq(overtimeRequestsTable.date, overtimeTable.date)
    ))
    .leftJoin(sitesTable, eq(overtimeRequestsTable.siteId, sitesTable.id))
    .leftJoin(departmentsTable, eq(overtimeRequestsTable.departmentId, departmentsTable.id))
    .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))
    .leftJoin(approverTable, eq(overtimeRequestsTable.approvedBy, approverTable.id))
    .where(and(
      inArray(overtimeRequestsTable.userId, employeeIds),
      gte(overtimeRequestsTable.date, startDate),
      lte(overtimeRequestsTable.date, endDate),
      // เงื่อนไขสำคัญตามที่คุณสั่ง
      eq(overtimeRequestsTable.status, "executed"), // Request ต้อง Execute แล้ว
      eq(overtimeTable.status, "approved"),       // ในตารางหลักต้อง Approved
      gt(overtimeTable.overtimeApproved, 0),      // ต้องมีชั่วโมงที่อนุมัติมากกว่า 0
      isNull(overtimeRequestsTable.deletedAt)
    ))
    .orderBy(asc(overtimeRequestsTable.date));

    // 3. ตรวจสอบข้อมูล
    if (!otData || otData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "ไม่พบข้อมูลการทำ OT ที่อนุมัติแล้วในช่วงวันที่เลือก",
        data: [] 
      });
    }

    // 4. Transform ข้อมูล
    const finalData = otData.map(item => ({
      ...item,
      userName: `${item.firstName} ${item.lastName}`,
      approvedByName: item.approvedByName?.trim() || "System Admin",
      exportFormat: format,
      generatedType: reportType || "overtime"
    }));

    return NextResponse.json({ 
      success: true, 
      data: finalData 
    });

  } catch (error: any) {
    console.error("API OT Report Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Server Error: " + (error.message || "Unknown error") 
    }, { status: 500 });
  }
}