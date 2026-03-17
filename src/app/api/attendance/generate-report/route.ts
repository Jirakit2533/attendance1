import { db } from "@/db/db";
import { attendanceTable, usersTable, shiftsTable, sitesTable } from "@/db/schema";
import { and, eq, or, gte, lte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { employeeIds, startDate, endDate } = body;

    // 1. Validation เบื้องต้น
    if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      return NextResponse.json({ success: false, message: "กรุณาเลือกพนักงาน" }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, message: "กรุณาเลือกช่วงวันที่" }, { status: 400 });
    }

    // 2. Query ข้อมูลการลงเวลาพร้อม Join ข้อมูลที่จำเป็นสำหรับทำ Report
    const reportData = await db.select({
      id: attendanceTable.id,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      userId: attendanceTable.user_id,
      employeeName: usersTable.firstName,
      lastName: usersTable.lastName,
      siteName: sitesTable.name,
      // เพิ่มการดึงค่าจาก Snapshot เพื่อใช้เทียบ String ตามเงื่อนไขพนักงาน "ทุกไซต์" หรือพนักงานที่ไม่มี Site ID
      siteSnapName: attendanceTable.siteNameSnapshot,
      departmentSnapName: attendanceTable.departmentNameSnapshot,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      isEarlyExit: attendanceTable.isEarlyExit,
      locationIn: attendanceTable.locationIn,
      locationOut: attendanceTable.locationOut,
    })
    .from(attendanceTable)
    .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
    .leftJoin(sitesTable, eq(attendanceTable.site_id, sitesTable.id))
    .leftJoin(shiftsTable, eq(attendanceTable.shift_id, shiftsTable.id))
    .where(and(
      // กรองเฉพาะพนักงานที่เลือกมา
      inArray(attendanceTable.user_id, employeeIds),
      // กรองตามช่วงวันที่ (ใช้ gte และ lte เพื่อครอบคลุมช่วงวัน)
      gte(attendanceTable.date, startDate),
      lte(attendanceTable.date, endDate)
    ))
    .orderBy(attendanceTable.date);

    // 3. ตรวจสอบว่าพบข้อมูลหรือไม่
    if (!reportData || reportData.length === 0) {
      return NextResponse.json({ success: false, message: "ไม่พบข้อมูลการลงเวลาในช่วงวันที่เลือก" });
    }

    // 4. ส่งข้อมูลกลับไปยัง Client
    return NextResponse.json({ success: true, data: reportData });

  } catch (error) {
    console.error("API Report Error:", error);
    return NextResponse.json({ success: false, message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์" }, { status: 500 });
  }
}