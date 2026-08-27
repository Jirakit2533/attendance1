// @/lib/over-time/otExecutionActions.ts

"use server";

import { db } from "@/db/db";
import { overtimeTable, overtimeRequestsTable, automationLogTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * API: Execute OT (คัดกรองและบันทึกยอดสรุป)
 * @param attendanceId - ID จากตารางบันทึกเวลา
 * @param adminId - ID ของผู้ที่กดยืนยันรายการนี้
 */
export async function executeOTAction(attendanceId: string, adminId: string) {
  const startTime = new Date();
  const todayDate = startTime.toISOString().split('T')[0];
  let logId: string | null = null;

  try {
    // --- [บันทึก Log เริ่มต้น] ---
    const [log] = await db.insert(automationLogTable).values({
      jobName: "manual-ot-execution",
      date: todayDate,
      startAt: startTime,
      status: "success",
      retryCount: 0,
    }).returning({ id: automationLogTable.id });
    logId = log.id;

    // 1. ดึง OT ที่ยัง pending เท่านั้น
    const [rawOT] = await db
      .select()
      .from(overtimeTable)
      .where(
        and(
          eq(overtimeTable.attendanceId, attendanceId),
          eq(overtimeTable.status, "pending")
        )
      )
      .limit(1);

    if (!rawOT) {
      throw new Error("⚠️ ไม่พบ OT ที่เป็น pending");
    }

    // 2. หา request โดยเทียบ “วัน”
    const requests = await db
      .select()
      .from(overtimeRequestsTable)
      .where(
        and(
          eq(overtimeRequestsTable.userId, rawOT.userId!),
          eq(overtimeRequestsTable.date, rawOT.date!),
          eq(overtimeRequestsTable.status, "approved")
        )
      );

    if (requests.length === 0) {
      throw new Error("⚠️ ไม่พบ request ที่ approved และตรงวัน");
    }

    if (requests.length > 1) {
      throw new Error("❌ พบ request ซ้ำในวันเดียว (data คุณพัง)");
    }

    const requestOT = requests[0];

    // --- 3. คำนวณ OT ตาม Logic ช่วงเวลาและคำขอ ---
    const shiftStartTime = "08:30"; // เวลาเริ่มงานปกติ
    const timeStart = String(rawOT.timeStart || "").trim().substring(0, 5);
    const timeEnd = String(rawOT.timeEnd || "").trim().substring(0, 5);

    const otBefore = Number(rawOT.overtimeBefore || 0);
    const otAfter = Number(rawOT.overtimeAfter || 0);
    const requestedMinutes = Number(requestOT.overtimeByRequest || 0);

    // เลือก OT ตามช่วงเวลานาฬิกา
    let targetOtMinutes = 0;
    if (timeStart !== "" && timeEnd !== "" && timeStart < shiftStartTime && timeEnd < shiftStartTime) {
      // เวลาสแกนอยู่ก่อนเวลาเริ่มงานปกติ -> ใช้ OT ก่อนเริ่มงาน
      targetOtMinutes = otBefore;
    } else if (timeStart !== "" && timeEnd !== "" && timeStart > shiftStartTime && timeEnd > shiftStartTime) {
      // เวลาสแกนอยู่หลังเวลาเริ่มงานปกติ -> ใช้ OT หลังเลิกงาน
      targetOtMinutes = otAfter;
    } else {
      // กรณีเวลาคาบเกี่ยว (Fallback)
      targetOtMinutes = otBefore > 0 ? otBefore : otAfter;
    }

    // เปรียบเทียบกับ overtimeByRequest
    let finalizedMinutes = 0;
    if (targetOtMinutes < requestedMinutes) {
      finalizedMinutes = targetOtMinutes;
    } else {
      finalizedMinutes = requestedMinutes;
    }

    const totalRawMinutes = otBefore + otAfter;

    // 4. update OT
    const updated = await db
      .update(overtimeTable)
      .set({
        overtimeApproved: finalizedMinutes,
        status: "approved",
      })
      .where(
        and(
          eq(overtimeTable.id, rawOT.id),
          eq(overtimeTable.status, "pending")
        )
      )
      .returning();

    if (updated.length === 0) {
      throw new Error("❌ OT ถูก process ไปแล้ว (race condition)");
    }

    // 5. ปิด request
    await db
      .update(overtimeRequestsTable)
      .set({ status: "executed" as any })
      .where(eq(overtimeRequestsTable.id, requestOT.id));

    // --- [บันทึก Log จบงานสำเร็จ] ---
    if (logId) {
      const endTime = new Date();
      await db.update(automationLogTable).set({
        endAt: endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        readCount: 1,
        changeCount: 1,
        executedCount: 1,
        details: { 
          attendanceId, 
          rawMinutes: totalRawMinutes, 
          approvedMinutes: finalizedMinutes,
          adminId 
        },
      }).where(eq(automationLogTable.id, logId));
    }

    revalidatePath("/admin/ot-management");

    return {
      success: true,
      data: {
        rawMinutes: totalRawMinutes,
        approvedMinutes: finalizedMinutes,
        userName: rawOT.userName,
      },
    };

  } catch (error: any) {
    // --- [บันทึก Log กรณีพัง] ---
    if (logId) {
      await db.update(automationLogTable).set({
        status: "fault",
        details: { error: error.message, attendanceId },
      }).where(eq(automationLogTable.id, logId));
    }

    console.error("❌ OT Execution Failed:", error.message);

    return {
      success: false,
      error: error.message,
    };
  }
}