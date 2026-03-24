"use server";

import { db } from "@/db/db";
import { attendanceTable, leaveTable, usersTable, shiftsTable, temporaryShiftsTable, overtimeTable, departmentsTable, sitesTable } from "@/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadToDrive } from "@/lib/uploadthing-server";
import * as bcrypt from "bcryptjs";
import { validateAndGetSite, isInsideBound, validateCheckOutLocation } from "@/lib/location-service";



export async function checkInAction(userId: string, base64Image: string, location: string) {
  try {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
    const currentTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false });

    // แปลง String location "lat, lon" เป็นตัวเลข
    const [lat, lon] = location.split(',').map(Number);

    // ดึงข้อมูล User และตรวจสอบกะงาน
    const [userData, tempShift] = await Promise.all([
      db.select({
        id: usersTable.id,
        departmentId: usersTable.departmentId,
        siteId: usersTable.site_id,
        shiftId: shiftsTable.id,
        startTime: shiftsTable.startTime,
        endTime: shiftsTable.endTime,
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

    // ตรวจสอบพิกัดเข้างาน (รองรับ Logic ใหม่ที่คืนค่า isOffsiteIn และ OffsiteCheckInConfirm)
    const validatedSite = await validateAndGetSite(lat, lon, user.departmentId, user.siteId);

    // ดึงข้อมูลชื่อแผนกสำหรับ Snapshot
    let deptNameSnapshot = "";
    if (user.departmentId) {
      const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, user.departmentId)).limit(1);
      deptNameSnapshot = dept?.name || "";
    }

    const activeStartTime = tempShift[0]?.startTime || user.startTime;
    const activeEndTime = tempShift[0]?.endTime || user.endTime;
    const activeShiftId = tempShift[0] ? null : user.shiftId;
    const activeTempShiftId = tempShift[0]?.id || null;

    // จัดการรูปภาพ
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadRes = await uploadToDrive(buffer, `checkin_${userId}_${Date.now()}.png`, "image/png");

    // บันทึกลง Database พร้อม Snapshot และ Flag การอยู่นอกเขต
    await db.insert(attendanceTable).values({
      user_id: userId,
      department_id: user.departmentId,
      site_id: validatedSite.id,
      siteInNameSnapshot: validatedSite.name, 
      siteCoordinatesSnapshot: validatedSite.coordinates, // บันทึกพิกัดไซต์อ้างอิง
      shift_id: activeShiftId,
      temp_shift_id: activeTempShiftId,

      shiftStartTimeSnapshot: activeStartTime,
      shiftEndTimeSnapshot: activeEndTime,
      departmentNameSnapshot: deptNameSnapshot,
      date: dateStr,
      checkIn: currentTimeStr,
      imageIn: uploadRes.url,
      imageInId: uploadRes.fileId,
      locationIn: location,
      
      // บันทึกสถานะการอยู่นอกเขตขาเข้า
      isOffsiteIn: validatedSite.isOffsiteIn,
      isOffsiteInCoordinates: validatedSite.userCoordinates,

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
    
    // คืนค่าเพื่อให้หน้าบ้านรู้ว่าต้องแสดง Modal ยืนยันหรือไม่ (ถ้าจำเป็น) หรือแจ้งว่าสำเร็จ
    return { 
      success: true, 
      siteName: validatedSite.name,
      isOffsiteIn: validatedSite.isOffsiteIn,
      OffsiteCheckInConfirm: validatedSite.OffsiteCheckInConfirm
    };
  } catch (error: any) {
    console.error("Check-in error:", error);
    // ไม่ดักคำว่า "รัศมี" แล้วเพราะเราอนุญาตให้เข้างานได้ทุกกรณี แต่ยังคงรักษา Error อื่นๆ ไว้
    return { success: false, error: "บันทึกเข้างานล้มเหลว: " + error.message };
  }
}

/* -------------------------------------------------------------------------- */
/* CHECKOUT ACTION (การออกงาน)                                                 */
/* -------------------------------------------------------------------------- */

export async function checkOutAction(userId: string, base64Image: string, location: string, isConfirmed?: boolean) {
  try {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false });
    const [lat, lon] = location.split(',').map(Number);

    const lastCheckIn = await db
      .select()
      .from(attendanceTable)
      .where(and(eq(attendanceTable.user_id, userId), isNull(attendanceTable.checkOut)))
      .orderBy(desc(attendanceTable.createdAt))
      .limit(1);

    if (lastCheckIn.length === 0) {
      return { success: false, error: "ไม่พบข้อมูลการเช็คอินที่ค้างอยู่" };
    }

    const currentRecord = lastCheckIn[0];

    // ดึงข้อมูลไซต์ต้นทางมาเพื่อหาชื่อไซต์ (สำหรับแสดงใน Pop-up หรือ Error)
    const [originalSite] = await db.select().from(sitesTable).where(eq(sitesTable.id, currentRecord.site_id)).limit(1);
    if (!originalSite) throw new Error("ไม่พบข้อมูลไซต์งานที่ระบุไว้ตอนเข้างาน");

    // --- ส่วนตรวจสอบพิกัดและสิทธิ์ผ่าน validateCheckOutLocation ---
    const locationValidation = await validateCheckOutLocation(userId, lat, lon, currentRecord);

    const isOffsiteOutValue = locationValidation.isOffsiteOut === "1" ? "1" : "0";
    const showPopUp = locationValidation.OffsiteCheckOutConfirm;

    // ✅ แก้ไขจุดนี้: ถ้าต้องยืนยัน เปลี่ยน success เป็น false เพื่อไม่ให้หน้าบ้าน Alert "สำเร็จ"
    if (showPopUp && !isConfirmed) {
      return {
        success: false, // เปลี่ยนเป็น false เพื่อป้องกัน Alert สำเร็จเด้งก่อนกดยืนยันจริง
        offsite: true,
        siteName: locationValidation.siteName,
        OffsiteCheckOutConfirm: true // แจ้ง UI ให้เด้ง Pop-up
      };
    }

    // ✅ แก้ไข: ดึงชื่อจาก Snapshot เดิมมาใช้โดยตรง เพื่อไม่ให้เป็นค่า true/false
    const finalSiteInNameSnapshot = currentRecord.In;

    const checkInDate = currentRecord.date;

    const [shiftData, tempShift] = await Promise.all([
      db.select({ id: shiftsTable.id, endTime: shiftsTable.endTime }).from(shiftsTable).where(eq(shiftsTable.userId, userId)).limit(1),
      db.select({ id: temporaryShiftsTable.id, endTime: temporaryShiftsTable.endTime }).from(temporaryShiftsTable).where(and(eq(temporaryShiftsTable.userId, userId), eq(temporaryShiftsTable.targetDate, checkInDate))).limit(1)
    ]);

    const activeEndTime = tempShift[0]?.endTime || shiftData[0]?.endTime;
    let isEarlyExit = 0;
    let earlyExitMinutes = 0;

    if (activeEndTime) {
      const [currH, currM] = currentTimeStr.split(':').map(Number);
      const [endH, endM] = activeEndTime.split(':').map(Number);
      let currentTotalMinutes = currH * 60 + currM;
      let endTotalMinutes = endH * 60 + endM;
      const [inH, inM] = (currentRecord.checkIn || "00:00").split(':').map(Number);
      const checkInTotalMinutes = inH * 60 + inM;

      if (endTotalMinutes < checkInTotalMinutes) {
        if (currentTotalMinutes < checkInTotalMinutes) currentTotalMinutes += 1440;
        endTotalMinutes += 1440;
      }
      if (currentTotalMinutes < endTotalMinutes) {
        isEarlyExit = 1;
        earlyExitMinutes = endTotalMinutes - currentTotalMinutes;
      }
    }

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadRes = await uploadToDrive(buffer, `checkout_${userId}_${Date.now()}.png`, "image/png");

    // บันทึกข้อมูลลง Database
    await db.update(attendanceTable).set({
      checkOut: currentTimeStr,
      imageOut: uploadRes.url,
      imageOutId: uploadRes.fileId,
      locationOut: location,
      isEarlyExit: isEarlyExit,
      earlyExitMinutes: earlyExitMinutes,
      isOffsiteOut: isOffsiteOutValue,
      isOffsiteOutCoordinates: isOffsiteOutValue === "1" ? location : null,
      In: finalSiteInNameSnapshot, // ✅ บันทึกค่า String ชื่อไซต์งานเดิมกลับลงไป
    }).where(eq(attendanceTable.id, currentRecord.id));

    revalidatePath("/employee");
    revalidatePath("/leader");

    return {
      success: true,
      offsite: isOffsiteOutValue === "1",
      siteName: finalSiteInNameSnapshot,
      OffsiteCheckOutConfirm: false
    };
  } catch (error: any) {
    console.error("Check-out error:", error);
    return { success: false, error: "บันทึกเลิกงานล้มเหลว: " + error.message };
  }
}
/* -------------------------------------------------------------------------- */
/* LEAVE ACTIONS (การลางาน)                                                   */
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
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.userId),
      columns: { departmentId: true, site_id: true },
    });

    if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

    let fileUrl = null;
    let fileId = null;

    if (data.base64File) {
      const base64Data = data.base64File.replace(/^data:.*?;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const uploadRes = await uploadToDrive(buffer, data.fileName || `leave_${data.userId}_${Date.now()}.png`, "image/png");
      fileUrl = uploadRes.url;
      fileId = uploadRes.fileId;
    }

    await db.insert(leaveTable).values({
      user_id: data.userId,
      department_id: user.departmentId,
      site_id: user.site_id,
      type: data.type,
      startDate: data.start,
      endDate: data.end,
      reason: data.reason,
      status: "pending",
      fileUrl: fileUrl,
      fileId: fileId,
      fileName: data.fileName || null,
    });

    revalidatePath("/employee");
    revalidatePath("/leader");
    return { success: true };
  } catch (error: any) {
    console.error("Leave error:", error);
    return { success: false, error: "ส่งคำขอลางานล้มเหลว: " + error.message };
  }
}

/* -------------------------------------------------------------------------- */
/* CHANGE PASSWORD (เปลี่ยนรหัสผ่าน)                                                   */
/* -------------------------------------------------------------------------- */

export async function changePasswordAction(data: {
  userId: string;
  oldPassword: string;
  newPassword: string;
}) {
  try {
    if (!data.userId || !data.oldPassword || !data.newPassword) return { success: false, error: "ข้อมูลไม่ครบถ้วน" };

    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, data.userId) });
    if (!user || !user.passwordHash) return { success: false, error: "ไม่พบข้อมูลรหัสผ่านในระบบ" };
    if (!user.passwordHash.startsWith('$')) return { success: false, error: "รหัสผ่านในระบบอยู่ในรูปแบบที่ไม่รองรับ" };

    const isMatch = await bcrypt.compare(data.oldPassword, user.passwordHash);
    if (!isMatch) return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    if (data.oldPassword === data.newPassword) return { success: false, error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };

    const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);
    await db.update(usersTable).set({ passwordHash: hashedNewPassword }).where(eq(usersTable.id, data.userId));

    revalidatePath("/employee");
    revalidatePath("/leader");
    return { success: true };
  } catch (error: any) {
    console.error("Change password critical error:", error);
    return { success: false, error: `เกิดข้อผิดพลาด: ${error.message || "ทางระบบ"}` };
  }
}