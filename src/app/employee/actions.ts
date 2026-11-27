"use server";

import { db } from "@/db/db";
import { attendanceTable, leaveTable, usersTable, shiftsTable, temporaryShiftsTable, overtimeTable, departmentsTable, companyTable, overtimeRequestsTable, companyFeatureSelectedTable } from "@/db/schema";
import { eq, and, sql, isNull, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadToDrive } from "@/lib/uploadthing-server";
import { validateAndGetSite, isInsideBound, validateCheckOutLocation } from "@/lib/location-service";
import { calculateOvertime } from "@/features/over-time/ot-calculate";
import { FeatureService } from "@/features/feature-service";
import * as bcrypt from "bcryptjs";



/* -------------------------------------------------------------------------- */
/* DAY OFF HELPERS                                                            */
/* -------------------------------------------------------------------------- */

type DayOffOption =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "saturday_sunday";

/**
 * ตรวจสอบว่าวันที่ SQL DATE ตรงกับวันหยุดประจำสัปดาห์หรือไม่
 * ใช้ UTC เพื่อป้องกันปัญหา Timezone ของ Server
 */
function isDayOffDate(
  date: string,
  dayOff: DayOffOption | null
): boolean {
  if (!dayOff) return false;

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("วันที่ Attendance ไม่ถูกต้อง");
  }

  const weekdays: DayOffOption[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  const weekday = weekdays[parsed.getUTCDay()];

  if (dayOff === "saturday_sunday") {
    return weekday === "saturday" || weekday === "sunday";
  }

  return weekday === dayOff;
}

/**
 * คำนวณเวลาทำงานจริงสำหรับวันหยุด
 * ไม่ใช้ระบบปัดเศษ OT ของบริษัท
 * รองรับการทำงานข้ามเที่ยงคืน
 */
function calculateDayOffMinutes(
  checkIn: string,
  checkOut: string
): number {
  const toSeconds = (time: string): number => {
    const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(time);

    if (!match) {
      throw new Error(`รูปแบบเวลาไม่ถูกต้อง: ${time}`);
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] || 0);

    return hours * 3600 + minutes * 60 + seconds;
  };

  const startSeconds = toSeconds(checkIn);
  let endSeconds = toSeconds(checkOut);

  if (endSeconds < startSeconds) {
    endSeconds += 86400;
  }

  return Math.floor((endSeconds - startSeconds) / 60);
}

/**
 * คำนวณวันที่ย้อนหลัง 1 วันจาก SQL DATE
 * ไม่อิง Timezone ของ Server
 */
function getPreviousDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  parsed.setUTCDate(parsed.getUTCDate() - 1);

  return [
    parsed.getUTCFullYear(),
    String(parsed.getUTCMonth() + 1).padStart(2, "0"),
    String(parsed.getUTCDate()).padStart(2, "0"),
  ].join("-");
}


/* -------------------------------------------------------------------------- */
/* CHECKIN ACTION (การเข้างาน)                                                */
/* -------------------------------------------------------------------------- */

export async function checkInAction(
  userId: string,
  base64Image: string,
  location: string,
  isConfirmed?: boolean,
  remark?: string
) {
  try {
    const now = new Date();

    const currentTimeStr = now.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Bangkok",
      hour12: false,
    });

    // ใช้เวลา Bangkok จริง ไม่ใช้ now.getHours() ของ Server
    const bangkokHour = Number(currentTimeStr.split(":")[0]);

    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
    }).format(now);

    let lookupDate = dateStr;

    if (bangkokHour >= 0 && bangkokHour < 5) {
      lookupDate = getPreviousDate(dateStr);
    }

    if (!location || typeof location !== "string" || !location.includes(",")) {
      throw new Error("พิกัดตำแหน่งไม่ถูกต้องหรือไม่ได้เปิด GPS");
    }

    const [lat, lon] = location.split(",").map(Number);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error("ข้อมูลพิกัดไม่ใช่ตัวเลขที่ถูกต้อง");
    }

    // ป้องกันพนักงานลงชื่อเข้าซ้อน
    const existingActive = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.user_id, userId),
          isNull(attendanceTable.checkOut)
        )
      )
      .limit(1);

    if (existingActive.length > 0) {
      throw new Error(
        "คุณมีรายการลงชื่อเข้างานที่ยังไม่ได้ออก กรุณาลงชื่อออกก่อนเริ่มรอบใหม่"
      );
    }

    const [userData, tempShift] = await Promise.all([
      db
        .select({
          id: usersTable.id,
          name: usersTable.firstName,
          companyId: usersTable.companyId,
          departmentId: usersTable.departmentId,
          siteId: usersTable.site_id,
          shiftId: shiftsTable.id,
          startTime: shiftsTable.startTime,
          endTime: shiftsTable.endTime,
          dayOff: shiftsTable.dayOff,
        })
        .from(usersTable)
        .leftJoin(shiftsTable, eq(usersTable.id, shiftsTable.userId))
        .where(eq(usersTable.id, userId))
        .limit(1),

      db
        .select()
        .from(temporaryShiftsTable)
        .where(
          and(
            eq(temporaryShiftsTable.userId, userId),
            eq(temporaryShiftsTable.targetDate, lookupDate),
            eq(temporaryShiftsTable.status, "approved")
          )
        )
        .limit(1),
    ]);

    const user = userData[0];

    if (!user) {
      throw new Error("ไม่พบข้อมูลผู้ใช้");
    }

    // ดึงข้อมูลบริษัทและตรวจสอบ Feature
    const [companyData, isRemarkActive] = await Promise.all([
      db
        .select({
          otRoundingOption: companyTable.otRoundingOption,
          companyFeatureSelectedId: companyTable.companyFeatureSelectedId,
        })
        .from(companyTable)
        .where(eq(companyTable.id, user.companyId || ""))
        .limit(1)
        .then((res) => res[0]),

      FeatureService.isFeatureActive(
        user.companyId || "",
        "remarkAttendance"
      ),
    ]);

    const companyRounding =
      (companyData?.otRoundingOption as OTRoundingOption) || "ACTUAL";

    // ตรวจสอบตำแหน่ง
    const validatedSite = await validateAndGetSite(
      lat.toString(),
      lon.toString(),
      user.companyId || "",
      user.siteId || ""
    );

    if (validatedSite.OffsiteCheckInConfirm && !isConfirmed) {
      return {
        success: false,
        offsite: true,
        siteName: validatedSite.name,
        OffsiteCheckInConfirm: true,
        OffsiteCheckOutConfirm: true,
      };
    }

    const finalIsOffsiteIn = validatedSite.isOffsiteIn || "0";

    let deptNameSnapshot = "";

    if (user.departmentId) {
      const [dept] = await db
        .select({ name: departmentsTable.name })
        .from(departmentsTable)
        .where(eq(departmentsTable.id, user.departmentId))
        .limit(1);

      deptNameSnapshot = dept?.name || "";
    }

    const activeStartTime =
      tempShift[0]?.startTime || user.startTime || null;

    const activeEndTime =
      tempShift[0]?.endTime || user.endTime || null;

    const activeShiftId = tempShift[0] ? null : user.shiftId;
    const activeTempShiftId = tempShift[0]?.id || null;

    // Snapshot วันหยุดจากกะหลัก ณ วันที่ Check-in
    const activeDayOff = user.dayOff || null;

    // ตรวจสอบว่าวันที่ Check-in เป็นวันหยุดหรือไม่
    const isDayOff = isDayOffDate(
      dateStr,
      activeDayOff
    );

    const toMin = (t: string | null) => {
      if (!t) return 0;

      const [h, m] = t.split(":").map(Number);

      return h * 60 + (m || 0);
    };

    let currentWorkingStatus: "normal" | "extra" = "normal";

    if (activeEndTime && activeStartTime) {
      const nowMin = toMin(currentTimeStr);

      let endMin = toMin(activeEndTime);
      const startMin = toMin(activeStartTime);

      if (endMin < startMin) {
        endMin += 1440;
      }

      const adjustedNowMin =
        nowMin < startMin && endMin > 1440
          ? nowMin + 1440
          : nowMin;

      if (adjustedNowMin > endMin) {
        currentWorkingStatus = "extra";
      }
    } else {
      currentWorkingStatus = "extra";
    }

    const base64Data = base64Image.replace(
      /^data:image\/\w+;base64,/,
      ""
    );

    const buffer = Buffer.from(base64Data, "base64");

    const uploadRes = await uploadToDrive(
      buffer,
      `checkin_${userId}_${Date.now()}.png`,
      "image/png"
    );

    const finalRemark = remark?.trim() || "";

    console.log("--- SERVER DEBUG ---");
    console.log("Remark Received:", remark);
    console.log("Final Remark to DB:", finalRemark);
    console.log("Attendance Date:", dateStr);
    console.log("Day Off:", activeDayOff);
    console.log("Is Day Off:", isDayOff);

    // INSERT ATTENDANCE
    const [insertedAttendance] = await db
      .insert(attendanceTable)
      .values({
        user_id: userId,
        department_id: user.departmentId,
        site_id: validatedSite.id,
        siteInNameSnapshot: validatedSite.name || "",
        siteCoordinatesSnapshot: validatedSite.coordinates || "",

        shift_id: activeShiftId,
        temp_shift_id: activeTempShiftId,

        shiftStartTimeSnapshot: activeStartTime,
        shiftEndTimeSnapshot: activeEndTime,

        // Snapshot วันหยุด เพื่อใช้ตอน Check-out
        dayOffSnapshot: activeDayOff,

        departmentNameSnapshot: deptNameSnapshot,
        date: dateStr,
        checkIn: currentTimeStr,

        imageIn: uploadRes.url,
        imageInId: uploadRes.fileId,
        locationIn: location,

        isOffsiteIn: finalIsOffsiteIn,
        isOffsiteInCoordinates:
          finalIsOffsiteIn === "1" ? location : null,

        workingStatusEnum: currentWorkingStatus,
        remark: finalRemark,

        isLate:
          currentWorkingStatus === "normal" && activeStartTime
            ? toMin(currentTimeStr) > toMin(activeStartTime)
              ? 1
              : 0
            : 0,

        lateMinutes:
          currentWorkingStatus === "normal" && activeStartTime
            ? (() => {
              let nowM = toMin(currentTimeStr);
              const startM = toMin(activeStartTime);

              if (nowM < 300 && startM > 1000) {
                nowM += 1440;
              }

              const diff = nowM - startM;

              return diff > 0 ? diff : 0;
            })()
            : 0,
      })
      .returning({
        id: attendanceTable.id,
      });

    if (!insertedAttendance?.id) {
      throw new Error(
        "บันทึกข้อมูลเข้างานล้มเหลว (No ID returned from database)"
      );
    }

    console.log("Check-in Insert Success:", insertedAttendance.id);

    // คำนวณ OT เริ่มต้น
    const otResult = calculateOvertime({
      checkIn: currentTimeStr,
      checkOut: currentTimeStr,
      shiftStart: activeStartTime,
      shiftEnd: activeEndTime,
      roundingMode: companyRounding,
    });

    // INSERT OT
    await db.insert(overtimeTable).values({
      userId: userId,
      userName: user.name || "Unknown",
      companyId: user.companyId || "",
      shiftId: activeShiftId,
      attendanceId: insertedAttendance.id,
      date: dateStr,

      // วันหยุดไม่ใช้ Before / After
      overtimeBefore: isDayOff ? 0 : otResult.beforeMinutes,
      overtimeOnDayOff: 0,

      otRoundingOption: companyRounding,
      status: "pending",
    });

    revalidatePath("/employee");
    revalidatePath("/leader");

    return {
      success: true,
      siteName: validatedSite.name,
      isOffsiteIn: finalIsOffsiteIn,
      attendanceId: insertedAttendance.id,
      requiresRemark: isRemarkActive,
    };
  } catch (error: any) {
    console.error("Check-in error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}


/* -------------------------------------------------------------------------- */
/* CHECKOUT ACTION (การออกงาน)                                                */
/* -------------------------------------------------------------------------- */

export async function checkOutAction(
  userId: string,
  base64Image: string,
  location: string,
  isConfirmed?: boolean
) {
  try {
    const now = new Date();

    const currentTimeStr = now.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Bangkok",
      hour12: false,
    });

    if (!location || typeof location !== "string" || !location.includes(",")) {
      throw new Error("พิกัดตำแหน่งไม่ถูกต้องหรือไม่ได้เปิด GPS");
    }

    const [lat, lon] = location.split(",").map(Number);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error("ข้อมูลพิกัดไม่ถูกต้อง");
    }

    const lastCheckIn = await db
      .select({
        attendance: attendanceTable,
        userName: usersTable.firstName,
        companyId: usersTable.companyId,
      })
      .from(attendanceTable)
      .leftJoin(usersTable, eq(attendanceTable.user_id, usersTable.id))
      .where(
        and(
          eq(attendanceTable.user_id, userId),
          isNull(attendanceTable.checkOut)
        )
      )
      .orderBy(desc(attendanceTable.createdAt))
      .limit(1);

    if (!lastCheckIn || lastCheckIn.length === 0) {
      return {
        success: false,
        error: "ไม่พบข้อมูลการเช็คอินที่ค้างอยู่",
      };
    }

    const row = lastCheckIn[0];
    const currentRecord = row.attendance;

    if (!currentRecord) {
      throw new Error("ข้อมูลการลงเวลาไม่ถูกต้อง");
    }

    const [companyData] = await db
      .select({
        otRoundingOption: companyTable.otRoundingOption,
      })
      .from(companyTable)
      .where(eq(companyTable.id, row.companyId || ""))
      .limit(1);

    const roundingMode =
      (companyData?.otRoundingOption as OTRoundingOption) || "ACTUAL";

    const userName = row.userName || "Unknown";
    const companyId = row.companyId || "";

    // ตรวจสอบพิกัดขาออก
    const locationValidation = await validateCheckOutLocation(
      userId,
      lat,
      lon,
      currentRecord
    );

    const isOffsiteOutValue =
      locationValidation.isOffsiteOut === "1" ? "1" : "0";

    if (locationValidation.OffsiteCheckOutConfirm && !isConfirmed) {
      return {
        success: false,
        offsite: true,
        siteName: locationValidation.siteOutName,
        OffsiteCheckOutConfirm: true,
      };
    }

    const checkInDate = currentRecord.date;
    const activeStartTime = currentRecord.shiftStartTimeSnapshot;
    const activeEndTime = currentRecord.shiftEndTimeSnapshot;

    // ตรวจวันหยุดจาก Snapshot ที่บันทึกตอน Check-in
    const isDayOff = isDayOffDate(
      checkInDate,
      currentRecord.dayOffSnapshot
    );

    let otResult;
    let overtimeOnDayOff = 0;

    if (isDayOff) {
      // วันหยุด: คิดเวลาทำงานจริงทั้งหมด ไม่ปัดเศษ
      overtimeOnDayOff = calculateDayOffMinutes(
        currentRecord.checkIn || "00:00",
        currentTimeStr
      );

      otResult = {
        beforeMinutes: 0,
        afterMinutes: 0,
        totalMinutes: overtimeOnDayOff,
      };
    } else if (currentRecord.workingStatusEnum === "extra") {
      // Logic เดิมสำหรับพนักงานที่เริ่มทำงานหลังเวลาเลิกกะ
      otResult = calculateOvertime({
        checkIn: currentRecord.checkIn || "00:00",
        checkOut: currentTimeStr,
        shiftStart: currentRecord.checkIn,
        shiftEnd: currentRecord.checkIn,
        roundingMode: roundingMode,
      });
    } else {
      // Logic เดิมสำหรับวันทำงานปกติ
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

    // คง Logic ตรวจสอบออกก่อนเวลาเดิม
    if (activeEndTime && currentRecord.workingStatusEnum !== "extra") {
      const [currH, currM] = currentTimeStr.split(":").map(Number);
      const [endH, endM] = (activeEndTime || "00:00").split(":").map(Number);
      const [inH, inM] = (currentRecord.checkIn || "00:00").split(":").map(Number);

      let currentTotalMinutes = currH * 60 + currM;
      let endTotalMinutes = endH * 60 + endM;
      const checkInTotalMinutes = inH * 60 + inM;

      if (endTotalMinutes < checkInTotalMinutes) {
        if (currentTotalMinutes < checkInTotalMinutes) {
          currentTotalMinutes += 1440;
        }

        endTotalMinutes += 1440;
      }

      if (currentTotalMinutes < endTotalMinutes) {
        isEarlyExit = 1;
        earlyExitMinutes = endTotalMinutes - currentTotalMinutes;
      }
    }

    const base64Data = base64Image.replace(
      /^data:image\/\w+;base64,/,
      ""
    );

    const buffer = Buffer.from(base64Data, "base64");

    const uploadRes = await uploadToDrive(
      buffer,
      `checkout_${userId}_${Date.now()}.png`,
      "image/png"
    );

    // UPDATE ATTENDANCE
    await db
      .update(attendanceTable)
      .set({
        checkOut: currentTimeStr,
        imageOut: uploadRes.ufsUrl || uploadRes.url,
        imageOutId: uploadRes.fileId,
        locationOut: location,

        isEarlyExit: isEarlyExit.toString(),
        earlyExitMinutes: earlyExitMinutes,

        isOffsiteOut: isOffsiteOutValue,
        isOffsiteOutCoordinates:
          isOffsiteOutValue === "1" ? location : null,
      })
      .where(eq(attendanceTable.id, currentRecord.id));

    // INSERT หรือ UPDATE OT
    if (checkInDate) {
      await db
        .insert(overtimeTable)
        .values({
          userId: userId,
          userName: userName,
          companyId: companyId,
          shiftId: currentRecord.shift_id || null,
          attendanceId: currentRecord.id,
          date: checkInDate,

          overtimeBefore: otResult.beforeMinutes,
          overtimeAfter: otResult.afterMinutes,
          overtimeOnDayOff: overtimeOnDayOff,
          overtimeCollected: otResult.totalMinutes,

          otRoundingOption: roundingMode,
          status: "pending",
        })
        .onConflictDoUpdate({
          target: [overtimeTable.attendanceId],
          set: {
            overtimeBefore: otResult.beforeMinutes,
            overtimeAfter: otResult.afterMinutes,
            overtimeOnDayOff: overtimeOnDayOff,
            overtimeCollected: otResult.totalMinutes,
            otRoundingOption: roundingMode,
          },
        });
    }

    console.log("CHECKOUT OT RESULT:", {
      attendanceId: currentRecord.id,
      date: checkInDate,
      dayOff: currentRecord.dayOffSnapshot,
      isDayOff,
      before: otResult.beforeMinutes,
      after: otResult.afterMinutes,
      onDayOff: overtimeOnDayOff,
      total: otResult.totalMinutes,
    });

    revalidatePath("/employee");
    revalidatePath("/leader");

    return {
      success: true,
      offsite: isOffsiteOutValue === "1",
      siteName:
        locationValidation.siteOutName ||
        currentRecord.siteInNameSnapshot ||
        "",
      otTotal: otResult.totalMinutes,
    };
  } catch (error: any) {
    console.error("Check-out error:", error);

    return {
      success: false,
      error: error.message,
    };
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
  startTime?: string | null; // เพิ่มรองรับเวลาเริ่มต้น
  endTime?: string | null;   // เพิ่มรองรับเวลาสิ้นสุด
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

    // --- 💡 Logic การคำนวณ Total Hours ---
    let totalHoursResult = 0;

    if (data.type === "ลาเป็นชั่วโมง" && data.startTime && data.endTime) {
      // กรณีลาเป็นชั่วโมง: คำนวณส่วนต่างชั่วโมงจากเวลาเริ่มต้น-สิ้นสุด
      const startDateTime = new Date(`${data.start}T${data.startTime}`);
      const endDateTime = new Date(`${data.end}T${data.endTime}`);

      const diffMs = endDateTime.getTime() - startDateTime.getTime();
      totalHoursResult = Math.floor(diffMs / (1000 * 60 * 60)); // ใส่ตัวเลขชั่วโมงเข้าไปเลย
    } else {
      // กรณีลาปกติ: คำนวณจำนวนวัน (สิ้นสุด - เริ่มต้น + 1) แล้วคูณด้วย 24
      const start = new Date(data.start);
      const end = new Date(data.end);

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      totalHoursResult = diffDays * 24; // จำนวนวันคูณ 24
    }

    // ป้องกันค่าที่ผิดพลาด
    if (totalHoursResult <= 0) throw new Error("ช่วงเวลาการลาไม่ถูกต้อง");
    // --------------------------------------------------

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
      startTime: data.startTime || null, // บันทึกเวลาเริ่มต้น
      endTime: data.endTime || null,     // บันทึกเวลาสิ้นสุด
      totalHours: totalHoursResult,      // ✅ บันทึกค่าชั่วโมงที่คำนวณได้
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
/* PERSONAL OT ACTIONS (OT ส่วนตัว)                                           */
/* -------------------------------------------------------------------------- */

type DayOffOption =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "saturday_sunday";

function isWeeklyDayOff(
  date: string,
  dayOff: DayOffOption | null
): boolean {
  if (!dayOff) return false;

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("วันที่สำหรับตรวจสอบวันหยุดไม่ถูกต้อง");
  }

  const weekdays: DayOffOption[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  const weekday = weekdays[parsed.getUTCDay()];

  if (dayOff === "saturday_sunday") {
    return weekday === "saturday" || weekday === "sunday";
  }

  return weekday === dayOff;
}

export async function createPersonalOTAction(payload: {
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
  isAfterMidnight: boolean;
}) {
  try {
    if (!payload.userId) {
      throw new Error("ไม่พบรหัสพนักงาน (Missing User ID)");
    }

    if (typeof payload.isAfterMidnight !== "boolean") {
      throw new Error("ข้อมูลประเภท OT ไม่ถูกต้อง");
    }

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

    if (!user) {
      throw new Error(`ไม่พบข้อมูลพนักงานในระบบ (ID: ${payload.userId})`);
    }

    // ดึงกะล่าสุดของพนักงานจาก DB
    const latestShift = await db.query.shiftsTable.findFirst({
      where: eq(shiftsTable.userId, user.id),
      orderBy: (shifts, { desc }) => [desc(shifts.createdAt)],
    });

    if (!latestShift) {
      throw new Error("ไม่พบข้อมูลกะพนักงานสำหรับตรวจสอบวันหยุด");
    }

    // ตรวจสอบรูปแบบเวลา
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (
      !timeRegex.test(payload.startTime) ||
      !timeRegex.test(payload.endTime)
    ) {
      throw new Error("รูปแบบเวลา OT ไม่ถูกต้อง");
    }

    // คำนวณระยะเวลา OT
    const [startH, startM] = payload.startTime.split(":").map(Number);
    const [endH, endM] = payload.endTime.split(":").map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes === endMinutes) {
      throw new Error("เวลาเริ่มต้นและสิ้นสุดต้องไม่ตรงกัน");
    }

    // ตรวจสอบประเภท OT หลังเที่ยงคืนฝั่ง Server อีกครั้ง
    if (payload.isAfterMidnight) {
      const isStartAfterMidnight =
        startMinutes >= 0 && startMinutes <= 360;

      const isEndAfterMidnight =
        endMinutes >= 0 && endMinutes <= 360;

      if (
        !isStartAfterMidnight ||
        !isEndAfterMidnight ||
        endMinutes <= startMinutes
      ) {
        throw new Error("ช่วงเวลา OT หลังเที่ยงคืนไม่ถูกต้อง");
      }
    } else if (endMinutes < startMinutes) {
      throw new Error("เวลา OT ไม่ถูกต้อง กรุณาตรวจสอบประเภท OT หลังเที่ยงคืน");
    }

    let totalMinutes = endMinutes - startMinutes;

    if (totalMinutes < 0) {
      totalMinutes += 1440;
    }

    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
      throw new Error("ช่วงเวลา OT ไม่ถูกต้อง");
    }

    // วันที่ที่ผู้ใช้เลือกจาก UI
    const [year, month, day] = payload.date.split("-").map(Number);

    const selectedDate = new Date(Date.UTC(year, month - 1, day));

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      selectedDate.getUTCFullYear() !== year ||
      selectedDate.getUTCMonth() !== month - 1 ||
      selectedDate.getUTCDate() !== day
    ) {
      throw new Error("วันที่ OT ไม่ถูกต้อง");
    }

    // วันที่สำหรับบันทึกใน DB
    // ถ้าเป็น OT ข้ามเที่ยงคืน ให้ย้อนหลัง 1 วัน
    const dbDate = new Date(selectedDate);

    if (payload.isAfterMidnight === true) {
      dbDate.setUTCDate(dbDate.getUTCDate() - 1);
    }

    const dbDateString = [
      dbDate.getUTCFullYear(),
      String(dbDate.getUTCMonth() + 1).padStart(2, "0"),
      String(dbDate.getUTCDate()).padStart(2, "0"),
    ].join("-");

    // ตรวจสอบวันหยุดประจำสัปดาห์จาก DB
    // ใช้วันที่ dbDateString เป็นวันที่อ้างอิง
    const isOtDayOff = isWeeklyDayOff(
      dbDateString,
      latestShift.dayOff
    );

    console.log("PERSONAL OT INSERT DEBUG:", {
      selectedDate: payload.date,
      databaseDate: dbDateString,
      isAfterMidnight: payload.isAfterMidnight,
      startTime: payload.startTime,
      endTime: payload.endTime,
      totalMinutes,
      shiftDayOff: latestShift.dayOff,
      isOtDayOff,
    });

    // บันทึกคำขอ OT
    const newRequest = await db
      .insert(overtimeRequestsTable)
      .values({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        companyId: user.companyId,
        departmentId: user.departmentId,
        siteId: user.site_id,
        shiftId: latestShift.id,

        overtimeByRequest: totalMinutes,
        timeStart: payload.startTime,
        timeEnd: payload.endTime,

        // วันที่บันทึกใน DB
        date: dbDateString,

        // ประเภท OT ที่ผู้ใช้เลือก
        isAfterMidnight: payload.isAfterMidnight,

        // ผลการตรวจสอบวันหยุดจาก DB
        isDayOffOt: isOtDayOff,

        requestedWorkers: [user.id],
        reason: payload.reason,
        status: "pending",
        createdBy: user.id,
        createdAt: new Date(),
      })
      .returning();

    revalidatePath("/dashboard/ot-status");
    revalidatePath("/employee");
    revalidatePath("/leader");

    return {
      success: true,
      message: "ส่งคำขอ OT รายบุคคลเรียบร้อยแล้ว",
      data: newRequest[0],
    };

  } catch (error: any) {
    console.error("PERSONAL_OT_ERROR_DETAIL:", error);

    return {
      success: false,
      error:
        "ส่งคำขอ OT ล้มเหลว: " +
        (error.message || "Database Constraint Error"),
    };
  }
}
