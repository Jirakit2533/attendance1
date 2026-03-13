"use server";

import { db } from "@/db/db";
import { attendanceTable, leaveTable, usersTable, shiftsTable, temporaryShiftsTable, overtimeTable } from "@/db/schema"; // ✅ เพิ่ม usersTable
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadToDrive } from "@/lib/uploadthing-server"; 
import * as bcrypt from "bcryptjs";

/* -------------------------------------------------------------------------- */
/* ATTENDANCE ACTIONS (เข้า/ออกงาน)                                             */
/* -------------------------------------------------------------------------- */

export async function checkInAction(userId: string, base64Image: string, location: string) {
  try {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
    // ✅ 1. จัดรูปแบบเวลาจากเครื่องให้เป็น "HH:mm:ss" เหมือนฝั่ง Check-out
    const currentTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false });

    // ดึงข้อมูล User และตรวจสอบกะงาน
    const [userData, tempShift] = await Promise.all([
      db.select({
        departmentId: usersTable.departmentId,
        siteId: usersTable.site_id,
        shiftId: shiftsTable.id,
        startTime: shiftsTable.startTime,
      })
      .from(usersTable)
      .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId))
      .where(eq(usersTable.id, userId))
      .limit(1),

      db.select()
      .from(temporaryShiftsTable)
      .where(and(
        eq(temporaryShiftsTable.userId, userId),
        eq(temporaryShiftsTable.targetDate, dateStr),
        eq(temporaryShiftsTable.status, "approved")
      ))
      .limit(1)
    ]);

    const user = userData[0];
    if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

    const activeStartTime = tempShift[0]?.startTime || user.startTime;
    const activeShiftId = tempShift[0] ? null : user.shiftId;
    const activeTempShiftId = tempShift[0]?.id || null;

    // 2. จัดการรูปภาพ
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadRes = await uploadToDrive(buffer, `checkin_${userId}_${Date.now()}.png`, "image/png");

    // 3. บันทึกลง Database (เปลี่ยนจาก sql timezone เป็น currentTimeStr ที่จัดรูปแบบแล้ว)
    await db.insert(attendanceTable).values({
      user_id: userId,
      department_id: user.departmentId, 
      site_id: user.siteId,           
      shift_id: activeShiftId,
      temp_shift_id: activeTempShiftId,
      date: dateStr,
      checkIn: currentTimeStr, // ✅ ใช้ตัวแปรที่จัดรูปแบบ "HH:mm:ss" แล้ว
      imageIn: uploadRes.url, 
      imageInId: uploadRes.fileId,
      locationIn: location,
      // คำนวณสายโดยใช้ currentTimeStr เทียบกับ activeStartTime
      isLate: activeStartTime ? (currentTimeStr > activeStartTime ? 1 : 0) : 0,
      lateMinutes: activeStartTime ? (() => {
          const [currH, currM] = currentTimeStr.split(':').map(Number);
          const [startH, startM] = activeStartTime.split(':').map(Number);
          const diff = (currH * 60 + currM) - (startH * 60 + startM);
          return diff > 0 ? diff : 0;
      })() : 0,
    });

    revalidatePath("/employee");
    revalidatePath("/leader");
    return { success: true };
  } catch (error: any) {
    console.error("Check-in error:", error);
    return { success: false, error: "บันทึกเข้างานล้มเหลว: " + error.message };
  }
}
export async function checkOutAction(userId: string, base64Image: string, location: string) {
  try {
    const now = new Date();
    // 1. เตรียมรูปแบบเวลาและวันที่ (Asia/Bangkok)
    const currentTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false }); // รูปแบบ "HH:mm:ss"

    // --- ส่วนที่ปรับปรุง: ค้นหา Record ล่าสุดที่ยังไม่ได้ Check-out เพื่อรองรับกะข้ามคืน ---
    const lastCheckIn = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.user_id, userId),
          isNull(attendanceTable.checkOut)
        )
      )
      .orderBy(desc(attendanceTable.createdAt))
      .limit(1);

    if (lastCheckIn.length === 0) {
      return { success: false, error: "ไม่พบข้อมูลการเช็คอินที่ค้างอยู่" };
    }

    const currentRecord = lastCheckIn[0];
    const checkInDate = currentRecord.date; // ใช้วันที่ที่เช็คอินจริงมาดึงข้อมูลกะงาน

    // 2. ดึงข้อมูลกะงาน (endTime) โดยอ้างอิงจากวันที่เช็คอิน
    const [shiftData, tempShift] = await Promise.all([
      db.select({ id: shiftsTable.id, endTime: shiftsTable.endTime }).from(shiftsTable).where(eq(shiftsTable.userId, userId)).limit(1),
      db.select({ id: temporaryShiftsTable.id, endTime: temporaryShiftsTable.endTime }).from(temporaryShiftsTable).where(and(eq(temporaryShiftsTable.userId, userId), eq(temporaryShiftsTable.targetDate, checkInDate))).limit(1)
    ]);

    // กำหนดเวลาเลิกงานจริง
    const activeEndTime = tempShift[0]?.endTime || shiftData[0]?.endTime;

    // 3. คำนวณสถานะการออก (0 = ปกติ, 1 = ออกก่อน)
    let isEarlyExit = 0; // Default ปกติ เป็น 0
    let earlyExitMinutes = 0;

    if (activeEndTime) {
      // แปลงเวลา "HH:mm:ss" เป็นนาทีรวมเพื่อเปรียบเทียบ
      const [currH, currM] = currentTimeStr.split(':').map(Number);
      const [endH, endM] = activeEndTime.split(':').map(Number);
      
      let currentTotalMinutes = currH * 60 + currM;
      let endTotalMinutes = endH * 60 + endM;

      // --- โลจิกแก้ไขสำหรับกะกลางคืน ---
      // ดึงเวลาเช็คอินมาเปรียบเทียบ (ถ้าไม่มีให้ถือว่าเป็น 0)
      const [inH, inM] = (currentRecord.checkIn || "00:00").split(':').map(Number);
      const checkInTotalMinutes = inH * 60 + inM;

      // ถ้าเวลาเลิกงาน (endTime) น้อยกว่าเวลาเข้างาน (checkIn) แสดงว่าเป็นกะข้ามคืน
      // และถ้าเวลาปัจจุบัน (ตอนเช้า) น้อยกว่าเวลาเข้างาน (เมื่อคืน) ให้บวก 1440 นาที (24 ชม.) เข้าไปเพื่อให้เปรียบเทียบได้
      if (endTotalMinutes < checkInTotalMinutes) {
        if (currentTotalMinutes < checkInTotalMinutes) {
          currentTotalMinutes += 1440;
        }
        endTotalMinutes += 1440;
      }
      // -----------------------------

      // ตรวจสอบเปรียบเทียบเวลากับข้อมูลเอ็นไทม์
      if (currentTotalMinutes < endTotalMinutes) {
        isEarlyExit = 1; // ออกก่อนเวลา บันทึกเป็นเลข 1
        earlyExitMinutes = endTotalMinutes - currentTotalMinutes;
      }
    }

    // 4. จัดการรูปภาพ
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadRes = await uploadToDrive(buffer, `checkout_${userId}_${Date.now()}.png`, "image/png");

    // 5. อัปเดตตาราง Attendance โดยใช้ ID ของ Record ที่เจอ
    const result = await db
      .update(attendanceTable)
      .set({
        checkOut: currentTimeStr, // บันทึกเวลาที่ดึงมาจากเครื่อง
        imageOut: uploadRes.url, 
        imageOutId: uploadRes.fileId,
        locationOut: location,
        isEarlyExit: isEarlyExit,
        earlyExitMinutes: earlyExitMinutes,
      })
      .where(eq(attendanceTable.id, currentRecord.id)) // เปลี่ยนมาใช้ ID แทนวันที่เพื่อให้แม่นยำและรองรับกะข้ามคืน
      .returning({ id: attendanceTable.id });

    revalidatePath("/employee");
    revalidatePath("/leader");
    
    return { success: true };

  } catch (error: any) {
    console.error("Check-out error:", error);
    return { success: false, error: "บันทึกเลิกงานล้มเหลว" };
  }
}
/* -------------------------------------------------------------------------- */
/* LEAVE ACTIONS (การลางาน)                                                  */
/* -------------------------------------------------------------------------- */

export async function createLeaveRequest(data: {
  userId: string;
  type: string;
  start: string;
  end: string;
  reason: string;
  base64File?: string; 
  fileName?: string;   
}) {
  try {
    // 1. ดึงข้อมูลแผนกและไซต์ของ User
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.userId),
      columns: {
        departmentId: true,
        site_id: true,
      },
    });

    if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

    let fileUrl = "no-file";
    let fileId = "no-id";

    if (data.base64File) {
      const base64Data = data.base64File.replace(/^data:.*?;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      
      const uploadRes = await uploadToDrive(
        buffer, 
        data.fileName || `leave_${data.userId}_${Date.now()}.png`, 
        "image/png"
      );
      
      fileUrl = uploadRes.url;
      fileId = uploadRes.fileId;
    }

    // 2. บันทึกลง Database พร้อม department_id และ site_id
    await db.insert(leaveTable).values({
      user_id: data.userId,
      department_id: user.departmentId, // ✅ เพิ่มการบันทึกแผนก
      site_id: user.site_id,           // ✅ เพิ่มการบันทึกไซต์
      type: data.type,
      startDate: data.start,
      endDate: data.end,
      reason: data.reason,
      status: "pending",
      fileUrl: fileUrl,  
      fileId: fileId,    
      fileName: data.fileName || "leave_document",
    });

    revalidatePath("/employee");
    revalidatePath("/leader");
    return { success: true };
  } catch (error: any) {
    console.error("Leave error:", error);
    return { success: false, error: "ส่งคำขอลางานล้มเหลว: " + error.message };
  }
}

export async function changePasswordAction(data: {
  userId: string;
  oldPassword: string;
  newPassword: string;
}) {
  try {
    // 1. ตรวจสอบข้อมูลนำเข้าเบื้องต้น
    if (!data.userId || !data.oldPassword || !data.newPassword) {
      return { success: false, error: "ข้อมูลไม่ครบถ้วน" };
    }

    // 2. ดึงข้อมูล User จาก Database
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.userId),
    });

    // ตรวจสอบจาก log ที่คุณส่งมา ต้องใช้ user.passwordHash
    if (!user || !user.passwordHash) {
      return { success: false, error: "ไม่พบข้อมูลรหัสผ่านในระบบ" };
    }

    // 3. ตรวจสอบรูปแบบรหัสผ่านใน DB (ต้องเป็น Bcrypt Hash ที่ขึ้นต้นด้วย $)
    if (!user.passwordHash.startsWith('$')) {
      return { success: false, error: "รหัสผ่านในระบบอยู่ในรูปแบบที่ไม่รองรับ" };
    }

    // 4. ตรวจสอบรหัสผ่านปัจจุบัน (เปรียบเทียบกับ passwordHash)
    const isMatch = await bcrypt.compare(data.oldPassword, user.passwordHash);
    
    if (!isMatch) {
      return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }

    // 5. ตรวจสอบว่ารหัสใหม่ต้องไม่ซ้ำกับรหัสเดิม
    if (data.oldPassword === data.newPassword) {
      return { success: false, error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };
    }

    // 6. เข้ารหัสรหัสผ่านใหม่ (Hashing)
    const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);

    // 7. อัปเดตข้อมูลลง Database (ใช้ชื่อคอลัมน์ passwordHash ให้ตรงกับ DB)
    await db.update(usersTable)
      .set({ passwordHash: hashedNewPassword })
      .where(eq(usersTable.id, data.userId));

    // 8. ล้าง Cache หน้าเว็บเพื่อให้ข้อมูลเป็นปัจจุบัน
    revalidatePath("/employee");
    revalidatePath("/leader");

    return { success: true };

  } catch (error: any) {
    console.error("Change password critical error:", error);
    return { success: false, error: `เกิดข้อผิดพลาด: ${error.message || "ทางระบบ"}` };
  }
}