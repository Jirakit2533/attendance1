"use server";

import { db } from "@/db/db";
import { leaveTable, attendanceTable, usersTable, shiftsTable, overtimeTable, departmentsTable, sitesTable, temporaryShiftsTable, companyTable, overtimeRequestsTable } from "@/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm"; // เพิ่ม isNull, desc
import { revalidatePath } from "next/cache";
import { isInsideBound, validateAndGetSite, validateCheckOutLocation } from "@/lib/location-service";
import { calculateOvertime } from "@/lib/over-time/ot-calculate";
import bcrypt from "bcryptjs";

/**------------------------------------------------------------------
 * 1. บันทึกเวลาเข้า-ออก (Check-in / Check-out) พร้อมตรวจสอบสาย/ออกก่อน
 --------------------------------------------------------------------*/
 export async function saveAttendanceAction(data: {
  userId: string;
  type: "IN" | "OUT";
  image: string;
  fileId?: string;
  location: string;
  departmentId: string;
  siteId: string | null;
  isConfirmed?: boolean;
 }) {
  try {
    const now = new Date();
    const currentTimeStr = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour12: false
    });
 
    const nowH = now.getHours();
    let lookupDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
    if (data.type === "IN" && nowH >= 0 && nowH < 5) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      lookupDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(yesterday);
    }
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
 
    const [userData, shiftData, tempShift] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.id, data.userId)).limit(1),
      db.select().from(shiftsTable).where(eq(shiftsTable.userId, data.userId)).limit(1),
      db.select().from(temporaryShiftsTable).where(and(
        eq(temporaryShiftsTable.userId, data.userId),
        eq(temporaryShiftsTable.targetDate, lookupDate),
        eq(temporaryShiftsTable.status, "approved")
      )).limit(1)
    ]);
 
    const user = userData[0];
    if (!user) throw new Error("ไม่พบข้อมูลผู้ใช้");
 
    const [companyData] = await db.select({ 
      otRoundingOption: companyTable.otRoundingOption 
    }).from(companyTable).where(eq(companyTable.id, user.companyId || "")).limit(1);
    
    const companyRounding = (companyData?.otRoundingOption as OTRoundingOption) || "ACTUAL";
 
    const shift = shiftData[0];
    const activeStartTime = tempShift[0]?.startTime || shift?.startTime || null;
    const activeEndTime = tempShift[0]?.endTime || shift?.endTime || null;
 
    const toMin = (t: string | null) => {
      if (!t) return 0;
      const [h, m] = t.split(':').map(Number);
      return (h * 60) + (m || 0);
    };
 
    let currentSiteName = "";
    let currentSiteCoords = "";
    let finalSiteId = data.siteId;
    let isOffsiteIn = "0";
 
    if (data.type === "IN") {
      const [uLat, uLon] = data.location.split(',').map(Number);
      
      // 🚩 แก้ไข: ใช้ user.site_id จาก DB เพื่อความแม่นยำสำหรับพนักงานประจำไซต์
      const validated = await validateAndGetSite(
        uLat.toString(), 
        uLon.toString(), 
        user.companyId || "", 
        user.site_id || "" 
      );
      
      currentSiteName = validated.name;
      currentSiteCoords = validated.coordinates || "";
      finalSiteId = validated.id;
      isOffsiteIn = validated.isOffsiteIn || "0";
 
      // 🚩 ดักรอคำยืนยันหากเป็นกลุ่มทุกไซต์ที่อยู่นอกพื้นที่
      if (validated.OffsiteCheckInConfirm && !data.isConfirmed) {
        return {
          success: false,
          siteName: currentSiteName,
          offsite: true,
          OffsiteCheckInConfirm: true,
          OffsiteCheckOutConfirm: true 
        };
      }
    } else if (data.siteId) {
      const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, data.siteId)).limit(1);
      currentSiteName = site?.name || "";
      currentSiteCoords = site?.coordinates || "";
    }
 
    let deptNameSnapshot = "";
    if (data.departmentId) {
      const [dept] = await db.select({ name: departmentsTable.name }).from(departmentsTable).where(eq(departmentsTable.id, data.departmentId)).limit(1);
      deptNameSnapshot = dept?.name || "";
    }
 
    if (data.type === "IN") {
      let currentWorkingStatus: "normal" | "extra" = "normal";
      if (activeEndTime && activeStartTime) {
        let nowM = toMin(currentTimeStr);
        let endM = toMin(activeEndTime);
        let startM = toMin(activeStartTime);
 
        if (endM < startM) endM += 1440;
        const adjNowM = (nowM < startM && endM > 1440) ? nowM + 1440 : nowM;
 
        if (adjNowM > endM) currentWorkingStatus = "extra";
      }
 
      let isLate = 0;
      let lateMinutes = 0;
 
      if (currentWorkingStatus === "normal" && activeStartTime) {
        let nowM = toMin(currentTimeStr);
        let startM = toMin(activeStartTime);
        if (nowM < 300 && startM > 1000) nowM += 1440;
 
        const diff = nowM - startM;
        if (diff > 0) {
          isLate = 1;
          lateMinutes = diff;
        }
      }
 
      const [insertedAttendance] = await db.insert(attendanceTable).values({
        user_id: data.userId,
        department_id: data.departmentId,
        site_id: finalSiteId,
        shift_id: tempShift[0] ? null : shift?.id,
        temp_shift_id: tempShift[0]?.id || null,
        siteInNameSnapshot: currentSiteName,
        siteCoordinatesSnapshot: currentSiteCoords,
        shiftStartTimeSnapshot: activeStartTime,
        shiftEndTimeSnapshot: activeEndTime,
        departmentNameSnapshot: deptNameSnapshot,
        date: dateStr,
        checkIn: currentTimeStr,
        imageIn: data.image,
        imageInId: data.fileId || null,
        locationIn: data.location,
        workingStatusEnum: currentWorkingStatus,
        isLate: isLate,
        isOffsiteIn: isOffsiteIn,
        isOffsiteInCoordinates: isOffsiteIn === "1" ? data.location : null,
        lateMinutes: lateMinutes,
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
          userId: data.userId,
          userName: user?.firstName || "Unknown",
          companyId: user?.companyId || "",
          shiftId: tempShift[0] ? null : shift?.id,
          attendanceId: insertedAttendance.id,
          date: dateStr,
          overtimeBefore: otResult?.beforeMinutes || 0,
          otRoundingOption: companyRounding,
          status: "pending"
        });
      }
 
      revalidatePath("/", "layout");
      revalidatePath("/leader");
      revalidatePath("/employee");
      return { success: true, siteName: currentSiteName, offsite: isOffsiteIn === "1" };
 
    } else {
      // --- ขาออก (Check-out) ---
      let isEarlyExit = 0;
      let earlyExitMinutes = 0;
 
      const lastCheckIn = await db
        .select()
        .from(attendanceTable)
        .where(and(eq(attendanceTable.user_id, data.userId), isNull(attendanceTable.checkOut)))
        .orderBy(desc(attendanceTable.createdAt))
        .limit(1);
 
      if (lastCheckIn.length === 0) {
        return { success: false, error: "ไม่พบข้อมูลการเช็คอินที่ค้างอยู่" };
      }
 
      const currentRecord = lastCheckIn[0];
      const [uLatOut, uLonOut] = data.location.split(',').map(Number);
      
      // 🚩 แก้ไข: ส่ง user.site_id จาก DB เข้าไปเพื่อให้ validateCheckOutLocation ตรวจสอบพิกัดได้ถูกต้อง
      const locationValidation = await validateCheckOutLocation(
        data.userId, 
        uLatOut, 
        uLonOut, 
        currentRecord, 
        user.site_id || "" 
      );
      
      const isOffsiteOutValue = locationValidation.isOffsiteOut;
 
      if (locationValidation.OffsiteCheckOutConfirm && !data.isConfirmed) {
        return {
          success: false,
          siteName: locationValidation.siteOutName || currentRecord.siteInNameSnapshot || "",
          offsite: true,
          OffsiteCheckInConfirm: false,
          OffsiteCheckOutConfirm: true 
        };
      }
 
      const finalEndTime = currentRecord.shiftEndTimeSnapshot;
 
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
          shiftEnd: currentRecord.shiftEndTimeSnapshot,
          roundingMode: companyRounding,
        });
 
        if (finalEndTime) {
          let currentTotalMinutes = toMin(currentTimeStr);
          let endTotalMinutes = toMin(finalEndTime);
          const checkInTotalMinutes = toMin(currentRecord.checkIn);
 
          if (endTotalMinutes < checkInTotalMinutes) {
            if (currentTotalMinutes < checkInTotalMinutes) currentTotalMinutes += 1440;
            endTotalMinutes += 1440;
          }
 
          if (currentTotalMinutes < endTotalMinutes) {
            isEarlyExit = 1;
            earlyExitMinutes = endTotalMinutes - currentTotalMinutes;
          }
        }
      }
 
      await db.update(attendanceTable)
        .set({
          checkOut: currentTimeStr,
          imageOut: data.image,
          imageOutId: data.fileId || null,
          locationOut: data.location,
          isEarlyExit: isEarlyExit.toString(),
          earlyExitMinutes: earlyExitMinutes,
          isOffsiteOut: isOffsiteOutValue,
          isOffsiteOutCoordinates: isOffsiteOutValue === "1" ? data.location : null,
        })
        .where(eq(attendanceTable.id, currentRecord.id));
 
      await db.insert(overtimeTable).values({
        userId: data.userId,
        userName: user?.firstName || "Unknown",
        companyId: user?.companyId || "",
        shiftId: currentRecord.shift_id,
        attendanceId: currentRecord.id,
        date: currentRecord.date || dateStr,
        overtimeBefore: otResult?.beforeMinutes || 0,
        overtimeAfter: otResult?.afterMinutes || 0,
        overtimeCollected: otResult?.totalMinutes || 0,
        otRoundingOption: companyRounding,
        status: "pending"
      }).onConflictDoUpdate({
        target: [overtimeTable.attendanceId],
        set: { 
          overtimeBefore: otResult?.beforeMinutes || 0,
          overtimeAfter: otResult?.afterMinutes || 0,
          overtimeCollected: otResult?.totalMinutes || 0,
          otRoundingOption: companyRounding
        }
      });
 
      revalidatePath("/", "layout");
      revalidatePath("/leader");
      revalidatePath("/employee");
 
      return {
        success: true,
        siteName: locationValidation.siteOutName || currentRecord.siteInNameSnapshot || "",
        offsite: isOffsiteOutValue === "1",
        OffsiteCheckOutConfirm: false,
        otTotal: otResult?.totalMinutes || 0
      };
    }
  } catch (error: any) {
    console.error("Attendance error:", error);
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

    await db.insert(leaveTable).values({
      user_id: data.userId,
      department_id: user.departmentId,
      site_id: user.site_id,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
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