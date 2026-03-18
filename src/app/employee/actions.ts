"use server";

import { db } from "@/db/db";
import { attendanceTable, leaveTable, usersTable, shiftsTable, temporaryShiftsTable, overtimeTable, departmentsTable, sitesTable } from "@/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadToDrive } from "@/lib/uploadthing-server";
import * as bcrypt from "bcryptjs";
import { validateAndGetSite, isInsideBound } from "@/lib/location-service";

/* -------------------------------------------------------------------------- */
/* ATTENDANCE ACTIONS (เข้างาน)                                             */
/* -------------------------------------------------------------------------- */

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

    // ตรวจสอบพิกัดเข้างาน (ได้ข้อมูลไซต์จริงจาก DB มาใน validatedSite)
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

    // บันทึกลง Database พร้อม Snapshot (เพิ่มการบันทึกชื่อไซต์และพิกัดจากฐานข้อมูลจริง)
    await db.insert(attendanceTable).values({
      user_id: userId,
      department_id: user.departmentId,
      site_id: validatedSite.id,
      shift_id: activeShiftId,
      temp_shift_id: activeTempShiftId,
      
      // ✅ บันทึก Snapshot ชื่อไซต์และพิกัดที่ค้นเจอจากพิกัดจริงๆ
      siteNameSnapshot: validatedSite.name,
      siteCoordinatesSnapshot: validatedSite.coordinates || "",
      
      shiftStartTimeSnapshot: activeStartTime,
      shiftEndTimeSnapshot: activeEndTime,
      departmentNameSnapshot: deptNameSnapshot,
      date: dateStr,
      checkIn: currentTimeStr,
      imageIn: uploadRes.url,
      imageInId: uploadRes.fileId,
      locationIn: location,
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
    return { success: true, siteName: validatedSite.name };
  } catch (error: any) {
    console.error("Check-in error:", error);
    const errorMessage = error.message.includes("รัศมี") ? "คุณไม่อยู่ในพื้นที่ทำงาน" : error.message;
    return { success: false, error: "บันทึกเข้างานล้มเหลว: " + errorMessage };
  }
}
/* -------------------------------------------------------------------------- */
/* CHECKOUT ACTION (การออกงาน)                                                     */
/* -------------------------------------------------------------------------- */

export async function checkOutAction(userId: string, base64Image: string, location: string) {
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
    const [originalSite] = await db.select().from(sitesTable).where(eq(sitesTable.id, currentRecord.site_id)).limit(1);
    if (!originalSite) throw new Error("ไม่พบข้อมูลไซต์งานที่ระบุไว้ตอนเข้างาน");

    const [sLat, sLon] = originalSite.coordinates.split(',').map(Number);
    const isInside = isInsideBound(lat, lon, sLat, sLon);
    const isOffsiteOut = isInside ? 0 : 1;
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

    await db.update(attendanceTable).set({
      checkOut: currentTimeStr,
      imageOut: uploadRes.url,
      imageOutId: uploadRes.fileId,
      locationOut: location,
      isEarlyExit: isEarlyExit,
      earlyExitMinutes: earlyExitMinutes,
      isOffsiteOut: isOffsiteOut,
    }).where(eq(attendanceTable.id, currentRecord.id));

    revalidatePath("/employee");
    revalidatePath("/leader");
    return { success: true, offsite: isOffsiteOut === 1, siteName: originalSite.name };
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

    let fileUrl = "no-file";
    let fileId = "no-id";

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