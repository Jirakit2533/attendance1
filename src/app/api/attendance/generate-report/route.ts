import { db } from "@/db/db";
import { attendanceTable, usersTable, shiftsTable, sitesTable } from "@/db/schema";
import { and, eq, or, gte, lte, inArray, asc } from "drizzle-orm";
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
      // ✅ แก้ไข: อ้างอิงชื่อให้ตรงตาม Schema (siteInNameSnapshot)
      siteSnapName: attendanceTable.siteInNameSnapshot,
      departmentSnapName: attendanceTable.departmentNameSnapshot,
      // ✅ เพิ่มเติม: ดึงเวลาจาก Snapshot เพื่อใช้คำนวณสายใน Report ให้แม่นยำ
      shiftStartTimeSnapshot: attendanceTable.shiftStartTimeSnapshot,
      shiftEndTimeSnapshot: attendanceTable.shiftEndTimeSnapshot,
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      // ✅ เพิ่มเติม: ดึงสถานะจาก DB ตรงๆ
      isLate: attendanceTable.isLate,
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
      // กรองตามช่วงวันที่
      gte(attendanceTable.date, startDate),
      lte(attendanceTable.date, endDate)
    ))
    .orderBy(asc(attendanceTable.date));

    // 3. ตรวจสอบว่าพบข้อมูลหรือไม่
    if (!reportData || reportData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "ไม่พบข้อมูลการลงเวลาในช่วงวันที่เลือก",
        data: [] 
      });
    }

    // 4. ปรับโครงสร้างข้อมูลเล็กน้อยก่อนส่งกลับ (เพื่อความสะดวกของ Client)
    const finalData = reportData.map(item => ({
      ...item,
      fullName: `${item.employeeName} ${item.lastName}`,
    }));

    // ส่งข้อมูลกลับไปยัง Client
    return NextResponse.json({ success: true, data: finalData });

  } catch (error: any) {
    console.error("API Report Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์: " + (error.message || "") 
    }, { status: 500 });
  }
}