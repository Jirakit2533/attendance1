"use server";

import { db } from "@/db/db";
import { attendanceTable, leaveTable, usersTable, shiftsTable, temporaryShiftsTable, overtimeTable, departmentsTable, companyTable, overtimeRequestsTable} from "@/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadToDrive } from "@/lib/uploadthing-server";
import { validateAndGetSite, isInsideBound, validateCheckOutLocation } from "@/lib/location-service";
import { calculateOvertime } from "@/lib/over-time/ot-calculate";
import * as bcrypt from "bcryptjs";

/* -------------------------------------------------------------------------- */
/* CHECKIN ACTION (การเข้างาน)                                                 */
/* -------------------------------------------------------------------------- */
export async function checkInAction(userId: string, base64Image: string, location: string, isConfirmed?: boolean) {
  try {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false });
    
    const nowH = now.getHours();
    let lookupDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
    if (nowH >= 0 && nowH < 5) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      lookupDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(yesterday);
    }
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);

    if (!location || typeof location !== 'string' || !location.includes(',')) {
      throw new Error("พิกัดตำแหน่งไม่ถูกต้องหรือไม่ได้เปิด GPS");
    }

    const [lat, lon] = location.split(',').map(Number);
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error("ข้อมูลพิกัดไม่ใช่ตัวเลขที่ถูกต้อง");
    }

    const [userData, tempShift] = await Promise.all([
      db.select({
        id: usersTable.id,
        name: usersTable.firstName, 
        companyId: usersTable.companyId,
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
          eq(temporaryShiftsTable.targetDate, lookupDate),
          eq(temporaryShiftsTable.status, "approved")
        ))
        .limit(1)
    ]);

    const user = userData[0];
    if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

    const [companyData] = await db.select({ 
      otRoundingOption: companyTable.otRoundingOption 
    }).from(companyTable).where(eq(companyTable.id, user.companyId || "")).limit(1);
    
    const companyRounding = (companyData?.otRoundingOption as OTRoundingOption) || "ACTUAL";

    // 🚩 ตรวจสอบพิกัดด้วย Logic รัศมี 20 เมตร และประเภทพนักงาน
    const validatedSite = await validateAndGetSite(
      lat.toString(), 
      lon.toString(), 
      user.companyId || "", 
      user.siteId || ""
    );

    // ถ้าเป็นกลุ่มทุกไซต์ แต่อยู่นอกเขต และยังไม่ได้กดยืนยัน (แสดง Pop-up)
    if (validatedSite.OffsiteCheckInConfirm && !isConfirmed) {
      return { 
        success: false, 
        offsite: true, 
        siteName: validatedSite.name,
        OffsiteCheckOutConfirm: true 
      };
    }

    const finalIsOffsiteIn = validatedSite.isOffsiteIn || "0";

    let deptNameSnapshot = "";
    if (user.departmentId) {
      const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, user.departmentId)).limit(1);
      deptNameSnapshot = dept?.name || "";
    }

    const activeStartTime = tempShift[0]?.startTime || user.startTime || null;
    const activeEndTime = tempShift[0]?.endTime || user.endTime || null;
    const activeShiftId = tempShift[0] ? null : user.shiftId;
    const activeTempShiftId = tempShift[0]?.id || null;

    const toMin = (t: string | null) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h * 60) + (m || 0);
    };

    let currentWorkingStatus: "normal" | "extra" = "normal";
    if (activeEndTime && activeStartTime) {
      const nowMin = toMin(currentTimeStr);
      let endMin = toMin(activeEndTime);
      let startMin = toMin(activeStartTime);
      if (endMin < startMin) endMin += 1440;
      const adjustedNowMin = (nowMin < startMin && endMin > 1440) ? nowMin + 1440 : nowMin;
      if (adjustedNowMin > endMin) currentWorkingStatus = "extra";
    }

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadRes = await uploadToDrive(buffer, `checkin_${userId}_${Date.now()}.png`, "image/png");

    const [insertedAttendance] = await db.insert(attendanceTable).values({
      user_id: userId,
      department_id: user.departmentId,
      site_id: validatedSite.id,
      siteInNameSnapshot: validatedSite.name || "", 
      siteCoordinatesSnapshot: validatedSite.coordinates || "", 
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
      isOffsiteIn: finalIsOffsiteIn,
      isOffsiteInCoordinates: finalIsOffsiteIn === "1" ? location : null,
      workingStatusEnum: currentWorkingStatus,
      isLate: currentWorkingStatus === "normal" && activeStartTime ? (toMin(currentTimeStr) > toMin(activeStartTime) ? 1 : 0) : 0,
      lateMinutes: currentWorkingStatus === "normal" && activeStartTime ? (() => {
        let nowM = toMin(currentTimeStr);
        let startM = toMin(activeStartTime);
        if (nowM < 300 && startM > 1000) nowM += 1440; 
        const diff = nowM - startM;
        return diff > 0 ? diff : 0;
      })() : 0,
    }).returning({ id: attendanceTable.id });

    if (insertedAttendance) {
      const otResult = calculateOvertime({
        checkIn: currentTimeStr,
        checkOut: currentTimeStr, 
        shiftStart: activeStartTime,
        shiftEnd: activeEndTime,
        roundingMode: companyRounding,
      });

      await db.insert(overtimeTable).values({
        userId: userId,
        userName: user.name || "Unknown",
        companyId: user.companyId || "",
        shiftId: activeShiftId,
        attendanceId: insertedAttendance.id,
        date: dateStr,
        overtimeBefore: otResult.beforeMinutes,
        otRoundingOption: companyRounding,
        status: "pending"
      });
    }

    revalidatePath("/employee");
    revalidatePath("/leader");
    
    return { 
      success: true, 
      siteName: validatedSite.name,
      isOffsiteIn: finalIsOffsiteIn
    };
  } catch (error: any) {
    console.error("Check-in error:", error);
    return { success: false, error: error.message };
  }
}

/* -------------------------------------------------------------------------- */
/* CHECKOUT ACTION (การออกงาน)                                                 */
/* -------------------------------------------------------------------------- */
export async function checkOutAction(userId: string, base64Image: string, location: string, isConfirmed?: boolean) {
  try {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour12: false });

    if (!location || typeof location !== 'string' || !location.includes(',')) {
      throw new Error("พิกัดตำแหน่งไม่ถูกต้องหรือไม่ได้เปิด GPS");
    }

    const [lat, lon] = location.split(',').map(Number);

    const lastCheckIn = await db
      .select({
        attendance: attendanceTable,
        userName: usersTable.firstName, 
        companyId: usersTable.companyId,
      })
      .from(attendanceTable)
      .leftJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
      .where(and(eq(attendanceTable.user_id, userId), isNull(attendanceTable.checkOut)))
      .orderBy(desc(attendanceTable.createdAt))
      .limit(1);

    if (!lastCheckIn || lastCheckIn.length === 0) {
      return { success: false, error: "ไม่พบข้อมูลการเช็คอินที่ค้างอยู่" };
    }

    const row = lastCheckIn[0];
    const currentRecord = row.attendance;
    if (!currentRecord) throw new Error("ข้อมูลการลงเวลาไม่ถูกต้อง");

    const [companyData] = await db.select({ 
      otRoundingOption: companyTable.otRoundingOption 
    }).from(companyTable).where(eq(companyTable.id, row.companyId || "")).limit(1);
    
    const roundingMode = (companyData?.otRoundingOption as OTRoundingOption) || "ACTUAL";
    const userName = row.userName || "Unknown";
    const companyId = row.companyId || "";

    // 🚩 ตรวจสอบพิกัดขาออก (ห้ามประจำไซต์เช็คเอาท์นอกพื้นที่)
    const locationValidation = await validateCheckOutLocation(userId, lat, lon, currentRecord);
    const isOffsiteOutValue = locationValidation.isOffsiteOut === "1" ? "1" : "0";

    if (locationValidation.OffsiteCheckOutConfirm && !isConfirmed) {
      return {
        success: false,
        offsite: true,
        siteName: locationValidation.siteOutName,
        OffsiteCheckOutConfirm: true 
      };
    }

    const checkInDate = currentRecord.date;
    const activeStartTime = currentRecord.shiftStartTimeSnapshot;
    const activeEndTime = currentRecord.shiftEndTimeSnapshot;

    let otResult;
    if (currentRecord.workingStatusEnum === "extra") {
      otResult = calculateOvertime({
        checkIn: currentRecord.checkIn || "00:00",
        checkOut: currentTimeStr,
        shiftStart: currentRecord.checkIn, 
        shiftEnd: currentRecord.checkIn,
        roundingMode: roundingMode,
      });
    } else {
      otResult = calculateOvertime({
        checkIn: currentRecord.checkIn || "00:00",
        checkOut: currentTimeStr,
        shiftStart: activeStartTime,
        shiftEnd: activeEndTime,
        roundingMode: roundingMode,
      });
    }

    let isEarlyExit = 0;
    let earlyExitMinutes = 0;

    if (activeEndTime && currentRecord.workingStatusEnum !== "extra") {
      const [currH, currM] = currentTimeStr.split(':').map(Number);
      const [endH, endM] = (activeEndTime || "00:00").split(':').map(Number);
      const [inH, inM] = (currentRecord.checkIn || "00:00").split(':').map(Number);
      
      let currentTotalMinutes = currH * 60 + currM;
      let endTotalMinutes = endH * 60 + endM;
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
      imageOut: uploadRes.ufsUrl || uploadRes.url,
      imageOutId: uploadRes.fileId,
      locationOut: location,
      isEarlyExit: isEarlyExit.toString(),
      earlyExitMinutes: earlyExitMinutes,
      isOffsiteOut: isOffsiteOutValue,
      isOffsiteOutCoordinates: isOffsiteOutValue === "1" ? location : null,
    }).where(eq(attendanceTable.id, currentRecord.id));

    if (checkInDate) {
      await db.insert(overtimeTable).values({
        userId: userId,
        userName: userName,
        companyId: companyId,
        shiftId: currentRecord.shift_id || null,
        attendanceId: currentRecord.id,
        date: checkInDate,
        overtimeBefore: otResult.beforeMinutes,
        overtimeAfter: otResult.afterMinutes,
        overtimeCollected: otResult.totalMinutes,
        otRoundingOption: roundingMode,
        status: "pending"
      }).onConflictDoUpdate({
        target: [overtimeTable.attendanceId],
        set: { 
          overtimeBefore: otResult.beforeMinutes,
          overtimeAfter: otResult.afterMinutes,
          overtimeCollected: otResult.totalMinutes,
          otRoundingOption: roundingMode
        }
      });
    }

    revalidatePath("/employee");
    revalidatePath("/leader");

    return {
      success: true,
      offsite: isOffsiteOutValue === "1",
      siteName: locationValidation.siteOutName || currentRecord.siteInNameSnapshot || "",
      otTotal: otResult.totalMinutes 
    };
  } catch (error: any) {
    console.error("Check-out error:", error);
    return { success: false, error: error.message };
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
/* CHANGE PASSWORD (เปลี่ยนรหัสผ่าน)                                            */
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

/* -------------------------------------------------------------------------- */
/* PERSONAL OT ACTIONS (OT ส่วนตัว)                                               */
/* -------------------------------------------------------------------------- */

export async function createPersonalOTAction(payload: {
  userId: string;
  userName: string;
  date: string;       // วันที่พนักงานขอทำ OT
  startTime: string;  // "18:00"
  endTime: string;    // "20:00"
  reason: string;
}) {
  try {
    // ตรวจสอบเบื้องต้นว่ามี userId ส่งมาหรือไม่
    if (!payload.userId) {
      throw new Error("ไม่พบรหัสพนักงาน (Missing User ID)");
    }

    // 1. ดึงข้อมูลพนักงานจาก usersTable (ตาม Schema ของคุณ)
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, payload.userId),
      columns: { 
        id: true,
        firstName: true,
        lastName: true,
        companyId: true, 
        departmentId: true, 
        site_id: true, 
      },
    });

    // หาก Query แล้วได้ค่าว่าง (user เป็น undefined)
    if (!user) {
      throw new Error(`ไม่พบข้อมูลพนักงานในระบบ (ID: ${payload.userId})`);
    }

    // 2. ดึงข้อมูล shiftId ล่าสุดจาก shiftsTable เนื่องจากใน usersTable ไม่มีฟิลด์นี้
    const latestShift = await db.query.shiftsTable.findFirst({
      where: eq(shiftsTable.userId, user.id),
      orderBy: (shifts, { desc }) => [desc(shifts.createdAt)],
    });

    // 3. คำนวณชั่วโมงเป็นนาที (Integer) ตามที่ DB ต้องการ (overtimeByRequest)
    const [startH, startM] = payload.startTime.split(":").map(Number);
    const [endH, endM] = payload.endTime.split(":").map(Number);
    
    const startDate = new Date(0, 0, 0, startH, startM);
    const endDate = new Date(0, 0, 0, endH, endM);
    
    let diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // กรณีทำข้ามคืน
    
    const totalMinutes = Math.round(diffMs / (1000 * 60));

    // 4. บันทึกลงตาราง overtime_requests ตาม Schema เป๊ะๆ (ห้ามลบ/ห้ามลด)
    const newRequest = await db.insert(overtimeRequestsTable).values({
      // id: UUID จะ defaultRandom() เองตาม Schema
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      
      // บันทึก IDs สังกัดที่ดึงมาจาก DB (ต้องตรงกับ Foreign Key Constraints)
      companyId: user.companyId,
      departmentId: user.departmentId,
      siteId: user.site_id, // ใช้ค่าจาก site_id ของ usersTable
      shiftId: latestShift?.id || null, // ใช้ id จาก shiftsTable (ถ้าไม่มีจะเป็น null)
      
      // ฟิลด์บังคับใน Schema (Update ใหม่)
      overtimeByRequest: totalMinutes, 
      timeStart: payload.startTime, // ✨ บันทึกเข้า timeStart (notNull)
      timeEnd: payload.endTime,     // ✨ บันทึกเข้า timeEnd (notNull)
      date: payload.date,           // ✨ บันทึกเข้า date (notNull)
      
      // บันทึกเป็น JSONB Array ตาม Schema ($type<string[]>)
      requestedWorkers: [user.id], 
      
      // รายละเอียดเพิ่มเติม (ปรับให้เหลือแค่เหตุผล เพราะมีฟิลด์เวลาแยกแล้ว)
      remarks: payload.reason, 
      
      // สถานะเริ่มต้นตาม Enum ใน Schema
      status: "pending",
      
      // ร่องรอยการสร้าง
      createdBy: user.id,
      createdAt: new Date(), // จะถูกเขียนทับด้วย timezone('UTC', now()) ใน DB
    }).returning();

    // 5. Update Cache เพื่อให้หน้าประวัติโชว์ข้อมูลใหม่ทันที
    revalidatePath("/dashboard/ot-status");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return { 
      success: true, 
      message: "ส่งคำขอ OT รายบุคคลเรียบร้อยแล้ว", 
      data: newRequest[0] 
    };

  } catch (error: any) {
    console.error("PERSONAL_OT_ERROR_DETAIL:", error);
    // ส่งข้อความ Error ที่ละเอียดขึ้นเพื่อให้แก้ไขได้ตรงจุด
    return { 
      success: false, 
      error: "ส่งคำขอ OT ล้มเหลว: " + (error.message || "Database Constraint Error")
    };
  }
}