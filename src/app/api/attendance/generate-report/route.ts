import { db } from "@/db/db";
import { attendanceTable, usersTable, shiftsTable, sitesTable, departmentsTable, positionsTable } from "@/db/schema";
import { and, eq, gte, lte, inArray, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
      empCode: usersTable.empCode, // เพิ่มรหัสพนักงาน
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      // ดึงข้อมูล Master ปัจจุบัน (สำหรับหัวรายงาน)
      currentDepartment: departmentsTable.name,
      currentPosition: positionsTable.name,
      currentSite: sitesTable.name,
      // ข้อมูล Snapshot (สำหรับข้อมูลในตารางที่แม่นยำตามวันนั้นๆ)
      siteSnapName: attendanceTable.siteInNameSnapshot,
      departmentSnapName: attendanceTable.departmentNameSnapshot,
      shiftStartTimeSnapshot: attendanceTable.shiftStartTimeSnapshot,
      shiftEndTimeSnapshot: attendanceTable.shiftEndTimeSnapshot,
      // ข้อมูล Shift เดิม (ถ้ามี)
      startTime: shiftsTable.startTime,
      endTime: shiftsTable.endTime,
      isLate: attendanceTable.isLate,
      isEarlyExit: attendanceTable.isEarlyExit,
      locationIn: attendanceTable.locationIn,
      locationOut: attendanceTable.locationOut,
      remark: attendanceTable.remark,
    })
    .from(attendanceTable)
    .innerJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
    .leftJoin(sitesTable, eq(attendanceTable.site_id, sitesTable.id))
    .leftJoin(shiftsTable, eq(attendanceTable.shift_id, shiftsTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id)) // Join เพิ่มเพื่อเอาชื่อแผนก
    .leftJoin(positionsTable, eq(usersTable.positionId, positionsTable.id))    // Join เพิ่มเพื่อเอาชื่อตำแหน่ง
    .where(and(
      inArray(attendanceTable.user_id, employeeIds),
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

    // 4. ปรับโครงสร้างข้อมูล (Transform) เพื่อให้ UI ใช้งานง่ายขึ้น
    const finalData = reportData.map(item => {
      // ✅ Logic สถานะ: ถ้ามีเข้าแต่ไม่มีออก = ไม่ได้ลงชื่อออก, ถ้ามีครบ = สมบูรณ์
      let statusText = "ไม่ได้ลงชื่อเข้า"; // Default (กรณีข้อมูลผิดพลาด)
      if (item.checkIn && !item.checkOut) {
        statusText = "ไม่ได้ลงชื่อออก";
      } else if (item.checkIn && item.checkOut) {
        statusText = "สมบูรณ์";
      }

      return {
        ...item,
        fullName: `${item.employeeName} ${item.lastName}`,
        statusText: statusText, // ส่งสถานะที่คำนวณแล้วไปให้ UI เลย
        exportFormat: format,
        generatedType: reportType
      };
    });

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