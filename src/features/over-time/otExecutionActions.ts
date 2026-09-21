// @/lib/over-time/otExecutionActions.ts

"use server";

import { db } from "@/db/db";
import {
  overtimeTable,
  overtimeRequestsTable,
  automationLogTable,
  attendanceTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * API: Execute OT (คัดกรองและบันทึกยอดสรุป)
 * @param attendanceId - ID จากตารางบันทึกเวลา
 * @param adminId - ID ของผู้ที่กดยืนยันรายการนี้
 */
export async function executeOTAction(
  attendanceId: string,
  adminId: string
) {
  const startTime = new Date();
  const todayDate = startTime.toISOString().split("T")[0];
  let logId: string | null = null;

  try {
    // --- [บันทึก Log เริ่มต้น] ---
    const [log] = await db
      .insert(automationLogTable)
      .values({
        jobName: "manual-ot-execution",
        date: todayDate,
        startAt: startTime,
        status: "success",
        retryCount: 0,
      })
      .returning({ id: automationLogTable.id });

    logId = log.id;

    // 1. ดึง OT ตัวที่ถูกเลือก
    // ใช้ attendanceId ที่ส่งเข้ามาเพื่อหา userId + date
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
      throw new Error("ไม่พบ OT ที่เป็น pending");
    }

    // 2. หา Attendance ทั้งหมดของ User + Date เดียวกัน
    const attendances = await db
      .select({
        id: attendanceTable.id,
        userId: attendanceTable.user_id,
        date: attendanceTable.date,
      })
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.user_id, rawOT.userId!),
          eq(attendanceTable.date, rawOT.date!)
        )
      );

    console.log("ATTENDANCES:", {
      count: attendances.length,
      items: attendances.map((attendance) => ({
        attendanceId: attendance.id,
        userId: attendance.userId,
        date: attendance.date,
      })),
    });

    if (attendances.length === 0) {
      throw new Error(
        "ไม่พบ Attendance ของ User และวันที่นี้"
      );
    }

    // 3. Loop หา OT จาก attendanceId ของแต่ละ Attendance
    const rawOTs: (typeof rawOT)[] = [];

    for (const attendance of attendances) {
      const [ot] = await db
        .select()
        .from(overtimeTable)
        .where(
          and(
            eq(overtimeTable.attendanceId, attendance.id),
            eq(overtimeTable.status, "pending")
          )
        )
        .limit(1);

      console.log("FIND OT BY ATTENDANCE:", {
        attendanceId: attendance.id,
        found: !!ot,
        otId: ot?.id ?? null,
      });

      if (ot) {
        rawOTs.push(ot);
      }
    }

    console.log("RAW OTS:", {
      count: rawOTs.length,
      items: rawOTs.map((ot) => ({
        id: ot.id,
        attendanceId: ot.attendanceId,
        userId: ot.userId,
        date: ot.date,
        status: ot.status,
        timeStart: ot.timeStart,
        timeEnd: ot.timeEnd,
      })),
    });

    if (rawOTs.length === 0) {
      throw new Error(
        "ไม่พบ OT ที่เป็น pending ของ Attendance ใน User และวันที่นี้"
      );
    }

    // 4. ดึง Request approved ทั้งหมดของ User + Date เดียวกัน
    const requests = await db
      .select()
      .from(overtimeRequestsTable)
      .where(
        and(
          eq(
            overtimeRequestsTable.userId,
            rawOT.userId!
          ),
          eq(
            overtimeRequestsTable.date,
            rawOT.date!
          ),
          eq(
            overtimeRequestsTable.status,
            "approved"
          )
        )
      );

    console.log("REQUESTS:", {
      count: requests.length,
      items: requests.map((request) => ({
        id: request.id,
        overtimeByRequest:
          request.overtimeByRequest,
        status: request.status,
      })),
    });

    if (requests.length === 0) {
      throw new Error(
        "ไม่พบ request ที่ approved และตรงวัน"
      );
    }

    // แปลง HH:mm เป็นนาที
    const toMinutes = (time: string) => {
      const [hours, minutes] = time
        .split(":")
        .map(Number);

      return hours * 60 + minutes;
    };

    const shiftStartMinutes = toMinutes("08:30");

    /**
     * คำนวณ OT ของแต่ละรายการ
     */
    const calculateTargetOT = (ot: typeof rawOT) => {
      const timeStart = String(ot.timeStart || "")
        .trim()
        .substring(0, 5);

      const timeEnd = String(ot.timeEnd || "")
        .trim()
        .substring(0, 5);

      const otBefore = Number(
        ot.overtimeBefore || 0
      );

      const otAfter = Number(
        ot.overtimeAfter || 0
      );

      let targetOtMinutes = 0;

      if (timeStart !== "" && timeEnd !== "") {
        const startMinutes = toMinutes(timeStart);
        const endMinutes = toMinutes(timeEnd);

        // กรณีข้ามเที่ยงคืน
        // 21:00 -> 00:00 = 180 นาที
        // 21:00 -> 02:00 = 300 นาที
        if (endMinutes < startMinutes) {
          targetOtMinutes =
            24 * 60 -
            startMinutes +
            endMinutes;
        }

        // กรณี OT ก่อนเริ่มงาน
        else if (
          startMinutes < shiftStartMinutes &&
          endMinutes <= shiftStartMinutes
        ) {
          targetOtMinutes = otBefore;
        }

        // กรณี OT หลังเลิกงาน
        else if (
          startMinutes >= shiftStartMinutes &&
          endMinutes > shiftStartMinutes
        ) {
          targetOtMinutes = otAfter;
        }

        // กรณีอื่น ใช้ค่าที่ระบบคำนวณไว้เดิม
        else {
          targetOtMinutes =
            otBefore > 0
              ? otBefore
              : otAfter;
        }
      }

      return {
        targetOtMinutes,
        rawMinutes: otBefore + otAfter,
      };
    };

    // 5. เตรียม Request สำหรับการจัดสรร
    const requestPool = requests.map(
      (request) => ({
        request,
        remainingMinutes: Number(
          request.overtimeByRequest || 0
        ),
      })
    );

    const updatedOTs: typeof rawOTs = [];
    const executedRequestIds: string[] = [];

    let totalRawMinutes = 0;
    let totalApprovedMinutes = 0;

    // 6. Loop OT ทุก attendanceId
    for (const ot of rawOTs) {
      console.log("PROCESS OT:", {
        id: ot.id,
        attendanceId: ot.attendanceId,
        userId: ot.userId,
        date: ot.date,
      });

      const {
        targetOtMinutes,
        rawMinutes,
      } = calculateTargetOT(ot);

      totalRawMinutes += rawMinutes;

      let remainingOTMinutes =
        targetOtMinutes;

      // จำนวนที่ OT รายการนี้ได้รับอนุมัติ
      let approvedMinutes = 0;

      // ใช้ Request ตามลำดับ
      for (const requestItem of requestPool) {
        if (
          remainingOTMinutes <= 0 ||
          requestItem.remainingMinutes <= 0
        ) {
          continue;
        }

        const allocatedMinutes =
          Math.min(
            remainingOTMinutes,
            requestItem.remainingMinutes
          );

        approvedMinutes += allocatedMinutes;

        remainingOTMinutes -=
          allocatedMinutes;

        requestItem.remainingMinutes -=
          allocatedMinutes;

        // Request ถูกใช้หมดแล้ว
        if (
          requestItem.remainingMinutes === 0
        ) {
          executedRequestIds.push(
            requestItem.request.id
          );
        }
      }

      totalApprovedMinutes +=
        approvedMinutes;

      console.log("BEFORE UPDATE:", {
        id: ot.id,
        attendanceId: ot.attendanceId,
        approvedMinutes,
        targetOtMinutes,
        rawMinutes,
      });

      // 7. Update OT แต่ละรายการ
      const [updated] = await db
        .update(overtimeTable)
        .set({
          overtimeApproved: approvedMinutes,
          status: "approved",
        })
        .where(
          and(
            eq(overtimeTable.id, ot.id),
            eq(
              overtimeTable.status,
              "pending"
            )
          )
        )
        .returning();

      console.log("AFTER UPDATE:", {
        id: ot.id,
        attendanceId: ot.attendanceId,
        updated: !!updated,
      });

      if (!updated) {
        throw new Error(
          `OT ${ot.id} ถูก process ไปแล้ว (race condition)`
        );
      }

      updatedOTs.push(updated);
    }

    // 8. ปิด Request ที่ถูกใช้จนหมด
    for (const requestId of executedRequestIds) {
      await db
        .update(overtimeRequestsTable)
        .set({
          status: "executed" as any,
        })
        .where(
          eq(
            overtimeRequestsTable.id,
            requestId
          )
        );
    }

    // --- [บันทึก Log จบงานสำเร็จ] ---
    if (logId) {
      const endTime = new Date();

      await db
        .update(automationLogTable)
        .set({
          endAt: endTime,
          durationMs:
            endTime.getTime() -
            startTime.getTime(),
          readCount:
            attendances.length +
            rawOTs.length +
            requests.length,
          changeCount:
            updatedOTs.length +
            executedRequestIds.length,
          executedCount:
            updatedOTs.length,
          details: {
            attendanceId,
            rawMinutes:
              totalRawMinutes,
            approvedMinutes:
              totalApprovedMinutes,
            attendanceCount:
              attendances.length,
            processedOTCount:
              updatedOTs.length,
            processedRequestCount:
              executedRequestIds.length,
            adminId,
          },
        })
        .where(
          eq(
            automationLogTable.id,
            logId
          )
        );
    }

    revalidatePath(
      "/admin/ot-management"
    );

    return {
      success: true,
      data: {
        rawMinutes:
          totalRawMinutes,
        approvedMinutes:
          totalApprovedMinutes,
        processedOTCount:
          updatedOTs.length,
        processedRequestCount:
          executedRequestIds.length,
        userName:
          rawOT.userName,
      },
    };
  } catch (error: any) {
    // --- [บันทึก Log กรณีพัง] ---
    if (logId) {
      await db
        .update(automationLogTable)
        .set({
          status: "fault",
          details: {
            error: error.message,
            attendanceId,
          },
        })
        .where(
          eq(
            automationLogTable.id,
            logId
          )
        );
    }

    console.error(
      "OT Execution Failed:",
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}