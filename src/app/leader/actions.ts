"use server";

import { db } from "@/db/db";
import { leaveTable, attendanceTable, usersTable, shiftsTable, overtimeTable, departmentsTable, temporaryShiftsTable, companyTable, overtimeRequestsTable, companyFeatureSelectedTable } from "@/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm"; // เพิ่ม isNull, desc
import { revalidatePath } from "next/cache";
import { validateAndGetSite, validateCheckOutLocation } from "@/lib/location-service";
import { calculateOvertime } from "@/features/over-time/ot-calculate";
import { getCurrentUser } from "@/lib/auth";
import { FeatureService } from "@/features/feature-service";
import bcrypt from "bcryptjs";


/**------------------------------------------------------------------
 * 1. [REFACTORED FOR LEADER] บันทึกเวลาเข้า-ออก (Check-in / Check-out) 
 * ปรับปรุงระบบคิวรีแบบ Join, ดึง Feature ตรวจสอบ Remark, และแก้ไขบั๊ก Object.entries ของ Drizzle
 --------------------------------------------------------------------*/
 export async function saveAttendanceAction(data: {
  userId: string;
  type: "IN" | "OUT";
  image: string; // รับเป็น base64 หรือ URL ตามหน้าบ้านเดิมของ Leader
  fileId?: string;
  location: string;
  departmentId: string;
  siteId: string | null;
  isConfirmed?: boolean;
  remark?: string; 
}) {
  try {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour12: false
    });

    if (!data.location || typeof data.location !== 'string' || !data.location.includes(',')) {
      throw new Error("พิกัดตำแหน่งไม่ถูกต้องหรือไม่ได้เปิด GPS");
    }

    const [lat, lon] = data.location.split(',').map(Number);
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error("ข้อมูลพิกัดไม่ใช่ตัวเลขที่ถูกต้อง");
    }

    const nowH = now.getHours();
    let lookupDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
    if (data.type === "IN" && nowH >= 0 && nowH < 5) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      lookupDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(yesterday);
    }
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);

    // 🚩 เปลี่ยนมาใช้ตระกูล Join เหมือนหน้า Employee เพื่อลดภาระ DB และป้องกันค่า Undefined
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
        .where(eq(usersTable.id, data.userId))
        .limit(1),
      db.select()
        .from(temporaryShiftsTable)
        .where(and(
          eq(temporaryShiftsTable.userId, data.userId),
          eq(temporaryShiftsTable.targetDate, lookupDate),
          eq(temporaryShiftsTable.status, "approved")
        ))
        .limit(1)
    ]);

    const user = userData[0];
    if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");

    // 🚩 ดึงข้อมูล Company และเรียกใช้ระบบตรวจสอบ Feature ใหม่ล่าสุดที่ Knight เตรียมไว้
    const [companyData, isRemarkActive] = await Promise.all([
      db.select({
        otRoundingOption: companyTable.otRoundingOption,
        companyFeatureSelectedId: companyTable.companyFeatureSelectedId
      })
      .from(companyTable)
      .where(eq(companyTable.id, user.companyId || ""))
      .limit(1)
      .then(res => res[0]),
      FeatureService.isFeatureActive(user.companyId || "", "remarkAttendance")
    ]);

    const companyRounding = (companyData?.otRoundingOption as OTRoundingOption) || "ACTUAL";

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
    } else {
      currentWorkingStatus = "extra";
    }

    /* -------------------------------------------------------------------------- */
    /* CHECK-IN LOGIC (ขาเข้า)                                                    */
    /* -------------------------------------------------------------------------- */
    if (data.type === "IN") {
      const existingActive = await db
        .select()
        .from(attendanceTable)
        .where(and(eq(attendanceTable.user_id, data.userId), isNull(attendanceTable.checkOut)))
        .limit(1);

      if (existingActive.length > 0) {
        throw new Error("คุณมีรายการลงชื่อเข้างานที่ยังไม่ได้ออก กรุณาลงชื่อออกก่อนเริ่มรอบใหม่");
      }

      const validatedSite = await validateAndGetSite(
        lat.toString(),
        lon.toString(),
        user.companyId || "",
        user.siteId || ""
      );

      if (validatedSite.OffsiteCheckInConfirm && !data.isConfirmed) {
        return {
          success: false,
          offsite: true,
          siteName: validatedSite.name,
          OffsiteCheckInConfirm: true,
          OffsiteCheckOutConfirm: true
        };
      }

      const finalIsOffsiteIn = validatedSite.isOffsiteIn || "0";

      let deptNameSnapshot = "";
      if (user.departmentId) {
        const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, user.departmentId)).limit(1);
        deptNameSnapshot = dept?.name || "";
      }

      const finalRemark = isRemarkActive ? (data.remark?.trim() || "") : "";

      // ปล่อยให้หน้าบ้านของผู้นำจัดการอัปโหลดภาพมาให้เรียบร้อยแล้วส่ง URL เข้ามาที่ data.image เผื่อกรณีใช้ Uploader คนละตัว
      let finalImageUrl = data.image;
      let finalImageId = data.fileId || null;

      // ถ้าหน้าบ้าน leader ส่งมาเป็น base64 ดิบ ให้ทำความสะอาดและแปลงก่อนอัปโหลดผ่านไดรฟ์ตามรอยพนักงาน
      if (data.image.startsWith("data:image")) {
        const base64Data = data.image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const uploadRes = await uploadToDrive(buffer, `checkin_leader_${data.userId}_${Date.now()}.png`, "image/png");
        finalImageUrl = uploadRes.url;
        finalImageId = uploadRes.fileId;
      }

      const [insertedAttendance] = await db.insert(attendanceTable).values({
        user_id: data.userId,
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
        imageIn: finalImageUrl,
        imageInId: finalImageId,
        locationIn: data.location,
        isOffsiteIn: finalIsOffsiteIn,
        isOffsiteInCoordinates: finalIsOffsiteIn === "1" ? data.location : null,
        workingStatusEnum: currentWorkingStatus,
        remark: finalRemark,
        isLate: currentWorkingStatus === "normal" && activeStartTime ? (toMin(currentTimeStr) > toMin(activeStartTime) ? 1 : 0) : 0,
        lateMinutes: currentWorkingStatus === "normal" && activeStartTime ? (() => {
          let nowM = toMin(currentTimeStr);
          let startM = toMin(activeStartTime);
          if (nowM < 300 && startM > 1000) nowM += 1440;
          const diff = nowM - startM;
          return diff > 0 ? diff : 0;
        })() : 0,
      }).returning({ id: attendanceTable.id });

      if (insertedAttendance?.id) {
        const otResult = calculateOvertime({
          checkIn: currentTimeStr,
          checkOut: currentTimeStr,
          shiftStart: activeStartTime,
          shiftEnd: activeEndTime,
          roundingMode: companyRounding,
        });

        await db.insert(overtimeTable).values({
          userId: data.userId,
          userName: user.name || "Unknown",
          companyId: user.companyId || "",
          shiftId: activeShiftId,
          attendanceId: insertedAttendance.id, 
          date: dateStr,
          overtimeBefore: otResult.beforeMinutes ?? 0,
          otRoundingOption: companyRounding,
          status: "pending"
        });
      } else {
        throw new Error("บันทึกข้อมูลเข้างานล้มเหลว (No ID returned from database)");
      }

      revalidatePath("/", "layout");
      revalidatePath("/leader");
      revalidatePath("/employee");

      return {
        success: true,
        siteName: validatedSite.name,
        offsite: finalIsOffsiteIn === "1",
        attendanceId: insertedAttendance.id, 
        requiresRemark: isRemarkActive 
      };

    /* -------------------------------------------------------------------------- */
    /* CHECK-OUT LOGIC (ขาออก)                                                    */
    /* -------------------------------------------------------------------------- */
    } else {
      let isEarlyExit = 0;
      let earlyExitMinutes = 0;

      const lastCheckIn = await db
        .select()
        .from(attendanceTable)
        .where(and(eq(attendanceTable.user_id, data.userId), isNull(attendanceTable.checkOut)))
        .orderBy(desc(attendanceTable.createdAt))
        .limit(1);

      if (!lastCheckIn || lastCheckIn.length === 0) {
        return { success: false, error: "ไม่พบข้อมูลการเช็คอินที่ค้างอยู่" };
      }

      const currentRecord = lastCheckIn[0];
      const locationValidation = await validateCheckOutLocation(data.userId, lat, lon, currentRecord);
      const isOffsiteOutValue = locationValidation.isOffsiteOut === "1" ? "1" : "0";

      if (locationValidation.OffsiteCheckOutConfirm && !data.isConfirmed) {
        return {
          success: false,
          offsite: true,
          siteName: locationValidation.siteOutName,
          OffsiteCheckOutConfirm: true
        };
      }

      const checkInDate = currentRecord.date;
      const cachedEndTime = currentRecord.shiftEndTimeSnapshot;

      let otResult;
      if (currentRecord.workingStatusEnum === "extra") {
        otResult = calculateOvertime({
          checkIn: currentRecord.checkIn || "00:00",
          checkOut: currentTimeStr,
          shiftStart: currentRecord.checkIn,
          shiftEnd: currentRecord.checkIn,
          roundingMode: companyRounding,
        });
      } else {
        otResult = calculateOvertime({
          checkIn: currentRecord.checkIn || "00:00",
          checkOut: currentTimeStr,
          shiftStart: currentRecord.shiftStartTimeSnapshot,
          shiftEnd: cachedEndTime,
          roundingMode: companyRounding,
        });
      }

      if (cachedEndTime && currentRecord.workingStatusEnum !== "extra") {
        const [currH, currM] = currentTimeStr.split(':').map(Number);
        const [endH, endM] = cachedEndTime.split(':').map(Number);
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

      let finalImageUrl = data.image;
      let finalImageId = data.fileId || null;

      if (data.image.startsWith("data:image")) {
        const base64Data = data.image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const uploadRes = await uploadToDrive(buffer, `checkout_leader_${data.userId}_${Date.now()}.png`, "image/png");
        finalImageUrl = uploadRes.ufsUrl || uploadRes.url;
        finalImageId = uploadRes.fileId;
      }

      await db.update(attendanceTable).set({
        checkOut: currentTimeStr,
        imageOut: finalImageUrl,
        imageOutId: finalImageId,
        locationOut: data.location,
        isEarlyExit: isEarlyExit.toString(),
        earlyExitMinutes: earlyExitMinutes,
        isOffsiteOut: isOffsiteOutValue,
        isOffsiteOutCoordinates: isOffsiteOutValue === "1" ? data.location : null,
      }).where(eq(attendanceTable.id, currentRecord.id));

      if (checkInDate) {
        await db.insert(overtimeTable).values({
          userId: data.userId,
          userName: user.name || "Unknown",
          companyId: user.companyId || "",
          shiftId: currentRecord.shift_id || null,
          attendanceId: currentRecord.id,
          date: checkInDate,
          overtimeBefore: otResult.beforeMinutes ?? 0,
          overtimeAfter: otResult.afterMinutes ?? 0,
          overtimeCollected: otResult.totalMinutes ?? 0,
          otRoundingOption: companyRounding,
          status: "pending"
        }).onConflictDoUpdate({
          target: overtimeTable.attendanceId, // ✨ มั่นใจ 100% ว่าระบุ Target ตรงกลุ่ม Index ไม่แครช
          set: {
            overtimeBefore: otResult.beforeMinutes ?? 0,
            overtimeAfter: otResult.afterMinutes ?? 0,
            overtimeCollected: otResult.totalMinutes ?? 0,
            otRoundingOption: companyRounding
          }
        });
      }

      revalidatePath("/", "layout");
      revalidatePath("/leader");
      revalidatePath("/employee");

      return {
        success: true,
        offsite: isOffsiteOutValue === "1",
        siteName: locationValidation.siteOutName || currentRecord.siteInNameSnapshot || "",
        otTotal: otResult.totalMinutes,
        attendanceId: currentRecord.id,
        requiresRemark: isRemarkActive
      };
    }
  } catch (error: any) {
    console.error("Leader attendance error:", error);
    return {
      success: false,
      error: error.message || "เกิดข้อผิดพลาดภายในระบบ"
    };
  }
}
/**------------------------------------------------------------------------------------------
 * 2. ส่งคำขอลางาน
--------------------------------------------------------------------------------------------- */
export async function createLeaveRequestAction(data: {
  userId: string;
  type: string;
  startDate: string;
  endDate: string;
  startTime?: string | null; // ✅ เพิ่มรองรับเวลาเริ่มต้น
  endTime?: string | null;   // ✅ เพิ่มรองรับเวลาสิ้นสุด
  reason: string;
  fileUrl?: string;
  fileId?: string;
  fileName?: string;
}) {
  try {
    const user = await db.query.usersTable.findFirst({
      where: (users, { eq }) => eq(users.id, data.userId),
      columns: {
        departmentId: true,
        site_id: true,
      },
    });

    if (!user) {
      return { success: false, error: "ไม่พบข้อมูลพนักงานในระบบ" };
    }

    // --- 💡 Logic การคำนวณ Total Hours ---
    let totalHoursResult = 0;

    if (data.type === "ลาเป็นชั่วโมง" && data.startTime && data.endTime) {
      const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
      const endDateTime = new Date(`${data.endDate}T${data.endTime}`);
      
      const diffMs = endDateTime.getTime() - startDateTime.getTime();
      
      // หารออกมาเป็นชั่วโมง (จะได้ทศนิยมมาด้วย เช่น 1.5)
      const hours = diffMs / (1000 * 60 * 60);
      
      // ใช้ Number() ครอบเพื่อให้แน่ใจว่าเป็นตัวเลข และปัดเศษทศนิยมให้เหลือ 2 ตำแหน่ง
      totalHoursResult = Number(hours.toFixed(2)); 
    } else {
      // กรณีลาปกติ: คำนวณจากจำนวนวัน (วันที่สิ้นสุด - วันที่เริ่มต้น + 1 วัน) แล้วคูณ 24
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      totalHoursResult = diffDays * 24; // จำนวนวันคูณ 24
    }

    // ตรวจสอบความถูกต้องของเวลา
    if (totalHoursResult < 0.00) {
      return { success: false, error: "ช่วงเวลาการลาไม่ถูกต้อง" };
    }
    // --------------------------------------------------

    await db.insert(leaveTable).values({
      user_id: data.userId,
      department_id: user.departmentId,
      site_id: user.site_id,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      startTime: data.startTime || null, // ✅ บันทึกเวลาเริ่มต้น (ถ้ามี)
      endTime: data.endTime || null,     // ✅ บันทึกเวลาสิ้นสุด (ถ้ามี)
      totalHours: totalHoursResult,      // ✅ บันทึกค่าที่คำนวณได้เป็นชั่วโมง (Integer)
      reason: data.reason,
      status: "pending",
      fileUrl: data.fileUrl || null,
      fileId: data.fileId || null,
      fileName: data.fileName || null,
    });

    revalidatePath("/leader");
    revalidatePath("/employee");
    return { success: true };
  } catch (error: any) {
    console.error("Create leave error:", error);
    return { success: false, error: "ส่งคำขอลาไม่สำเร็จ: " + error.message };
  }
}
/**
 * 3. อัปเดตสถานะการลา (แก้ไข Error Type Mismatch)
 */
export async function updateLeaveStatusAction(
  leaveId: string,
  newStatus: "approved" | "rejected" | "pending",
  adminOrLeaderId: string,
  remark?: string // เพิ่ม parameter สำหรับรับค่าหมายเหตุ
) {
  try {
    const updatePayload: any = {
      status: newStatus,
      remark: remark, // อัปเดตหมายเหตุลงในฟิลด์ remark
      approvedBy: newStatus === "approved" ? adminOrLeaderId : null,
      approvedAt: newStatus === "approved" ? sql`timezone('UTC', now())` : null,
      rejectedBy: newStatus === "rejected" ? adminOrLeaderId : null,
      rejectedAt: newStatus === "rejected" ? sql`timezone('UTC', now())` : null,
    };

    await db.update(leaveTable)
      .set(updatePayload)
      .where(eq(leaveTable.id, leaveId));

    revalidatePath("/leader");
    revalidatePath("/employee");
    return { success: true };
  } catch (error: any) {
    console.error("Update leave error:", error);
    return { success: false, error: "อัปเดตสถานะไม่สำเร็จ" };
  }
}

/**
 * 4. เปลี่ยนรหัสผ่าน
 */
export async function changePasswordAction(data: {
  userId: string;
  oldPassword: string;
  newPassword: string;
}) {
  try {
    if (!data.userId || !data.oldPassword || !data.newPassword) {
      return { success: false, error: "ข้อมูลไม่ครบถ้วน" };
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, data.userId),
    });

    if (!user || !user.passwordHash) {
      return { success: false, error: "ไม่พบข้อมูลรหัสผ่านในระบบ" };
    }

    if (!user.passwordHash.startsWith('$')) {
      return { success: false, error: "รหัสผ่านในระบบอยู่ในรูปแบบที่ไม่รองรับ" };
    }

    const isMatch = await bcrypt.compare(data.oldPassword, user.passwordHash);

    if (!isMatch) {
      return { success: false, error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" };
    }

    if (data.oldPassword === data.newPassword) {
      return { success: false, error: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" };
    }

    const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);

    await db.update(usersTable)
      .set({ passwordHash: hashedNewPassword })
      .where(eq(usersTable.id, data.userId));

    revalidatePath("/employee");
    revalidatePath("/leader");

    return { success: true };

  } catch (error: any) {
    console.error("Change password critical error:", error);
    return { success: false, error: `เกิดข้อผิดพลาด: ${error.message || "ทางระบบ"}` };
  }
}

/* -------------------------------------------------------------------------- */
/* PERSONAL OT ACTIONS (OT ส่วนตัว)                                              */
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

    // 1. ดึงข้อมูลพนักงานจาก usersTable
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

    // หาก Query แล้วได้ค่าว่าง
    if (!user) {
      throw new Error(`ไม่พบข้อมูลพนักงานในระบบ (ID: ${payload.userId})`);
    }

    // 2. ดึงข้อมูล shiftId ล่าสุดจาก shiftsTable
    const latestShift = await db.query.shiftsTable.findFirst({
      where: eq(shiftsTable.userId, user.id),
      orderBy: (shifts, { desc }) => [desc(shifts.createdAt)],
    });

    // 3. คำนวณชั่วโมงเป็นนาที (Integer) สำหรับ overtimeByRequest
    const [startH, startM] = payload.startTime.split(":").map(Number);
    const [endH, endM] = payload.endTime.split(":").map(Number);
    
    const startDate = new Date(0, 0, 0, startH, startM);
    const endDate = new Date(0, 0, 0, endH, endM);
    
    let diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // กรณีทำข้ามคืน
    
    const totalMinutes = Math.round(diffMs / (1000 * 60));

    // 4. บันทึกลงตาราง overtime_requests ตาม Schema (ห้ามลบ/ห้ามลด)
    const newRequest = await db.insert(overtimeRequestsTable).values({
      // id: จะถูกสร้างอัตโนมัติด้วย defaultRandom()
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`,
      
      // บันทึก IDs สังกัด
      companyId: user.companyId,
      departmentId: user.departmentId,
      siteId: user.site_id, 
      shiftId: latestShift?.id || null,
      
      // ฟิลด์บังคับ (Not Null) ตาม Schema
      overtimeByRequest: totalMinutes, 
      timeStart: payload.startTime,
      timeEnd: payload.endTime,
      date: payload.date, 
      
      // บันทึกเป็น JSONB Array
      requestedWorkers: [user.id], 
      
      // เหตุผลการขอ OT (Not Null)
      reason: payload.reason || "ไม่มีระบุเหตุผล", 
      
      // สถานะเริ่มต้น
      status: "pending",
      
      // ร่องรอยการสร้าง
      createdBy: user.id,
      createdAt: new Date(),
    }).returning();

    // 5. Update Cache เพื่อให้ข้อมูลเป็นปัจจุบัน
    revalidatePath("/dashboard/ot-status");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return { 
      success: true, 
      message: "ส่งคำขอ OT เรียบร้อยแล้ว", 
      data: newRequest[0] 
    };

  } catch (error: any) {
    console.error("PERSONAL_OT_ERROR_DETAIL:", error);
    return { 
      success: false, 
      error: "ส่งคำขอ OT ล้มเหลว: " + (error.message || "Database Constraint Error")
    };
  }
}

/* -------------------------------------------------------------------------- */
/* LEADER OT ACTIONS (จัดการอนุมัติ/ปฏิเสธ OT)                                      */
/* -------------------------------------------------------------------------- */

export async function updateOTStatusAction(
  otId: string, 
  status: "approved" | "rejected" | "pending",
  remark?: string
) {
  try {
    // 1. ตรวจสอบสิทธิ์ Leader เบื้องต้น
    const leader = await getCurrentUser();
    if (!leader || leader.role !== "leader") {
      throw new Error("คุณไม่มีสิทธิ์ในการดำเนินการนี้");
    }

    // 2. อัปเดตข้อมูลลงตาราง overtime_requests
    // หมายเหตุ: ใช้การ update ตาม id ที่ส่งมาจาก UI
    const updatedRequest = await db
      .update(overtimeRequestsTable)
      .set({
        status: status,
        remarks: remark || null, // บันทึกหมายเหตุถ้ามีการส่งมา
        approvedBy: status === "approved" ? leader.id : null,
        rejectedBy: status === "rejected" ? leader.id : null, 
        updatedAt: new Date(),
      })
      .where(eq(overtimeRequestsTable.id, otId))
      .returning();

    if (updatedRequest.length === 0) {
      throw new Error("ไม่พบรายการ OT ที่ต้องการอัปเดต");
    }

    // 3. Update Cache เพื่อให้หน้าจอทุกฝั่งเห็นข้อมูลล่าสุด
    revalidatePath("/leader");
    revalidatePath("/employee");
    revalidatePath("/dashboard/ot-status");

    return { 
      success: true, 
      message: status === "approved" ? "อนุมัติเรียบร้อย" : "ปฏิเสธคำขอเรียบร้อย" 
    };

  } catch (error: any) {
    console.error("UPDATE_OT_STATUS_ERROR:", error);
    return { 
      success: false, 
      error: error.message || "เกิดข้อผิดพลาดในการอัปเดตสถานะ" 
    };
  }
}