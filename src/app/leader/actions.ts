"use server";

import { db } from "@/db/db";
import { leaveTable, attendanceTable, usersTable, shiftsTable, overtimeTable, departmentsTable, sitesTable, temporaryShiftsTable } from "@/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm"; // เพิ่ม isNull, desc
import { revalidatePath } from "next/cache";
import { isInsideBound, validateAndGetSite } from "@/lib/location-service";
import bcrypt from "bcryptjs";

/**
 * 1. บันทึกเวลาเข้า-ออก (Check-in / Check-out) พร้อมตรวจสอบสาย/ออกก่อน
 */
export async function saveAttendanceAction(data: {
  userId: string;
  type: "IN" | "OUT";
  image: string;
  fileId?: string;
  location: string;
  departmentId: string;
  siteId: string | null;
}) {
  try {
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok'
    }).format(now);
    const currentTimeStr = now.toLocaleTimeString('en-GB', {
      timeZone: 'Asia/Bangkok',
      hour12: false
    });

    // 1. ดึงข้อมูลกะงานปกติ
    const shiftData = await db
      .select()
      .from(shiftsTable)
      .where(eq(shiftsTable.userId, data.userId))
      .limit(1);

    const shift = shiftData[0];

    // --- ส่วนที่แก้ไข: ดึงข้อมูล Snapshot โดยใช้ validateAndGetSite เพื่อรองรับ Roaming ---
    let currentSiteName = "";
    let currentSiteCoords = "";
    let finalSiteId = data.siteId;

    if (data.type === "IN") {
      const [uLat, uLon] = data.location.split(',');
      // เรียกใช้ Algorithm เพื่อระบุตัวตนไซต์งาน (Winner Site)
      const winnerSite = await validateAndGetSite(uLat, uLon, data.departmentId, data.siteId);
      currentSiteName = winnerSite.name;
      currentSiteCoords = winnerSite.coordinates || "";
      finalSiteId = winnerSite.id;
    } else if (data.siteId) {
      // สำหรับ OUT ดึงข้อมูลปกติถ้ามี ID
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
      let isLate = 0;
      let lateMinutes = 0;

      if (shift) {
        if (currentTimeStr > shift.startTime) {
          const [nowH, nowM] = currentTimeStr.split(':').map(Number);
          const [shH, shM] = shift.startTime.split(':').map(Number);
          const diff = (nowH * 60 + nowM) - (shH * 60 + shM);
          if (diff > 0) {
            isLate = 1;
            lateMinutes = diff;
          }
        }
      }

      await db.insert(attendanceTable).values({
        user_id: data.userId,
        department_id: data.departmentId,
        site_id: finalSiteId, // ใช้ ID ที่ได้จาก Algorithm
        shift_id: shift?.id || null,
        // --- ส่วน Snapshot ที่จะไม่มีค่าว่างอีกต่อไป ---
        siteNameSnapshot: currentSiteName,
        siteCoordinatesSnapshot: currentSiteCoords,
        shiftStartTimeSnapshot: shift?.startTime || null,
        shiftEndTimeSnapshot: shift?.endTime || null,
        departmentNameSnapshot: deptNameSnapshot,
        // -----------------------------
        date: dateStr,
        checkIn: currentTimeStr,
        imageIn: data.image,
        imageInId: data.fileId || null,
        locationIn: data.location,
        isLate: isLate,
        ...(Object.keys(attendanceTable).includes('lateMinutes') ? { lateMinutes } : {}),
      });
      
      revalidatePath("/", "layout");
      revalidatePath("/leader");
      revalidatePath("/employee");
      return { success: true, siteName: currentSiteName };

    } else {
      // --- LOGIC CHECK-OUT ที่ปรับปรุง ---
      let isEarlyExit = 0;
      let earlyExitMinutes = 0;

      // ค้นหา Record ล่าสุดที่ยังไม่ได้ Check-out
      const lastCheckIn = await db
        .select()
        .from(attendanceTable)
        .where(
          and(
            eq(attendanceTable.user_id, data.userId),
            isNull(attendanceTable.checkOut)
          )
        )
        .orderBy(desc(attendanceTable.createdAt))
        .limit(1);

      if (lastCheckIn.length === 0) {
        return { success: false, error: "ไม่พบข้อมูลการเช็คอินที่ค้างอยู่" };
      }

      const currentRecord = lastCheckIn[0];
      const checkInDate = currentRecord.date;

      // ตรวจสอบพิกัดตอนออกงานเทียบกับไซต์ที่เข้างานไว้
      const [originalSite] = await db.select().from(sitesTable).where(eq(sitesTable.id, currentRecord.site_id)).limit(1);
      let isOffsiteOut = "0";
      
      if (originalSite && originalSite.coordinates) {
        const [uLat, uLon] = data.location.split(',');
        const [sLat, sLon] = originalSite.coordinates.split(',');
        const isInside = isInsideBound(uLat, uLon, sLat, sLon);
        isOffsiteOut = isInside ? "0" : "1";
      }

      // ดึงข้อมูลกะงาน (ตรวจเช็คกะชั่วคราวด้วยตาม Logic รอบแรก)
      const [tempShiftData] = await db
        .select({ id: temporaryShiftsTable.id, endTime: temporaryShiftsTable.endTime })
        .from(temporaryShiftsTable)
        .where(and(eq(temporaryShiftsTable.userId, data.userId), eq(temporaryShiftsTable.targetDate, checkInDate)))
        .limit(1);

      const activeEndTime = tempShiftData?.endTime || shift?.endTime;

      if (activeEndTime) {
        const [currH, currM] = currentTimeStr.split(':').map(Number);
        const [endH, endM] = activeEndTime.split(':').map(Number);
        const [inH, inM] = (currentRecord.checkIn || "00:00").split(':').map(Number);

        let currentTotalMinutes = currH * 60 + currM;
        let endTotalMinutes = endH * 60 + endM;
        const checkInTotalMinutes = inH * 60 + inM;

        // รองรับกะข้ามคืน
        if (endTotalMinutes < checkInTotalMinutes) {
          if (currentTotalMinutes < checkInTotalMinutes) {
            currentTotalMinutes += 1440;
          }
          endTotalMinutes += 1440;
        }

        // ตรวจสอบการออกก่อนเวลา
        if (currentTotalMinutes < endTotalMinutes) {
          isEarlyExit = 1;
          earlyExitMinutes = endTotalMinutes - currentTotalMinutes;
        }
      }

      const result = await db.update(attendanceTable)
        .set({
          checkOut: currentTimeStr,
          imageOut: data.image,
          imageOutId: data.fileId || null,
          locationOut: data.location,
          isEarlyExit: isEarlyExit,
          isOffsiteOut: isOffsiteOut,
          ...(Object.keys(attendanceTable).includes('earlyExitMinutes') ? { earlyExitMinutes } : {}),
        })
        .where(eq(attendanceTable.id, currentRecord.id));

      // @ts-ignore
      if (result.rowCount === 0 && !result.length) {
        return { success: false, error: "ไม่พบข้อมูลการเช็คอินที่ต้องการอัปเดต" };
      }

      revalidatePath("/", "layout");
      revalidatePath("/leader");
      revalidatePath("/employee");
      return { success: true, siteName: currentRecord.siteNameSnapshot || originalSite?.name || "", offsite: isOffsiteOut === "1" };
    }
  } catch (error: any) {
    console.error("Attendance error:", error);
    return { success: false, error: "บันทึกเวลาไม่สำเร็จ: " + (error.message || "Unknown Error") };
  }
}

/**
 * 2. ส่งคำขอลางาน
 */
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
      approvedAt: newStatus === "approved" ? sql`timezone('Asia/Bangkok', now())` : null,
      rejectedBy: newStatus === "rejected" ? adminOrLeaderId : null,
      rejectedAt: newStatus === "rejected" ? sql`timezone('Asia/Bangkok', now())` : null,
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